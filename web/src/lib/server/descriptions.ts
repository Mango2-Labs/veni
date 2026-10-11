// Event descriptions: saved only when the event's organizer signed them.
import type { Address } from "@solana/kit";
import { DESCRIPTION_LIMIT, eventDescriptionMessage, type EventDescriptionInput } from "../event-description";
import { getDatabase } from "./db";
import { checkHostSignature, type HostSignatureOptions } from "./host-signature";

/** Checks that the event's organizer signed it, then saves it. Throws a readable message. */
export async function saveDescription(input: EventDescriptionInput & { signature: string }, options: HostSignatureOptions = {}) {
  if (input.description.length > DESCRIPTION_LIMIT) {
    throw new Error(`The description is too long: ${DESCRIPTION_LIMIT.toLocaleString("en-US")} characters at most.`);
  }
  const signedAt = await checkHostSignature(input, await eventDescriptionMessage(input), "its description", options);
  const db = await getDatabase();
  // A newer signature always wins, so replaying an old one can't roll the description back.
  const rows = await db.query(
    `INSERT INTO event_descriptions (event_address, description, signed_at, signature) VALUES ($1, $2, $3, $4)
     ON CONFLICT (event_address) DO UPDATE SET
       description = EXCLUDED.description, signed_at = EXCLUDED.signed_at, signature = EXCLUDED.signature
       WHERE event_descriptions.signed_at < EXCLUDED.signed_at
     RETURNING event_address`,
    [input.event, input.description, signedAt, input.signature],
  );
  if (rows.length === 0) throw new Error("A newer description is already saved.");
}

/** The event's description, or undefined when its host never wrote one. */
export async function getDescription(event: Address): Promise<string | undefined> {
  const db = await getDatabase();
  const rows = await db.query<{ description: string }>("SELECT description FROM event_descriptions WHERE event_address = $1", [event]);
  return rows[0]?.description;
}
