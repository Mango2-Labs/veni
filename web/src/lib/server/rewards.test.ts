import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, test } from "bun:test";
import { generateKeyPairSigner, type Address } from "@solana/kit";
import { skrEarnedBy } from "@veni/sdk";
import { createPgliteDatabase, useDatabaseForTests } from "./db";
import { recordClaim } from "./rewards";

let seeker: Address;
let wallet: Address;

beforeEach(async () => {
  await useDatabaseForTests(createPgliteDatabase(new PGlite()));
  seeker = (await generateKeyPairSigner()).address;
  wallet = (await generateKeyPairSigner()).address;
});

describe("SKR rewards", () => {
  test("pays at each milestone, then for every stamp after the last", () => {
    expect([0, 1, 4, 5, 10, 15, 20, 22].map(skrEarnedBy)).toEqual([0, 25, 25, 100, 250, 500, 1000, 1020]);
  });

  test("records a claim once, even when two arrive together", async () => {
    expect(await recordClaim(seeker, wallet, 0, 25)).toBe(true);
    expect(await recordClaim(seeker, wallet, 0, 25)).toBe(false);
    expect(await recordClaim(seeker, wallet, 25, 100)).toBe(true);
  });

  test("counts claims per Seeker, whichever wallet holds it", async () => {
    const otherWallet = (await generateKeyPairSigner()).address;
    expect(await recordClaim(seeker, wallet, 0, 25)).toBe(true);
    expect(await recordClaim(seeker, otherWallet, 0, 25)).toBe(false);
  });
});
