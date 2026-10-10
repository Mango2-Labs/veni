"use client";

// Reads and saves an event's description through the app's own API.
import type { Address } from "@solana/kit";
import { useJson } from "./archive-client";
import { eventDescriptionMessage } from "./event-description";
import { toBase64 } from "./signing";

/** A wallet's message signer, as `useSignMessage` gives it. */
export type SignMessage = (input: { message: Uint8Array }) => Promise<{ signature: Uint8Array }>;

/** The host's description, or null. Re-read when `refresh` changes. */
export function useEventDescription(event: Address | undefined, refresh = 0) {
  return useJson<{ description: string | null }>(event && `/api/events/${event}/description`, refresh);
}

/** Has the host's wallet sign the description, then saves it. */
export async function saveEventDescription(signMessage: SignMessage, event: Address, description: string) {
  const signedAt = new Date().toISOString();
  const message = new TextEncoder().encode(await eventDescriptionMessage({ event, description, signedAt }));
  const { signature } = await signMessage({ message });
  const response = await fetch(`/api/events/${event}/description`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ description, signedAt, signature: toBase64(signature) }),
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Couldn't save the description (error ${response.status}).`);
}
