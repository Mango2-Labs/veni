// Check-ins, two ways. Either way the door key signs, the Ed25519 program
// verifies it, and the program reads it from the previous instruction.
//   check_in_guest: the door signs "this wallet attended"; anyone sends it.
//   check_in_with_code: the guest scans a signed door code and sends it.
import {
  address,
  getAddressDecoder,
  getAddressEncoder,
  getBase64Decoder,
  getBase64Encoder,
  getI64Decoder,
  getI64Encoder,
  getU64Decoder,
  getU64Encoder,
  signBytes,
  type Address,
  type Instruction,
  type KeyPairSigner,
  type ReadonlyUint8Array,
  type TransactionSigner,
} from "@solana/kit";
import {
  CHECK_IN_MESSAGE_PREFIX,
  CHECK_IN_CODE_MESSAGE_PREFIX,
  findGuestPda,
  getCheckInGuestInstruction,
  getCheckInWithCodeInstructionAsync,
} from "@veni/client";

export const ED25519_PROGRAM_ADDRESS = address("Ed25519SigVerify111111111111111111111111111");

export type SignedCheckIn = { event: Address; wallet: Address; signer: Address; signature: ReadonlyUint8Array };

/** What the door key signs. The program builds the same bytes and compares. */
export function checkInMessage(event: Address, wallet: Address) {
  const addressEncoder = getAddressEncoder();
  return new Uint8Array([
    ...CHECK_IN_MESSAGE_PREFIX,
    ...addressEncoder.encode(event),
    ...addressEncoder.encode(wallet),
  ]);
}

/** The door key's signature over one guest's check-in. */
export async function signCheckIn(doorKey: KeyPairSigner, event: Address, wallet: Address): Promise<SignedCheckIn> {
  const signature = await signBytes(doorKey.keyPair.privateKey, checkInMessage(event, wallet));
  return { event, wallet, signer: doorKey.address, signature };
}

/** The two instructions that check a guest in, in the order the program expects. */
export async function getCheckInInstructions({ event, wallet, signer, signature }: SignedCheckIn) {
  const [guest] = await findGuestPda({ event, wallet });
  return [
    getEd25519Instruction(signer, signature, checkInMessage(event, wallet)),
    getCheckInGuestInstruction({ event, guest }),
  ];
}

/** A door code: the door key's signature over the event, code number and time shown. */
export type CheckInCode = { event: Address; code: bigint; shownAt: bigint; signer: Address; signature: ReadonlyUint8Array };

/** What the door key signs for each code. The program builds the same bytes and compares. */
export function checkInCodeMessage(event: Address, code: bigint, shownAt: bigint) {
  return new Uint8Array([
    ...CHECK_IN_CODE_MESSAGE_PREFIX,
    ...getAddressEncoder().encode(event),
    ...getU64Encoder().encode(code),
    ...getI64Encoder().encode(shownAt),
  ]);
}

/** Signs the next door code. `code` must exceed the event's `lastCheckInCode`; `shownAt` is chain time. */
export async function signCheckInCode(doorKey: KeyPairSigner, event: Address, code: bigint, shownAt: bigint): Promise<CheckInCode> {
  const signature = await signBytes(doorKey.keyPair.privateKey, checkInCodeMessage(event, code, shownAt));
  return { event, code, shownAt, signer: doorKey.address, signature };
}

/** What a guest sends after scanning: the door's signature, then their check-in. */
export async function getCheckInWithCodeInstructions(checkInCode: CheckInCode, wallet: TransactionSigner) {
  const { event, code, shownAt, signer, signature } = checkInCode;
  return [
    getEd25519Instruction(signer, signature, checkInCodeMessage(event, code, shownAt)),
    await getCheckInWithCodeInstructionAsync({ wallet, event, code, shownAt }),
  ];
}

const CHECK_IN_CODE_QR_PREFIX = "veni-check-in:";
const CHECK_IN_CODE_BYTES = 32 + 8 + 8 + 32 + 64;

/** The text a door screen puts in its QR code: a prefix, then the code's 144 bytes in URL-safe base64. */
export function encodeCheckInCode({ event, code, shownAt, signer, signature }: CheckInCode) {
  const bytes = new Uint8Array([
    ...getAddressEncoder().encode(event),
    ...getU64Encoder().encode(code),
    ...getI64Encoder().encode(shownAt),
    ...getAddressEncoder().encode(signer),
    ...signature,
  ]);
  const base64 = getBase64Decoder().decode(bytes);
  return CHECK_IN_CODE_QR_PREFIX + base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Reads a scanned QR back into a door code, or throws a message a guest can act on. */
export function decodeCheckInCode(text: string): CheckInCode {
  const notACheckInCode = new Error("That isn't a Veni check-in code. Scan the code on the door screen.");
  if (!text.startsWith(CHECK_IN_CODE_QR_PREFIX)) throw notACheckInCode;
  const base64 = text.slice(CHECK_IN_CODE_QR_PREFIX.length).replace(/-/g, "+").replace(/_/g, "/");
  let bytes: ReadonlyUint8Array;
  try {
    bytes = getBase64Encoder().encode(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  } catch {
    throw notACheckInCode;
  }
  if (bytes.length !== CHECK_IN_CODE_BYTES) throw notACheckInCode;
  return {
    event: getAddressDecoder().decode(bytes.slice(0, 32)),
    code: getU64Decoder().decode(bytes.slice(32, 40)),
    shownAt: getI64Decoder().decode(bytes.slice(40, 48)),
    signer: getAddressDecoder().decode(bytes.slice(48, 80)),
    signature: bytes.slice(80),
  };
}

/** An Ed25519 verify instruction for one signature, every part in this instruction (index u16::MAX), as the program requires. */
export function getEd25519Instruction(
  publicKey: Address,
  signature: ReadonlyUint8Array,
  message: ReadonlyUint8Array,
): Instruction {
  const THIS_INSTRUCTION = 0xffff;
  const publicKeyOffset = 16;
  const signatureOffset = publicKeyOffset + 32;
  const messageOffset = signatureOffset + 64;
  const offsets = [
    signatureOffset,
    THIS_INSTRUCTION,
    publicKeyOffset,
    THIS_INSTRUCTION,
    messageOffset,
    message.length,
    THIS_INSTRUCTION,
  ];

  const data = new Uint8Array(messageOffset + message.length);
  const view = new DataView(data.buffer);
  data[0] = 1; // one signature
  offsets.forEach((value, index) => view.setUint16(2 + index * 2, value, true));
  data.set(getAddressEncoder().encode(publicKey), publicKeyOffset);
  data.set(signature, signatureOffset);
  data.set(message, messageOffset);
  return { programAddress: ED25519_PROGRAM_ADDRESS, data };
}
