// Profile photos: saved only when the wallet signed this exact JPEG, and served from Postgres.
import { address, getPublicKeyFromAddress, getUtf8Encoder, isAddress, verifySignature, type Address, type SignatureBytes } from "@solana/kit";
import { PHOTO_MAX_BYTES, photoMessage, sha256Hex, type PhotoInput } from "@veni/sdk";
import { getDatabase } from "./db";

const MAX_SIGNATURE_AGE_MS = 10 * 60 * 1000;
const MAX_CLOCK_AHEAD_MS = 2 * 60 * 1000;

/** Checks the photo and signature, then saves it as the wallet's photo. Returns its version. Throws a readable message. */
export async function savePhoto(input: PhotoInput & { image: string; signature: string }, now = Date.now()): Promise<number> {
  if (!isAddress(input.wallet)) throw new Error("That isn't a wallet address.");
  const image = Uint8Array.from(Buffer.from(input.image, "base64"));
  if (image.length === 0 || image.length > PHOTO_MAX_BYTES) throw new Error("Use a photo under 100 KB.");
  // A JPEG starts with FF D8 FF and ends with FF D9.
  const isJpeg = image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff && image.at(-2) === 0xff && image.at(-1) === 0xd9;
  if (!isJpeg) throw new Error("Send the photo as a JPEG.");
  if ((await sha256Hex(image)) !== input.sha256) throw new Error("That photo doesn't match the signed one.");
  const signedAt = Date.parse(input.signedAt);
  if (Number.isNaN(signedAt) || now - signedAt > MAX_SIGNATURE_AGE_MS || signedAt - now > MAX_CLOCK_AHEAD_MS) {
    throw new Error("That signature is too old. Sign again to save your photo.");
  }
  const signature = Uint8Array.from(Buffer.from(input.signature, "base64"));
  if (signature.length !== 64) throw new Error("That isn't a wallet signature.");
  const message = getUtf8Encoder().encode(photoMessage(input));
  if (!(await verifySignature(await getPublicKeyFromAddress(address(input.wallet)), signature as SignatureBytes, message))) {
    throw new Error("The signature doesn't match this wallet.");
  }

  const db = await getDatabase();
  // A newer signature always wins, so replaying an old one can't bring an old photo back.
  const rows = await db.query<{ updated_at: string | Date }>(
    `INSERT INTO photos (wallet, image, sha256, signed_at, signature, updated_at) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (wallet) DO UPDATE SET
       image = EXCLUDED.image, sha256 = EXCLUDED.sha256, signed_at = EXCLUDED.signed_at, signature = EXCLUDED.signature, updated_at = EXCLUDED.updated_at
       WHERE photos.signed_at < EXCLUDED.signed_at
     RETURNING updated_at`,
    [input.wallet, Buffer.from(image), input.sha256, new Date(signedAt).toISOString(), input.signature, new Date(now).toISOString()],
  );
  if (rows.length === 0) throw new Error("A newer photo is already saved for this wallet.");
  return new Date(rows[0].updated_at).getTime();
}

export async function getPhoto(wallet: Address) {
  const db = await getDatabase();
  const rows = await db.query<{ image: Uint8Array; updated_at: string | Date }>("SELECT image, updated_at FROM photos WHERE wallet = $1", [wallet]);
  return rows[0] && { image: new Uint8Array(rows[0].image), version: new Date(rows[0].updated_at).getTime() };
}

/** Each wallet's photo version, for the wallets that have one. */
export async function getPhotoVersions(wallets: Address[]): Promise<Record<string, number>> {
  const unique = [...new Set(wallets)];
  if (unique.length === 0) return {};
  const db = await getDatabase();
  const placeholders = unique.map((_, index) => `$${index + 1}`).join(", ");
  const rows = await db.query<{ wallet: string; updated_at: string | Date }>(
    `SELECT wallet, updated_at FROM photos WHERE wallet IN (${placeholders})`,
    unique,
  );
  return Object.fromEntries(rows.map(({ wallet, updated_at }) => [wallet, new Date(updated_at).getTime()]));
}
