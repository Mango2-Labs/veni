// Event categories, against Postgres running in memory (PGlite).
//   cd web && bun test src/lib/server
import { beforeEach, describe, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { generateKeyPairSigner, getUtf8Encoder, signBytes, type Address, type KeyPairSigner } from "@solana/kit";
import { eventCategoryMessage, type EventCategory } from "@veni/sdk";
import { getCategories, saveCategory } from "./categories";
import { createPgliteDatabase, useDatabaseForTests } from "./db";

const NOW = Date.parse("2026-10-11T12:00:00Z");

let organizer: KeyPairSigner;
let event: Address;
const organizerOf = async () => organizer.address;

beforeEach(async () => {
  await useDatabaseForTests(createPgliteDatabase(new PGlite()));
  organizer = await generateKeyPairSigner();
  event = (await generateKeyPairSigner()).address;
});

async function signed(category: EventCategory, signer = organizer) {
  const signedAt = new Date(NOW).toISOString();
  const message = getUtf8Encoder().encode(eventCategoryMessage({ event, category, signedAt }));
  const signature = Buffer.from(await signBytes(signer.keyPair.privateKey, message)).toString("base64");
  return { event, category, signedAt, signature };
}

describe("event categories", () => {
  test("saves a category the organizer signed, and lists it", async () => {
    await saveCategory(await signed("Workshop"), { now: NOW, organizerOf });

    expect(await getCategories([event, (await generateKeyPairSigner()).address])).toEqual({ [event]: "Workshop" });
  });

  test("refuses one signed by anyone else", async () => {
    await expect(saveCategory(await signed("Party", await generateKeyPairSigner()), { now: NOW, organizerOf })).rejects.toThrow(
      "Only the event's host",
    );
    expect(await getCategories([event])).toEqual({});
  });

  test("refuses a category Veni doesn't have", async () => {
    const input = { ...(await signed("Meetup")), category: "Concert" as EventCategory };

    await expect(saveCategory(input, { now: NOW, organizerOf })).rejects.toThrow("isn't one of Veni's categories");
  });
});
