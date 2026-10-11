// Events as cards: live ones on Find events, a profile or a host's page, and the examples
// beside them. The website and the Seeker app draw the same cards from these.
import type { Address } from "@solana/kit";
import type { Event as EventAccount } from "@veni/client";
import { coverOf, formatUsdShort, locationOf, STAGE_LABEL, stageOf, type MapPoint } from "./events";

/** What a card shows. Live events and the examples on Find events both fit it. */
export type EventCardData = {
  key: string;
  /** The event's page. Examples have none, since they aren't on-chain. */
  href?: string;
  title: string;
  hostName: string;
  /** The host's wallet, whose photo is the host's face. */
  organizer?: string;
  /** Examples only: a bundled host logo. */
  hostLogo?: "monkedao" | "solana" | "superteam-sg" | "superteam-ca";
  /** "91% of guests show up", when the host has a record. */
  hostRecord?: string;
  when: string;
  place: string;
  city: string;
  /** The short date on the city stamp, like "Oct 22". */
  stampDate: string;
  cover?: string;
  /** Picks the cover color for events without a poster. */
  seed: string;
  stake: string;
  /** The ticket price at a paid event, like "$25". */
  ticket?: string;
  going: string;
  /** "2 spots left", when it's nearly full. */
  spotsLeft?: string;
  stage?: { label: string; className: string };
  /** Guests apply, and the host picks who comes. */
  approval?: boolean;
  point?: MapPoint;
};

/** "Oct 22", for a stamp. */
export function stampDateOf(date: Date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

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
    organizer: event.organizer,
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

// Example events for Find events, marked as examples. None are on-chain.
type Example = Omit<EventCardData, "key" | "when" | "stampDate" | "seed"> & {
  /** Days after today it starts, at `time`. Breakpoint has real dates instead. */
  inDays?: number;
  time?: string;
  dates?: { when: string; start: Date };
};

const EXAMPLES: Example[] = [
  {
    title: "Solana Breakpoint",
    hostName: "Solana Foundation",
    hostLogo: "solana",
    dates: { when: "15–17 Nov", start: new Date(2026, 10, 15) },
    place: "Olympia London",
    city: "London",
    stake: "$10",
    going: "2,998 going",
    point: { latitude: 51.4965, longitude: -0.2097 },
  },
  {
    title: "Seoul builders dinner",
    hostName: "Seoul Builders",
    hostRecord: "91% of guests show up",
    inDays: 5,
    time: "19:00",
    place: "Seongsu-dong studio",
    city: "Seoul",
    stake: "$10",
    going: "38 of 40 going",
    spotsLeft: "2 spots left",
    approval: true,
    point: { latitude: 37.5446, longitude: 127.0559 },
  },
  {
    title: "Lagos DeFi meetup",
    hostName: "Lagos Onchain",
    hostRecord: "87% of guests show up",
    inDays: 7,
    time: "14:00",
    place: "Yaba tech hub",
    city: "Lagos",
    stake: "$5",
    going: "64 going",
    point: { latitude: 6.5095, longitude: 3.3711 },
  },
  {
    title: "Hacker house demo day",
    hostName: "São Paulo Hacker House",
    hostRecord: "94% of guests show up",
    inDays: 13,
    time: "18:30",
    place: "Pinheiros",
    city: "São Paulo",
    ticket: "$15",
    stake: "$5",
    going: "120 going",
    point: { latitude: -23.5614, longitude: -46.6825 },
  },
  {
    title: "MonkeDAO members night",
    hostName: "MonkeDAO",
    hostLogo: "monkedao",
    inDays: 9,
    time: "19:00",
    place: "Ari",
    city: "Bangkok",
    stake: "$10",
    going: "45 of 60 going",
    approval: true,
    point: { latitude: 13.7797, longitude: 100.5446 },
  },
  {
    title: "Solana Summit Singapore",
    hostName: "Superteam Singapore",
    hostLogo: "superteam-sg",
    inDays: 21,
    time: "09:30",
    place: "Marina Bay",
    city: "Singapore",
    stake: "$10",
    going: "212 of 300 going",
    point: { latitude: 1.2834, longitude: 103.8607 },
  },
  {
    title: "Solana Summit Canada",
    hostName: "Superteam Canada",
    hostLogo: "superteam-ca",
    inDays: 28,
    time: "10:00",
    place: "King West",
    city: "Toronto",
    ticket: "$20",
    stake: "$5",
    going: "140 of 200 going",
    point: { latitude: 43.6447, longitude: -79.4006 },
  },
  {
    title: "Seeker devs breakfast",
    hostName: "Mobile Builders SG",
    hostRecord: "89% of guests show up",
    inDays: 16,
    time: "09:00",
    place: "Tanjong Pagar",
    city: "Singapore",
    stake: "$5",
    going: "24 of 30 going",
    point: { latitude: 1.2764, longitude: 103.8458 },
  },
];

const DAY_MS = 86_400_000;

/** The examples, dated from `today` so they always look upcoming. */
export function exampleEvents(today: Date): EventCardData[] {
  return EXAMPLES.map(({ inDays = 0, time, dates, ...example }) => {
    const start = dates?.start ?? new Date(today.getTime() + inDays * DAY_MS);
    const day = start.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
    return {
      ...example,
      key: `example-${example.title}`,
      when: dates?.when ?? `${day} · ${time}`,
      stampDate: stampDateOf(start),
      seed: example.title,
      stage: { label: "Example", className: "stage-example" },
    };
  });
}
