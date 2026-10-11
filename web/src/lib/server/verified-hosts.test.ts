// Verified hosts, against Postgres running in memory (PGlite).
//   cd web && bun test src/lib/server
import { beforeEach, describe, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { generateKeyPairSigner, getUtf8Encoder, signBytes, type Address, type KeyPairSigner } from "@solana/kit";
import { verifiedHostMessage } from "@veni/sdk";
import { createPgliteDatabase, useDatabaseForTests } from "./db";
import { getVerifiedHosts, saveVerifiedHost } from "./verified-hosts";

const NOW = Date.parse("2026-10-11T12:00:00Z");

let admin: KeyPairSigner;
let host: Address;

beforeEach(async () => {
  await useDatabaseForTests(createPgliteDatabase(new PGlite()));
  admin = await generateKeyPairSigner();
  host = (await generateKeyPairSigner()).address;
});

async function signed(isVerified: boolean, { signer = admin, at = NOW } = {}) {
  const input = { wallet: host, name: "Superteam", isVerified, signedAt: new Date(at).toISOString() };
  const signature = await signBytes(signer.keyPair.privateKey, getUtf8Encoder().encode(verifiedHostMessage(input)));
  return { ...input, signature: Buffer.from(signature).toString("base64") };
}

describe("verified hosts", () => {
  test("adds a host Veni's admin signed, and lists it", async () => {
    await saveVerifiedHost(await signed(true), { now: NOW, admin: admin.address });

    expect(await getVerifiedHosts([host, (await generateKeyPairSigner()).address])).toEqual([host]);
  });

  test("refuses one signed by anyone else", async () => {
    const stranger = await generateKeyPairSigner();
    await expect(saveVerifiedHost(await signed(true, { signer: stranger }), { now: NOW, admin: admin.address })).rejects.toThrow(
      "Only Veni can verify hosts.",
    );
    expect(await getVerifiedHosts([host])).toEqual([]);
  });

  test("removes a host, but an older signature can't undo it", async () => {
    const added = await signed(true, { at: NOW - 60_000 });
    await saveVerifiedHost(added, { now: NOW, admin: admin.address });
    await saveVerifiedHost(await signed(false), { now: NOW, admin: admin.address });
    await saveVerifiedHost(added, { now: NOW, admin: admin.address });

    expect(await getVerifiedHosts([host])).toEqual([]);
  });
});
