import Image from "next/image";
import Link from "next/link";
import type { MapPoint } from "@/lib/places";

/** What a card shows. Live events and the examples on Find events both fit it. */
export type EventCardData = {
  key: string;
  /** The event's page. Examples have none, since they aren't on-chain. */
  href?: string;
  title: string;
  hostName: string;
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

export function EventCard({ event }: { event: EventCardData }) {
  const content = (
    <>
      <div className={`event-card-cover ${event.cover ? "has-image" : coverClassOf(event.seed)}`}>
        {event.cover ? <Image src={event.cover} alt="" fill sizes="(max-width: 640px) 100vw, 400px" /> : event.title}
        <CityStamp city={event.city} date={event.stampDate} />
      </div>
      <div className="event-card-body">
        {event.cover && <span className="event-card-title">{event.title}</span>}
        <b>{event.hostName}</b>
        <span>{event.when} · {event.place}</span>
        {(event.hostRecord || event.stage || event.approval) && (
          <span className="event-card-tags">
            {event.stage && <span className={`stage ${event.stage.className}`}>{event.stage.label}</span>}
            {event.approval && <span className="stage stage-approval">Host approves</span>}
            {event.hostRecord && <span className="turnout">{event.hostRecord}</span>}
          </span>
        )}
        <span className="event-card-foot">
          {event.spotsLeft ? <span className="spots-left">{event.spotsLeft}</span> : <span>{event.going}</span>}
          <b>{event.ticket ? `${event.ticket} + ${event.stake} stake` : `${event.stake} stake`}</b>
        </span>
      </div>
    </>
  );
  return event.href ? (
    <Link className="event-card" href={event.href}>{content}</Link>
  ) : (
    <article className="event-card" aria-label={`${event.title}, an example event`}>{content}</article>
  );
}

/** A dashed ring with the city and date, like a stamp. */
export function CityStamp({ city, date }: { city: string; date: string }) {
  return (
    <span className={city.length > 7 ? "city-stamp is-long" : "city-stamp"} aria-hidden="true">
      <small>{date}</small>
      <strong>{city}</strong>
    </span>
  );
}

/** One of the six cover colors, picked by `seed` so an event keeps its color. */
export function coverClassOf(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return `cover-${hash % 6}`;
}

/** "Oct 22", for a stamp. */
export function stampDateOf(date: Date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
