// Compute ceilings: each instruction must stay well inside Solana's default
// 200,000 units, and a change that makes one much costlier fails here first.
// Each ceiling is about 1.5 times what the instruction uses today.
import { describe, expect, test } from "bun:test";
import type { Signature } from "@solana/kit";
import { TICKET_HOLD_SECONDS } from "@veni/client";
import { createTestChain, createWallet, giveUsdc, jumpTo, type TestChain } from "./litesvm";
import {
  approveApplication,
  cancelEvent,
  CHECK_IN_ENDS_AT,
  checkIn,
  closeEvent,
  closeGuest,
  createEventInstruction,
  createGuest,
  eventAddressOf,
  guestAddressOf,
  removeApplication,
  scanCheckInCode,
  settleEvent,
  signUp,
  usdcTokenAccountOf,
} from "./events";

const CEILINGS = {
  create_event: 52_000,
  sign_up: 31_000,
  approve_application: 10_000,
  remove_application: 29_000,
  check_in_guest: 11_000,
  check_in_with_code: 14_000,
  cancel_event: 8_000,
  settle_event: 23_000,
  "close_guest, first stamp": 38_000,
  "close_guest, later stamp": 33_000,
  "close_guest, no-show": 27_000,
  close_event: 22_000,
  "close_event, paying tickets": 40_000,
} as const;

type Used = Partial<Record<keyof typeof CEILINGS, number>>;

function computeOf(chain: TestChain, result: { context: { signature: Signature } }) {
  const transaction = chain.svm.getTransaction(result.context.signature);
  if (!transaction || !("computeUnitsConsumed" in transaction)) throw new Error("No successful transaction");
  return Number(transaction.computeUnitsConsumed());
}

describe("compute", () => {
  test("every instruction stays under its ceiling", async () => {
    const chain = await createTestChain();
    const used: Used = {};
    const organizer = await createWallet(chain);
    await giveUsdc(chain, organizer.address, 0n);

    // A paid event: three sign up, one scans in, one is checked in at the door.
    used.create_event = computeOf(chain, await createEventInstruction(chain, { organizer, terms: { ticketPrice: 25_000_000n, stakeAmount: 5_000_000n } }).sendTransaction());
    const event = await eventAddressOf(chain, 1n, organizer.address);
    const [first, second, noShow] = await Promise.all([1, 2, 3].map(() => createGuest(chain, 30_000_000n)));
    used.sign_up = computeOf(chain, await signUp(chain, event, first));
    await signUp(chain, event, second);
    await signUp(chain, event, noShow);
    used.check_in_with_code = computeOf(chain, await scanCheckInCode(chain, event, first, 1n));
    used.check_in_guest = computeOf(chain, await checkIn(chain, event, second.address));
    jumpTo(chain, CHECK_IN_ENDS_AT);
    used.settle_event = computeOf(chain, await settleEvent(chain, event));
    used["close_guest, first stamp"] = computeOf(chain, await closeGuest(chain, event, first.address));
    used["close_guest, no-show"] = computeOf(chain, await closeGuest(chain, event, noShow.address));
    await closeGuest(chain, event, second.address);
    jumpTo(chain, CHECK_IN_ENDS_AT + TICKET_HOLD_SECONDS);
    used["close_event, paying tickets"] = computeOf(
      chain,
      await closeEvent(chain, event, organizer.address, { organizerTokenAccount: await usdcTokenAccountOf(organizer.address) }),
    );

    // A second event on a fresh chain: approval, a withdrawal, a later stamp, a free close.
    const later = await createTestChain();
    const regular = await createGuest(later, 20_000_000n);
    const applicant = await createGuest(later, 10_000_000n);
    for (const eventId of [1n, 2n]) {
      await createEventInstruction(later, { eventId, terms: { requiresApproval: eventId === 2n } }).sendTransaction();
    }
    const [freeEvent, approvalEvent] = await Promise.all([1n, 2n].map((eventId) => eventAddressOf(later, eventId)));
    await signUp(later, freeEvent, regular);
    await signUp(later, approvalEvent, regular);
    await signUp(later, approvalEvent, applicant);
    used.approve_application = computeOf(later, await approveApplication(later, approvalEvent, await guestAddressOf(later, approvalEvent, regular.address)));
    used.remove_application = computeOf(later, await removeApplication(later, approvalEvent, applicant.address));
    for (const event of [freeEvent, approvalEvent]) await checkIn(later, event, regular.address);
    jumpTo(later, CHECK_IN_ENDS_AT);
    for (const event of [freeEvent, approvalEvent]) await settleEvent(later, event);
    await closeGuest(later, freeEvent, regular.address);
    used["close_guest, later stamp"] = computeOf(later, await closeGuest(later, approvalEvent, regular.address));
    used.close_event = computeOf(later, await closeEvent(later, freeEvent, later.identity.address));

    // A cancel, on its own chain.
    const cancelled = await createTestChain();
    await createEventInstruction(cancelled).sendTransaction();
    used.cancel_event = computeOf(cancelled, await cancelEvent(cancelled, await eventAddressOf(cancelled, 1n)));

    const overCeiling = Object.entries(CEILINGS)
      .filter(([instruction, ceiling]) => !(used[instruction as keyof Used]! <= ceiling))
      .map(([instruction, ceiling]) => ({ instruction, used: used[instruction as keyof Used], ceiling }));
    expect(overCeiling).toEqual([]);
  });
});
