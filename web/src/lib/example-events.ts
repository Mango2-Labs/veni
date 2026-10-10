// Example events for Find events, marked as examples. None are on-chain.
import { stampDateOf, type EventCardData } from "@/components/EventCard";

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
      key: `example-${example.city}`,
      when: dates?.when ?? `${day} · ${time}`,
      stampDate: stampDateOf(start),
      seed: example.title,
      stage: { label: "Example", className: "stage-example" },
    };
  });
}
