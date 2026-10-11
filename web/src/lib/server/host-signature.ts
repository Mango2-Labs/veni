// Writes only an event's host may make, such as its description or category:
// checked against the organizer the chain names.
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
import { isEventAccount } from "../events";
import { SERVER_RPC_URL } from "./rpc";

const reader = createVeniReader(SERVER_RPC_URL);

/** Signature age and clock limits, as for host profiles. */
const MAX_SIGNATURE_AGE_MS = 10 * 60 * 1000;
const MAX_CLOCK_AHEAD_MS = 2 * 60 * 1000;

export type HostSignatureOptions = {
  now?: number;
  /** Who hosts the event. The chain's answer, unless a test stands in for it. */
  organizerOf?: (event: Address) => Promise<Address>;
};

/**
 * Throws a readable message unless the event's host signed `message` in the last
 * few minutes. `what` names the change, like "its description". Returns when it was signed.
 */
export async function checkHostSignature(
  input: { event: string; signedAt: string; signature: string },
  message: string,
  what: string,
  { now = Date.now(), organizerOf = organizerOnChain }: HostSignatureOptions = {},
) {
  if (!isAddress(input.event)) throw new Error("That isn't an event address.");
  checkSignedAt(input.signedAt, now, what);
  const organizer = await organizerOf(address(input.event));
  if (!(await isSignedBy(organizer, input.signature, message))) {
    throw new Error(`Only the event's host can change ${what}. Sign with the wallet that created it.`);
  }
  return new Date(input.signedAt).toISOString();
}

/** Throws unless `signedAt` is from the last few minutes. */
export function checkSignedAt(signedAt: string, now: number, what: string) {
  const time = Date.parse(signedAt);
  if (Number.isNaN(time) || now - time > MAX_SIGNATURE_AGE_MS || time - now > MAX_CLOCK_AHEAD_MS) {
    throw new Error(`That signature is too old. Sign again to save ${what}.`);
  }
}

/** Whether `signer`'s wallet made this base64 signature of `message`. */
export async function isSignedBy(signer: Address, signature: string, message: string) {
  const bytes = Uint8Array.from(Buffer.from(signature, "base64"));
  if (bytes.length !== 64) throw new Error("That isn't a wallet signature.");
  return verifySignature(await getPublicKeyFromAddress(signer), bytes as SignatureBytes, getUtf8Encoder().encode(message));
}

/** The organizer, read from the chain. Retried briefly, since a new event may not have reached the RPC yet. */
async function organizerOnChain(event: Address) {
  for (let attempt = 1; ; attempt++) {
    const account = await fetchEncodedAccount(reader.rpc, event, { commitment: "confirmed" });
    if (account.exists && isEventAccount(account)) return decodeEvent(account).data.organizer;
    if (attempt === 3) throw new Error("That event isn't open anymore, so it can't change.");
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}
