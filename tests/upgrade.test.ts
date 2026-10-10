// Upgrading from the program before stamps: the events and guests it made must
// still pay out and close under the current program. The fixture is that
// program as deployed on devnet at slot 509419045.
import { describe, expect, test } from "bun:test";
import { getCloseGuestInstructionAsync, TICKET_HOLD_SECONDS, TREASURY, USDC_MINT, VENI_PROGRAM_ADDRESS } from "@veni/client";
import { createTestChain, createWallet, giveUsdc, jumpTo, type TestChain } from "./litesvm";
import {
  accountsLeftBehind,
  CHECK_IN_ENDS_AT,
  checkIn,
  closeEvent,
  closeGuest,
  createEventWithGuests,
  createSettledEvent,
  settleEvent,
  stampCountOf,
  USDC,
  usdcBalance,
  usdcTokenAccountOf,
} from "./events";

const BEFORE_STAMPS = "tests/fixtures/veni-before-stamps.so";
const CURRENT = "target/deploy/veni.so";

function deploy(chain: TestChain, program: string) {
  chain.svm.addProgramFromFile(VENI_PROGRAM_ADDRESS, program);
}

/** close_guest as the program before stamps took it: no stamp count, payer or log accounts. */
async function closeGuestBeforeStamps(chain: TestChain, event: Parameters<typeof closeGuest>[1], wallet: Parameters<typeof closeGuest>[2]) {
  const instruction = await getCloseGuestInstructionAsync({ event, wallet, stakeMint: USDC_MINT, payer: chain.payer });
  // Now: event, guest, stamp count, wallet, mint, vault, wallet's token account, payer, token program, system program, log authority, program.
  const before = [0, 1, 3, 4, 5, 6, 8].map((index) => instruction.accounts[index]);
  return chain.sendTransaction([{ ...instruction, accounts: before }]);
}

describe("upgrading from the program before stamps", () => {
  test("an event it settled pays out and stamps attendees under the current program", async () => {
    const chain = await createTestChain();
    deploy(chain, BEFORE_STAMPS);
    const { event, attendees, noShows } = await createSettledEvent(chain, 3, 2);

    deploy(chain, CURRENT);
    for (const { wallet } of [...attendees, ...noShows]) await closeGuest(chain, event, wallet.address);
    await closeEvent(chain, event, chain.identity.address);

    // The no-show's $10: $1 to the treasury, $4.50 to each of the two who came.
    for (const { wallet } of attendees) {
      expect(await usdcBalance(chain, wallet.address)).toBe(14_500_000n);
      expect(await stampCountOf(chain, wallet.address)).toBe(1);
    }
    expect(await stampCountOf(chain, noShows[0].wallet.address)).toBe(0);
    expect(await usdcBalance(chain, TREASURY)).toBe(1n * USDC);
    expect(accountsLeftBehind(chain)).toHaveLength(0);
  });

  test("guests it already closed stay closed, and the rest close under the current program", async () => {
    const chain = await createTestChain();
    deploy(chain, BEFORE_STAMPS);
    const { event, attendees, noShows } = await createSettledEvent(chain, 3, 2);
    await closeGuestBeforeStamps(chain, event, attendees[0].wallet.address);

    deploy(chain, CURRENT);
    for (const { wallet } of [attendees[1], ...noShows]) await closeGuest(chain, event, wallet.address);
    await closeEvent(chain, event, chain.identity.address);

    for (const { wallet } of attendees) expect(await usdcBalance(chain, wallet.address)).toBe(14_500_000n);
    // Paid before stamps existed, so no stamp.
    expect(await stampCountOf(chain, attendees[0].wallet.address)).toBe(0);
    expect(await stampCountOf(chain, attendees[1].wallet.address)).toBe(1);
    expect(accountsLeftBehind(chain)).toHaveLength(0);
  });

  test("ticket money it held is paid to the organizer under the current program", async () => {
    const chain = await createTestChain();
    const organizer = await createWallet(chain);
    await giveUsdc(chain, organizer.address, 0n);
    deploy(chain, BEFORE_STAMPS);
    const { event, guests } = await createEventWithGuests(chain, 2, {
      organizer,
      terms: { ticketPrice: 25n * USDC, stakeAmount: 5n * USDC },
    });
    await checkIn(chain, event, guests[0].wallet.address);
    jumpTo(chain, CHECK_IN_ENDS_AT);
    await settleEvent(chain, event);
    for (const { wallet } of guests) await closeGuestBeforeStamps(chain, event, wallet.address);

    deploy(chain, CURRENT);
    jumpTo(chain, CHECK_IN_ENDS_AT + TICKET_HOLD_SECONDS);
    await closeEvent(chain, event, organizer.address, { organizerTokenAccount: await usdcTokenAccountOf(organizer.address) });

    expect(await usdcBalance(chain, organizer.address)).toBe(50n * USDC);
    expect(accountsLeftBehind(chain)).toHaveLength(0);
  });
});
