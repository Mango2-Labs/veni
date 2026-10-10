// Builders for Veni events, shared by the program tests and the crank tests.
import {
  containsBytes,
  generateKeyPairSigner,
  type Address,
  type KeyPairSigner,
  type Signature,
  type TransactionSigner,
} from "@solana/kit";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import {
  getCloseEventInstruction,
  parseStampedEvent,
  STAMP_COUNT_DISCRIMINATOR,
  STAMPED_EVENT_DISCRIMINATOR,
  TREASURY,
  USDC_MINT,
  VENI_PROGRAM_ADDRESS,
  type EventDetailsArgs,
  type EventTermsArgs,
} from "@veni/client";
import { getCheckInInstructions, getCheckInWithCodeInstructions, signCheckIn, signCheckInCode } from "@veni/sdk";
import { createWallet, DAY_SECONDS, giveUsdc, jumpTo, START_TIME, type TestChain } from "./litesvm";

export const USDC = 1_000_000n; // base units in 1 USDC
export const HOUR_SECONDS = 60n * 60n;
/** The event starts a day after the test chain does, and RSVPs close then. */
export const RSVP_ENDS_AT = START_TIME + DAY_SECONDS;
/** Guests have 4 hours from the start to check in. */
export const CHECK_IN_ENDS_AT = RSVP_ENDS_AT + 4n * HOUR_SECONDS;
/** The key the organizer hands to staff at the door. */
export const DOOR_KEY = await generateKeyPairSigner();

/** A free, $10, 6-guest event. Override any term to test it. */
export function termsWith(overrides: Partial<EventTermsArgs> = {}): EventTermsArgs {
  return {
    stakeAmount: 10n * USDC,
    ticketPrice: 0n,
    rsvpEndsAt: RSVP_ENDS_AT,
    checkInEndsAt: CHECK_IN_ENDS_AT,
    capacity: 6,
    requiresApproval: false,
    doorKey: DOOR_KEY.address,
    title: "Builders Night",
    ...overrides,
  };
}

/** LX Factory in Lisbon, in millionths of a degree. */
export const LX_FACTORY = { latitude: 38_702_600, longitude: -9_178_660 };

export function detailsWith(overrides: Partial<EventDetailsArgs> = {}): EventDetailsArgs {
  return {
    hostName: "Lisbon Builders Club",
    city: "Lisbon",
    venue: "LX Factory",
    cover: "",
    lumaSlug: "",
    location: LX_FACTORY,
    ...overrides,
  };
}

export type CreateEventOptions = {
  terms?: Partial<EventTermsArgs>;
  details?: Partial<EventDetailsArgs>;
  stakeMint?: Address;
  eventId?: bigint;
  /** `chain.identity` by default, which also pays every transaction's fee. */
  organizer?: TransactionSigner;
};

/** Creates an event. Resolves to its address. */
export async function createEvent(chain: TestChain, options: CreateEventOptions = {}) {
  await createEventInstruction(chain, options).sendTransaction();
  const organizer = options.organizer ?? chain.identity;
  return eventAddressOf(chain, options.eventId ?? 1n, organizer.address);
}

export function createEventInstruction(chain: TestChain, options: CreateEventOptions = {}) {
  return chain.veni.instructions.createEvent({
    organizer: options.organizer ?? chain.identity,
    stakeMint: options.stakeMint ?? USDC_MINT,
    eventId: options.eventId ?? 1n,
    terms: termsWith(options.terms),
    details: detailsWith(options.details),
  });
}

export async function eventAddressOf(chain: TestChain, eventId: bigint, organizer = chain.identity.address) {
  const [eventAddress] = await chain.veni.pdas.event({ organizer, eventId });
  return eventAddress;
}

export function signUp(chain: TestChain, event: Address, wallet: TransactionSigner, stakeMint = USDC_MINT) {
  return chain.veni.instructions.signUp({ wallet, event, stakeMint }).sendTransaction();
}

/** A wallet with SOL for rent and exactly this much USDC, $10 by default. */
export async function createGuest(chain: TestChain, usdc = 10n * USDC) {
  const wallet = await createWallet(chain);
  await giveUsdc(chain, wallet.address, usdc);
  return wallet;
}

export async function guestAddressOf(chain: TestChain, event: Address, wallet: Address) {
  const [guestAddress] = await chain.veni.pdas.guest({ event, wallet });
  return guestAddress;
}

export type SignedUpGuest = { wallet: TransactionSigner; guest: Address };

/** An event that `guestCount` fresh wallets have RSVPed to, each holding exactly the stake and any ticket price. */
export async function createEventWithGuests(chain: TestChain, guestCount: number, options: CreateEventOptions = {}) {
  const event = await createEvent(chain, options);
  const terms = termsWith(options.terms);
  const stakeAmount = BigInt(terms.stakeAmount) + BigInt(terms.ticketPrice);
  const guests: SignedUpGuest[] = [];
  for (let signedUp = 0; signedUp < guestCount; signedUp++) {
    const wallet = await createGuest(chain, stakeAmount);
    await signUp(chain, event, wallet);
    guests.push({ wallet, guest: await guestAddressOf(chain, event, wallet.address) });
  }
  return { event, guests };
}

/** An event that requires approval, with `applicantCount` fresh wallets that applied, none approved yet. */
export async function createEventWithApplicants(chain: TestChain, applicantCount: number, options: CreateEventOptions = {}) {
  return createEventWithGuests(chain, applicantCount, { ...options, terms: { requiresApproval: true, ...options.terms } });
}

/** The organizer (`chain.identity` by default) approves an application. */
export function approveApplication(chain: TestChain, event: Address, guest: Address, organizer: TransactionSigner = chain.identity) {
  return chain.veni.instructions.approveApplication({ organizer, event, guest }).sendTransaction();
}

/** The organizer declines an application, or the applicant withdraws it, when `remover` is their wallet. */
export function removeApplication(chain: TestChain, event: Address, wallet: Address, remover: TransactionSigner = chain.identity) {
  return chain.veni.instructions.removeApplication({ remover, event, wallet, stakeMint: USDC_MINT }).sendTransaction();
}

export async function createEventWithGuest(chain: TestChain, options: CreateEventOptions = {}) {
  const { event, guests } = await createEventWithGuests(chain, 1, options);
  return { event, ...guests[0] };
}

/**
 * The door checks a guest in: `signer` (the door key by default) signs, and
 * `chain.identity` sends the signature and `check_in_guest` in one transaction.
 */
export async function checkIn(chain: TestChain, event: Address, wallet: Address, signer: KeyPairSigner = DOOR_KEY) {
  const signed = await signCheckIn(signer, event, wallet);
  return chain.sendTransaction(await getCheckInInstructions(signed));
}

/**
 * A guest scans the door: `signer` (the door key by default) signs code
 * `code`, shown at `shownAt` (the test chain's start by default), and the
 * guest's own wallet sends it with `check_in_with_code`.
 */
export async function scanCheckInCode(
  chain: TestChain,
  event: Address,
  wallet: TransactionSigner,
  code: bigint,
  shownAt = START_TIME,
  signer: KeyPairSigner = DOOR_KEY,
) {
  const checkInCode = await signCheckInCode(signer, event, code, shownAt);
  return chain.sendTransaction(await getCheckInWithCodeInstructions(checkInCode, wallet));
}

export function cancelEvent(chain: TestChain, event: Address, organizer: TransactionSigner = chain.identity) {
  return chain.veni.instructions.cancelEvent({ organizer, event }).sendTransaction();
}

/** Settles a USDC event. Override where the fee goes to test redirects. */
export function settleEvent(
  chain: TestChain,
  event: Address,
  overrides: { stakeMint?: Address; treasuryTokenAccount?: Address } = {},
) {
  return chain.veni.instructions
    .settleEvent({ event, stakeMint: overrides.stakeMint ?? USDC_MINT, ...overrides })
    .sendTransaction();
}

/**
 * A settled event: `guestCount` RSVPed at the default $10 stake (or the stake
 * in `options`), the first `attendeeCount` checked in, and it settled when
 * check-in closed.
 */
export async function createSettledEvent(
  chain: TestChain,
  guestCount: number,
  attendeeCount: number,
  options: CreateEventOptions = {},
) {
  const { event, guests } = await createEventWithGuests(chain, guestCount, options);
  const attendees = guests.slice(0, attendeeCount);
  for (const { wallet } of attendees) await checkIn(chain, event, wallet.address);
  jumpTo(chain, CHECK_IN_ENDS_AT);
  await settleEvent(chain, event);
  return { event, attendees, noShows: guests.slice(attendeeCount) };
}

/** Closes the guest's account. `chain.identity` sends it, not the guest. */
export function closeGuest(
  chain: TestChain,
  event: Address,
  wallet: Address,
  overrides: { guest?: Address; walletTokenAccount?: Address; stampCount?: Address } = {},
) {
  return chain.veni.instructions
    .closeGuest({ event, wallet, stakeMint: USDC_MINT, payer: chain.payer, ...overrides })
    .sendTransaction();
}

/**
 * Closes the event. The closer signs, and `chain.identity` pays the fee. It
 * passes no organizer token account unless given one: a free event needs none.
 */
export async function closeEvent(
  chain: TestChain,
  event: Address,
  organizer: Address,
  overrides: { closer?: TransactionSigner; treasuryTokenAccount?: Address; organizerTokenAccount?: Address } = {},
) {
  const { closer = chain.identity, treasuryTokenAccount, organizerTokenAccount } = overrides;
  return chain.sendTransaction([
    getCloseEventInstruction({
      closer,
      event,
      organizer,
      stakeMint: USDC_MINT,
      vault: await usdcTokenAccountOf(event),
      treasuryTokenAccount: treasuryTokenAccount ?? (await usdcTokenAccountOf(TREASURY)),
      organizerTokenAccount,
    }),
  ]);
}

/** What the organizer gets back when the event closes: its rent and the vault's. */
export async function rentHeldBy(chain: TestChain, event: Address) {
  const vault = await usdcTokenAccountOf(event);
  const [eventAccount, vaultAccount] = await Promise.all([
    chain.rpc.getAccountInfo(event).send(),
    chain.rpc.getAccountInfo(vault).send(),
  ]);
  return BigInt(eventAccount.value!.lamports) + BigInt(vaultAccount.value!.lamports);
}

export async function solBalance(chain: TestChain, address: Address): Promise<bigint> {
  return (await chain.rpc.getBalance(address).send()).value;
}

export async function usdcTokenAccountOf(owner: Address) {
  const [tokenAccount] = await findAssociatedTokenPda({
    owner,
    mint: USDC_MINT,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  return tokenAccount;
}

export async function usdcBalance(chain: TestChain, owner: Address) {
  return (await chain.token.accounts.token.fetch(await usdcTokenAccountOf(owner))).data.amount;
}

/** A wallet's stamp count: 0 until their first stamp. */
export async function stampCountOf(chain: TestChain, wallet: Address) {
  const [address] = await chain.veni.pdas.stampCount({ wallet });
  const account = await chain.veni.accounts.stampCount.fetchMaybe(address);
  return account.exists ? account.data.count : 0;
}

/** Everything the program owns except stamp counts, which stay for good. */
export function accountsLeftBehind(chain: TestChain) {
  return chain.svm
    .getProgramAccounts(VENI_PROGRAM_ADDRESS)
    .filter(({ data }) => !containsBytes(data, STAMP_COUNT_DISCRIMINATOR, 0));
}

/** The stamps a transaction logged. Each sits after the 8-byte tag `emit_cpi!` adds. */
export function stampsLoggedBy(chain: TestChain, signature: Signature) {
  const transaction = chain.svm.getTransaction(signature);
  if (!transaction || !("innerInstructions" in transaction)) throw new Error(`No successful transaction ${signature}`);
  return transaction
    .innerInstructions()
    .flat()
    .map((inner) => inner.instruction().data())
    .filter((data) => containsBytes(data, STAMPED_EVENT_DISCRIMINATOR, 8))
    .map((data) => parseStampedEvent(data.slice(8)));
}
