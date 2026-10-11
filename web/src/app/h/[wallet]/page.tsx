"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSelectedWalletAccount } from "@solana/react";
import { address as toAddress, isAddress, type Address } from "@solana/kit";
import { fetchAllMaybeEvent, type Event as EventAccount } from "@veni/client";
import { cardOfEvent, chainTime, describeError, fetchEventAddressesOf } from "@veni/sdk";
import { AppHeader } from "@/components/AppHeader";
import { EventCard } from "@/components/EventCard";
import { Face } from "@/components/Face";
import { PastEventList } from "@/components/PastEventList";
import { WalletName } from "@/components/WalletName";
import { turnoutPercent, useHostPage } from "@/lib/archive-client";
import { initialsOf } from "@/lib/host-profile";
import { isLumaSlug } from "@/lib/events";
import { veniReader } from "@/lib/veni";

type Live = { kind: "loading" } | { kind: "ready"; events: { address: Address; event: EventAccount }[]; now: bigint } | { kind: "error"; message: string };

/** A host's public page: who they are if they registered, and how their events went. */
export default function HostPage() {
  const params = useParams<{ wallet: string }>();
  const wallet = isAddress(params.wallet) ? toAddress(params.wallet) : undefined;
  return (
    <>
      <AppHeader />
      <main className="app-main">
        <div className="wrap">{wallet ? <Host wallet={wallet} /> : <p className="app-message error">That isn&apos;t a wallet address.</p>}</div>
      </main>
    </>
  );
}

function Host({ wallet }: { wallet: Address }) {
  const [account] = useSelectedWalletAccount();
  const page = useHostPage(wallet);
  const [live, setLive] = useState<Live>({ kind: "loading" });

  useEffect(() => {
    let isCurrent = true;
    async function load() {
      try {
        const addresses = await fetchEventAddressesOf(veniReader, wallet);
        const [accounts, now] = await Promise.all([fetchAllMaybeEvent(veniReader.rpc, addresses), chainTime(veniReader)]);
        const events = accounts.flatMap((maybe) => (maybe.exists ? [{ address: maybe.address, event: maybe.data }] : []));
        events.sort((a, b) => Number(a.event.terms.rsvpEndsAt - b.event.terms.rsvpEndsAt));
        if (isCurrent) setLive({ kind: "ready", events, now });
      } catch (error) {
        if (isCurrent) setLive({ kind: "error", message: describeError(error) });
      }
    }
    load();
    return () => {
      isCurrent = false;
    };
  }, [wallet]);

  if (page.kind === "loading") return <p className="action-note">Loading the host…</p>;
  if (page.kind === "error") return <p className="app-message error">{page.message}</p>;
  const { profile, record, pastEvents } = page.value;
  const turnout = turnoutPercent(record.attendedCount, record.guestCount);
  const isMe = account?.address === wallet;
  // An unregistered host still has the name they put on their events.
  const name = profile?.name ?? pastEvents[0]?.hostName ?? "Host";

  return (
    <div className="app-form">
      <section className="passport-cover" aria-labelledby="host-name">
        <Face wallet={wallet} initials={initialsOf(name)} />
        <div className="app-head">
          {profile && (
            <p className="passport-kicker">
              Host on Veni since {new Date(profile.registeredAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
            </p>
          )}
          <h1 id="host-name">{name}</h1>
          <p className="passport-note">
            <WalletName wallet={wallet} />
          </p>
          {profile && isLumaSlug(profile.lumaCalendar) && (
            <a className="passport-link" href={`https://luma.com/${profile.lumaCalendar}`} target="_blank" rel="noopener noreferrer">
              luma.com/{profile.lumaCalendar}
            </a>
          )}
        </div>
        <dl className="passport-stats">
          <div><dt>Events hosted</dt><dd><b>{record.eventCount}</b></dd></div>
          <div><dt>Guests who showed up</dt><dd><b>{turnout ?? "None yet"}</b></dd></div>
        </dl>
        {isMe && (
          <Link className="btn btn-primary btn-sm" href="/host">{profile ? "Edit your profile" : "Register as a host"}</Link>
        )}
      </section>

      <h2 className="section-title">Upcoming and live</h2>
      {live.kind === "loading" && <p className="action-note">Loading their events…</p>}
      {live.kind === "error" && <p className="app-message error">{live.message}</p>}
      {live.kind === "ready" && live.events.length === 0 && <p className="action-note">Nothing on right now.</p>}
      {live.kind === "ready" && live.events.length > 0 && (
        <div className="card-grid">
          {live.events.map(({ address, event }) => (
            <EventCard key={address} event={cardOfEvent(address, event, live.now)} />
          ))}
        </div>
      )}

      <h2 className="section-title">Past events</h2>
      {pastEvents.length === 0 ? <p className="action-note">None yet.</p> : <PastEventList events={pastEvents} />}
    </div>
  );
}
