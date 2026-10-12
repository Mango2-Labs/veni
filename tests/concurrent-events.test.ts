// Three copies of the same event, running at the same time: the same terms,
// the same details and, like the web app does for one host, the same door
// key. Nothing about one should reach the others.
import { describe, expect, test } from "bun:test";
import type { Address } from "@solana/kit";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { SYSTEM_ERROR__ACCOUNT_ALREADY_IN_USE } from "@solana-program/system";
import {
  getCheckInGuestInstruction,
  getCheckInWithCodeInstructionAsync,
  VENI_ERROR__GUEST_NOT_IN_EVENT,
  VENI_ERROR__NOT_ORGANIZER,
  VENI_ERROR__WRONG_CHECK_IN_MESSAGE,
  TICKET_HOLD_SECONDS,
  TREASURY,
  USDC_MINT,
} from "@veni/client";
import { runCrank } from "@veni/crank";
import { checkInMessage, checkInCodeMessage, getEd25519Instruction, signCheckIn, signCheckInCode } from "@veni/sdk";
import { createTestChain, createWallet, expectTransactionError, giveUsdc, jumpTo, START_TIME, type TestChain } from "./litesvm";
import {
  accountsLeftBehind,
  approveApplication,
  CHECK_IN_ENDS_AT,
  createEvent,
  createGuest,
  DOOR_KEY,
  guestAddressOf,
  removeApplication,
  signUp,
  scanCheckInCode,
  USDC,
  usdcBalance,
} from "./events";

/** Anchor's code for an address that isn't the one its seeds derive. */
const ANCHOR_ERROR__CONSTRAINT_SEEDS = 2006;

/** One host's three copies of the same event, IDs 1 to 3. */
async function createThreeEvents(chain: TestChain) {
  return Promise.all([1n, 2n, 3n].map((eventId) => createEvent(chain, { eventId })));
}

async function fetchEvent(chain: TestChain, event: Address) {
  return (await chain.veni.accounts.event.fetch(event)).data;
}

describe("three identical events at the same time", () => {
  test("three hosts can each run the same event: each gets its own address and vault", async () => {
    const chain = await createTestChain();
    const hosts = await Promise.all([createWallet(chain), createWallet(chain), createWallet(chain)]);

    // The same event ID, terms, details and door key for all three.
    const events = await Promise.all(hosts.map((organizer) => createEvent(chain, { organizer, eventId: 1n })));
    const vaults = await Promise.all(
      events.map(async (owner) => (await findAssociatedTokenPda({ owner, mint: USDC_MINT, tokenProgram: TOKEN_PROGRAM_ADDRESS }))[0]),
    );

    expect(new Set(events).size).toBe(3);
    expect(new Set(vaults).size).toBe(3);
    for (const [index, event] of events.entries()) {
      expect((await fetchEvent(chain, event)).organizer).toBe(hosts[index].address);
    }
  });

  test("one host can run three copies, but can't create the same event ID twice", async () => {
    const chain = await createTestChain();

    const events = await createThreeEvents(chain);

    expect(new Set(events).size).toBe(3);
    await expectTransactionError(
      createEvent(chain, { eventId: 1n, terms: { title: "Builders Night, again" } }),
      SYSTEM_ERROR__ACCOUNT_ALREADY_IN_USE,
    );
    expect((await fetchEvent(chain, events[0])).terms.title).toBe("Builders Night");
  });

  test("a guest who RSVPs to all three has a separate place, and stake, at each", async () => {
    const chain = await createTestChain();
    const events = await createThreeEvents(chain);
    const guest = await createGuest(chain, 30n * USDC);

    for (const event of events) await signUp(chain, event, guest);

    const places = await Promise.all(events.map((event) => guestAddressOf(chain, event, guest.address)));
    expect(new Set(places).size).toBe(3);
    for (const event of events) {
      expect((await fetchEvent(chain, event)).guestCount).toBe(1);
      expect(await usdcBalance(chain, event)).toBe(10n * USDC);
    }
    expect(await usdcBalance(chain, guest.address)).toBe(0n);
  });

  test("a check-in code works only at its own event, and each event counts its codes on its own", async () => {
    const chain = await createTestChain();
    const [first, second, third] = await createThreeEvents(chain);
    const guest = await createGuest(chain, 30n * USDC);
    for (const event of [first, second, third]) await signUp(chain, event, guest);

    // Code #1 from the first event's door screen, signed by the door key all three share.
    const firstEventsCode = await signCheckInCode(DOOR_KEY, first, 1n, START_TIME);
    for (const otherEvent of [second, third]) {
      await expectTransactionError(
        chain.sendTransaction([
          getEd25519Instruction(DOOR_KEY.address, firstEventsCode.signature, checkInCodeMessage(first, 1n, START_TIME)),
          await getCheckInWithCodeInstructionAsync({ wallet: guest, event: otherEvent, code: 1n, shownAt: START_TIME }),
        ]),
        VENI_ERROR__WRONG_CHECK_IN_MESSAGE,
      );
    }

    await scanCheckInCode(chain, first, guest, 1n);
    // Using code #1 at the first event doesn't retire code #1 at the second.
    await scanCheckInCode(chain, second, guest, 1n);

    const [atFirst, atSecond, atThird] = await Promise.all([first, second, third].map((event) => fetchEvent(chain, event)));
    expect([atFirst.lastCheckInCode, atSecond.lastCheckInCode, atThird.lastCheckInCode]).toEqual([1n, 1n, 0n]);
    expect([atFirst.attendedCount, atSecond.attendedCount, atThird.attendedCount]).toEqual([1, 1, 0]);
    const placeAtThird = await guestAddressOf(chain, third, guest.address);
    expect((await chain.veni.accounts.guest.fetch(placeAtThird)).data.hasAttended).toBe(false);
  });

  test("a host check-in signed for one event doesn't count at the others", async () => {
    const chain = await createTestChain();
    const [first, second] = await createThreeEvents(chain);
    const guest = await createGuest(chain, 20n * USDC);
    for (const event of [first, second]) await signUp(chain, event, guest);
    const signedForFirst = await signCheckIn(DOOR_KEY, first, guest.address);
    const placeAtSecond = await guestAddressOf(chain, second, guest.address);

    await expectTransactionError(
      chain.sendTransaction([
        getEd25519Instruction(DOOR_KEY.address, signedForFirst.signature, checkInMessage(first, guest.address)),
        getCheckInGuestInstruction({ event: second, guest: placeAtSecond }),
      ]),
      VENI_ERROR__WRONG_CHECK_IN_MESSAGE,
    );

    expect((await chain.veni.accounts.guest.fetch(placeAtSecond)).data.hasAttended).toBe(false);
  });

  test("they settle, pay out and close on their own, with the right money at each", async () => {
    const chain = await createTestChain();
    const [first, second, third] = await createThreeEvents(chain);
    // Sam goes to all three. Everyone else RSVPs to one.
    const sam = await createGuest(chain, 30n * USDC);
    for (const event of [first, second, third]) await signUp(chain, event, sam);
    async function twoMoreGuests(event: Address) {
      const guests = [await createGuest(chain), await createGuest(chain)];
      for (const guest of guests) await signUp(chain, event, guest);
      return guests;
    }
    const firstGuests = await twoMoreGuests(first);
    const secondGuests = await twoMoreGuests(second);
    const thirdGuests = await twoMoreGuests(third);

    // First event: Sam and one other come, one doesn't. Second: everyone comes.
    // Third: nobody comes. Each door counts its own codes from #1.
    await scanCheckInCode(chain, first, sam, 1n);
    await scanCheckInCode(chain, first, firstGuests[0], 2n);
    await scanCheckInCode(chain, second, sam, 1n);
    await scanCheckInCode(chain, second, secondGuests[0], 2n);
    await scanCheckInCode(chain, second, secondGuests[1], 3n);
    const counts = await Promise.all([first, second, third].map((event) => fetchEvent(chain, event)));
    expect(counts.map((event) => [event.guestCount, event.attendedCount, event.lastCheckInCode])).toEqual([
      [3, 2, 2n],
      [3, 3, 3n],
      [3, 0, 0n],
    ]);

    jumpTo(chain, CHECK_IN_ENDS_AT);
    expect(await runCrank(chain)).toEqual({ settled: 3, guestsClosed: 9, eventsClosed: 3, waiting: [], errors: [] });

    // First: $10 lost, $1 of it to the treasury, so each of the two who came gets $10 + $4.50.
    // Second: nobody lost anything. Third: nobody came, so everyone is refunded.
    expect(await usdcBalance(chain, sam.address)).toBe(34_500_000n);
    expect(await usdcBalance(chain, firstGuests[0].address)).toBe(14_500_000n);
    expect(await usdcBalance(chain, firstGuests[1].address)).toBe(0n);
    for (const guest of [...secondGuests, ...thirdGuests]) expect(await usdcBalance(chain, guest.address)).toBe(10n * USDC);
    expect(await usdcBalance(chain, TREASURY)).toBe(1n * USDC);
    expect(accountsLeftBehind(chain)).toHaveLength(0);
  });
});

describe("events that require approval, at the same time as others", () => {
  test("approving or removing an application at one event never touches another", async () => {
    const chain = await createTestChain();
    const [first, second] = await Promise.all(
      [1n, 2n].map((eventId) => createEvent(chain, { eventId, terms: { requiresApproval: true } })),
    );
    const sam = await createGuest(chain, 20n * USDC);
    for (const event of [first, second]) await signUp(chain, event, sam);
    const [samAtFirst, samAtSecond] = await Promise.all([first, second].map((event) => guestAddressOf(chain, event, sam.address)));

    // Sam's application at the second event can't be approved, or removed, through the first.
    await expectTransactionError(approveApplication(chain, first, samAtSecond), VENI_ERROR__GUEST_NOT_IN_EVENT);
    await expectTransactionError(
      chain.veni.instructions
        .removeApplication({ remover: chain.identity, event: first, guest: samAtSecond, wallet: sam.address, stakeMint: USDC_MINT })
        .sendTransaction(),
      ANCHOR_ERROR__CONSTRAINT_SEEDS,
    );
    // Another host's event is theirs to review, not this host's.
    const otherHost = await createWallet(chain);
    const theirs = await createEvent(chain, { organizer: otherHost, terms: { requiresApproval: true } });
    await signUp(chain, theirs, await createGuest(chain));
    await expectTransactionError(approveApplication(chain, first, samAtFirst, otherHost), VENI_ERROR__NOT_ORGANIZER);

    await approveApplication(chain, first, samAtFirst);
    await removeApplication(chain, second, sam.address);

    const [atFirst, atSecond] = await Promise.all([first, second].map((event) => fetchEvent(chain, event)));
    expect([atFirst.guestCount, atFirst.applicantCount]).toEqual([1, 0]);
    expect([atSecond.guestCount, atSecond.applicantCount]).toEqual([0, 0]);
    expect(await usdcBalance(chain, first)).toBe(10n * USDC);
    expect(await usdcBalance(chain, second)).toBe(0n);
    expect(await usdcBalance(chain, sam.address)).toBe(10n * USDC);
  });

  test("an open event and an approval event, with one host and door key, settle together with the right money", async () => {
    const chain = await createTestChain();
    const open = await createEvent(chain, { eventId: 1n });
    const curated = await createEvent(chain, { eventId: 2n, terms: { requiresApproval: true } });
    // Sam goes to both. At the open event, Ana comes and Ben doesn't. At the
    // approval event, Cy is approved and doesn't come, and Dee is never reviewed.
    const sam = await createGuest(chain, 20n * USDC);
    const [ana, ben, cy, dee] = await Promise.all([createGuest(chain), createGuest(chain), createGuest(chain), createGuest(chain)]);
    for (const guest of [sam, ana, ben]) await signUp(chain, open, guest);
    for (const guest of [sam, cy, dee]) await signUp(chain, curated, guest);
    for (const guest of [sam, cy]) await approveApplication(chain, curated, await guestAddressOf(chain, curated, guest.address));
    await scanCheckInCode(chain, open, sam, 1n);
    await scanCheckInCode(chain, open, ana, 2n);
    // Each door counts its own codes, though the same key signs both.
    await scanCheckInCode(chain, curated, sam, 1n);

    const [atOpen, atCurated] = await Promise.all([open, curated].map((event) => fetchEvent(chain, event)));
    expect([atOpen.guestCount, atOpen.attendedCount, atOpen.applicantCount]).toEqual([3, 2, 0]);
    expect([atCurated.guestCount, atCurated.attendedCount, atCurated.applicantCount]).toEqual([2, 1, 1]);

    jumpTo(chain, CHECK_IN_ENDS_AT);
    expect(await runCrank(chain)).toEqual({ settled: 2, guestsClosed: 6, eventsClosed: 2, waiting: [], errors: [] });

    // Open: Ben's $10 lost, $1 to the treasury, $4.50 more each for Sam and Ana.
    // Approval: Cy's $10 lost, $1 to the treasury, $9 more for Sam. Dee was never a guest: all $10 back.
    expect(await usdcBalance(chain, sam.address)).toBe(33_500_000n);
    expect(await usdcBalance(chain, ana.address)).toBe(14_500_000n);
    expect(await usdcBalance(chain, ben.address)).toBe(0n);
    expect(await usdcBalance(chain, cy.address)).toBe(0n);
    expect(await usdcBalance(chain, dee.address)).toBe(10n * USDC);
    expect(await usdcBalance(chain, TREASURY)).toBe(2n * USDC);
    expect(accountsLeftBehind(chain)).toHaveLength(0);
  });
});

describe("a paid event at the same time as a free one", () => {
  test("each host's ticket money stays with their own event, and one crank run pays both events' guests", async () => {
    const chain = await createTestChain();
    const [paidHost, freeHost] = await Promise.all([createWallet(chain), createWallet(chain)]);
    for (const host of [paidHost, freeHost]) await giveUsdc(chain, host.address, 0n);
    const paid = await createEvent(chain, { organizer: paidHost, terms: { ticketPrice: 25n * USDC, stakeAmount: 5n * USDC } });
    const free = await createEvent(chain, { organizer: freeHost });
    // Sam goes to both. Ana signs up for the paid one and Ben for the free one; neither comes.
    const sam = await createGuest(chain, 40n * USDC);
    const ana = await createGuest(chain, 30n * USDC);
    const ben = await createGuest(chain, 10n * USDC);
    for (const event of [paid, free]) await signUp(chain, event, sam);
    await signUp(chain, paid, ana);
    await signUp(chain, free, ben);
    await scanCheckInCode(chain, paid, sam, 1n);
    await scanCheckInCode(chain, free, sam, 1n);

    jumpTo(chain, CHECK_IN_ENDS_AT);
    // Both settle and pay their guests. The free event closes; the paid one holds its tickets.
    expect(await runCrank(chain)).toEqual({ settled: 2, guestsClosed: 4, eventsClosed: 1, waiting: [], errors: [] });

    // Paid: $5 back plus Ana's $5 less $0.50. Free: $10 back plus Ben's $10 less $1.
    expect(await usdcBalance(chain, sam.address)).toBe(28_500_000n);
    expect(await usdcBalance(chain, ana.address)).toBe(0n);
    expect(await usdcBalance(chain, ben.address)).toBe(0n);
    expect(await usdcBalance(chain, paidHost.address)).toBe(0n);

    jumpTo(chain, CHECK_IN_ENDS_AT + TICKET_HOLD_SECONDS);
    expect(await runCrank(chain)).toEqual({ settled: 0, guestsClosed: 0, eventsClosed: 1, waiting: [], errors: [] });
    // Two tickets, Ana's included, to the paid event's host only, less Veni's 1% ($0.50).
    expect(await usdcBalance(chain, paidHost.address)).toBe(49_500_000n);
    expect(await usdcBalance(chain, freeHost.address)).toBe(0n);
    expect(await usdcBalance(chain, TREASURY)).toBe(1_500_000n + 500_000n);
    expect(accountsLeftBehind(chain)).toHaveLength(0);
  });
});
