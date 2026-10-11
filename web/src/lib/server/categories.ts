// Event categories: saved only when the event's organizer signed them.
import type { Address } from "@solana/kit";
import { eventCategoryMessage, isEventCategory, type EventCategory, type EventCategoryInput } from "@veni/sdk";
import { getDatabase } from "./db";
import { checkHostSignature, type HostSignatureOptions } from "./host-signature";

/** Checks that the event's organizer signed it, then saves it. Throws a readable message. */
export async function saveCategory(input: EventCategoryInput & { signature: string }, options: HostSignatureOptions = {}) {
  if (!isEventCategory(input.category)) throw new Error("That isn't one of Veni's categories.");
  const signedAt = await checkHostSignature(input, eventCategoryMessage(input), "its category", options);
  const db = await getDatabase();
  // A newer signature always wins, so replaying an old one can't roll the category back.
  const rows = await db.query(
    `INSERT INTO event_categories (event_address, category, signed_at, signature) VALUES ($1, $2, $3, $4)
     ON CONFLICT (event_address) DO UPDATE SET
       category = EXCLUDED.category, signed_at = EXCLUDED.signed_at, signature = EXCLUDED.signature
       WHERE event_categories.signed_at < EXCLUDED.signed_at
     RETURNING event_address`,
    [input.event, input.category, signedAt, input.signature],
  );
  if (rows.length === 0) throw new Error("A newer category is already saved.");
}

/** Each of these events' categories, for the ones that have one. */
export async function getCategories(events: Address[]): Promise<Record<string, EventCategory>> {
  if (events.length === 0) return {};
  const db = await getDatabase();
  const rows = await db.query<{ event_address: string; category: EventCategory }>(
    "SELECT event_address, category FROM event_categories WHERE event_address = ANY($1)",
    [events],
  );
  return Object.fromEntries(rows.map(({ event_address, category }) => [event_address, category]));
}
