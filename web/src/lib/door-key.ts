// The organizer's door key: a keypair this browser makes on first use and names
// in each event's terms. It signs check-ins without a wallet prompt per guest, so
// the door runs from the browser that created the event.
import { createKeyPairSignerFromPrivateKeyBytes, type Address } from "@solana/kit";

const STORAGE_PREFIX = "veni.doorKey.";

/** This browser's door key for an organizer, made on first use. Throws if it can't be saved. */
export async function doorKeyFor(organizer: Address) {
  let seed = readSeed(organizer);
  if (!seed) {
    seed = crypto.getRandomValues(new Uint8Array(32));
    try {
      localStorage.setItem(STORAGE_PREFIX + organizer, toHex(seed));
    } catch {
      throw new Error("This browser can't save your door key, which checks guests in. Allow site storage, or use another browser.");
    }
  }
  return createKeyPairSignerFromPrivateKeyBytes(seed);
}

/** The event's door key, if this browser is where its organizer made it. */
export async function findDoorKey(organizer: Address, doorKey: Address) {
  const seed = readSeed(organizer);
  if (!seed) return undefined;
  const signer = await createKeyPairSignerFromPrivateKeyBytes(seed);
  return signer.address === doorKey ? signer : undefined;
}

function readSeed(organizer: Address) {
  try {
    const hex = localStorage.getItem(STORAGE_PREFIX + organizer);
    return hex && /^[0-9a-f]{64}$/.test(hex) ? Uint8Array.from(hex.match(/../g)!, (pair) => parseInt(pair, 16)) : undefined;
  } catch {
    return undefined;
  }
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
