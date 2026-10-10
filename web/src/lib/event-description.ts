// Event descriptions live in the app's database, signed by the event's
// organizer. Browser and server build the message here, so they match.
import type { Address } from "@solana/kit";

/** Enough for any real event description. Luma's are cut to the same length when imported. */
export const DESCRIPTION_LIMIT = 10_000;

export type EventDescriptionInput = {
  event: Address;
  description: string;
  /** ISO 8601. Signatures expire after a few minutes. */
  signedAt: string;
};

/** What the host signs: the description's SHA-256, so a long one fits a wallet prompt. */
export async function eventDescriptionMessage({ event, description, signedAt }: EventDescriptionInput) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(description)));
  const fingerprint = [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return ["Veni event description", `Event: ${event}`, `Description SHA-256: ${fingerprint}`, `Signed at: ${signedAt}`].join("\n");
}
