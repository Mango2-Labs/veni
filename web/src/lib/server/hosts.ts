// Host profiles: saved only when the wallet's own signature checks out.
import { address, getPublicKeyFromAddress, getUtf8Encoder, isAddress, verifySignature, type Address, type SignatureBytes } from "@solana/kit";
import { fitBytes, isLumaSlug } from "../events";
import { HOST_NAME_LIMIT, hostProfileMessage, type HostProfile, type HostProfileInput } from "../host-profile";
import { getDatabase } from "./db";

/** How old a signature may be: long enough to approve, too short to replay. */
const MAX_SIGNATURE_AGE_MS = 10 * 60 * 1000;
/** How far ahead of the server's clock a browser's clock may run. */
const MAX_CLOCK_AHEAD_MS = 2 * 60 * 1000;

/** Checks the signature and saves the profile. Throws a readable message. */
export async function registerHost(input: HostProfileInput & { signature: string }, now = Date.now()): Promise<HostProfile> {
  if (!isAddress(input.wallet)) throw new Error("That isn't a wallet address.");
  const name = input.name.trim();
  if (!name) throw new Error("Add the name guests know you by.");
  if (fitBytes(name, HOST_NAME_LIMIT) !== name) throw new Error(`The name is too long: ${HOST_NAME_LIMIT} characters at most.`);
  const lumaCalendar = input.lumaCalendar.trim();
  if (lumaCalendar && !isLumaSlug(lumaCalendar)) throw new Error("That isn't a Luma calendar. Use the part after luma.com/, like superteam.");
  const signedAt = Date.parse(input.signedAt);
  if (Number.isNaN(signedAt) || now - signedAt > MAX_SIGNATURE_AGE_MS || signedAt - now > MAX_CLOCK_AHEAD_MS) {
    throw new Error("That signature is too old. Sign again to save your profile.");
  }

  const signature = Uint8Array.from(Buffer.from(input.signature, "base64"));
  if (signature.length !== 64) throw new Error("That isn't a wallet signature.");
  const message = getUtf8Encoder().encode(hostProfileMessage({ ...input, name, lumaCalendar }));
  const publicKey = await getPublicKeyFromAddress(address(input.wallet));
  if (!(await verifySignature(publicKey, signature as SignatureBytes, message))) {
    throw new Error("The signature doesn't match this wallet. Sign again with the wallet you host from.");
  }

  const db = await getDatabase();
  // A newer signature always wins, so replaying an old one can't roll a profile back.
  const rows = await db.query<HostRow>(
    `INSERT INTO hosts (wallet, name, luma_calendar, signed_at, signature) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (wallet) DO UPDATE SET
       name = EXCLUDED.name, luma_calendar = EXCLUDED.luma_calendar, signed_at = EXCLUDED.signed_at, signature = EXCLUDED.signature
       WHERE hosts.signed_at < EXCLUDED.signed_at
     RETURNING wallet, name, luma_calendar, registered_at`,
    [input.wallet, name, lumaCalendar, new Date(signedAt).toISOString(), input.signature],
  );
  if (rows.length === 0) throw new Error("A newer version of this profile is already saved.");
  return toProfile(rows[0]);
}

export async function getHost(wallet: Address): Promise<HostProfile | undefined> {
  const db = await getDatabase();
  const rows = await db.query<HostRow>("SELECT wallet, name, luma_calendar, registered_at FROM hosts WHERE wallet = $1", [wallet]);
  return rows[0] ? toProfile(rows[0]) : undefined;
}

type HostRow = { wallet: string; name: string; luma_calendar: string; registered_at: string | Date };

function toProfile(row: HostRow): HostProfile {
  return {
    wallet: row.wallet as Address,
    name: row.name,
    lumaCalendar: row.luma_calendar,
    registeredAt: new Date(row.registered_at).toISOString(),
  };
}
