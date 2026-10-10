"use client";

import { turnoutOf } from "@/lib/archive-client";
import { isCoverUrl, isLumaSlug } from "@/lib/events";
import type { PastEvent } from "@/lib/host-profile";
import { CoverThumb } from "./EventCover";

/** Past events from the archive. Their accounts are closed, so they link to Luma. */
export function PastEventList({ events, showHost }: { events: PastEvent[]; showHost?: boolean }) {
  return (
    <ul className="event-list past-list">
      {events.map((event) => {
        const date = new Date(event.startsAt * 1000).toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        return (
          <li key={event.address} className="app-card event-row">
            <CoverThumb src={isCoverUrl(event.cover) ? event.cover : undefined} title={event.title} seed={event.address} />
            <h2>{event.title}</h2>
            <span className="stage stage-closed">{turnoutOf(event)}</span>
            <p className="action-note">
              <b>{event.city}</b> · {event.venue} · {date}
              {showHost && <> · hosted by {event.hostName}</>}
              {isLumaSlug(event.lumaSlug) && (
                <>
                  {" · "}
                  <a href={`https://luma.com/${event.lumaSlug}`} target="_blank" rel="noopener noreferrer">
                    On Luma
                  </a>
                </>
              )}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

/** Events a guest checked in to, as stamps on their profile. */
export function ProfileStamps({ events }: { events: PastEvent[] }) {
  return (
    <ul className="stamp-sheet">
      {events.map((event) => {
        const date = new Date(event.startsAt * 1000).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
        return (
          <li key={event.address} className="stamp">
            <span className="stamp-ring" aria-hidden="true">
              <small>Checked in</small>
              <strong>{event.city}</strong>
              <small>{date}</small>
            </span>
            <span className="sr-only">Checked in at {event.city} on {date}:</span>
            <span className="stamp-title">{event.title}</span>
            <span className="stamp-note">Hosted by {event.hostName}</span>
          </li>
        );
      })}
    </ul>
  );
}
