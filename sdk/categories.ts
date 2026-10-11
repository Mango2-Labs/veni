// What kind of event it is. Stored by Veni's site, signed by the event's host,
// since the program doesn't hold it. The site and app build the message here.
import type { Address } from "@solana/kit";

export const EVENT_CATEGORIES = ["Meetup", "Workshop", "Hackathon", "Conference", "Party", "Demo day"] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export function isEventCategory(value: unknown): value is EventCategory {
  return EVENT_CATEGORIES.includes(value as EventCategory);
}

export type EventCategoryInput = {
  event: Address;
  category: EventCategory;
  /** ISO 8601. Signatures expire after a few minutes. */
  signedAt: string;
};

/** What the host signs. */
export function eventCategoryMessage({ event, category, signedAt }: EventCategoryInput) {
  return ["Veni event category", `Event: ${event}`, `Category: ${category}`, `Signed at: ${signedAt}`].join("\n");
}
