"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSelectedWalletAccount } from "@solana/react";
import type { UiWalletAccount } from "@wallet-standard/react";
import { fetchEncodedAccounts, type Address } from "@solana/kit";
import { decodeEvent, type Event as EventAccount } from "@veni/client";
import { cardOfEvent, chainTime, describeError, fetchGuestsOfWallet, usernameInitials } from "@veni/sdk";
import { AppHeader } from "@/components/AppHeader";
import { EventCard } from "@/components/EventCard";
import { ProfileStamps } from "@/components/PastEventList";
import { useJson, usePastEventsAttendedBy } from "@/lib/archive-client";
import { isEventAccount } from "@/lib/events";
import { UsernamePicker } from "@/components/UsernamePicker";
import { useUsernameOf } from "@/lib/usernames-client";
import { veniReader } from "@/lib/veni";

type Upcoming =
  | { kind: "loading" }
  | { kind: "ready"; events: { address: Address; event: EventAccount; isApproved: boolean }[]; now: bigint }
  | { kind: "error"; message: string };

/** A guest's profile: upcoming events from the chain, stamps from the archive. */
export default function ProfilePage() {
  const [account] = useSelectedWalletAccount();
  const wallet = account?.address as Address | undefined;
  return (
    <>
      <AppHeader />
      <main className="app-main">
        <div className="wrap">
          {account && wallet ? (
            <Profile account={account} wallet={wallet} />
          ) : (
            <section className="passport-cover" aria-labelledby="profile">
              <div className="app-head">
                <h1 id="profile">Profile</h1>
                <p className="passport-note">Sign in to see your profile.</p>
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}

function Profile({ account, wallet }: { account: UiWalletAccount; wallet: Address }) {
  const username = useUsernameOf(wallet);
  const [isChanging, setIsChanging] = useState(false);
  const [changes, setChanges] = useState(0);
  const record = useJson<{ changeableAt?: string }>(`/api/usernames/${wallet}`, changes);
  const changeableAt = record.kind === "ready" && record.value.changeableAt ? Date.parse(record.value.changeableAt) : undefined;
  const [openedAt] = useState(() => Date.now());
  const [upcoming, setUpcoming] = useState<Upcoming>({ kind: "loading" });
  const past = usePastEventsAttendedBy(wallet);

  useEffect(() => {
    let isCurrent = true;
    async function load() {
      try {
        const signUps = await fetchGuestsOfWallet(veniReader, wallet);
        const [accounts, now] = await Promise.all([
          fetchEncodedAccounts(veniReader.rpc, signUps.map(({ data }) => data.event)),
          chainTime(veniReader),
        ]);
        // Skips events from older program versions.
        const events = accounts.flatMap((account, index) =>
          account.exists && isEventAccount(account)
            ? [{ address: account.address, event: decodeEvent(account).data, isApproved: signUps[index].data.isApproved }]
            : [],
        );
        events.sort((a, b) => Number(a.event.terms.rsvpEndsAt - b.event.terms.rsvpEndsAt));
        if (isCurrent) setUpcoming({ kind: "ready", events, now });
      } catch (error) {
        if (isCurrent) setUpcoming({ kind: "error", message: describeError(error) });
      }
    }
    load();
    return () => {
      isCurrent = false;
    };
  }, [wallet]);

  const attended = past.kind === "ready" ? past.value.attended : [];
  const cities = new Set(attended.map((event) => event.city)).size;

  return (
    <>
      <section className="passport-cover" aria-labelledby="profile">
        <span className="passport-face" aria-hidden="true">{username ? usernameInitials(username) : "?"}</span>
        <div className="app-head">
          <h1 id="profile">{username ?? "Profile"}</h1>
          {username && changeableAt !== undefined && openedAt >= changeableAt && (
            <button type="button" className="passport-edit" onClick={() => setIsChanging(true)}>
              Change username
            </button>
          )}
        </div>
        <dl className="passport-stats">
          <div><dt>Events attended</dt><dd><b>{past.kind === "ready" ? attended.length : "…"}</b></dd></div>
          <div><dt>Cities</dt><dd><b>{past.kind === "ready" ? cities : "…"}</b></dd></div>
          <div><dt>Going</dt><dd><b>{upcoming.kind === "ready" ? upcoming.events.length : "…"}</b></dd></div>
        </dl>
      </section>
      {username && (
        <UsernamePicker
          key={isChanging ? "open" : "closed"}
          account={account}
          open={isChanging}
          current={username}
          leaveLabel="Cancel"
          onLeave={() => setIsChanging(false)}
          onDone={() => {
            setIsChanging(false);
            setChanges((count) => count + 1);
          }}
        />
      )}

      <h2 className="section-title">Going</h2>
      {upcoming.kind === "loading" && <p className="action-note">Loading your events…</p>}
      {upcoming.kind === "error" && <p className="app-message error">{upcoming.message}</p>}
      {upcoming.kind === "ready" && upcoming.events.length === 0 && (
        <p className="action-note">
          Nothing yet. <Link href="/events">Find an event</Link>
        </p>
      )}
      {upcoming.kind === "ready" && upcoming.events.length > 0 && (
        <div className="card-grid">
          {upcoming.events.map(({ address, event, isApproved }) => {
            const card = cardOfEvent(address, event, upcoming.now);
            // An application still waiting reads as that, not as the event's stage.
            if (!isApproved) card.stage = { label: "Waiting for the host", className: "stage-waiting" };
            return <EventCard key={address} event={card} />;
          })}
        </div>
      )}

      <h2 className="section-title">Stamps</h2>
      {past.kind === "loading" && <p className="action-note">Loading your stamps…</p>}
      {past.kind === "error" && <p className="app-message error">{past.message}</p>}
      {past.kind === "ready" && attended.length === 0 && (
        <p className="action-note">No stamps yet.</p>
      )}
      {past.kind === "ready" && attended.length > 0 && <ProfileStamps events={attended} />}
    </>
  );
}
