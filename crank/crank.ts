// The crank moves events past their deadlines, since a program never acts on
// its own. It holds no special key: anyone could send what it sends.
//
//   ended     check-in closed, or sign-ups closed and everyone is in → settle_event
//   settled   or cancelled → close_guest for each guest, then close_event
//   empty     nobody signed up and sign-ups closed → close_event
//
// Unapproved applications are refunded with close_guest once sign-ups close.
// Each run reads the chain fresh, so it can stop anywhere and the next resumes.
import type { Address, Instruction, TransactionSigner } from "@solana/kit";
import { fetchMaybeEvent, getCloseEventInstruction, TREASURY, type Event, type VeniPlugin } from "@veni/client";
import {
  accountExists,
  chainTime,
  describeError,
  fetchEventAddresses,
  fetchGuests,
  refundsEveryGuest,
  ticketHoldEndsAt,
  ticketRevenueOf,
  tokenAccountOf,
  type ReadClient,
} from "@veni/sdk";

export type CrankClient = ReadClient & {
  /** Signs and pays the fees. */
  identity: TransactionSigner;
  veni: VeniPlugin;
  /** Sends instructions as one transaction. */
  sendTransaction(instructions: Instruction[]): Promise<unknown>;
};

export type CrankReport = {
  settled: number;
  guestsClosed: number;
  eventsClosed: number;
  /** Work blocked on someone else, like a missing token account. */
  waiting: string[];
  errors: string[];
};

export type CrankOptions = {
  /** Saves the event before its accounts close. If it throws, the event stays open this run. */
  archive?: (eventAddress: Address) => Promise<void>;
};

/** Moves every event along as far as it can go right now. */
export async function runCrank(client: CrankClient, options: CrankOptions = {}): Promise<CrankReport> {
  const report = emptyReport();
  const now = await chainTime(client);
  for (const eventAddress of await fetchEventAddresses(client)) {
    await moveAlongAndReport(client, eventAddress, now, report, options);
  }
  return report;
}

/** Moves one event along as far as it can go right now. */
export async function crankEvent(client: CrankClient, eventAddress: Address, options: CrankOptions = {}): Promise<CrankReport> {
  const report = emptyReport();
  await moveAlongAndReport(client, eventAddress, await chainTime(client), report, options);
  return report;
}

/** Archives through the app's /api/archive, which reads the chain itself. */
export function archiveThrough(url: string): NonNullable<CrankOptions["archive"]> {
  return async (eventAddress) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: eventAddress }),
    }).catch(() => {
      throw new Error(`Couldn't reach the archive at ${url}, so the event stays open for now.`);
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `The archive answered with error ${response.status}, so the event stays open for now.`);
    }
  };
}

function emptyReport(): CrankReport {
  return { settled: 0, guestsClosed: 0, eventsClosed: 0, waiting: [], errors: [] };
}

async function moveAlongAndReport(
  client: CrankClient,
  eventAddress: Address,
  now: bigint,
  report: CrankReport,
  options: CrankOptions,
) {
  try {
    await moveEventAlong(client, eventAddress, now, report, options);
  } catch (error) {
    report.errors.push(`event ${eventAddress}: ${describeError(error)}`);
  }
}

async function moveEventAlong(
  client: CrankClient,
  eventAddress: Address,
  now: bigint,
  report: CrankReport,
  options: CrankOptions,
) {
  const maybeEvent = await fetchMaybeEvent(client.rpc, eventAddress, { commitment: "confirmed" });
  if (!maybeEvent.exists) return; // already closed
  const event = maybeEvent.data;
  const { terms } = event;
  const hasRsvpClosed = now >= terms.rsvpEndsAt;

  if (event.guestCount === 0) {
    if (hasRsvpClosed) {
      await options.archive?.(eventAddress);
      const { applicantsClosed } = await closeGuests(client, eventAddress, event, report);
      if (applicantsClosed === event.applicantCount && (await closeEvent(client, eventAddress, event, now, report))) {
        report.eventsClosed++;
      }
    }
    return;
  }

  if (!event.isSettled && !event.isCancelled) {
    const hasCheckInClosed = now >= terms.checkInEndsAt;
    const canSettleEarly = hasRsvpClosed && event.attendedCount === event.guestCount;
    if (!hasCheckInClosed && !canSettleEarly) {
      // Unapproved applications are refunded once sign-ups close.
      if (hasRsvpClosed && event.applicantCount > 0) {
        await closeGuests(client, eventAddress, event, report, { applicantsOnly: true });
      }
      return;
    }
    await settleEvent(client, eventAddress, event);
    report.settled++;
  }

  // Closing guests deletes their accounts, so archive first.
  await options.archive?.(eventAddress);
  const { guestsClosed, applicantsClosed } = await closeGuests(client, eventAddress, event, report);
  // Counted, not read back: a busy RPC may return a stale event.
  const isEveryoneClosed = event.closedGuestCount + guestsClosed === event.guestCount && applicantsClosed === event.applicantCount;
  if (isEveryoneClosed && (await closeEvent(client, eventAddress, event, now, report))) {
    report.eventsClosed++;
  }
}

async function settleEvent(client: CrankClient, eventAddress: Address, event: Event) {
  // The program never creates token accounts; the treasury's is made at deploy.
  if (!(await accountExists(client, await tokenAccountOf(TREASURY, event.stakeMint)))) {
    throw new Error(`The treasury has no token account for ${event.stakeMint}. Create it once, then settling can go ahead.`);
  }
  await client.veni.instructions.settleEvent({ event: eventAddress, stakeMint: event.stakeMint }).sendTransaction();
}

/** Pays or refunds every guest (or only applications), returning how many of each it closed. */
async function closeGuests(
  client: CrankClient,
  eventAddress: Address,
  event: Event,
  report: CrankReport,
  { applicantsOnly = false } = {},
) {
  let guestsClosed = 0;
  let applicantsClosed = 0;
  const refundsEveryone = refundsEveryGuest(event);
  for (const guest of await fetchGuests(client, eventAddress)) {
    const { wallet, hasAttended, isApproved } = guest.data;
    if (applicantsOnly && isApproved) continue;
    const isOwedTokens = !isApproved || refundsEveryone || hasAttended;
    // Never create guests' token accounts: they could close them and keep the rent, again and again.
    if (isOwedTokens && !(await accountExists(client, await tokenAccountOf(wallet, event.stakeMint)))) {
      report.waiting.push(`${wallet} is owed ${!isApproved || refundsEveryone ? "a refund" : "a payout"} but has no token account to be paid into`);
      continue;
    }
    try {
      await client.veni.instructions
        .closeGuest({ event: eventAddress, wallet, stakeMint: event.stakeMint, payer: client.identity })
        .sendTransaction();
      report.guestsClosed++;
      if (isApproved) guestsClosed++;
      else applicantsClosed++;
    } catch (error) {
      report.errors.push(`close guest ${wallet}: ${describeError(error)}`);
    }
  }
  return { guestsClosed, applicantsClosed };
}

/** Closes the event and pays for tickets. False while tickets are on hold or the organizer has no token account. */
async function closeEvent(client: CrankClient, eventAddress: Address, event: Event, now: bigint, report: CrankReport) {
  const owesTickets = ticketRevenueOf(event) > 0n;
  // Every paid event waits out the hold, so it isn't reported.
  if (owesTickets && now < ticketHoldEndsAt(event)) return false;
  // Like guests, the organizer creates their own token account.
  if (owesTickets && !(await accountExists(client, await tokenAccountOf(event.organizer, event.stakeMint)))) {
    report.waiting.push(`${event.organizer} is owed ticket money but has no token account to be paid into`);
    return false;
  }
  await client.sendTransaction([await getCloseEventInstructionFor(client.identity, eventAddress, event)]);
  return true;
}

/** close_event, with the organizer's token account only when tickets are owed. */
export async function getCloseEventInstructionFor(closer: TransactionSigner, eventAddress: Address, event: Event) {
  return getCloseEventInstruction({
    closer,
    event: eventAddress,
    organizer: event.organizer,
    stakeMint: event.stakeMint,
    vault: await tokenAccountOf(eventAddress, event.stakeMint),
    treasuryTokenAccount: await tokenAccountOf(TREASURY, event.stakeMint),
    organizerTokenAccount: ticketRevenueOf(event) > 0n ? await tokenAccountOf(event.organizer, event.stakeMint) : undefined,
  });
}
