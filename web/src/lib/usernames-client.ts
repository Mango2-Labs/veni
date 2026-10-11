"use client";

// Usernames in the browser: one shared cache, filled by batched lookups, so a
// guest list of 60 asks the server once.
import { useEffect, useSyncExternalStore } from "react";
import { photoPath, type UsernameInput } from "@veni/sdk";
import { shortAddress } from "./solana";

/** A wallet's username, or null once we know it has none. */
const known = new Map<string, string | null>();
/** A wallet's photo version, or null once we know it has none. */
const photos = new Map<string, number | null>();
/** Whether a wallet is on Veni's verified hosts list. */
const verified = new Map<string, boolean>();
const waiting = new Set<string>();
const listeners = new Set<() => void>();
let flushTimer: ReturnType<typeof setTimeout> | undefined;

const BATCH_SIZE = 100;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  for (const listener of listeners) listener();
}

function request(wallet: string) {
  if ((known.has(wallet) && photos.has(wallet) && verified.has(wallet)) || waiting.has(wallet)) return;
  waiting.add(wallet);
  flushTimer ??= setTimeout(flush, 20);
}

async function flush() {
  flushTimer = undefined;
  const wallets = [...waiting];
  waiting.clear();
  for (let start = 0; start < wallets.length; start += BATCH_SIZE) {
    const batch = wallets.slice(start, start + BATCH_SIZE);
    try {
      const response = await fetch(`/api/usernames?wallets=${batch.join(",")}`);
      const body = (await response.json()) as { usernames?: Record<string, string>; photos?: Record<string, number>; verified?: string[] };
      if (!response.ok || !body.usernames) continue;
      for (const wallet of batch) {
        known.set(wallet, body.usernames[wallet] ?? null);
        photos.set(wallet, body.photos?.[wallet] ?? null);
        verified.set(wallet, body.verified?.includes(wallet) ?? false);
      }
    } catch {
      // Left unknown, so the next render asks again.
    }
  }
  notify();
}

/** The wallet's username: undefined while loading, null if it has none. */
export function useUsernameOf(wallet: string | undefined) {
  const username = useSyncExternalStore(
    subscribe,
    () => (wallet ? known.get(wallet) : undefined),
    () => undefined,
  );
  useEffect(() => {
    if (wallet) request(wallet);
  }, [wallet, username]);
  return username;
}

/** Whether Veni verified this wallet as a host: false while loading. */
export function useIsVerifiedHost(wallet: string | undefined) {
  const isVerified = useSyncExternalStore(
    subscribe,
    () => (wallet ? verified.get(wallet) : undefined),
    () => undefined,
  );
  useEffect(() => {
    if (wallet) request(wallet);
  }, [wallet, isVerified]);
  return isVerified ?? false;
}

/** The wallet's photo address: undefined while loading, null if it has none. */
export function usePhotoOf(wallet: string | undefined) {
  const version = useSyncExternalStore(
    subscribe,
    () => (wallet ? photos.get(wallet) : undefined),
    () => undefined,
  );
  useEffect(() => {
    if (wallet) request(wallet);
  }, [wallet, version]);
  return wallet && version ? photoPath(wallet, version) : version === null ? null : undefined;
}

/** Shows a just-saved photo everywhere this wallet appears. */
export function rememberPhoto(wallet: string, version: number) {
  photos.set(wallet, version);
  notify();
}

/** "menor", or the short address while a wallet has no username. */
export function displayNameOf(wallet: string) {
  return known.get(wallet) ?? shortAddress(wallet);
}

export type UsernameCheck = { available: boolean; problem?: string };

/** Whether `wallet` can pick `username`: a name it gave up is still its own to take back. */
export async function checkUsername(username: string, wallet: string): Promise<UsernameCheck> {
  const response = await fetch(`/api/usernames/check?name=${encodeURIComponent(username)}&wallet=${wallet}`);
  const body = (await response.json()) as UsernameCheck & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Couldn't check that username.");
  return body;
}

/** Saves a signed username and remembers it for every component showing this wallet. */
export async function saveUsername(input: UsernameInput & { signature: string }) {
  const response = await fetch("/api/usernames", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await response.json()) as { username?: string; error?: string };
  if (!response.ok || !body.username) throw new Error(body.error ?? "Couldn't save your username.");
  known.set(input.wallet, body.username);
  notify();
  return body.username;
}
