// Hosts Veni has checked, such as Solana Foundation or Superteam. Each change is
// signed by Veni's admin wallet; the site keeps the list.
import type { Address } from "@solana/kit";

export type VerifiedHostInput = {
  wallet: Address;
  /** Who the wallet belongs to, for Veni's own records. */
  name: string;
  /** False takes the check away. */
  isVerified: boolean;
  /** ISO 8601. Signatures expire after a few minutes. */
  signedAt: string;
};

export function verifiedHostMessage({ wallet, name, isVerified, signedAt }: VerifiedHostInput) {
  return ["Veni verified host", `Wallet: ${wallet}`, `Name: ${name}`, `Verified: ${isVerified ? "yes" : "no"}`, `Signed at: ${signedAt}`].join("\n");
}
