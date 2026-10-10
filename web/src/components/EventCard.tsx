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
  return `cover-${coverIndexOf(seed)}`;
}
