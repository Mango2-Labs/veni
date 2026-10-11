// Verified hosts: the check beside a trusted host's name. Only Veni's admin wallet changes the list.
import { address, isAddress, type Address } from "@solana/kit";
import { verifiedHostMessage, type VerifiedHostInput } from "@veni/sdk";
import { getDatabase } from "./db";
import { checkSignedAt, isSignedBy } from "./host-signature";

/** Veni's deploy wallet, which also upgrades the program. */
const VENI_ADMIN = address("FduPpewZj737R4W5Qng1F4virjANaa4h4XZTJenLx8bS");
const NAME_LIMIT = 64;

/** Adds or removes a host, if Veni's admin signed it. Throws a readable message. */
export async function saveVerifiedHost(
  input: VerifiedHostInput & { signature: string },
  { now = Date.now(), admin = VENI_ADMIN }: { now?: number; admin?: Address } = {},
) {
  if (!isAddress(input.wallet)) throw new Error("That isn't a wallet address.");
  const name = input.name.trim();
  if (!name || name.length > NAME_LIMIT) throw new Error(`Name the host in 1 to ${NAME_LIMIT} characters.`);
  checkSignedAt(input.signedAt, now, "the verified host");
  if (!(await isSignedBy(admin, input.signature, verifiedHostMessage(input)))) throw new Error("Only Veni can verify hosts.");
  const signedAt = new Date(input.signedAt).toISOString();
  const db = await getDatabase();
  // A removal stays as a row, and older signatures never win, so replaying one can't undo a newer change.
  await db.query(
    `INSERT INTO verified_hosts (wallet, name, is_verified, signed_at, signature) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (wallet) DO UPDATE SET
       name = EXCLUDED.name, is_verified = EXCLUDED.is_verified, signed_at = EXCLUDED.signed_at, signature = EXCLUDED.signature
       WHERE verified_hosts.signed_at < EXCLUDED.signed_at`,
    [input.wallet, name, input.isVerified, signedAt, input.signature],
  );
}

/** Which of these wallets are verified hosts. */
export async function getVerifiedHosts(wallets: Address[]): Promise<Address[]> {
  if (wallets.length === 0) return [];
  const db = await getDatabase();
  const rows = await db.query<{ wallet: Address }>("SELECT wallet FROM verified_hosts WHERE wallet = ANY($1) AND is_verified", [wallets]);
  return rows.map((row) => row.wallet);
}
