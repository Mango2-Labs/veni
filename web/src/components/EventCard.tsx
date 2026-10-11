import Image from "next/image";
import Link from "next/link";
import { coverIndexOf, type EventCardData } from "@veni/sdk";
import { Face } from "@/components/Face";
import { initialsOf } from "@/lib/host-profile";

export function EventCard({ event }: { event: EventCardData }) {
  const content = (
    <>
      <div className={`event-card-cover ${event.cover ? "has-image" : coverClassOf(event.seed, { paid: Boolean(event.ticket), approval: event.approval })}`}>
        {event.cover ? <Image src={event.cover} alt="" fill sizes="(max-width: 640px) 100vw, 400px" /> : event.title}
        <TypeLabels ticket={event.ticket} approval={event.approval} />
        <CityStamp city={event.city} date={event.stampDate} />
      </div>
      <div className="event-card-body">
        {event.cover && <span className="event-card-title">{event.title}</span>}
        <span className="card-host">
          <Face wallet={event.organizer} src={event.hostLogo && `/hosts/${event.hostLogo}.png`} initials={initialsOf(event.hostName)} className="member-face" />
          <b>{event.hostName}</b>
        </span>
        <span>{event.when} · {event.place}</span>
        <span className="event-card-tags">
          {event.stage && <span className={`stage ${event.stage.className}`}>{event.stage.label}</span>}
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

/** Free or paid, and whether the host approves guests, on the cover's top-left. */
export function TypeLabels({ ticket, approval }: { ticket?: string; approval?: boolean }) {
  return (
    <span className="type-labels">
      {ticket ? <span className="type-label paid">Paid · {ticket}</span> : <span className="type-label free">Free</span>}
      {approval && <span className="type-label approval">Approval required</span>}
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
export function coverClassOf(seed: string, labels?: Parameters<typeof coverIndexOf>[1]) {
  return `cover-${coverIndexOf(seed, labels)}`;
}
