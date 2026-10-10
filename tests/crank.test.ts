import { describe, expect, test } from "bun:test";
import { VENI_PROGRAM_ADDRESS, TREASURY, TEST_USD_MINT } from "@veni/client";
import { crankEvent, runCrank, type CrankReport } from "@veni/crank";
import { fetchEventAddressesOf, fetchGuestsOfWallet } from "@veni/sdk";
import {
  accountsLeftBehind,
  approveApplication,
  cancelEvent,
  CHECK_IN_ENDS_AT,
  checkIn,
  createEvent,
  createEventWithApplicants,
  createEventWithGuests,
  rentHeldBy,
  signUp,
  RSVP_ENDS_AT,
  solBalance,
  USDC,
  usdcBalance,
  usdcTokenAccountOf,
} from "./events";
import { createMint, createTestChain, createWallet, giveTokens, giveUsdc, jumpTo, removeAccount } from "./litesvm";

const NOTHING_DONE: CrankReport = {
  settled: 0,
  guestsClosed: 0,
  eventsClosed: 0,
  waiting: [],
  errors: [],
};

describe("runCrank", () => {
  test("once check-in closes, settles, pays everyone and closes the event, all on its own", async () => {
    const chain = await createTestChain();
    const organizer = await createWallet(chain);
    const { event, guests } = await createEventWithGuests(chain, 3, { organizer });
    const [firstAttendee, secondAttendee, noShow] = guests;
    for (const { wallet } of [firstAttendee, secondAttendee]) await checkIn(chain, event, wallet.address);

    expect(await runCrank(chain)).toEqual(NOTHING_DONE);

    jumpTo(chain, CHECK_IN_ENDS_AT);
    expect(await runCrank(chain)).toEqual({ ...NOTHING_DONE, settled: 1, guestsClosed: 3, eventsClosed: 1 });

    // $30 staked and $10 lost by the no-show: the treasury takes $1, and each attendee gets $10 + $4.50.
    expect(await usdcBalance(chain, firstAttendee.wallet.address)).toBe(14_500_000n);
    expect(await usdcBalance(chain, secondAttendee.wallet.address)).toBe(14_500_000n);
    expect(await usdcBalance(chain, noShow.wallet.address)).toBe(0n);
    expect(await usdcBalance(chain, TREASURY)).toBe(1n * USDC);
    expect(accountsLeftBehind(chain)).toHaveLength(0);
  });

  test("archives an event while its guests are still on-chain, before closing anything", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithGuests(chain, 2);
    await checkIn(chain, event, guests[0].wallet.address);
    jumpTo(chain, CHECK_IN_ENDS_AT);
    const guestAccountsWhenArchived: number[] = [];

    const report = await runCrank(chain, {
      archive: async (eventAddress) => {
        expect(eventAddress).toBe(event);
        guestAccountsWhenArchived.push(chain.svm.getProgramAccounts(VENI_PROGRAM_ADDRESS).length);
      },
    });

    expect(report).toEqual({ ...NOTHING_DONE, settled: 1, guestsClosed: 2, eventsClosed: 1 });
    // The event and both guests were still there when it was archived.
    expect(guestAccountsWhenArchived).toEqual([3]);
  });

  test("closes nothing for an event it couldn't archive, and says why", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithGuests(chain, 2);
    await checkIn(chain, event, guests[0].wallet.address);
    jumpTo(chain, CHECK_IN_ENDS_AT);

    const report = await runCrank(chain, {
      archive: async () => {
        throw new Error("the archive is down");
      },
    });

    expect(report).toMatchObject({ settled: 1, guestsClosed: 0, eventsClosed: 0 });
    expect(report.errors).toEqual([`event ${event}: the archive is down`]);
    expect(chain.svm.getProgramAccounts(VENI_PROGRAM_ADDRESS)).toHaveLength(3);
  });

  test("archives an event nobody RSVPed to before closing it", async () => {
    const chain = await createTestChain();
    const event = await createEvent(chain);
    jumpTo(chain, RSVP_ENDS_AT);
    const archived: string[] = [];

    const report = await runCrank(chain, { archive: async (eventAddress) => void archived.push(eventAddress) });

    expect(report).toEqual({ ...NOTHING_DONE, eventsClosed: 1 });
    expect(archived).toEqual([event]);
  });

  test("finds an organizer's events and a wallet's RSVPs", async () => {
    const chain = await createTestChain();
    const organizer = await createWallet(chain);
    const { event, guests } = await createEventWithGuests(chain, 2, { organizer });
    await createEvent(chain, { eventId: 2n }); // someone else's

    expect(await fetchEventAddressesOf(chain, organizer.address)).toEqual([event]);
    const signUps = await fetchGuestsOfWallet(chain, guests[0].wallet.address);
    expect(signUps.map(({ data }) => data.event)).toEqual([event]);
  });

  test("refunds applications nobody approved as soon as RSVPs close, while check-in is still open", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithApplicants(chain, 2);
    const [approved, waiting] = guests;
    await approveApplication(chain, event, approved.guest);
    jumpTo(chain, RSVP_ENDS_AT);

    expect(await runCrank(chain)).toEqual({ ...NOTHING_DONE, guestsClosed: 1 });

    expect(await usdcBalance(chain, waiting.wallet.address)).toBe(10n * USDC);
    // The approved guest still has until check-in closes.
    expect(await usdcBalance(chain, event)).toBe(10n * USDC);
  });

  test("closes an event nobody was approved to, refunding every application", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithApplicants(chain, 2);
    jumpTo(chain, RSVP_ENDS_AT);
    const archived: string[] = [];

    const report = await runCrank(chain, { archive: async (eventAddress) => void archived.push(eventAddress) });

    expect(report).toEqual({ ...NOTHING_DONE, guestsClosed: 2, eventsClosed: 1 });
    expect(archived).toEqual([event]);
    for (const { wallet } of guests) expect(await usdcBalance(chain, wallet.address)).toBe(10n * USDC);
    expect(accountsLeftBehind(chain)).toHaveLength(0);
  });

  test("settles an approval event like any other, refunding the application left waiting", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithApplicants(chain, 3);
    const [attendee, noShow, waiting] = guests;
    for (const { guest } of [attendee, noShow]) await approveApplication(chain, event, guest);
    await checkIn(chain, event, attendee.wallet.address);
    jumpTo(chain, CHECK_IN_ENDS_AT);

    expect(await runCrank(chain)).toEqual({ ...NOTHING_DONE, settled: 1, guestsClosed: 3, eventsClosed: 1 });

    expect(await usdcBalance(chain, attendee.wallet.address)).toBe(19n * USDC);
    expect(await usdcBalance(chain, waiting.wallet.address)).toBe(10n * USDC);
    expect(await usdcBalance(chain, TREASURY)).toBe(1n * USDC);
    expect(accountsLeftBehind(chain)).toHaveLength(0);
  });

  test("a second run straight after sends nothing", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithGuests(chain, 1, { terms: { capacity: 1 } });
    await checkIn(chain, event, guests[0].wallet.address);
    jumpTo(chain, CHECK_IN_ENDS_AT);
    await runCrank(chain);

    expect(await runCrank(chain)).toEqual(NOTHING_DONE);
  });

  test("does nothing for an event that's already closed", async () => {
    const chain = await createTestChain();
    const event = await createEvent(chain);
    jumpTo(chain, RSVP_ENDS_AT);
    await runCrank(chain);

    expect(await crankEvent(chain, event)).toEqual(NOTHING_DONE);
  });

  test("does nothing while check-in is open and someone hasn't come", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithGuests(chain, 2);
    await checkIn(chain, event, guests[0].wallet.address);
    jumpTo(chain, CHECK_IN_ENDS_AT - 1n);

    expect(await runCrank(chain)).toEqual(NOTHING_DONE);
  });

  test("settles as soon as RSVPs close once every guest has checked in", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithGuests(chain, 2);
    for (const { wallet } of guests) await checkIn(chain, event, wallet.address);
    expect(await runCrank(chain)).toEqual(NOTHING_DONE);

    jumpTo(chain, RSVP_ENDS_AT);

    expect(await runCrank(chain)).toEqual({ ...NOTHING_DONE, settled: 1, guestsClosed: 2, eventsClosed: 1 });
    for (const { wallet } of guests) expect(await usdcBalance(chain, wallet.address)).toBe(10n * USDC);
  });

  test("closes an event nobody RSVPed to once RSVPs have closed, returning the organizer's rent", async () => {
    const chain = await createTestChain();
    const organizer = await createWallet(chain);
    const event = await createEvent(chain, { organizer });
    expect(await runCrank(chain)).toEqual(NOTHING_DONE);
    const rent = await rentHeldBy(chain, event);
    const solBefore = await solBalance(chain, organizer.address);

    jumpTo(chain, RSVP_ENDS_AT);

    expect(await runCrank(chain)).toEqual({ ...NOTHING_DONE, eventsClosed: 1 });
    expect(await solBalance(chain, organizer.address)).toBe(solBefore + rent);
  });

  test("refunds every guest when nobody checked in, with no fee, and closes the event", async () => {
    const chain = await createTestChain();
    const organizer = await createWallet(chain);
    const { event, guests } = await createEventWithGuests(chain, 2, { organizer });
    jumpTo(chain, CHECK_IN_ENDS_AT);

    expect(await runCrank(chain)).toEqual({ ...NOTHING_DONE, settled: 1, guestsClosed: 2, eventsClosed: 1 });

    for (const { wallet } of guests) expect(await usdcBalance(chain, wallet.address)).toBe(10n * USDC);
    expect(await usdcBalance(chain, TREASURY)).toBe(0n);
    expect(accountsLeftBehind(chain)).toHaveLength(0);
  });

  test("refunds every guest of a cancelled event and closes it straight away, with no fee", async () => {
    const chain = await createTestChain();
    const organizer = await createWallet(chain);
    const { event, guests } = await createEventWithGuests(chain, 3, { organizer });
    await checkIn(chain, event, guests[0].wallet.address);
    await cancelEvent(chain, event, organizer);
    const rent = await rentHeldBy(chain, event);
    const solBefore = await solBalance(chain, organizer.address);

    expect(await runCrank(chain)).toEqual({ ...NOTHING_DONE, guestsClosed: 3, eventsClosed: 1 });

    for (const { wallet } of guests) expect(await usdcBalance(chain, wallet.address)).toBe(10n * USDC);
    expect(await usdcBalance(chain, TREASURY)).toBe(0n);
    expect(await solBalance(chain, organizer.address)).toBe(solBefore + rent);
    expect(accountsLeftBehind(chain)).toHaveLength(0);
  });

  test("waits for a guest of a cancelled event with no token account to be refunded into", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithGuests(chain, 2);
    await cancelEvent(chain, event);
    const [guest] = guests;
    removeAccount(chain, await usdcTokenAccountOf(guest.wallet.address));

    const report = await runCrank(chain);

    expect(report).toMatchObject({ guestsClosed: 1, eventsClosed: 0, errors: [] });
    expect(report.waiting).toEqual([`${guest.wallet.address} is owed a refund but has no token account to be paid into`]);
  });

  test("waits for an attendee with no token account, closes everyone else, and finishes once it exists", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithGuests(chain, 2);
    const [attendee] = guests;
    await checkIn(chain, event, attendee.wallet.address);
    jumpTo(chain, CHECK_IN_ENDS_AT);
    removeAccount(chain, await usdcTokenAccountOf(attendee.wallet.address));

    const report = await runCrank(chain);

    expect(report).toMatchObject({ settled: 1, guestsClosed: 1, eventsClosed: 0, errors: [] });
    expect(report.waiting).toEqual([`${attendee.wallet.address} is owed a payout but has no token account to be paid into`]);

    await giveUsdc(chain, attendee.wallet.address, 0n); // the attendee's Reclaim button recreates it
    expect(await runCrank(chain)).toEqual({ ...NOTHING_DONE, guestsClosed: 1, eventsClosed: 1 });
    expect(await usdcBalance(chain, attendee.wallet.address)).toBe(19n * USDC);
  });

  test("reports an event it can't settle and still finishes the others", async () => {
    const chain = await createTestChain();
    await createEventWithGuests(chain, 1, { eventId: 1n });
    // A Test USD event, though the treasury has no Test USD token account yet.
    createMint(chain, TEST_USD_MINT);
    const testUsdEvent = await createEvent(chain, { eventId: 2n, stakeMint: TEST_USD_MINT });
    const testUsdGuest = await createWallet(chain);
    await giveTokens(chain, testUsdGuest.address, TEST_USD_MINT, 10n * USDC);
    await signUp(chain, testUsdEvent, testUsdGuest, TEST_USD_MINT);
    jumpTo(chain, CHECK_IN_ENDS_AT);

    const report = await runCrank(chain);

    expect(report).toMatchObject({ settled: 1, guestsClosed: 1, eventsClosed: 1 });
    expect(report.errors).toEqual([
      `event ${testUsdEvent}: The treasury has no token account for ${TEST_USD_MINT}. Create it once, then settling can go ahead.`,
    ]);
  });
});
