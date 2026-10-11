// Profile photos, against Postgres running in memory (PGlite).
//   cd web && bun test src/lib/server
import { beforeEach, describe, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { generateKeyPairSigner, getUtf8Encoder, signBytes, type KeyPairSigner } from "@solana/kit";
import { photoMessage, sha256Hex } from "@veni/sdk";
import { createPgliteDatabase, useDatabaseForTests } from "./db";
import { getPhoto, getPhotoVersions, savePhoto } from "./photos";

const NOW = Date.parse("2026-10-11T12:00:00Z");
const MINUTE = 60_000;
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);

let alice: KeyPairSigner;
let bob: KeyPairSigner;

beforeEach(async () => {
  await useDatabaseForTests(createPgliteDatabase(new PGlite()));
  [alice, bob] = await Promise.all([generateKeyPairSigner(), generateKeyPairSigner()]);
});

/** `wallet` sends `image`, signed by `signer` (the wallet by default) at `at`. */
async function signed(wallet: KeyPairSigner, image = JPEG, { at = NOW, signer = wallet, sha256 }: { at?: number; signer?: KeyPairSigner; sha256?: string } = {}) {
  const input = { wallet: wallet.address, sha256: sha256 ?? (await sha256Hex(image)), signedAt: new Date(at).toISOString() };
  const signature = await signBytes(signer.keyPair.privateKey, getUtf8Encoder().encode(photoMessage(input)));
  return { ...input, image: Buffer.from(image).toString("base64"), signature: Buffer.from(signature).toString("base64") };
}

describe("photos", () => {
  test("saves a JPEG the wallet signed, and serves it back", async () => {
    expect(await savePhoto(await signed(alice), NOW)).toBe(NOW);
    expect(await getPhoto(alice.address)).toEqual({ image: JPEG, version: NOW });
    expect(await getPhotoVersions([alice.address, bob.address])).toEqual({ [alice.address]: NOW });
  });

  test("refuses one signed by any other wallet", async () => {
    await expect(savePhoto(await signed(alice, JPEG, { signer: bob }), NOW)).rejects.toThrow("doesn't match this wallet");
  });

  test("refuses a photo other than the signed one", async () => {
    const other = new Uint8Array([0xff, 0xd8, 0xff, 9, 0xff, 0xd9]);
    await expect(savePhoto(await signed(alice, other, { sha256: await sha256Hex(JPEG) }), NOW)).rejects.toThrow("doesn't match the signed one");
  });

  test("refuses anything but a JPEG under 100 KB", async () => {
    await expect(savePhoto(await signed(alice, new Uint8Array([0x89, 0x50, 0x4e, 0x47])), NOW)).rejects.toThrow("JPEG");
    const huge = new Uint8Array(100_001);
    huge.set([0xff, 0xd8, 0xff]);
    huge.set([0xff, 0xd9], huge.length - 2);
    await expect(savePhoto(await signed(alice, huge), NOW)).rejects.toThrow("under 100 KB");
  });

  test("refuses an old signature", async () => {
    await expect(savePhoto(await signed(alice, JPEG, { at: NOW - 11 * MINUTE }), NOW)).rejects.toThrow("too old");
  });

  test("a newer photo replaces the old one, and an older signature can't bring it back", async () => {
    const first = await signed(alice, JPEG, { at: NOW });
    const newer = new Uint8Array([0xff, 0xd8, 0xff, 7, 0xff, 0xd9]);
    await savePhoto(first, NOW);
    expect(await savePhoto(await signed(alice, newer, { at: NOW + MINUTE }), NOW + MINUTE)).toBe(NOW + MINUTE);
    await expect(savePhoto(first, NOW + 2 * MINUTE)).rejects.toThrow("newer photo");
    expect((await getPhoto(alice.address))?.image).toEqual(newer);
  });
});
