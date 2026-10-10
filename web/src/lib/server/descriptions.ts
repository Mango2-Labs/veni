// Event descriptions: saved only when the event's organizer signed them.
import {
  address,
  fetchEncodedAccount,
  getPublicKeyFromAddress,
  getUtf8Encoder,
  isAddress,
  verifySignature,
  type Address,
  type SignatureBytes,
} from "@solana/kit";
import { decodeEvent } from "@veni/client";
import { createVeniReader } from "@veni/sdk";
import { DESCRIPTION_LIMIT, eventDescriptionMessage, type EventDescriptionInput } from "../event-description";
import { isEventAccount } from "../events";
import { getDatabase } from "./db";
import { SERVER_RPC_URL } from "./rpc";

const reader = createVeniReader(SERVER_RPC_URL);

/** Signature age and clock limits, as for host profiles. */
const MAX_SIGNATURE_AGE_MS = 10 * 60 * 1000;
const MAX_CLOCK_AHEAD_MS = 2 * 60 * 1000;

type SaveOptions = {
  now?: number;
  /** Who may describe the event. The chain's answer, unless a test stands in for it. */
  organizerOf?: (event: Address) => Promise<Address>;
};

/** Checks that the event's organizer signed it, then saves it. Throws a readable message. */
export async function saveDescription(
  input: EventDescriptionInput & { signature: string },
  { now = Date.now(), organizerOf = organizerOnChain }: SaveOptions = {},
) {
  if (!isAddress(input.event)) throw new Error("That isn't an event address.");
  if (input.description.length > DESCRIPTION_LIMIT) {
    throw new Error(`The description is too long: ${DESCRIPTION_LIMIT.toLocaleString("en-US")} characters at most.`);
  }
  const signedAt = Date.parse(input.signedAt);
  if (Number.isNaN(signedAt) || now - signedAt > MAX_SIGNATURE_AGE_MS || signedAt - now > MAX_CLOCK_AHEAD_MS) {
    throw new Error("That signature is too old. Sign again to save the description.");
  }

  const organizer = await organizerOf(address(input.event));
  const signature = Uint8Array.from(Buffer.from(input.signature, "base64"));
  if (signature.length !== 64) throw new Error("That isn't a wallet signature.");
  const message = getUtf8Encoder().encode(await eventDescriptionMessage(input));
  if (!(await verifySignature(await getPublicKeyFromAddress(organizer), signature as SignatureBytes, message))) {
    throw new Error("Only the event's host can write its description. Sign with the wallet that created it.");
  }

  const db = await getDatabase();
  // A newer signature always wins, so replaying an old one can't roll the description back.
  const rows = await db.query(
    `INSERT INTO event_descriptions (event_address, description, signed_at, signature) VALUES ($1, $2, $3, $4)
     ON CONFLICT (event_address) DO UPDATE SET
       description = EXCLUDED.description, signed_at = EXCLUDED.signed_at, signature = EXCLUDED.signature
       WHERE event_descriptions.signed_at < EXCLUDED.signed_at
     RETURNING event_address`,
    [input.event, input.description, new Date(signedAt).toISOString(), input.signature],
  );
  if (rows.length === 0) throw new Error("A newer description is already saved.");
}

/**
 * The organizer, read from the chain. Retried briefly, since a new event may not
 * have reached the RPC yet.
 */
async function organizerOnChain(event: Address) {
  for (let attempt = 1; ; attempt++) {
    const account = await fetchEncodedAccount(reader.rpc, event, { commitment: "confirmed" });
    if (account.exists && isEventAccount(account)) return decodeEvent(account).data.organizer;
    if (attempt === 3) throw new Error("That event isn't open anymore, so its description can't change.");
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

/** The event's description, or undefined when its host never wrote one. */
export async function getDescription(event: Address): Promise<string | undefined> {
  const db = await getDatabase();
  const rows = await db.query<{ description: string }>("SELECT description FROM event_descriptions WHERE event_address = $1", [event]);
  return rows[0]?.description;
}
