// The archive and host profiles, against Postgres running in memory (PGlite).
//   cd web && bun test src/lib/server
import { beforeEach, describe, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { generateKeyPairSigner, getUtf8Encoder, none, signBytes, some, type Address, type KeyPairSigner } from "@solana/kit";
import { TEST_USD_MINT, type Event as EventAccount } from "@veni/client";
import { hostProfileMessage } from "../host-profile";
import { historyOf, pastEventsAttendedBy, pastEventsHostedBy, recordOf, saveEvent } from "./archive";
import { createPgliteDatabase, useDatabaseForTests } from "./db";
import { getHost, registerHost } from "./hosts";

const STARTS_AT = 1_800_000_000n;
const ENDS_AT = STARTS_AT + 4n * 3600n;
const AFTER = Number(ENDS_AT) + 1;

let organizer: KeyPairSigner;
let alice: Address;
let bob: Address;

beforeEach(async () => {
  await useDatabaseForTests(createPgliteDatabase(new PGlite()));
  organizer = await generateKeyPairSigner();
  alice = (await generateKeyPairSigner()).address;
  bob = (await generateKeyPairSigner()).address;
});

function eventWith(overrides: Partial<EventAccount> = {}): EventAccount {
  return {
    discriminator: new Uint8Array(8),
    organizer: organizer.address,
    eventId: 1n,
    stakeMint: TEST_USD_MINT,
    guestCount: 2,
    attendedCount: 1,
    paidCount: 0,
    closedGuestCount: 0,
    applicantCount: 0,
    lastCheckInCode: 0n,
    isSettled: false,
    isCancelled: false,
    bump: 255,
    terms: {
      stakeAmount: 10_000_000n,
      ticketPrice: 0n,
      rsvpEndsAt: STARTS_AT,
      checkInEndsAt: ENDS_AT,
      capacity: 60,
      requiresApproval: false,
      doorKey: organizer.address,
      title: "Builders Night",
    },
    details: {
      hostName: "Lisbon Builders Club",
      city: "Lisbon",
      venue: "LX Factory",
      cover: "",
      lumaSlug: "builders-night",
      location: some({ latitude: 38_702_600, longitude: -9_178_660 }),
    },
    ...overrides,
  };
}

const EVENT = "Ev3nt1111111111111111111111111111111111111" as Address;
const OTHER_EVENT = "Ev3nt2222222222222222222222222222222222222" as Address;

describe("archive", () => {
  test("lists an event a guest checked in to, once its check-in has closed", async () => {
    await saveEvent(EVENT, eventWith(), [
      { wallet: alice, hasAttended: true },
      { wallet: bob, hasAttended: false },
    ]);

    expect(await pastEventsAttendedBy(alice, Number(ENDS_AT) - 1)).toEqual([]);
    const [past] = await pastEventsAttendedBy(alice, AFTER);
    expect(past).toMatchObject({ address: EVENT, title: "Builders Night", startsAt: Number(STARTS_AT), guestCount: 2, attendedCount: 1 });
    expect(await pastEventsAttendedBy(bob, AFTER)).toEqual([]);
  });

  test("lists an event that settled early, when everyone checked in before check-in closed", async () => {
    await saveEvent(EVENT, eventWith({ guestCount: 1, attendedCount: 1, isSettled: true }), [{ wallet: alice, hasAttended: true }]);

    const before = Number(ENDS_AT) - 1;
    expect(await pastEventsAttendedBy(alice, before)).toHaveLength(1);
    expect(await pastEventsHostedBy(organizer.address, before)).toHaveLength(1);
  });

  test("never goes backwards when an older read of the chain is saved again", async () => {
    await saveEvent(EVENT, eventWith({ attendedCount: 2, isSettled: true }), [{ wallet: alice, hasAttended: true }]);
    await saveEvent(EVENT, eventWith({ attendedCount: 1, isSettled: false }), [{ wallet: alice, hasAttended: false }]);

    const [past] = await pastEventsAttendedBy(alice, AFTER);
    expect(past.attendedCount).toBe(2);
  });

  test("keeps an event without a map", async () => {
    await saveEvent(EVENT, eventWith({ details: { ...eventWith().details, location: none() } }), []);

    expect(await pastEventsHostedBy(organizer.address, AFTER)).toHaveLength(1);
  });

  test("counts turnout only across events that ran", async () => {
    await saveEvent(EVENT, eventWith({ guestCount: 10, attendedCount: 8 }), []);
    await saveEvent(OTHER_EVENT, eventWith({ guestCount: 5, attendedCount: 0, isCancelled: true }), []);

    const pastEvents = await pastEventsHostedBy(organizer.address, AFTER);

    expect(pastEvents).toHaveLength(2);
    expect(recordOf(pastEvents)).toEqual({ eventCount: 2, guestCount: 10, attendedCount: 8 });
  });
});

describe("history", () => {
  test("shows what each past event paid or cost, and all a guest earned", async () => {
    await saveEvent(EVENT, eventWith({ guestCount: 3, attendedCount: 2 }), [
      { wallet: alice, hasAttended: true },
      { wallet: bob, hasAttended: false },
    ]);
    await saveEvent(OTHER_EVENT, eventWith({ isCancelled: true }), [{ wallet: alice, hasAttended: false }]);

    // One $10 no-show, less Veni's 10%, split between two attendees.
    expect(await historyOf(alice, 0, AFTER)).toMatchObject({
      events: [
        { address: EVENT, outcome: "checked-in", result: "4500000" },
        { address: OTHER_EVENT, outcome: "cancelled", result: "0" },
      ],
      earned: "4500000",
      hasMore: false,
    });
    expect(await historyOf(bob, 0, AFTER)).toMatchObject({ events: [{ outcome: "missed", result: "-10000000" }], earned: "0" });
  });

  test("pages through ten events at a time", async () => {
    for (let i = 0; i < 11; i++) {
      await saveEvent((await generateKeyPairSigner()).address, eventWith(), [{ wallet: alice, hasAttended: true }]);
    }

    expect(await historyOf(alice, 0, AFTER)).toMatchObject({ events: { length: 10 }, hasMore: true });
    expect(await historyOf(alice, 10, AFTER)).toMatchObject({ events: { length: 1 }, hasMore: false });
  });
});

describe("host profiles", () => {
  async function signedProfile(signer: KeyPairSigner, name: string, signedAt = new Date().toISOString(), lumaCalendar = "lisbon-builders") {
    const input = { wallet: signer.address, name, lumaCalendar, signedAt };
    const signature = await signBytes(signer.keyPair.privateKey, getUtf8Encoder().encode(hostProfileMessage(input)));
    return { ...input, signature: Buffer.from(signature).toString("base64") };
  }

  test("saves a profile the wallet signed", async () => {
    const profile = await registerHost(await signedProfile(organizer, "Lisbon Builders Club"));

    expect(profile).toMatchObject({ wallet: organizer.address, name: "Lisbon Builders Club", lumaCalendar: "lisbon-builders" });
    expect(await getHost(organizer.address)).toMatchObject({ name: "Lisbon Builders Club" });
  });

  test("refuses a profile signed by another wallet", async () => {
    const impostor = await generateKeyPairSigner();
    const forged = { ...(await signedProfile(impostor, "Superteam")), wallet: organizer.address };

    await expect(registerHost(forged)).rejects.toThrow("doesn't match this wallet");
    expect(await getHost(organizer.address)).toBeUndefined();
  });

  test("refuses a signature from more than 10 minutes ago", async () => {
    const old = new Date(Date.now() - 11 * 60 * 1000).toISOString();

    await expect(registerHost(await signedProfile(organizer, "Lisbon Builders Club", old))).rejects.toThrow("too old");
  });

  test("keeps the newest profile when an older signature is replayed", async () => {
    const earlier = await signedProfile(organizer, "Old name", new Date(Date.now() - 60_000).toISOString());
    await registerHost(await signedProfile(organizer, "New name"));

    await expect(registerHost(earlier)).rejects.toThrow("newer version");
    expect(await getHost(organizer.address)).toMatchObject({ name: "New name" });
  });

  test("refuses a Luma calendar that isn't a plain Luma path", async () => {
    await expect(registerHost(await signedProfile(organizer, "Lisbon Builders Club", undefined, "evil.com/x"))).rejects.toThrow(
      "isn't a Luma calendar",
    );
  });
});
