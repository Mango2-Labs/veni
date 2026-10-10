// Stamps: close_guest adds one to each paid attendee's stamp count and logs it.
import { describe, expect, test } from "bun:test";
import { lamports } from "@solana/kit";
import { USDC_MINT, VENI_ERROR__NOT_SETTLED, VENI_PROGRAM_ADDRESS } from "@veni/client";
import { createTestChain, DAY_SECONDS, expectTransactionError, jumpTo, type TestChain } from "./litesvm";
import {
  accountsLeftBehind,
  cancelEvent,
  CHECK_IN_ENDS_AT,
  checkIn,
  closeEvent,
  closeGuest,
  createEvent,
  createEventWithApplicants,
  createEventWithGuests,
  createSettledEvent,
  RSVP_ENDS_AT,
  settleEvent,
  signUp,
  solBalance,
  stampCountOf,
  stampsLoggedBy,
  usdcBalance,
} from "./events";

/** Anchor's error when an account isn't at the address its seeds give. */
const CONSTRAINT_SEEDS = 2006;

/** What a stamp count holds: 13 bytes' rent. */
function stampDepositOf(chain: TestChain) {
  return chain.svm.minimumBalanceForRentExemption(13n);
}

async function stampCountAddressOf(chain: TestChain, wallet: Parameters<typeof stampCountOf>[1]) {
  const [address] = await chain.veni.pdas.stampCount({ wallet });
  return address;
}

describe("stamps", () => {
  test("an attendee's first stamp creates their count, paid from their sign-up's deposit", async () => {
    const chain = await createTestChain();
    const { event, attendees } = await createSettledEvent(chain, 2, 1);
    const { wallet, guest } = attendees[0];
    const guestRent = (await chain.veni.accounts.guest.fetch(guest)).lamports;
    const solBefore = await solBalance(chain, wallet.address);

    await closeGuest(chain, event, wallet.address);

    const stampCount = await chain.veni.accounts.stampCount.fetch(await stampCountAddressOf(chain, wallet.address));
    expect(stampCount.data.count).toBe(1);
    expect(stampCount.programAddress).toBe(VENI_PROGRAM_ADDRESS);
    expect(stampCount.lamports).toBe(lamports(stampDepositOf(chain)));
    expect(await solBalance(chain, wallet.address)).toBe(solBefore + guestRent - stampDepositOf(chain));
  });

  test("a later stamp adds one, and the whole sign-up deposit comes back", async () => {
    const chain = await createTestChain();
    const first = await createSettledEvent(chain, 2, 1);
    const { wallet } = first.attendees[0];
    await closeGuest(chain, first.event, wallet.address);

    const secondCheckInEndsAt = CHECK_IN_ENDS_AT + DAY_SECONDS;
    const second = await createEvent(chain, {
      eventId: 2n,
      terms: { rsvpEndsAt: secondCheckInEndsAt - DAY_SECONDS / 2n, checkInEndsAt: secondCheckInEndsAt },
    });
    await signUp(chain, second, wallet);
    await checkIn(chain, second, wallet.address);
    jumpTo(chain, secondCheckInEndsAt);
    await settleEvent(chain, second);
    const [guest] = await chain.veni.pdas.guest({ event: second, wallet: wallet.address });
    const guestRent = (await chain.veni.accounts.guest.fetch(guest)).lamports;
    const solBefore = await solBalance(chain, wallet.address);

    await closeGuest(chain, second, wallet.address);

    expect(await stampCountOf(chain, wallet.address)).toBe(2);
    expect(await solBalance(chain, wallet.address)).toBe(solBefore + guestRent);
  });

  test("no-shows get no stamp and their whole deposit back", async () => {
    const chain = await createTestChain();
    const { event, noShows } = await createSettledEvent(chain, 2, 1);
    const { wallet, guest } = noShows[0];
    const guestRent = (await chain.veni.accounts.guest.fetch(guest)).lamports;
    const solBefore = await solBalance(chain, wallet.address);

    await closeGuest(chain, event, wallet.address);

    expect(await stampCountOf(chain, wallet.address)).toBe(0);
    expect(await solBalance(chain, wallet.address)).toBe(solBefore + guestRent);
  });

  test("a cancelled event stamps nobody, even a guest who had checked in", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithGuests(chain, 2);
    await checkIn(chain, event, guests[0].wallet.address);
    await cancelEvent(chain, event);

    for (const { wallet } of guests) await closeGuest(chain, event, wallet.address);

    for (const { wallet } of guests) expect(await stampCountOf(chain, wallet.address)).toBe(0);
  });

  test("an event nobody came to stamps nobody", async () => {
    const chain = await createTestChain();
    const { event, noShows } = await createSettledEvent(chain, 2, 0);

    for (const { wallet } of noShows) await closeGuest(chain, event, wallet.address);

    for (const { wallet } of noShows) expect(await stampCountOf(chain, wallet.address)).toBe(0);
  });

  test("an application refunded once sign-ups close gets no stamp", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithApplicants(chain, 1);
    jumpTo(chain, RSVP_ENDS_AT);

    await closeGuest(chain, event, guests[0].wallet.address);

    expect(await stampCountOf(chain, guests[0].wallet.address)).toBe(0);
  });

  test("each stamp is logged with the event, its host, how many checked in, and the new count", async () => {
    const chain = await createTestChain();
    const { event, attendees, noShows } = await createSettledEvent(chain, 3, 2);
    const wallet = attendees[0].wallet.address;

    const stamped = await closeGuest(chain, event, wallet);
    const noShow = await closeGuest(chain, event, noShows[0].wallet.address);

    expect(stampsLoggedBy(chain, stamped.context.signature)).toEqual([
      { wallet, event, organizer: chain.identity.address, attendedCount: 2, count: 1 },
    ]);
    expect(stampsLoggedBy(chain, noShow.context.signature)).toEqual([]);
  });

  test("lamports sent to a stamp count's address first don't block the stamp, and lower what it takes", async () => {
    const chain = await createTestChain();
    const { event, attendees } = await createSettledEvent(chain, 1, 1, { terms: { capacity: 1 } });
    const { wallet, guest } = attendees[0];
    const address = await stampCountAddressOf(chain, wallet.address);
    // Enough to exist as an empty account, short of a stamp count's deposit.
    const sent = 900_000n;
    await chain.airdrop(address, lamports(sent));
    const guestRent = (await chain.veni.accounts.guest.fetch(guest)).lamports;
    const solBefore = await solBalance(chain, wallet.address);

    await closeGuest(chain, event, wallet.address);

    expect(await stampCountOf(chain, wallet.address)).toBe(1);
    expect(await solBalance(chain, address)).toBe(stampDepositOf(chain));
    expect(await solBalance(chain, wallet.address)).toBe(solBefore + guestRent - (stampDepositOf(chain) - sent));
  });

  test("if rent rose since sign-up, the sender covers the gap and the stamp still lands", async () => {
    const chain = await createTestChain();
    const { event, attendees } = await createSettledEvent(chain, 1, 1, { terms: { capacity: 1 } });
    const { wallet, guest } = attendees[0];
    const guestRent = (await chain.veni.accounts.guest.fetch(guest)).lamports;
    const rent = chain.svm.getRent();
    rent.lamportsPerByteYear *= 2n;
    chain.svm.setRent(rent);
    const gap = stampDepositOf(chain) - guestRent;
    expect(gap).toBeGreaterThan(0n);
    const solBefore = await solBalance(chain, wallet.address);
    const payerBefore = await solBalance(chain, chain.payer.address);

    await closeGuest(chain, event, wallet.address);

    expect(await stampCountOf(chain, wallet.address)).toBe(1);
    expect(await solBalance(chain, await stampCountAddressOf(chain, wallet.address))).toBe(stampDepositOf(chain));
    expect(await solBalance(chain, wallet.address)).toBe(solBefore);
    const fee = 5_000n;
    expect(payerBefore - (await solBalance(chain, chain.payer.address))).toBe(gap + fee);
  });

  test("refuses a stamp count that isn't the wallet's", async () => {
    const chain = await createTestChain();
    const { event, attendees } = await createSettledEvent(chain, 2, 2);
    const someoneElses = await stampCountAddressOf(chain, attendees[1].wallet.address);

    await expectTransactionError(
      closeGuest(chain, event, attendees[0].wallet.address, { stampCount: someoneElses }),
      CONSTRAINT_SEEDS,
    );
  });

  test("closing the event leaves every attendee's stamp count, and nothing else", async () => {
    const chain = await createTestChain();
    const organizer = chain.identity;
    const { event, attendees, noShows } = await createSettledEvent(chain, 3, 2);

    for (const { wallet } of [...attendees, ...noShows]) await closeGuest(chain, event, wallet.address);
    await closeEvent(chain, event, organizer.address);

    expect(accountsLeftBehind(chain)).toHaveLength(0);
    expect(chain.svm.getProgramAccounts(VENI_PROGRAM_ADDRESS)).toHaveLength(attendees.length);
    for (const { wallet } of attendees) expect(await stampCountOf(chain, wallet.address)).toBe(1);
  });
});

describe("a guest sending close_guest themselves", () => {
  test("once the event settles, collects their payout and stamp, signing as the payer", async () => {
    const chain = await createTestChain();
    const { event, attendees } = await createSettledEvent(chain, 2, 1);
    const { wallet, guest } = attendees[0];
    const guestRent = (await chain.veni.accounts.guest.fetch(guest)).lamports;
    const solBefore = await solBalance(chain, wallet.address);

    await chain.veni.instructions.closeGuest({ event, wallet: wallet.address, stakeMint: USDC_MINT, payer: wallet }).sendTransaction();

    // Their $10 back, plus the no-show's $10 less Veni's $1.
    expect(await usdcBalance(chain, wallet.address)).toBe(19_000_000n);
    expect(await stampCountOf(chain, wallet.address)).toBe(1);
    expect(await solBalance(chain, wallet.address)).toBe(solBefore + guestRent - stampDepositOf(chain));
  });

  test("before the event settles, gets nothing back, even after checking in or once check-in closes", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithGuests(chain, 2);
    const [came, stayedHome] = guests;
    await checkIn(chain, event, came.wallet.address);
    const closeOwn = ({ wallet }: (typeof guests)[number]) =>
      chain.veni.instructions.closeGuest({ event, wallet: wallet.address, stakeMint: USDC_MINT, payer: wallet }).sendTransaction();

    await expectTransactionError(closeOwn(came), VENI_ERROR__NOT_SETTLED);
    await expectTransactionError(closeOwn(stayedHome), VENI_ERROR__NOT_SETTLED);
    jumpTo(chain, CHECK_IN_ENDS_AT);
    // A new blockhash, so the same request isn't refused as a duplicate.
    chain.svm.expireBlockhash();
    await expectTransactionError(closeOwn(stayedHome), VENI_ERROR__NOT_SETTLED);

    for (const { wallet } of guests) expect(await usdcBalance(chain, wallet.address)).toBe(0n);
    expect(await usdcBalance(chain, event)).toBe(20n * 1_000_000n);
  });
});
