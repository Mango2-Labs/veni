// Usernames: saved only when the wallet's own signature checks out, and only
// while no other wallet holds the name. A wallet changes its username at most
// once every 24 hours, and a name given up stays reserved for 24 hours, so
// nobody can take it straight away and pass as its old owner.
import { address, getPublicKeyFromAddress, getUtf8Encoder, isAddress, verifySignature, type Address, type SignatureBytes } from "@solana/kit";
import { normalizeUsername, USERNAME_CHANGE_HOURS, usernameMessage, usernameProblem, type UsernameInput } from "../usernames";
import { getDatabase } from "./db";

/** How old a signature may be: long enough to approve, too short to replay. */
const MAX_SIGNATURE_AGE_MS = 10 * 60 * 1000;
/** How far ahead of the server's clock a browser's clock may run. */
const MAX_CLOCK_AHEAD_MS = 2 * 60 * 1000;
/** Most wallets one lookup answers for. */
export const MAX_WALLETS_PER_LOOKUP = 100;
/** Between a wallet's username changes, and how long a given-up name stays reserved. */
const CHANGE_INTERVAL_MS = USERNAME_CHANGE_HOURS * 60 * 60 * 1000;

/** Checks the signature and saves the username, replacing the wallet's old one. Throws a readable message. */
export async function claimUsername(input: UsernameInput & { signature: string }, now = Date.now()): Promise<string> {
  if (!isAddress(input.wallet)) throw new Error("That isn't a wallet address.");
  const username = normalizeUsername(input.username);
  if (username !== input.username) throw new Error("Send the username in lowercase, without the @.");
  const problem = usernameProblem(username);
  if (problem) throw new Error(problem);
  const signedAt = Date.parse(input.signedAt);
  if (Number.isNaN(signedAt) || now - signedAt > MAX_SIGNATURE_AGE_MS || signedAt - now > MAX_CLOCK_AHEAD_MS) {
    throw new Error("That signature is too old. Sign again to save your username.");
  }

  const signature = Uint8Array.from(Buffer.from(input.signature, "base64"));
  if (signature.length !== 64) throw new Error("That isn't a wallet signature.");
  const message = getUtf8Encoder().encode(usernameMessage({ ...input, username }));
  const publicKey = await getPublicKeyFromAddress(address(input.wallet));
  if (!(await verifySignature(publicKey, signature as SignatureBytes, message))) {
    throw new Error("The signature doesn't match this wallet. Sign again with the wallet you signed in with.");
  }

  const current = await getUsername(input.wallet);
  if (current?.username === username) return username;
  if (current && now < current.changeableAt) {
    throw new Error(`You can change your username once every ${USERNAME_CHANGE_HOURS} hours. Try again after ${timeOf(current.changeableAt)}.`);
  }
  const reservedUntil = await reservedUntilFor(username, input.wallet, now);
  if (reservedUntil) throw new Error(`That username was given up recently. It's free after ${timeOf(reservedUntil)}.`);

  const db = await getDatabase();
  let rows: { username: string }[];
  try {
    // A newer signature always wins, so replaying an old one can't roll a name back.
    rows = await db.query<{ username: string }>(
      `INSERT INTO usernames (wallet, username, signed_at, signature, claimed_at) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (wallet) DO UPDATE SET
         username = EXCLUDED.username, signed_at = EXCLUDED.signed_at, signature = EXCLUDED.signature, claimed_at = EXCLUDED.claimed_at
         WHERE usernames.signed_at < EXCLUDED.signed_at
       RETURNING username`,
      [input.wallet, username, new Date(signedAt).toISOString(), input.signature, new Date(now).toISOString()],
    );
  } catch (error) {
    if (isUniqueViolation(error)) throw new Error("That username is taken.");
    throw error;
  }
  if (rows.length === 0) throw new Error("A newer username is already saved for this wallet.");
  if (current) {
    await db.query(
      `INSERT INTO released_usernames (username, wallet, released_at) VALUES ($1, $2, $3)
       ON CONFLICT (username) DO UPDATE SET wallet = EXCLUDED.wallet, released_at = EXCLUDED.released_at`,
      [current.username, input.wallet, new Date(now).toISOString()],
    );
  }
  return rows[0].username;
}

/** A wallet's username, and when it may next change (milliseconds since 1970). */
export async function getUsername(wallet: Address): Promise<{ username: string; changeableAt: number } | undefined> {
  const db = await getDatabase();
  const rows = await db.query<{ username: string; claimed_at: string | Date }>(
    "SELECT username, claimed_at FROM usernames WHERE wallet = $1",
    [wallet],
  );
  if (!rows[0]) return undefined;
  return { username: rows[0].username, changeableAt: new Date(rows[0].claimed_at).getTime() + CHANGE_INTERVAL_MS };
}

/** Each wallet's username, for the wallets that have one. */
export async function getUsernames(wallets: Address[]): Promise<Record<string, string>> {
  const unique = [...new Set(wallets)];
  if (unique.length === 0) return {};
  const db = await getDatabase();
  const placeholders = unique.map((_, index) => `$${index + 1}`).join(", ");
  const rows = await db.query<{ wallet: string; username: string }>(
    `SELECT wallet, username FROM usernames WHERE wallet IN (${placeholders})`,
    unique,
  );
  return Object.fromEntries(rows.map(({ wallet, username }) => [wallet, username]));
}

/** Why `wallet` can't have `username` now, or undefined when it can. */
export async function usernameUnavailableReason(username: string, wallet: string | undefined, now = Date.now()) {
  const db = await getDatabase();
  const holders = await db.query<{ wallet: string }>("SELECT wallet FROM usernames WHERE username = $1", [username]);
  if (holders[0] && holders[0].wallet !== wallet) return "That username is taken.";
  const reservedUntil = await reservedUntilFor(username, wallet, now);
  if (reservedUntil) return `That username was given up recently. It's free after ${timeOf(reservedUntil)}.`;
  return undefined;
}

/** When a name another wallet gave up becomes free, if it's still reserved. Its old owner may take it back. */
async function reservedUntilFor(username: string, wallet: string | undefined, now: number) {
  const db = await getDatabase();
  const rows = await db.query<{ wallet: string; released_at: string | Date }>(
    "SELECT wallet, released_at FROM released_usernames WHERE username = $1",
    [username],
  );
  if (!rows[0] || rows[0].wallet === wallet) return undefined;
  const freeAt = new Date(rows[0].released_at).getTime() + CHANGE_INTERVAL_MS;
  return now < freeAt ? freeAt : undefined;
}

/** "Oct 11, 1:16 PM UTC". */
function timeOf(time: number) {
  const at = new Date(time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  return `${at} UTC`;
}

/** Postgres and PGlite both report a duplicate unique key as 23505. */
function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "23505";
}
