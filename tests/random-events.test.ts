// Random events, played through the crank, against what each wallet should
// end up with. The seed is fixed so runs repeat; VENI_RANDOM_SEED and
// VENI_RANDOM_RUNS explore further.
import { describe, expect, test } from "bun:test";
import type { Address, TransactionSigner } from "@solana/kit";
import { TICKET_HOLD_SECONDS, TREASURY } from "@veni/client";
import { runCrank } from "@veni/crank";
import { createTestChain, createWallet, giveUsdc, jumpTo, type TestChain } from "./litesvm";
import {
  accountsLeftBehind,
  approveApplication,
  cancelEvent,
  CHECK_IN_ENDS_AT,
  checkIn,
  createEventWithGuests,
  stampCountOf,
  usdcBalance,
} from "./events";

const SEED = Number(process.env.VENI_RANDOM_SEED ?? 20261010);
const RUNS = Number(process.env.VENI_RANDOM_RUNS ?? 40);
const FEE_BPS = 1_000n;

/** A small seeded generator (mulberry32), so a failing run can be replayed. */
function randomFrom(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  return { chance: (p: number) => next() < p, int, bigint: (min: bigint, max: bigint) => min + BigInt(Math.floor(next() * Number(max - min + 1n))) };
}

type Scenario = {
  stakeAmount: bigint;
  ticketPrice: bigint;
  guestCount: number;
  requiresApproval: boolean;
  approved: boolean[];
  attended: boolean[];
  cancelled: boolean;
};

function scenarioFor(run: number): Scenario {
  const random = randomFrom(SEED + run);
  const isPaid = random.chance(0.3);
  const guestCount = random.int(1, 8);
  const requiresApproval = random.chance(0.3);
  const approved = Array.from({ length: guestCount }, () => !requiresApproval || random.chance(0.7));
  // Sometimes nobody comes, sometimes everyone does.
  const turnout = random.chance(0.15) ? 0 : random.chance(0.15) ? 1 : random.int(1, 9) / 10;
  return {
    // Odd base units, to exercise every rounding.
    stakeAmount: isPaid ? random.bigint(1n, 5_000_000n) : random.bigint(1n, 100_000_000n),
    ticketPrice: isPaid ? random.bigint(1n, 1_000_000_000n) : 0n,
    guestCount,
    requiresApproval,
    approved,
    attended: approved.map((isApproved) => isApproved && random.chance(turnout)),
    cancelled: random.chance(0.1),
  };
}

/** What every wallet should hold at the end, worked out independently of the program. */
function expectedOutcome(scenario: Scenario) {
  const { stakeAmount, ticketPrice, approved, attended, cancelled } = scenario;
  const paid = stakeAmount + ticketPrice;
  const approvedCount = BigInt(approved.filter(Boolean).length);
  const attendeeCount = BigInt(attended.filter(Boolean).length);
  const refundsEveryone = cancelled || attendeeCount === 0n;
  if (refundsEveryone) {
    return { refundsEveryone, guests: approved.map(() => paid), organizer: 0n, treasury: 0n, attendeePool: 0n };
  }
  const forfeited = (approvedCount - attendeeCount) * stakeAmount;
  const fee = (forfeited * FEE_BPS) / 10_000n;
  const attendeePool = attendeeCount * stakeAmount + forfeited - fee;
  const guests = approved.map((isApproved, index) => (!isApproved ? paid : attended[index] ? -1n : 0n));
  return { refundsEveryone, guests, organizer: approvedCount * ticketPrice, treasury: fee, attendeePool };
}

async function play(chain: TestChain, scenario: Scenario) {
  const organizer = await createWallet(chain);
  await giveUsdc(chain, organizer.address, 0n);
  const { event, guests } = await createEventWithGuests(chain, scenario.guestCount, {
    organizer,
    terms: {
      stakeAmount: scenario.stakeAmount,
      ticketPrice: scenario.ticketPrice,
      capacity: scenario.guestCount + 2,
      requiresApproval: scenario.requiresApproval,
    },
  });
  for (const [index, { guest }] of guests.entries()) {
    if (scenario.requiresApproval && scenario.approved[index]) await approveApplication(chain, event, guest, organizer);
  }
  for (const [index, { wallet }] of guests.entries()) {
    if (scenario.attended[index]) await checkIn(chain, event, wallet.address);
  }
  if (scenario.cancelled) await cancelEvent(chain, event, organizer);
  else jumpTo(chain, CHECK_IN_ENDS_AT);
  const reports = [await runCrank(chain)];
  // Ticket money waits a day after check-in closes.
  jumpTo(chain, CHECK_IN_ENDS_AT + TICKET_HOLD_SECONDS);
  reports.push(await runCrank(chain));
  return { organizer, guests: guests.map(({ wallet }) => wallet), reports };
}

async function balancesOf(chain: TestChain, wallets: (TransactionSigner | Address)[]) {
  return Promise.all(wallets.map((wallet) => usdcBalance(chain, typeof wallet === "string" ? wallet : wallet.address)));
}

describe(`random events (seed ${SEED}, ${RUNS} runs)`, () => {
  for (let run = 0; run < RUNS; run++) {
    const scenario = scenarioFor(run);
    const label = `run ${run}: ${scenario.guestCount} guests, ${scenario.attended.filter(Boolean).length} came${scenario.ticketPrice ? ", paid" : ""}${scenario.requiresApproval ? ", approval" : ""}${scenario.cancelled ? ", cancelled" : ""}`;

    test(label, async () => {
      const chain = await createTestChain();
      const { organizer, guests, reports } = await play(chain, scenario);
      const expected = expectedOutcome(scenario);

      for (const report of reports) {
        expect(report.errors).toEqual([]);
        expect(report.waiting).toEqual([]);
      }
      const finals = await balancesOf(chain, guests);
      const attendeeFinals = finals.filter((_, index) => expected.guests[index] === -1n);

      // Everyone else gets exactly what the rules say.
      for (const [index, amount] of expected.guests.entries()) {
        if (amount !== -1n) expect(finals[index]).toBe(amount);
      }
      // Attendees split their pool to within one base unit, and nothing is lost to rounding.
      if (attendeeFinals.length) {
        expect(attendeeFinals.reduce((sum, amount) => sum + amount, 0n)).toBe(expected.attendeePool);
        const smallest = attendeeFinals.reduce((min, amount) => (amount < min ? amount : min));
        const largest = attendeeFinals.reduce((max, amount) => (amount > max ? amount : max));
        expect(largest - smallest <= 1n).toBe(true);
        for (const amount of attendeeFinals) expect(amount >= scenario.stakeAmount).toBe(true);
      }
      expect(await usdcBalance(chain, organizer.address)).toBe(expected.organizer);
      expect(await usdcBalance(chain, TREASURY)).toBe(expected.treasury);

      // Money in equals money out, and the event leaves nothing behind but stamps.
      const paidIn = BigInt(scenario.guestCount) * (scenario.stakeAmount + scenario.ticketPrice);
      const paidOut = finals.reduce((sum, amount) => sum + amount, 0n) + expected.organizer + expected.treasury;
      expect(paidOut).toBe(paidIn);
      expect(accountsLeftBehind(chain)).toHaveLength(0);
      for (const [index, wallet] of guests.entries()) {
        const isStamped = !expected.refundsEveryone && scenario.attended[index];
        expect(await stampCountOf(chain, wallet.address)).toBe(isStamped ? 1 : 0);
      }
    });
  }
});
