// Profile photos: square JPEGs, signed by the wallet like usernames, so only its owner can set one.
import type { Address } from "@solana/kit";

export const PHOTO_SIZE = 256;
export const PHOTO_MAX_BYTES = 100_000;

export type PhotoInput = {
  wallet: Address;
  /** The JPEG's SHA-256, lowercase hex. */
  sha256: string;
  /** ISO 8601. Signatures expire after a few minutes. */
  signedAt: string;
};

export function photoMessage({ wallet, sha256, signedAt }: PhotoInput) {
  return ["Veni profile photo", `Wallet: ${wallet}`, `Photo SHA-256: ${sha256}`, `Signed at: ${signedAt}`].join("\n");
}

export async function sha256Hex(bytes: Uint8Array<ArrayBuffer>) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Each new photo gets a new `version`, so a photo's address can be cached for good. */
export function photoPath(wallet: string, version: number) {
  return `/api/photos/${wallet}?v=${version}`;
}
