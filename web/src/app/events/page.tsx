"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Address } from "@solana/kit";
import { fetchAllMaybeEvent, type Event as EventAccount } from "@veni/client";
import { cardOfEvent, chainTime, describeError, exampleEvents, fetchEventAddresses } from "@veni/sdk";
import { AppHeader } from "@/components/AppHeader";
import { EventCard } from "@/components/EventCard";
import { EventsMap } from "@/components/EventsMap";
import { veniReader } from "@/lib/veni";

type Row = { address: Address; event: EventAccount };

const DAY_SECONDS = 86_400n;

export default function EventsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [now, setNow] = useState(0n);
  const [error, setError] = useState<string>();
  const [city, setCity] = useState<string>();

  useEffect(() => {
    async function load() {
      try {
        const addresses = await fetchEventAddresses(veniReader);
        const [accounts, chainNow] = await Promise.all([
          fetchAllMaybeEvent(veniReader.rpc, addresses),
          chainTime(veniReader),
        ]);
        const found = accounts.flatMap((account) => (account.exists ? [{ address: account.address, event: account.data }] : []));
        found.sort((a, b) => Number(b.event.terms.rsvpEndsAt - a.event.terms.rsvpEndsAt));
        setRows(found);
        setNow(chainNow);
      } catch (loadError) {
        setError(describeError(loadError));
        // The examples still show, dated from this device's clock.
        setNow((current) => current || BigInt(Math.floor(Date.now() / 1000)));
      }
    }
    load();
    const refresh = setInterval(load, 15000);
    return () => clearInterval(refresh);
  }, []);

  // Dated by the day, so the examples don't change every time the chain's clock ticks.
  const today = now / DAY_SECONDS;
  const examples = useMemo(() => (today > 0n ? exampleEvents(new Date(Number(today * DAY_SECONDS) * 1000)) : []), [today]);
  const cards = useMemo(() => [...(rows ?? []).map(({ address, event }) => cardOfEvent(address, event, now)), ...examples], [rows, now, examples]);
  const cities = useMemo(() => [...new Set(cards.map((card) => card.city))], [cards]);
  const shown = useMemo(() => (city ? cards.filter((card) => card.city === city) : cards), [cards, city]);
  const points = useMemo(() => shown.flatMap((card) => (card.point ? [card.point] : [])), [shown]);

  return (
    <>
      <AppHeader current="/events" />
      <main className="app-main">
        <div className="wrap">
          <section className="map-banner" aria-labelledby="find-events">
            <EventsMap points={points} label={`Map of ${city ?? "every city"} with a pin for each event`} />
            <div className="map-banner-title">
              <h1 id="find-events" className="app-title">Find events</h1>
              <p className="app-sub">Upcoming and recent events, in any city.</p>
            </div>
          </section>

          <div className="filters" role="group" aria-label="Show events in">
            <button type="button" className="filter" aria-pressed={!city} onClick={() => setCity(undefined)}>
              All cities
            </button>
            {cities.map((name) => (
              <button key={name} type="button" className="filter" aria-pressed={city === name} onClick={() => setCity(name)}>
                {name}
              </button>
            ))}
          </div>

          {error && <p className="app-message error">{error}</p>}
          {!rows && !error && <p className="action-note">Loading events…</p>}

          <div className="card-grid">
            {shown.map((card) => (
              <EventCard key={card.key} event={card} />
            ))}
            <Link className="event-card host-own" href="/new">
              <span className="host-own-icon">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
              <b>Host your own</b>
              <span className="action-note">Import it from Luma or start from scratch.</span>
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
