// The program's money rules, for showing them before they happen.
import { TICKET_HOLD_SECONDS, type Event } from "@veni/client";

/** Cancelled, or nobody checked in: every guest gets everything back. */
export function refundsEveryGuest(event: Event) {
  return event.isCancelled || event.attendedCount === 0;
}

/** The organizer's ticket money. Matches the program's `ticket_revenue`. */
export function ticketRevenueOf(event: Event) {
  return refundsEveryGuest(event) ? 0n : BigInt(event.guestCount) * event.terms.ticketPrice;
}

/** When ticket money can be paid. Matches the program's `ticket_hold_ends_at`. */
export function ticketHoldEndsAt(event: Event) {
  return event.terms.checkInEndsAt + TICKET_HOLD_SECONDS;
}
