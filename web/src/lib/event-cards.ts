// A live event as a card: the same card on Find events, on a profile and on a host's page.
import type { Address } from "@solana/kit";
import type { Event as EventAccount } from "@veni/client";
import { stampDateOf, type EventCardData } from "@/components/EventCard";
import { coverOf, locationOf } from "./events";
import { formatUsdShort, STAGE_LABEL, stageOf } from "./veni";

export function cardOfEvent(address: Address, event: EventAccount, now: bigint): EventCardData {
  const { terms, details } = event;
  const stage = stageOf(event, now);
  const startsAt = new Date(Number(terms.rsvpEndsAt) * 1000);
  const day = startsAt.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const time = startsAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const spotsLeft = terms.capacity - event.guestCount;
  return {
    key: address,
    href: `/e/${address}`,
    title: terms.title,
    hostName: details.hostName,
    when: `${day} · ${time}`,
    place: details.venue,
    city: details.city,
    stampDate: stampDateOf(startsAt),
    cover: coverOf(event),
    seed: address,
    stake: formatUsdShort(terms.stakeAmount),
    ticket: terms.ticketPrice > 0n ? formatUsdShort(terms.ticketPrice) : undefined,
    going: `${event.guestCount} of ${terms.capacity} going`,
    spotsLeft:
      stage !== "open" ? undefined : spotsLeft === 0 ? "Full" : spotsLeft <= 3 ? `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left` : undefined,
    stage: { label: STAGE_LABEL[stage], className: `stage-${stage}` },
    approval: terms.requiresApproval,
    point: locationOf(event),
  };
}
