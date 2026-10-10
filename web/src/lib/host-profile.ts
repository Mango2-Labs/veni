// Hosts register by signing a message with their wallet, with no fee. Browser and
// server build it here, so both sign and check the same text.
import type { Address } from "@solana/kit";

/** Same limit as the host name stored on each event. */
export const HOST_NAME_LIMIT = 40;

export type HostProfileInput = {
  wallet: Address;
  name: string;
  /** The path after "luma.com/", or "". */
  lumaCalendar: string;
  /** ISO 8601. Signatures expire after a few minutes. */
  signedAt: string;
};

export function hostProfileMessage({ wallet, name, lumaCalendar, signedAt }: HostProfileInput) {
  return [
    "Veni host profile",
    `Wallet: ${wallet}`,
    `Name: ${name}`,
    `Luma calendar: ${lumaCalendar || "none"}`,
    `Signed at: ${signedAt}`,
  ].join("\n");
}

export type HostProfile = {
  wallet: Address;
  name: string;
  lumaCalendar: string;
  registeredAt: string;
};

/** An event as the archive kept it, once it's over. */
export type PastEvent = {
  address: Address;
  organizer: Address;
  title: string;
  hostName: string;
  city: string;
  venue: string;
  cover: string;
  lumaSlug: string;
  /** Unix seconds. */
  startsAt: number;
  guestCount: number;
  attendedCount: number;
  isCancelled: boolean;
};

export type HostRecord = {
  /** Events whose check-in has closed, cancelled ones included. */
  eventCount: number;
  /** Across events that ran: not cancelled, with at least one guest. */
  guestCount: number;
  attendedCount: number;
};

/** A host's public page. `profile` is missing until they register. */
export type HostPage = { profile?: HostProfile; record: HostRecord; pastEvents: PastEvent[] };

/** "SB" for "Seoul Builders": a host's face until hosts have photos. */
export function initialsOf(name: string) {
  const words = name.trim().split(/\s+/);
  return words.slice(0, 2).map((word) => [...word][0]?.toUpperCase() ?? "").join("") || "?";
}
