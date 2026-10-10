// Events that require approval: guests apply with their stake, and only the
// organizer can turn an application into a spot.
import { describe, expect, test } from "bun:test";
import {
  VENI_ERROR__ALREADY_APPROVED,
  VENI_ERROR__APPLICANTS_STILL_OPEN,
  VENI_ERROR__APPLICATION_PENDING,
  VENI_ERROR__APPROVAL_CLOSED,
  VENI_ERROR__EVENT_CANCELLED,
  VENI_ERROR__EVENT_FULL,
  VENI_ERROR__NOT_APPROVED,
  VENI_ERROR__NOT_ORGANIZER,
  VENI_ERROR__NOT_ORGANIZER_OR_APPLICANT,
  TREASURY,
} from "@veni/client";
import { createTestChain, createWallet, expectTransactionError, jumpTo } from "./litesvm";
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
  createGuest,
  guestAddressOf,
  removeApplication,
  signUp,
  RSVP_ENDS_AT,
  scanCheckInCode,
  settleEvent,
  solBalance,
  USDC,
  usdcBalance,
} from "./events";

describe("applying", () => {
  test("holds the stake but takes no spot until the host approves", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithApplicants(chain, 1);
    const [{ wallet, guest }] = guests;

    expect(await usdcBalance(chain, event)).toBe(10n * USDC);
    expect((await chain.veni.accounts.event.fetch(event)).data).toMatchObject({ guestCount: 0, applicantCount: 1 });
    expect((await chain.veni.accounts.guest.fetch(guest)).data).toMatchObject({ wallet: wallet.address, isApproved: false });

    await approveApplication(chain, event, guest);

    expect((await chain.veni.accounts.event.fetch(event)).data).toMatchObject({ guestCount: 1, applicantCount: 0 });
    expect((await chain.veni.accounts.guest.fetch(guest)).data.isApproved).toBe(true);
  });

  test("at an event anyone can join, signing up is approved straight away", async () => {
    const chain = await createTestChain();
    const event = await createEvent(chain);
    const wallet = await createGuest(chain);

    await signUp(chain, event, wallet);

    const guest = await chain.veni.accounts.guest.fetch(await guestAddressOf(chain, event, wallet.address));
    expect(guest.data.isApproved).toBe(true);
    expect((await chain.veni.accounts.event.fetch(event)).data).toMatchObject({ guestCount: 1, applicantCount: 0 });
  });

  test("an applicant can't check in, by the host or by scanning, until approved", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithApplicants(chain, 1);
    const [{ wallet, guest }] = guests;

    await expectTransactionError(checkIn(chain, event, wallet.address), VENI_ERROR__NOT_APPROVED);
    await expectTransactionError(scanCheckInCode(chain, event, wallet, 1n), VENI_ERROR__NOT_APPROVED);

    await approveApplication(chain, event, guest);
    await scanCheckInCode(chain, event, wallet, 2n);
    expect((await chain.veni.accounts.event.fetch(event)).data.attendedCount).toBe(1);
  });
});

describe("approve_application", () => {
  test("only the organizer can approve", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithApplicants(chain, 1);
    const stranger = await createWallet(chain);

    await expectTransactionError(approveApplication(chain, event, guests[0].guest, stranger), VENI_ERROR__NOT_ORGANIZER);
  });

  test("refuses to approve the same guest twice", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithApplicants(chain, 1);
    await approveApplication(chain, event, guests[0].guest);
    chain.svm.expireBlockhash();

    await expectTransactionError(approveApplication(chain, event, guests[0].guest), VENI_ERROR__ALREADY_APPROVED);
    expect((await chain.veni.accounts.event.fetch(event)).data.guestCount).toBe(1);
  });

  test("stops at capacity", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithApplicants(chain, 2, { terms: { capacity: 1 } });
    await approveApplication(chain, event, guests[0].guest);

    await expectTransactionError(approveApplication(chain, event, guests[1].guest), VENI_ERROR__EVENT_FULL);
  });

  test("stops once RSVPs close, or once the event is cancelled", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithApplicants(chain, 2);
    await cancelEvent(chain, event);
    await expectTransactionError(approveApplication(chain, event, guests[0].guest), VENI_ERROR__EVENT_CANCELLED);

    const other = await createEventWithApplicants(chain, 1, { eventId: 2n });
    jumpTo(chain, RSVP_ENDS_AT);
    await expectTransactionError(approveApplication(chain, other.event, other.guests[0].guest), VENI_ERROR__APPROVAL_CLOSED);
  });
});

describe("remove_application", () => {
  test("the host declines: the whole stake and the account's rent go straight back", async () => {
    const chain = await createTestChain();
    const event = await createEvent(chain, { terms: { requiresApproval: true } });
    const wallet = await createGuest(chain);
    const solBefore = await solBalance(chain, wallet.address);
    await signUp(chain, event, wallet);

    await removeApplication(chain, event, wallet.address);

    expect(await usdcBalance(chain, wallet.address)).toBe(10n * USDC);
    expect(await solBalance(chain, wallet.address)).toBe(solBefore);
    expect(await usdcBalance(chain, event)).toBe(0n);
    const guest = await chain.rpc.getAccountInfo(await guestAddressOf(chain, event, wallet.address)).send();
    expect(guest.value).toBeNull();
    expect((await chain.veni.accounts.event.fetch(event)).data.applicantCount).toBe(0);
  });

  test("the applicant withdraws the same way", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithApplicants(chain, 1);
    const [{ wallet }] = guests;

    await removeApplication(chain, event, wallet.address, wallet);

    expect(await usdcBalance(chain, wallet.address)).toBe(10n * USDC);
  });

  test("nobody else can take back an application", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithApplicants(chain, 1);
    const stranger = await createWallet(chain);

    await expectTransactionError(
      removeApplication(chain, event, guests[0].wallet.address, stranger),
      VENI_ERROR__NOT_ORGANIZER_OR_APPLICANT,
    );
    expect(await usdcBalance(chain, event)).toBe(10n * USDC);
  });

  test("an approved guest can't be removed like an application", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithApplicants(chain, 1);
    await approveApplication(chain, event, guests[0].guest);

    await expectTransactionError(removeApplication(chain, event, guests[0].wallet.address), VENI_ERROR__ALREADY_APPROVED);
  });
});

describe("applications nobody approved", () => {
  test("are refunded once RSVPs close, and never touch the attendees' payout", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithApplicants(chain, 3);
    const [attendee, noShow, waiting] = guests;
    await approveApplication(chain, event, attendee.guest);
    await approveApplication(chain, event, noShow.guest);
    await checkIn(chain, event, attendee.wallet.address);
    jumpTo(chain, CHECK_IN_ENDS_AT);
    await settleEvent(chain, event);

    // The attendee is paid first, while the waiting applicant's stake is still in the vault.
    await closeGuest(chain, event, attendee.wallet.address);
    await closeGuest(chain, event, waiting.wallet.address);
    await closeGuest(chain, event, noShow.wallet.address);
    await closeEvent(chain, event, chain.identity.address);

    // The no-show's $10: $1 to the treasury, $9 to the attendee.
    expect(await usdcBalance(chain, attendee.wallet.address)).toBe(19n * USDC);
    expect(await usdcBalance(chain, waiting.wallet.address)).toBe(10n * USDC);
    expect(await usdcBalance(chain, noShow.wallet.address)).toBe(0n);
    expect(await usdcBalance(chain, TREASURY)).toBe(1n * USDC);
    expect(accountsLeftBehind(chain)).toHaveLength(0);
  });

  test("can't be refunded through close_guest while RSVPs are open", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithApplicants(chain, 1);

    await expectTransactionError(closeGuest(chain, event, guests[0].wallet.address), VENI_ERROR__APPLICATION_PENDING);
  });

  test("are refunded right away when the event is cancelled", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithApplicants(chain, 1);
    await cancelEvent(chain, event);

    await closeGuest(chain, event, guests[0].wallet.address);

    expect(await usdcBalance(chain, guests[0].wallet.address)).toBe(10n * USDC);
  });

  test("keep the event open until they're refunded, so their stakes never go to the treasury", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithApplicants(chain, 1);
    jumpTo(chain, RSVP_ENDS_AT);

    await expectTransactionError(closeEvent(chain, event, chain.identity.address), VENI_ERROR__APPLICANTS_STILL_OPEN);

    await closeGuest(chain, event, guests[0].wallet.address);
    // The same close again: a new blockhash keeps it from being refused as a duplicate.
    chain.svm.expireBlockhash();
    await closeEvent(chain, event, chain.identity.address);
    expect(await usdcBalance(chain, guests[0].wallet.address)).toBe(10n * USDC);
    expect(await usdcBalance(chain, TREASURY)).toBe(0n);
  });
});

