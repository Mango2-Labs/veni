// Copies events and guests from the chain into the archive before the crank
// closes them. It reads the chain itself, so nobody can write made-up history.
import { fetchEncodedAccount, isSome, type Address } from "@solana/kit";
import { decodeEvent, type Event as EventAccount } from "@veni/client";
import { createVeniReader, fetchGuests } from "@veni/sdk";
import type { HostRecord, PastEvent } from "../host-profile";
import { isEventAccount } from "../events";
import { fromGeoPoint } from "../places";
import { SERVER_RPC_URL } from "./rpc";
import { getDatabase } from "./db";

const reader = createVeniReader(SERVER_RPC_URL);

export type ArchiveResult = { archived: true; guestCount: number } | { archived: false; reason: "not-found" };

/** Reads an event and its guests from the chain and saves them. Safe to repeat. */
export async function archiveEvent(eventAddress: Address): Promise<ArchiveResult> {
  const account = await fetchEncodedAccount(reader.rpc, eventAddress, { commitment: "confirmed" });
  if (!account.exists) return { archived: false, reason: "not-found" };
  if (!isEventAccount(account)) throw new Error("That address isn't a Veni event.");
  // Unapproved applications don't count toward turnout.
  const guests = (await fetchGuests(reader, eventAddress)).filter(({ data }) => data.isApproved);
  await saveEvent(
    eventAddress,
    decodeEvent(account).data,
    guests.map(({ data }) => ({ wallet: data.wallet, hasAttended: data.hasAttended })),
  );
  return { archived: true, guestCount: guests.length };
}

/**
 * Saves the event as the chain shows it. Counts only go up, so a stale RPC
 * can't undo a later save.
 */
export async function saveEvent(address: Address, event: EventAccount, guests: { wallet: Address; hasAttended: boolean }[]) {
  const db = await getDatabase();
  const { terms, details } = event;
  const location = isSome(details.location) ? fromGeoPoint(details.location.value) : undefined;
  await db.query(
    `INSERT INTO archived_events (
       address, organizer, title, host_name, city, venue, cover, luma_slug, latitude, longitude,
       stake_mint, stake_amount, capacity, starts_at, check_in_ends_at, guest_count, attended_count, is_settled, is_cancelled
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
     ON CONFLICT (address) DO UPDATE SET
       guest_count = GREATEST(archived_events.guest_count, EXCLUDED.guest_count),
       attended_count = GREATEST(archived_events.attended_count, EXCLUDED.attended_count),
       is_settled = archived_events.is_settled OR EXCLUDED.is_settled,
       is_cancelled = archived_events.is_cancelled OR EXCLUDED.is_cancelled,
       archived_at = now()`,
    [
      address,
      event.organizer,
      terms.title,
      details.hostName,
      details.city,
      details.venue,
      details.cover,
      details.lumaSlug,
      location?.latitude ?? null,
      location?.longitude ?? null,
      event.stakeMint,
      terms.stakeAmount.toString(),
      terms.capacity,
      terms.rsvpEndsAt.toString(),
      terms.checkInEndsAt.toString(),
      event.guestCount,
      event.attendedCount,
      event.isSettled,
      event.isCancelled,
    ],
  );
  for (const guest of guests) {
    await db.query(
      `INSERT INTO archived_guests (event_address, wallet, has_attended) VALUES ($1, $2, $3)
       ON CONFLICT (event_address, wallet) DO UPDATE SET has_attended = archived_guests.has_attended OR EXCLUDED.has_attended`,
      [address, guest.wallet, guest.hasAttended],
    );
  }
}

type EventRow = {
  address: string;
  organizer: string;
  title: string;
  host_name: string;
  city: string;
  venue: string;
  cover: string;
  luma_slug: string;
  starts_at: string | number | bigint;
  guest_count: number;
  attended_count: number;
  is_cancelled: boolean;
};

const EVENT_COLUMNS = "e.address, e.organizer, e.title, e.host_name, e.city, e.venue, e.cover, e.luma_slug, e.starts_at, e.guest_count, e.attended_count, e.is_cancelled";

function toPastEvent(row: EventRow): PastEvent {
  return {
    address: row.address as Address,
    organizer: row.organizer as Address,
    title: row.title,
    hostName: row.host_name,
    city: row.city,
    venue: row.venue,
    cover: row.cover,
    lumaSlug: row.luma_slug,
    startsAt: Number(row.starts_at),
    guestCount: Number(row.guest_count),
    attendedCount: Number(row.attended_count),
    isCancelled: row.is_cancelled,
  };
}

/** Events that are over where this wallet checked in, newest first. */
export async function pastEventsAttendedBy(wallet: Address, nowSeconds = Math.floor(Date.now() / 1000)) {
  const db = await getDatabase();
  const rows = await db.query<EventRow>(
    `SELECT ${EVENT_COLUMNS} FROM archived_guests g JOIN archived_events e ON e.address = g.event_address
     WHERE g.wallet = $1 AND g.has_attended AND (e.check_in_ends_at <= $2 OR e.is_settled OR e.is_cancelled)
     ORDER BY e.starts_at DESC LIMIT 100`,
    [wallet, nowSeconds],
  );
  return rows.map(toPastEvent);
}

/** A host's events that are over (check-in closed, settled or cancelled), newest first. */
export async function pastEventsHostedBy(organizer: Address, nowSeconds = Math.floor(Date.now() / 1000)) {
  const db = await getDatabase();
  const rows = await db.query<EventRow>(
    `SELECT ${EVENT_COLUMNS} FROM archived_events e
     WHERE e.organizer = $1 AND (e.check_in_ends_at <= $2 OR e.is_settled OR e.is_cancelled)
     ORDER BY e.starts_at DESC LIMIT 100`,
    [organizer, nowSeconds],
  );
  return rows.map(toPastEvent);
}

/** How a host's past events went. Turnout only counts events that ran. */
export function recordOf(pastEvents: PastEvent[]): HostRecord {
  const ran = pastEvents.filter((event) => !event.isCancelled && event.guestCount > 0);
  return {
    eventCount: pastEvents.length,
    guestCount: ran.reduce((sum, event) => sum + event.guestCount, 0),
    attendedCount: ran.reduce((sum, event) => sum + event.attendedCount, 0),
  };
}
