// Event descriptions, against Postgres running in memory (PGlite).
//   cd web && bun test src/lib/server
import { beforeEach, describe, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { generateKeyPairSigner, getUtf8Encoder, signBytes, type Address, type KeyPairSigner } from "@solana/kit";
import { eventDescriptionMessage } from "../event-description";
import { createPgliteDatabase, useDatabaseForTests } from "./db";
import { getDescription, saveDescription } from "./descriptions";

const NOW = Date.parse("2026-10-09T12:00:00Z");

let organizer: KeyPairSigner;
let event: Address;
const organizerOf = async () => organizer.address;

beforeEach(async () => {
  await useDatabaseForTests(createPgliteDatabase(new PGlite()));
  organizer = await generateKeyPairSigner();
  event = (await generateKeyPairSigner()).address;
});

/** `signer` (the organizer by default) signs `description`, `ageMs` before NOW. */
async function signed(description: string, { signer = organizer, ageMs = 0 } = {}) {
  const signedAt = new Date(NOW - ageMs).toISOString();
  const message = getUtf8Encoder().encode(await eventDescriptionMessage({ event, description, signedAt }));
  const signature = Buffer.from(await signBytes(signer.keyPair.privateKey, message)).toString("base64");
  return { event, description, signedAt, signature };
}

describe("event descriptions", () => {
  test("saves a description the organizer signed", async () => {
    await saveDescription(await signed("Bring a laptop."), { now: NOW, organizerOf });

    expect(await getDescription(event)).toBe("Bring a laptop.");
  });

  test("refuses one signed by anyone else", async () => {
    const stranger = await generateKeyPairSigner();

    await expect(saveDescription(await signed("Free pizza!", { signer: stranger }), { now: NOW, organizerOf })).rejects.toThrow(
      "Only the event's host",
    );
    expect(await getDescription(event)).toBeUndefined();
  });

  test("refuses a description that differs from what was signed", async () => {
    const input = { ...(await signed("Bring a laptop.")), description: "Bring a laptop and $500." };

    await expect(saveDescription(input, { now: NOW, organizerOf })).rejects.toThrow("Only the event's host");
  });

  test("an edit replaces it, and replaying the older signature can't bring it back", async () => {
    const first = await signed("Doors at 19:00.", { ageMs: 60_000 });
    await saveDescription(first, { now: NOW, organizerOf });
    await saveDescription(await signed("Doors at 19:30."), { now: NOW, organizerOf });

    await expect(saveDescription(first, { now: NOW, organizerOf })).rejects.toThrow("A newer description");
    expect(await getDescription(event)).toBe("Doors at 19:30.");
  });

  test("refuses a signature older than 10 minutes", async () => {
    const stale = await signed("Bring a laptop.", { ageMs: 11 * 60_000 });

    await expect(saveDescription(stale, { now: NOW, organizerOf })).rejects.toThrow("too old");
  });

  test("refuses a description longer than 10,000 characters", async () => {
    await expect(saveDescription(await signed("x".repeat(10_001)), { now: NOW, organizerOf })).rejects.toThrow("too long");
  });
});
