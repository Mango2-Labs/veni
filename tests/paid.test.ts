// Paid events: guests pay the organizer for a ticket on top of a small stake.
// The ticket money waits in the vault until a day after check-in closes, then
// goes to the organizer, unless every guest is refunded. Stakes don't wait.
// Veni keeps 1% of the ticket money.
import { describe, expect, test } from "bun:test";
import { TOKEN_ERROR__INSUFFICIENT_FUNDS } from "@solana-program/token";
import {
  VENI_ERROR__HOST_TOKEN_ACCOUNT_MISSING,
  VENI_ERROR__STAKE_TOO_LARGE_FOR_PAID_EVENT,
  VENI_ERROR__TICKET_PRICE_TOO_LARGE,
  VENI_ERROR__TICKETS_ON_HOLD,
  TICKET_HOLD_SECONDS,
  TREASURY,
} from "@veni/client";
import { runCrank } from "@veni/crank";
import { createTestChain, createWallet, expectTransactionError, giveUsdc, jumpTo, type TestChain } from "./litesvm";
import {
  accountsLeftBehind,
  approveApplication,
  cancelEvent,
  CHECK_IN_ENDS_AT,
  checkIn,
  closeEvent,
  closeGuest,
  createEvent,
  createEventWithApplicants,
  createEventWithGuests,
  createGuest,
  removeApplication,
  RSVP_ENDS_AT,
  signUp,
  settleEvent,
  USDC,
  usdcBalance,
  usdcTokenAccountOf,
} from "./events";

/** A $25 ticket with a $5 stake: $30 to sign up. */
const PAID = { ticketPrice: 25n * USDC, stakeAmount: 5n * USDC };
/** When the organizer's ticket money stops being held. */
const TICKETS_PAID_AT = CHECK_IN_ENDS_AT + TICKET_HOLD_SECONDS;

/** An organizer with an empty USDC account, so they can be paid for tickets. */
async function createOrganizer(chain: TestChain) {
  const organizer = await createWallet(chain);
  await giveUsdc(chain, organizer.address, 0n);
  return organizer;
}

describe("creating a paid event", () => {
  test("allows a ticket with a stake of exactly $5", async () => {
    const chain = await createTestChain();

    const event = await createEvent(chain, { terms: PAID });

    expect((await chain.veni.accounts.event.fetch(event)).data.terms).toMatchObject(PAID);
  });

  test("refuses a stake over $5 when there's a ticket price, but not at a free event", async () => {
    const chain = await createTestChain();

    await expectTransactionError(
      createEvent(chain, { terms: { ticketPrice: 25n * USDC, stakeAmount: 5n * USDC + 1n } }),
      VENI_ERROR__STAKE_TOO_LARGE_FOR_PAID_EVENT,
    );
    await createEvent(chain, { eventId: 2n, terms: { ticketPrice: 0n, stakeAmount: 100n * USDC } });
  });

  test("allows a ticket of exactly 1,000 tokens and refuses one cent more", async () => {
    const chain = await createTestChain();

    await createEvent(chain, { terms: { ticketPrice: 1_000n * USDC, stakeAmount: 5n * USDC } });
    await expectTransactionError(
      createEvent(chain, { eventId: 2n, terms: { ticketPrice: 1_000n * USDC + 1n, stakeAmount: 5n * USDC } }),
      VENI_ERROR__TICKET_PRICE_TOO_LARGE,
    );
  });
});

describe("signing up for a paid event", () => {
  test("takes the ticket and the stake into the vault", async () => {
    const chain = await createTestChain();
    const event = await createEvent(chain, { terms: PAID });
    const wallet = await createGuest(chain, 40n * USDC);

    await signUp(chain, event, wallet);

    expect(await usdcBalance(chain, wallet.address)).toBe(10n * USDC);
    expect(await usdcBalance(chain, event)).toBe(30n * USDC);
  });

  test("refuses a wallet holding less than the ticket and the stake together", async () => {
    const chain = await createTestChain();
    const event = await createEvent(chain, { terms: PAID });
    const wallet = await createGuest(chain, 30n * USDC - 1n);

    await expectTransactionError(signUp(chain, event, wallet), TOKEN_ERROR__INSUFFICIENT_FUNDS);
  });
});

describe("after a paid event", () => {
  test("the organizer gets every ticket less Veni's 1%, attendees their stake and a share, and Veni 10% of no-show stakes", async () => {
    const chain = await createTestChain();
    const organizer = await createOrganizer(chain);
    const { event, guests } = await createEventWithGuests(chain, 3, { organizer, terms: PAID });
    const [first, second, noShow] = guests;
    for (const { wallet } of [first, second]) await checkIn(chain, event, wallet.address);
    jumpTo(chain, CHECK_IN_ENDS_AT);
    await settleEvent(chain, event);

    for (const { wallet } of guests) await closeGuest(chain, event, wallet.address);
    jumpTo(chain, TICKETS_PAID_AT);
    await closeEvent(chain, event, organizer.address, { organizerTokenAccount: await usdcTokenAccountOf(organizer.address) });

    // The no-show's $5 stake: $0.50 to the treasury, $2.25 to each of the two who came.
    expect(await usdcBalance(chain, first.wallet.address)).toBe(7_250_000n);
    expect(await usdcBalance(chain, second.wallet.address)).toBe(7_250_000n);
    expect(await usdcBalance(chain, noShow.wallet.address)).toBe(0n);
    // Three tickets, the no-show's included, less Veni's 1% ($0.75).
    expect(await usdcBalance(chain, organizer.address)).toBe(74_250_000n);
    expect(await usdcBalance(chain, TREASURY)).toBe(500_000n + 750_000n);
    expect(accountsLeftBehind(chain)).toHaveLength(0);
  });

  test("close_event refuses to leave out the organizer's token account while it owes them for tickets", async () => {
    const chain = await createTestChain();
    const organizer = await createOrganizer(chain);
    const { event, guests } = await createEventWithGuests(chain, 1, { organizer, terms: PAID });
    await checkIn(chain, event, guests[0].wallet.address);
    jumpTo(chain, CHECK_IN_ENDS_AT);
    await settleEvent(chain, event);
    await closeGuest(chain, event, guests[0].wallet.address);
    jumpTo(chain, TICKETS_PAID_AT);

    await expectTransactionError(closeEvent(chain, event, organizer.address), VENI_ERROR__HOST_TOKEN_ACCOUNT_MISSING);
    expect(await usdcBalance(chain, event)).toBe(25n * USDC);
  });

  test("a cancelled paid event refunds every ticket and stake at once, and the organizer gets nothing", async () => {
    const chain = await createTestChain();
    const organizer = await createOrganizer(chain);
    const { event, guests } = await createEventWithGuests(chain, 2, { organizer, terms: PAID });
    await cancelEvent(chain, event, organizer);

    for (const { wallet } of guests) await closeGuest(chain, event, wallet.address);
    await closeEvent(chain, event, organizer.address);

    for (const { wallet } of guests) expect(await usdcBalance(chain, wallet.address)).toBe(30n * USDC);
    expect(await usdcBalance(chain, organizer.address)).toBe(0n);
  });

  test("when nobody checked in, every ticket and stake comes back at once, and the organizer gets nothing", async () => {
    const chain = await createTestChain();
    const organizer = await createOrganizer(chain);
    const { event, guests } = await createEventWithGuests(chain, 2, { organizer, terms: PAID });
    jumpTo(chain, CHECK_IN_ENDS_AT);
    await settleEvent(chain, event);

    for (const { wallet } of guests) await closeGuest(chain, event, wallet.address);
    await closeEvent(chain, event, organizer.address);

    for (const { wallet } of guests) expect(await usdcBalance(chain, wallet.address)).toBe(30n * USDC);
    expect(await usdcBalance(chain, organizer.address)).toBe(0n);
    expect(await usdcBalance(chain, TREASURY)).toBe(0n);
  });

  test("holds the organizer's ticket money for a day after check-in closes, but pays attendees at once", async () => {
    const chain = await createTestChain();
    const organizer = await createOrganizer(chain);
    const { event, guests } = await createEventWithGuests(chain, 2, { organizer, terms: PAID });
    const [attendee, noShow] = guests;
    await checkIn(chain, event, attendee.wallet.address);
    jumpTo(chain, CHECK_IN_ENDS_AT);
    await settleEvent(chain, event);
    for (const { wallet } of guests) await closeGuest(chain, event, wallet.address);
    const organizerTokenAccount = await usdcTokenAccountOf(organizer.address);

    // $5 back, plus the no-show's $5 less Veni's $0.50.
    expect(await usdcBalance(chain, attendee.wallet.address)).toBe(9_500_000n);
    expect(await usdcBalance(chain, noShow.wallet.address)).toBe(0n);
    jumpTo(chain, TICKETS_PAID_AT - 1n);
    await expectTransactionError(closeEvent(chain, event, organizer.address, { organizerTokenAccount }), VENI_ERROR__TICKETS_ON_HOLD);
    // Only the two tickets are left: Veni's fee went to the treasury when the event settled.
    expect(await usdcBalance(chain, event)).toBe(50n * USDC);

    jumpTo(chain, TICKETS_PAID_AT);
    chain.svm.expireBlockhash(); // the same transaction again, so it needs a new blockhash
    await closeEvent(chain, event, organizer.address, { organizerTokenAccount });
    expect(await usdcBalance(chain, organizer.address)).toBe(49_500_000n);
  });

  test("counts the hold from when check-in closes, even when everyone checked in early", async () => {
    const chain = await createTestChain();
    const organizer = await createOrganizer(chain);
    const { event, guests } = await createEventWithGuests(chain, 2, { organizer, terms: PAID });
    for (const { wallet } of guests) await checkIn(chain, event, wallet.address);
    jumpTo(chain, RSVP_ENDS_AT);
    await settleEvent(chain, event);
    for (const { wallet } of guests) await closeGuest(chain, event, wallet.address);
    const organizerTokenAccount = await usdcTokenAccountOf(organizer.address);

    jumpTo(chain, RSVP_ENDS_AT + TICKET_HOLD_SECONDS);
    await expectTransactionError(closeEvent(chain, event, organizer.address, { organizerTokenAccount }), VENI_ERROR__TICKETS_ON_HOLD);
    jumpTo(chain, TICKETS_PAID_AT);
    chain.svm.expireBlockhash(); // the same transaction again, so it needs a new blockhash
    await closeEvent(chain, event, organizer.address, { organizerTokenAccount });
    expect(await usdcBalance(chain, organizer.address)).toBe(49_500_000n);
  });

  test("declined and unreviewed applications get their ticket back too, and only approved guests pay the organizer", async () => {
    const chain = await createTestChain();
    const organizer = await createOrganizer(chain);
    const { event, guests } = await createEventWithApplicants(chain, 3, { organizer, terms: PAID });
    const [approved, declined, waiting] = guests;
    await approveApplication(chain, event, approved.guest, organizer);
    await removeApplication(chain, event, declined.wallet.address, organizer);
    expect(await usdcBalance(chain, declined.wallet.address)).toBe(30n * USDC);
    await checkIn(chain, event, approved.wallet.address);
    jumpTo(chain, CHECK_IN_ENDS_AT);
    await settleEvent(chain, event);

    // The attendee is paid before the waiting application is refunded.
    await closeGuest(chain, event, approved.wallet.address);
    await closeGuest(chain, event, waiting.wallet.address);
    jumpTo(chain, TICKETS_PAID_AT);
    await closeEvent(chain, event, organizer.address, { organizerTokenAccount: await usdcTokenAccountOf(organizer.address) });

    expect(await usdcBalance(chain, approved.wallet.address)).toBe(5n * USDC);
    expect(await usdcBalance(chain, waiting.wallet.address)).toBe(30n * USDC);
    expect(await usdcBalance(chain, organizer.address)).toBe(24_750_000n);
  });
});

describe("the crank at a paid event", () => {
  test("pays attendees once check-in closes, and the organizer for every ticket, less Veni's 1%, a day later", async () => {
    const chain = await createTestChain();
    const organizer = await createOrganizer(chain);
    const { event, guests } = await createEventWithGuests(chain, 2, { organizer, terms: PAID });
    await checkIn(chain, event, guests[0].wallet.address);
    jumpTo(chain, CHECK_IN_ENDS_AT);

    expect(await runCrank(chain)).toEqual({ settled: 1, guestsClosed: 2, eventsClosed: 0, waiting: [], errors: [] });
    // $5 back, plus the no-show's $5 less Veni's $0.50.
    expect(await usdcBalance(chain, guests[0].wallet.address)).toBe(9_500_000n);
    expect(await usdcBalance(chain, organizer.address)).toBe(0n);

    jumpTo(chain, TICKETS_PAID_AT);
    expect(await runCrank(chain)).toEqual({ settled: 0, guestsClosed: 0, eventsClosed: 1, waiting: [], errors: [] });
    expect(await usdcBalance(chain, organizer.address)).toBe(49_500_000n);
    expect(accountsLeftBehind(chain)).toHaveLength(0);
  });

  test("waits for an organizer with no token account, after paying every guest", async () => {
    const chain = await createTestChain();
    const organizer = await createWallet(chain);
    const { event, guests } = await createEventWithGuests(chain, 1, { organizer, terms: PAID });
    await checkIn(chain, event, guests[0].wallet.address);
    jumpTo(chain, CHECK_IN_ENDS_AT);
    expect(await runCrank(chain)).toMatchObject({ settled: 1, guestsClosed: 1, eventsClosed: 0, waiting: [], errors: [] });
    expect(await usdcBalance(chain, guests[0].wallet.address)).toBe(5n * USDC);

    jumpTo(chain, TICKETS_PAID_AT);
    const report = await runCrank(chain);

    expect(report).toMatchObject({ eventsClosed: 0, errors: [] });
    expect(report.waiting).toEqual([`${organizer.address} is owed ticket money but has no token account to be paid into`]);

    await giveUsdc(chain, organizer.address, 0n);
    expect(await runCrank(chain)).toMatchObject({ eventsClosed: 1, errors: [] });
    expect(await usdcBalance(chain, organizer.address)).toBe(24_750_000n);
  });
});
