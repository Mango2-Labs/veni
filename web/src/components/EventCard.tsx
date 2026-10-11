import Image from "next/image";
import Link from "next/link";
import { coverIndexOf, type EventCardData } from "@veni/sdk";

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
        <span className="event-card-tags">
          {event.stage && <span className={`stage ${event.stage.className}`}>{event.stage.label}</span>}
          <TypeChips ticket={event.ticket} approval={event.approval} />
          {event.hostRecord && <span className="turnout">{event.hostRecord}</span>}
        </span>
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

const ICONS = {
  free: "M20 6 9 17l-5-5",
  paid: "M3 9a3 3 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a3 3 0 0 0 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1zM13 5v2M13 17v2M13 11v2",
  approval: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4",
};

/** Free or paid, and whether the host approves guests. */
export function TypeChips({ ticket, approval }: { ticket?: string; approval?: boolean }) {
  return (
    <>
      {ticket ? <TypeChip kind="paid" label={`Paid · ${ticket}`} /> : <TypeChip kind="free" label="Free" />}
      {approval && <TypeChip kind="approval" label="Host approves" />}
    </>
  );
}

function TypeChip({ kind, label }: { kind: keyof typeof ICONS; label: string }) {
  return (
    <span className={`stage stage-${kind}`}>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={ICONS[kind]} />
      </svg>
      {label}
    </span>
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
  return `cover-${coverIndexOf(seed)}`;
}
