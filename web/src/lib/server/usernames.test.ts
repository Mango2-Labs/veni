// Usernames, against Postgres running in memory (PGlite).
//   cd web && bun test src/lib/server
import { beforeEach, describe, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { generateKeyPairSigner, getUtf8Encoder, signBytes, type KeyPairSigner } from "@solana/kit";
import { usernameMessage } from "@veni/sdk";
import { createPgliteDatabase, useDatabaseForTests } from "./db";
import { claimUsername, getUsername, getUsernames, usernameUnavailableReason } from "./usernames";

const NOW = Date.parse("2026-10-10T12:00:00Z");
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

let alice: KeyPairSigner;
let bob: KeyPairSigner;

beforeEach(async () => {
  await useDatabaseForTests(createPgliteDatabase(new PGlite()));
  [alice, bob] = await Promise.all([generateKeyPairSigner(), generateKeyPairSigner()]);
});

/** `wallet` asks for `username` at `at`, signed by `signer` (the wallet by default) `ageMs` earlier. */
async function signed(wallet: KeyPairSigner, username: string, { at = NOW, signer = wallet, ageMs = 0 } = {}) {
  const signedAt = new Date(at - ageMs).toISOString();
  const message = getUtf8Encoder().encode(usernameMessage({ wallet: wallet.address, username, signedAt }));
  const signature = Buffer.from(await signBytes(signer.keyPair.privateKey, message)).toString("base64");
  return { wallet: wallet.address, username, signedAt, signature };
}

/** `wallet` claims `username` at `at`. */
async function claim(wallet: KeyPairSigner, username: string, at = NOW) {
  return claimUsername(await signed(wallet, username, { at }), at);
}

describe("usernames", () => {
  test("saves a username the wallet signed", async () => {
    expect(await claim(alice, "alice")).toBe("alice");

    expect(await getUsernames([alice.address, bob.address])).toEqual({ [alice.address]: "alice" });
    expect(await usernameUnavailableReason("alice", bob.address, NOW)).toBe("That username is taken.");
    expect(await usernameUnavailableReason("alice", alice.address, NOW)).toBeUndefined();
  });

  test("refuses one signed by any other wallet", async () => {
    await expect(claimUsername(await signed(alice, "alice", { signer: bob }), NOW)).rejects.toThrow("doesn't match this wallet");
    expect(await getUsernames([alice.address])).toEqual({});
  });

  test("refuses a signature over 10 minutes old, or more than 2 minutes ahead", async () => {
    await expect(claimUsername(await signed(alice, "alice", { ageMs: 11 * MINUTE }), NOW)).rejects.toThrow("too old");
    await expect(claimUsername(await signed(alice, "alice", { ageMs: -3 * MINUTE }), NOW)).rejects.toThrow("too old");
    expect(await claimUsername(await signed(alice, "alice", { ageMs: 9 * MINUTE }), NOW)).toBe("alice");
  });

  test("refuses a username another wallet holds", async () => {
    await claim(alice, "alice");

    await expect(claim(bob, "alice")).rejects.toThrow("That username is taken.");
    expect(await getUsernames([bob.address])).toEqual({});
  });

  test("refuses names that break the rules, and any not sent lowercase without the @", async () => {
    for (const [username, problem] of [
      ["al", "at least 3"],
      ["a".repeat(21), "20 characters at most"],
      ["1alice", "Start with a letter"],
      ["ali-ce", "Start with a letter"],
      ["veni", "reserved"],
      ["Alice", "lowercase"],
      ["@alice", "lowercase"],
    ]) {
      await expect(claim(alice, username)).rejects.toThrow(problem);
    }
    expect(await claim(alice, "a_1")).toBe("a_1");
  });

  test("a wallet changes its username at most once every 24 hours", async () => {
    await claim(alice, "alice");

    await expect(claim(alice, "ali", NOW + 23 * HOUR)).rejects.toThrow("once every 24 hours");
    expect(await claim(alice, "ali", NOW + 24 * HOUR)).toBe("ali");
    expect(await getUsername(alice.address)).toEqual({ username: "ali", changeableAt: NOW + 48 * HOUR });
    // Asking for the name it already has changes nothing, even inside the 24 hours.
    expect(await claim(alice, "ali", NOW + 25 * HOUR)).toBe("ali");
  });

  test("a name given up stays reserved for 24 hours, except for its old owner", async () => {
    await claim(alice, "alice");
    const changedAt = NOW + 24 * HOUR;
    await claim(alice, "ali", changedAt);

    await expect(claim(bob, "alice", changedAt + HOUR)).rejects.toThrow("given up recently");
    expect(await usernameUnavailableReason("alice", bob.address, changedAt + HOUR)).toContain("given up recently");
    expect(await usernameUnavailableReason("alice", alice.address, changedAt + HOUR)).toBeUndefined();
    expect(await claim(bob, "alice", changedAt + 24 * HOUR)).toBe("alice");
  });

  test("replaying an older signature can't roll a username back", async () => {
    const older = await signed(alice, "alice", { ageMs: MINUTE });
    await claimUsername(older, NOW);
    await claim(alice, "ali", NOW + 24 * HOUR);

    await expect(claimUsername(older, NOW + 24 * HOUR)).rejects.toThrow("too old");
    expect(await getUsernames([alice.address])).toEqual({ [alice.address]: "ali" });
  });
});
