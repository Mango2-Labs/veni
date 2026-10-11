// An event read from its public Luma page, as Veni's site returns it to the host forms.
import type { MapPoint } from "./events";

/** What the host form needs from a Luma event. Any detail Luma doesn't show is "". */
export type LumaEvent = {
  url: string;
  /** The path after "luma.com/", or "". */
  lumaSlug: string;
  title: string;
  host: string;
  city: string;
  venue: string;
  /** Plain text. Never stored on-chain. */
  description: string;
  /** ISO 8601 in the event's own offset, such as "2026-10-07T18:30:00.000+02:00". */
  startsAt?: string;
  endsAt?: string;
  isOnline: boolean;
  /** The poster the host uploaded, at its original size. */
  cover?: string;
  /** Where it meets, even when Luma hides the address. */
  location?: MapPoint;
  /** True when Luma hides the street address, so the pin may only be near the venue. */
  locationIsApproximate: boolean;
};
