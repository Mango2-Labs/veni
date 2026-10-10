"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSelectedWalletAccount, useSignMessage } from "@solana/react";
import type { UiWalletAccount } from "@wallet-standard/react";
import type { Address } from "@solana/kit";
import { describeError } from "@veni/sdk";
import { AppHeader } from "@/components/AppHeader";
import { useHostPage } from "@/lib/archive-client";
import { isLumaSlug } from "@/lib/events";
import { HOST_NAME_LIMIT, hostProfileMessage, type HostProfile } from "@/lib/host-profile";
import { toBase64 } from "@/lib/signing";

/** Host registration: a name and Luma calendar, signed by the hosting wallet. */
export default function HostProfilePage() {
  const [account] = useSelectedWalletAccount();
  return (
    <>
      <AppHeader />
      <main className="app-main">
        <div className="wrap">
          <div className="app-head">
            <h1 className="app-title">Your host profile</h1>
            <p className="app-sub">Guests see your name and past events.</p>
          </div>
          {account ? <HostProfileForm key={account.address} account={account} /> : (
            <div className="app-card"><p>Connect the wallet you host from to register.</p></div>
          )}
        </div>
      </main>
    </>
  );
}

function HostProfileForm({ account }: { account: UiWalletAccount }) {
  const wallet = account.address as Address;
  const [refresh, setRefresh] = useState(0);
  const page = useHostPage(wallet, refresh);
  if (page.kind === "loading") return <p className="action-note">Loading your profile…</p>;
  if (page.kind === "error") return <p className="app-message error">{page.message}</p>;
  return <ProfileEditor account={account} profile={page.value.profile} onSaved={() => setRefresh((count) => count + 1)} />;
}

function ProfileEditor({ account, profile, onSaved }: { account: UiWalletAccount; profile?: HostProfile; onSaved: () => void }) {
  const wallet = account.address as Address;
  const signMessage = useSignMessage(account);
  const [name, setName] = useState(profile?.name ?? "");
  const [calendar, setCalendar] = useState(profile?.lumaCalendar ?? "");
  const [status, setStatus] = useState<{ busy?: boolean; error?: string; saved?: boolean }>({});

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      const lumaCalendar = calendarSlugOf(calendar);
      const input = { wallet, name: name.trim(), lumaCalendar, signedAt: new Date().toISOString() };
      setStatus({ busy: true });
      const { signature } = await signMessage({ message: new TextEncoder().encode(hostProfileMessage(input)) });
      const response = await fetch("/api/hosts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...input, signature: toBase64(signature) }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? `Couldn't save your profile (error ${response.status}).`);
      setStatus({ saved: true });
      onSaved();
    } catch (error) {
      setStatus({ error: describeError(error) });
    }
  }

  return (
    <form className="app-card app-form" onSubmit={onSubmit} aria-busy={status.busy}>
      <div className="field">
        <label htmlFor="host-name">Name</label>
        <input id="host-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={HOST_NAME_LIMIT} autoComplete="organization" required />
      </div>
      <div className="field">
        <label htmlFor="luma-calendar">Luma calendar (optional)</label>
        <input
          id="luma-calendar"
          value={calendar}
          onChange={(event) => setCalendar(event.target.value)}
          inputMode="url"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="luma.com/your-calendar"
        />
      </div>
      {status.error && <p className="app-message error" role="alert">{status.error}</p>}
      {status.saved && (
        <p className="app-message ok" role="status">
          Saved. <Link href={`/h/${wallet}`}>See your host page</Link>
        </p>
      )}
      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={status.busy}>
          {status.busy ? "Sign in your wallet…" : profile ? "Sign and update" : "Sign and register"}
        </button>
        {profile && <Link className="btn btn-white" href={`/h/${wallet}`}>Your host page</Link>}
      </div>
    </form>
  );
}

/** "superteam" from "superteam", "luma.com/superteam" or "https://lu.ma/superteam". Throws for anything else. */
function calendarSlugOf(text: string) {
  const slug = text.trim().replace(/^https?:\/\//i, "").replace(/^(?:www\.)?(?:luma\.com|lu\.ma)\//i, "").replace(/\/+$/, "");
  if (slug && !isLumaSlug(slug)) throw new Error("That isn't a Luma calendar. Paste a link like luma.com/your-calendar.");
  return slug;
}
