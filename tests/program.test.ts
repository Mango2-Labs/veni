import { describe, expect, test } from "bun:test";
import {
  address,
  appendTransactionMessageInstructions,
  blockhash,
  compileTransaction,
  createTransactionMessage,
  generateKeyPairSigner,
  getTransactionEncoder,
  none,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  some,
} from "@solana/kit";
import { getTransferSolInstruction, SYSTEM_ERROR__ACCOUNT_ALREADY_IN_USE } from "@solana-program/system";
import {
  findAssociatedTokenPda,
  TOKEN_ERROR__INSUFFICIENT_FUNDS,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import {
  getCheckInGuestInstruction,
  getCheckInWithCodeInstruction,
  getCheckInWithCodeInstructionAsync,
  MAX_CHECK_IN_CODE_AGE_SECONDS,
  MAX_CHECK_IN_CODE_CLOCK_AHEAD_SECONDS,
  MAX_DURATION_SECONDS,
  MIN_DURATION_SECONDS,
  VENI_ERROR__ALREADY_CHECKED_IN,
  VENI_ERROR__ALREADY_SETTLED,
  VENI_ERROR__CANCEL_TOO_LATE,
  VENI_ERROR__CHECK_IN_CLOSED,
  VENI_ERROR__CHECK_IN_STILL_OPEN,
  VENI_ERROR__CITY_TOO_LONG,
  VENI_ERROR__CHECK_IN_CODE_EXPIRED,
  VENI_ERROR__CHECK_IN_CODE_FROM_THE_FUTURE,
  VENI_ERROR__CHECK_IN_CODE_USED,
  VENI_ERROR__COVER_TOO_LONG,
  VENI_ERROR__EVENT_CANCELLED,
  VENI_ERROR__EVENT_FULL,
  VENI_ERROR__EVENT_TOO_LONG,
  VENI_ERROR__EVENT_TOO_SHORT,
  VENI_ERROR__GUEST_NOT_IN_EVENT,
  VENI_ERROR__GUESTS_STILL_OPEN,
  VENI_ERROR__HOST_NAME_TOO_LONG,
  VENI_ERROR__LOCATION_OFF_THE_MAP,
  VENI_ERROR__LUMA_SLUG_TOO_LONG,
  VENI_ERROR__MISSING_CHECK_IN_SIGNATURE,
  VENI_ERROR__NO_CAPACITY,
  VENI_ERROR__NOBODY_RSVPED,
  VENI_ERROR__NOT_ORGANIZER,
  VENI_ERROR__ORGANIZER_CANNOT_RSVP,
  VENI_ERROR__NOT_SETTLED,
  VENI_ERROR__RSVP_CLOSED,
  VENI_ERROR__RSVP_ENDS_AFTER_CHECK_IN,
  VENI_ERROR__RSVP_ENDS_IN_PAST,
  VENI_ERROR__RSVP_STILL_OPEN,
  VENI_ERROR__STAKE_IS_ZERO,
  VENI_ERROR__STAKE_MINT_NOT_ALLOWED,
  VENI_ERROR__STAKE_TOO_LARGE,
  VENI_ERROR__TITLE_TOO_LONG,
  VENI_ERROR__VENUE_TOO_LONG,
  VENI_ERROR__WRONG_CHECK_IN_MESSAGE,
  VENI_ERROR__WRONG_CHECK_IN_SIGNER,
  VENI_ERROR__WRONG_STAKE_MINT,
  TREASURY,
  TEST_USD_MINT,
  USDC_MINT,
} from "@veni/client";
import {
  checkInMessage,
  decodeCheckInCode,
  EVENT_ACCOUNT_SIZE,
  checkInCodeMessage,
  encodeCheckInCode,
  getCheckInInstructions,
  getEd25519Instruction,
  signCheckIn,
  signCheckInCode,
} from "@veni/sdk";
import {
  createMint,
  createTestChain,
  createWallet,
  expectTransactionError,
  findCustomErrorCode,
  giveTokens,
  giveUsdc,
  jumpTo,
  removeAccount,
  START_TIME,
} from "./litesvm";
import {
  accountsLeftBehind,
  cancelEvent,
  CHECK_IN_ENDS_AT,
  checkIn,
  closeEvent,
  closeGuest,
  createEvent,
  createEventInstruction,
  createEventWithGuest,
  createEventWithGuests,
  createGuest,
  createSettledEvent,
  DOOR_KEY,
  eventAddressOf,
  guestAddressOf,
  LX_FACTORY,
  rentHeldBy,
  signUp,
  RSVP_ENDS_AT,
  scanCheckInCode,
  settleEvent,
  solBalance,
  USDC,
  usdcBalance,
  usdcTokenAccountOf,
} from "./events";

/** The most bytes a Solana transaction can have on the wire. */
const SOLANA_TRANSACTION_SIZE_LIMIT = 1232;
const COMPUTE_BUDGET_PROGRAM = address("ComputeBudget111111111111111111111111111111");

/** Anchor's code for an account that should exist but doesn't. */
const ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED = 3012;
/** Anchor's code for a token account whose owner isn't the one required. */
const ANCHOR_ERROR__CONSTRAINT_TOKEN_OWNER = 2015;
/** Anchor's code for an address that isn't the one its seeds derive. */
const ANCHOR_ERROR__CONSTRAINT_SEEDS = 2006;
/** Anchor's code for an account that doesn't match the field it should equal. */
const ANCHOR_ERROR__CONSTRAINT_HAS_ONE = 2001;

describe("create_event", () => {
  test("creates the event, with its terms and details, and an empty vault that only the event controls", async () => {
    const chain = await createTestChain();
    const cover = "https://images.lumacdn.com/uploads/3y/75684817-ec25-45fa-8190-7395176ae0b9.png";
    const lumaSlug = "builders-night-lisbon";

    const eventAddress = await createEvent(chain, { details: { cover, lumaSlug } });

    const event = await chain.veni.accounts.event.fetch(eventAddress);
    expect(event.data).toMatchObject({
      organizer: chain.identity.address,
      eventId: 1n,
      stakeMint: USDC_MINT,
      guestCount: 0,
      attendedCount: 0,
      paidCount: 0,
      closedGuestCount: 0,
      isSettled: false,
      isCancelled: false,
      terms: {
        stakeAmount: 10n * USDC,
        rsvpEndsAt: RSVP_ENDS_AT,
        checkInEndsAt: CHECK_IN_ENDS_AT,
        capacity: 6,
        doorKey: DOOR_KEY.address,
        title: "Builders Night",
      },
      details: {
        hostName: "Lisbon Builders Club",
        city: "Lisbon",
        venue: "LX Factory",
        cover,
        lumaSlug,
        location: some(LX_FACTORY),
      },
    });

    const [vaultAddress] = await findAssociatedTokenPda({
      owner: eventAddress,
      mint: USDC_MINT,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    const vault = await chain.token.accounts.token.fetch(vaultAddress);
    expect(vault.data).toMatchObject({ mint: USDC_MINT, owner: eventAddress, amount: 0n });
  });

  test("makes every event account the size the app and crank filter on", async () => {
    const chain = await createTestChain();

    const eventAddress = await createEvent(chain);

    const event = await chain.veni.accounts.event.fetch(eventAddress);
    expect(event.space).toBe(BigInt(EVENT_ACCOUNT_SIZE));
  });

  test("allows Test USD, the devnet stand-in for USDC", async () => {
    const chain = await createTestChain();
    createMint(chain, TEST_USD_MINT);

    await createEvent(chain, { stakeMint: TEST_USD_MINT });
  });

  test("allows a stake of exactly 100 tokens", async () => {
    const chain = await createTestChain();

    await createEvent(chain, { terms: { stakeAmount: 100n * USDC } });
  });

  test("refuses a stake of 0", async () => {
    const chain = await createTestChain();

    await expectTransactionError(createEvent(chain, { terms: { stakeAmount: 0n } }), VENI_ERROR__STAKE_IS_ZERO);
  });

  test("refuses a stake of 101 USDC", async () => {
    const chain = await createTestChain();

    await expectTransactionError(
      createEvent(chain, { terms: { stakeAmount: 101n * USDC } }),
      VENI_ERROR__STAKE_TOO_LARGE,
    );
  });

  test("refuses a look-alike token that isn't on the list", async () => {
    const chain = await createTestChain();
    const fakeUsdc = (await generateKeyPairSigner()).address;
    createMint(chain, fakeUsdc);

    await expectTransactionError(createEvent(chain, { stakeMint: fakeUsdc }), VENI_ERROR__STAKE_MINT_NOT_ALLOWED);
  });

  test("allows a 64-byte title, counted in bytes rather than characters", async () => {
    const chain = await createTestChain();

    await createEvent(chain, { eventId: 1n, terms: { title: "a".repeat(64) } });
    await createEvent(chain, { eventId: 2n, terms: { title: "é".repeat(32) } });
  });

  test("refuses a title longer than 64 bytes", async () => {
    const chain = await createTestChain();

    await expectTransactionError(createEvent(chain, { terms: { title: "a".repeat(65) } }), VENI_ERROR__TITLE_TOO_LONG);
    await expectTransactionError(createEvent(chain, { terms: { title: "é".repeat(33) } }), VENI_ERROR__TITLE_TOO_LONG);
  });

  const DETAIL_LIMITS = [
    { field: "hostName", limit: 40, error: VENI_ERROR__HOST_NAME_TOO_LONG },
    { field: "city", limit: 32, error: VENI_ERROR__CITY_TOO_LONG },
    { field: "venue", limit: 48, error: VENI_ERROR__VENUE_TOO_LONG },
    { field: "cover", limit: 100, error: VENI_ERROR__COVER_TOO_LONG },
    { field: "lumaSlug", limit: 64, error: VENI_ERROR__LUMA_SLUG_TOO_LONG },
  ] as const;

  for (const { field, limit, error } of DETAIL_LIMITS) {
    test(`allows a ${limit}-byte ${field} and refuses ${limit + 1} bytes`, async () => {
      const chain = await createTestChain();

      await createEvent(chain, { eventId: 1n, details: { [field]: "a".repeat(limit) } });
      await expectTransactionError(
        createEvent(chain, { eventId: 2n, details: { [field]: "a".repeat(limit + 1) } }),
        error,
      );
    });
  }

  test("fits in one transaction with every detail at its limit, alongside compute budget instructions", async () => {
    const chain = await createTestChain();
    const createEventAtLimits = await createEventInstruction(chain, {
      terms: { title: "a".repeat(64) },
      details: {
        hostName: "a".repeat(40),
        city: "a".repeat(32),
        venue: "a".repeat(48),
        cover: "a".repeat(100),
        lumaSlug: "a".repeat(64),
      },
    });
    // The app's transaction planner adds a compute unit limit and price to every transaction.
    const setComputeUnitLimit = { programAddress: COMPUTE_BUDGET_PROGRAM, data: new Uint8Array([2, 0, 0, 0, 0]) };
    const setComputeUnitPrice = { programAddress: COMPUTE_BUDGET_PROGRAM, data: new Uint8Array([3, 0, 0, 0, 0, 0, 0, 0, 0]) };

    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (draft) => setTransactionMessageFeePayerSigner(chain.identity, draft),
      (draft) => setTransactionMessageLifetimeUsingBlockhash({ blockhash: blockhash("11111111111111111111111111111111"), lastValidBlockHeight: 0n }, draft),
      (draft) => appendTransactionMessageInstructions([setComputeUnitLimit, setComputeUnitPrice, createEventAtLimits], draft),
    );
    const size = getTransactionEncoder().encode(compileTransaction(message)).length;

    expect(size).toBeLessThanOrEqual(SOLANA_TRANSACTION_SIZE_LIMIT);
  });

  test("allows an event with no map", async () => {
    const chain = await createTestChain();

    const eventAddress = await createEvent(chain, { details: { location: null } });

    const event = await chain.veni.accounts.event.fetch(eventAddress);
    expect(event.data.details.location).toEqual(none());
  });

  test("allows a pin at the poles and on the date line, and refuses one past them", async () => {
    const chain = await createTestChain();

    await createEvent(chain, { eventId: 1n, details: { location: { latitude: 90_000_000, longitude: -180_000_000 } } });
    await createEvent(chain, { eventId: 2n, details: { location: { latitude: -90_000_000, longitude: 180_000_000 } } });
    for (const location of [
      { latitude: 90_000_001, longitude: 0 },
      { latitude: 0, longitude: -180_000_001 },
    ]) {
      await expectTransactionError(createEvent(chain, { eventId: 3n, details: { location } }), VENI_ERROR__LOCATION_OFF_THE_MAP);
    }
  });

  test("refuses an event with no room for guests", async () => {
    const chain = await createTestChain();

    await expectTransactionError(createEvent(chain, { terms: { capacity: 0 } }), VENI_ERROR__NO_CAPACITY);
  });

  test("refuses RSVPs that close right now or earlier", async () => {
    const chain = await createTestChain();

    await expectTransactionError(
      createEvent(chain, { terms: { rsvpEndsAt: START_TIME } }),
      VENI_ERROR__RSVP_ENDS_IN_PAST,
    );
  });

  test("refuses RSVPs that close after check-in does", async () => {
    const chain = await createTestChain();

    await expectTransactionError(
      createEvent(chain, { terms: { rsvpEndsAt: CHECK_IN_ENDS_AT + 1n } }),
      VENI_ERROR__RSVP_ENDS_AFTER_CHECK_IN,
    );
  });

  test("allows check-in to close exactly the minimum time from now, or exactly 1 year from now", async () => {
    const chain = await createTestChain();

    await createEvent(chain, {
      eventId: 1n,
      terms: { rsvpEndsAt: START_TIME + 1n, checkInEndsAt: START_TIME + MIN_DURATION_SECONDS },
    });
    await createEvent(chain, { eventId: 2n, terms: { checkInEndsAt: START_TIME + MAX_DURATION_SECONDS } });
  });

  test("refuses check-in that closes 1 second sooner than the minimum", async () => {
    const chain = await createTestChain();

    await expectTransactionError(
      createEvent(chain, {
        terms: { rsvpEndsAt: START_TIME + 1n, checkInEndsAt: START_TIME + MIN_DURATION_SECONDS - 1n },
      }),
      VENI_ERROR__EVENT_TOO_SHORT,
    );
  });

  test("refuses check-in that closes more than 1 year from now", async () => {
    const chain = await createTestChain();

    await expectTransactionError(
      createEvent(chain, { terms: { checkInEndsAt: START_TIME + MAX_DURATION_SECONDS + 1n } }),
      VENI_ERROR__EVENT_TOO_LONG,
    );
  });

  test("refuses to reuse an event id, leaving the first event unchanged", async () => {
    const chain = await createTestChain();
    const eventAddress = await createEvent(chain, { terms: { stakeAmount: 10n * USDC } });

    await expectTransactionError(
      createEvent(chain, { terms: { stakeAmount: 20n * USDC } }),
      SYSTEM_ERROR__ACCOUNT_ALREADY_IN_USE,
    );

    const event = await chain.veni.accounts.event.fetch(eventAddress);
    expect(event.data.terms.stakeAmount).toBe(10n * USDC);
  });
});

describe("sign_up", () => {
  test("moves the stake into the vault and records the guest", async () => {
    const chain = await createTestChain();
    const eventAddress = await createEvent(chain);
    const wallet = await createGuest(chain, 25n * USDC);

    await signUp(chain, eventAddress, wallet);

    expect(await usdcBalance(chain, wallet.address)).toBe(15n * USDC);
    expect(await usdcBalance(chain, eventAddress)).toBe(10n * USDC);
    const event = await chain.veni.accounts.event.fetch(eventAddress);
    expect(event.data.guestCount).toBe(1);
    const guest = await chain.veni.accounts.guest.fetch(await guestAddressOf(chain, eventAddress, wallet.address));
    expect(guest.data).toMatchObject({ event: eventAddress, wallet: wallet.address, hasAttended: false });
  });

  test("refuses an RSVP from the organizer, who hosts rather than stakes", async () => {
    const chain = await createTestChain();
    await giveUsdc(chain, chain.identity.address, 10n * USDC);
    const eventAddress = await createEvent(chain);

    await expectTransactionError(signUp(chain, eventAddress, chain.identity), VENI_ERROR__ORGANIZER_CANNOT_RSVP);

    const event = await chain.veni.accounts.event.fetch(eventAddress);
    expect(event.data.guestCount).toBe(0);
    expect(await usdcBalance(chain, chain.identity.address)).toBe(10n * USDC);
  });

  test("allows an RSVP 1 second before RSVPs close", async () => {
    const chain = await createTestChain();
    const eventAddress = await createEvent(chain);
    const wallet = await createGuest(chain);
    jumpTo(chain, RSVP_ENDS_AT - 1n);

    await signUp(chain, eventAddress, wallet);
  });

  test("refuses an RSVP once RSVPs have closed", async () => {
    const chain = await createTestChain();
    const eventAddress = await createEvent(chain);
    const wallet = await createGuest(chain);
    jumpTo(chain, RSVP_ENDS_AT);

    await expectTransactionError(signUp(chain, eventAddress, wallet), VENI_ERROR__RSVP_CLOSED);
  });

  test("refuses an RSVP to a full event", async () => {
    const chain = await createTestChain();
    const eventAddress = await createEvent(chain, { terms: { capacity: 2 } });
    await signUp(chain, eventAddress, await createGuest(chain));
    await signUp(chain, eventAddress, await createGuest(chain));

    await expectTransactionError(signUp(chain, eventAddress, await createGuest(chain)), VENI_ERROR__EVENT_FULL);
  });

  test("refuses the same wallet twice and takes its stake only once", async () => {
    const chain = await createTestChain();
    const eventAddress = await createEvent(chain);
    const wallet = await createGuest(chain, 20n * USDC);
    await signUp(chain, eventAddress, wallet);
    // A real second try comes later, with a new blockhash. Without this, the
    // runtime rejects it as a duplicate of the first before the program runs.
    chain.svm.expireBlockhash();

    await expectTransactionError(signUp(chain, eventAddress, wallet), SYSTEM_ERROR__ACCOUNT_ALREADY_IN_USE);

    expect(await usdcBalance(chain, wallet.address)).toBe(10n * USDC);
    const event = await chain.veni.accounts.event.fetch(eventAddress);
    expect(event.data.guestCount).toBe(1);
  });

  test("refuses a wallet holding less than the stake", async () => {
    const chain = await createTestChain();
    const eventAddress = await createEvent(chain);
    const wallet = await createGuest(chain, 9n * USDC);

    await expectTransactionError(signUp(chain, eventAddress, wallet), TOKEN_ERROR__INSUFFICIENT_FUNDS);

    const event = await chain.veni.accounts.event.fetch(eventAddress);
    expect(event.data.guestCount).toBe(0);
  });

  test("refuses a wallet with no USDC account", async () => {
    const chain = await createTestChain();
    const eventAddress = await createEvent(chain);
    const wallet = await createWallet(chain);

    await expectTransactionError(signUp(chain, eventAddress, wallet), ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED);
  });

  test("refuses a stake in a worthless token, even when its vault already exists", async () => {
    const chain = await createTestChain();
    const eventAddress = await createEvent(chain);
    const attacker = await createWallet(chain);
    const worthlessToken = (await generateKeyPairSigner()).address;
    createMint(chain, worthlessToken);
    await giveTokens(chain, attacker.address, worthlessToken, 10n * USDC);
    // Anyone can create a token account for any owner, so the attacker can make
    // a vault for their own token that the event appears to own.
    await giveTokens(chain, eventAddress, worthlessToken, 0n);

    await expectTransactionError(signUp(chain, eventAddress, attacker, worthlessToken), VENI_ERROR__WRONG_STAKE_MINT);
  });
});

describe("check_in_guest", () => {
  test("marks the guest attended when the door key signs, whoever sends it", async () => {
    const chain = await createTestChain();
    // The organizer is someone else, so chain.identity, which sends and pays
    // for the check-in, is a stranger: not the organizer, the door or the guest.
    const organizer = await createWallet(chain);
    const { event, wallet, guest } = await createEventWithGuest(chain, { organizer });

    await checkIn(chain, event, wallet.address);

    expect((await chain.veni.accounts.guest.fetch(guest)).data.hasAttended).toBe(true);
    expect((await chain.veni.accounts.event.fetch(event)).data.attendedCount).toBe(1);
  });

  test("accepts the organizer's own signature too", async () => {
    const chain = await createTestChain();
    const organizer = await createWallet(chain);
    const { event, wallet, guest } = await createEventWithGuest(chain, { organizer });

    await checkIn(chain, event, wallet.address, organizer);

    expect((await chain.veni.accounts.guest.fetch(guest)).data.hasAttended).toBe(true);
  });

  test("refuses a signature from any other key", async () => {
    const chain = await createTestChain();
    const { event, wallet, guest } = await createEventWithGuest(chain);
    const stranger = await generateKeyPairSigner();

    await expectTransactionError(checkIn(chain, event, wallet.address, stranger), VENI_ERROR__WRONG_CHECK_IN_SIGNER);

    expect((await chain.veni.accounts.guest.fetch(guest)).data.hasAttended).toBe(false);
  });

  test("refuses the door key's signature for another event", async () => {
    const chain = await createTestChain();
    const { event, wallet, guest } = await createEventWithGuest(chain);
    // The same door key serves the organizer's other event.
    const otherEvent = await createEvent(chain, { eventId: 2n });
    const signedForOtherEvent = await signCheckIn(DOOR_KEY, otherEvent, wallet.address);

    await expectTransactionError(
      chain.sendTransaction([
        getEd25519Instruction(DOOR_KEY.address, signedForOtherEvent.signature, checkInMessage(otherEvent, wallet.address)),
        getCheckInGuestInstruction({ event, guest }),
      ]),
      VENI_ERROR__WRONG_CHECK_IN_MESSAGE,
    );
  });

  test("refuses the door key's signature for another guest", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithGuests(chain, 2);
    const [noShow, attendee] = guests;
    const signedForAttendee = await signCheckIn(DOOR_KEY, event, attendee.wallet.address);

    await expectTransactionError(
      chain.sendTransaction([
        getEd25519Instruction(DOOR_KEY.address, signedForAttendee.signature, checkInMessage(event, attendee.wallet.address)),
        getCheckInGuestInstruction({ event, guest: noShow.guest }),
      ]),
      VENI_ERROR__WRONG_CHECK_IN_MESSAGE,
    );

    expect((await chain.veni.accounts.guest.fetch(noShow.guest)).data.hasAttended).toBe(false);
  });

  test("refuses a check-in with no signature before it", async () => {
    const chain = await createTestChain();
    const { event, guest } = await createEventWithGuest(chain);

    await expectTransactionError(
      chain.sendTransaction([getCheckInGuestInstruction({ event, guest })]),
      VENI_ERROR__MISSING_CHECK_IN_SIGNATURE,
    );
  });

  test("refuses a signature that isn't in the instruction right before the check-in", async () => {
    const chain = await createTestChain();
    const { event, wallet } = await createEventWithGuest(chain);
    const [signature, checkInInstruction] = await getCheckInInstructions(
      await signCheckIn(DOOR_KEY, event, wallet.address),
    );
    const somethingElse = getTransferSolInstruction({
      source: chain.identity,
      destination: (await generateKeyPairSigner()).address,
      amount: 1_000_000n,
    });

    await expectTransactionError(
      chain.sendTransaction([signature, somethingElse, checkInInstruction]),
      VENI_ERROR__MISSING_CHECK_IN_SIGNATURE,
    );
  });

  test("refuses a signature whose parts are named by instruction index, even one the Ed25519 program accepts", async () => {
    const chain = await createTestChain();
    const { event, wallet, guest } = await createEventWithGuest(chain);
    const [signature, checkInInstruction] = await getCheckInInstructions(
      await signCheckIn(DOOR_KEY, event, wallet.address),
    );
    // Index 0 is the Ed25519 instruction itself, so its signature still checks
    // out. But an index could name any instruction, so the program only accepts u16::MAX.
    const data = new Uint8Array(signature.data!);
    for (const indexAt of [4, 8, 14]) data.set([0, 0], indexAt);

    await expectTransactionError(
      chain.sendTransaction([{ ...signature, data }, checkInInstruction]),
      VENI_ERROR__MISSING_CHECK_IN_SIGNATURE,
    );
    expect((await chain.veni.accounts.guest.fetch(guest)).data.hasAttended).toBe(false);
  });

  test("a tampered signature fails the whole transaction before the program runs", async () => {
    const chain = await createTestChain();
    const { event, wallet, guest } = await createEventWithGuest(chain);
    const signed = await signCheckIn(DOOR_KEY, event, wallet.address);
    const tampered = new Uint8Array(signed.signature);
    tampered[0] ^= 1;

    const error = await chain.sendTransaction(await getCheckInInstructions({ ...signed, signature: tampered })).then(
      () => undefined,
      (error: unknown) => error,
    );

    expect(error).toBeDefined();
    // The Ed25519 program's own error, not one of the program's (6000 and up).
    expect(findCustomErrorCode(error)).toBeLessThan(6000);
    expect((await chain.veni.accounts.guest.fetch(guest)).data.hasAttended).toBe(false);
  });

  test("refuses a guest who already checked in, counting them once", async () => {
    const chain = await createTestChain();
    const { event, wallet } = await createEventWithGuest(chain);
    await checkIn(chain, event, wallet.address);
    chain.svm.expireBlockhash(); // the same signature makes the same transaction, so a retry comes later

    await expectTransactionError(checkIn(chain, event, wallet.address), VENI_ERROR__ALREADY_CHECKED_IN);

    expect((await chain.veni.accounts.event.fetch(event)).data.attendedCount).toBe(1);
  });

  test("allows a check-in 1 second before check-in closes", async () => {
    const chain = await createTestChain();
    const { event, wallet } = await createEventWithGuest(chain);
    jumpTo(chain, CHECK_IN_ENDS_AT - 1n);

    await checkIn(chain, event, wallet.address);
  });

  test("refuses a check-in once check-in has closed", async () => {
    const chain = await createTestChain();
    const { event, wallet } = await createEventWithGuest(chain);
    jumpTo(chain, CHECK_IN_ENDS_AT);

    await expectTransactionError(checkIn(chain, event, wallet.address), VENI_ERROR__CHECK_IN_CLOSED);
  });

  test("refuses a guest from another event, even one the same wallet RSVPed to", async () => {
    const chain = await createTestChain();
    const { event, wallet } = await createEventWithGuest(chain);
    const otherEvent = await createEvent(chain, { eventId: 2n });
    await giveUsdc(chain, wallet.address, 10n * USDC);
    await signUp(chain, otherEvent, wallet);
    const guestOfOtherEvent = await guestAddressOf(chain, otherEvent, wallet.address);
    const signed = await signCheckIn(DOOR_KEY, event, wallet.address);

    await expectTransactionError(
      chain.sendTransaction([
        getEd25519Instruction(DOOR_KEY.address, signed.signature, checkInMessage(event, wallet.address)),
        getCheckInGuestInstruction({ event, guest: guestOfOtherEvent }),
      ]),
      VENI_ERROR__GUEST_NOT_IN_EVENT,
    );
  });

  test("refuses a check-in at a cancelled event", async () => {
    const chain = await createTestChain();
    const { event, wallet } = await createEventWithGuest(chain);
    await cancelEvent(chain, event);

    await expectTransactionError(checkIn(chain, event, wallet.address), VENI_ERROR__EVENT_CANCELLED);
  });
});

describe("check_in_with_code", () => {
  test("checks in the guest who scans a fresh code with their own wallet", async () => {
    const chain = await createTestChain();
    // The organizer is someone else: the host never has to act for a guest to get in.
    const organizer = await createWallet(chain);
    const { event, wallet, guest } = await createEventWithGuest(chain, { organizer });

    await scanCheckInCode(chain, event, wallet, 1n);

    expect((await chain.veni.accounts.guest.fetch(guest)).data.hasAttended).toBe(true);
    const eventAccount = (await chain.veni.accounts.event.fetch(event)).data;
    expect(eventAccount.attendedCount).toBe(1);
    expect(eventAccount.lastCheckInCode).toBe(1n);
  });

  test("a code checks in one guest only: the next guest scanning it is refused", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithGuests(chain, 2);
    const [first, second] = guests;

    await scanCheckInCode(chain, event, first.wallet, 1n);
    await expectTransactionError(scanCheckInCode(chain, event, second.wallet, 1n), VENI_ERROR__CHECK_IN_CODE_USED);

    expect((await chain.veni.accounts.guest.fetch(second.guest)).data.hasAttended).toBe(false);
    expect((await chain.veni.accounts.event.fetch(event)).data.attendedCount).toBe(1);

    // The door has moved on to the next code, which still works.
    await scanCheckInCode(chain, event, second.wallet, 2n);
    expect((await chain.veni.accounts.guest.fetch(second.guest)).data.hasAttended).toBe(true);
  });

  test("using a newer code retires every older one, even a code nobody used", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithGuests(chain, 2);
    const [first, second] = guests;

    await scanCheckInCode(chain, event, first.wallet, 5n);

    await expectTransactionError(scanCheckInCode(chain, event, second.wallet, 4n), VENI_ERROR__CHECK_IN_CODE_USED);
    expect((await chain.veni.accounts.event.fetch(event)).data.lastCheckInCode).toBe(5n);
  });

  test("a code works for a minute after it's shown, and not a second longer", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithGuests(chain, 2);
    const [first, second] = guests;

    jumpTo(chain, START_TIME + MAX_CHECK_IN_CODE_AGE_SECONDS);
    await scanCheckInCode(chain, event, first.wallet, 1n, START_TIME);

    jumpTo(chain, START_TIME + MAX_CHECK_IN_CODE_AGE_SECONDS + 1n);
    await expectTransactionError(scanCheckInCode(chain, event, second.wallet, 2n, START_TIME), VENI_ERROR__CHECK_IN_CODE_EXPIRED);
    expect((await chain.veni.accounts.guest.fetch(second.guest)).data.hasAttended).toBe(false);
  });

  test("allows a door clock up to 30 seconds ahead of the chain's, and no further", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithGuests(chain, 2);
    const [first, second] = guests;

    await expectTransactionError(
      scanCheckInCode(chain, event, first.wallet, 1n, START_TIME + MAX_CHECK_IN_CODE_CLOCK_AHEAD_SECONDS + 1n),
      VENI_ERROR__CHECK_IN_CODE_FROM_THE_FUTURE,
    );
    await scanCheckInCode(chain, event, second.wallet, 2n, START_TIME + MAX_CHECK_IN_CODE_CLOCK_AHEAD_SECONDS);

    expect((await chain.veni.accounts.guest.fetch(second.guest)).data.hasAttended).toBe(true);
  });

  test("nobody can check in someone else: a wallet can only use its own Guest account", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithGuests(chain, 2);
    const [victim, impostor] = guests;
    const checkInCode = await signCheckInCode(DOOR_KEY, event, 1n, START_TIME);

    await expectTransactionError(
      chain.sendTransaction([
        getEd25519Instruction(checkInCode.signer, checkInCode.signature, checkInCodeMessage(event, 1n, START_TIME)),
        getCheckInWithCodeInstruction({
          wallet: impostor.wallet,
          event,
          guest: victim.guest,
          code: 1n,
          shownAt: START_TIME,
        }),
      ]),
      ANCHOR_ERROR__CONSTRAINT_SEEDS,
    );

    expect((await chain.veni.accounts.guest.fetch(victim.guest)).data.hasAttended).toBe(false);
    expect((await chain.veni.accounts.event.fetch(event)).data.lastCheckInCode).toBe(0n);
  });

  test("refuses a wallet that never RSVPed, so a code is no use to a stranger", async () => {
    const chain = await createTestChain();
    const { event } = await createEventWithGuest(chain);
    const stranger = await createWallet(chain);

    await expectTransactionError(scanCheckInCode(chain, event, stranger, 1n), ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED);
  });

  test("accepts a code signed by the organizer's own key", async () => {
    const chain = await createTestChain();
    const organizer = await createWallet(chain);
    const { event, wallet, guest } = await createEventWithGuest(chain, { organizer });

    await scanCheckInCode(chain, event, wallet, 1n, START_TIME, organizer);

    expect((await chain.veni.accounts.guest.fetch(guest)).data.hasAttended).toBe(true);
  });

  test("refuses a code signed by any other key", async () => {
    const chain = await createTestChain();
    const { event, wallet, guest } = await createEventWithGuest(chain);
    const stranger = await generateKeyPairSigner();

    await expectTransactionError(
      scanCheckInCode(chain, event, wallet, 1n, START_TIME, stranger),
      VENI_ERROR__WRONG_CHECK_IN_SIGNER,
    );
    expect((await chain.veni.accounts.guest.fetch(guest)).data.hasAttended).toBe(false);
  });

  test("refuses a code from another event, or one whose number or time was changed", async () => {
    const chain = await createTestChain();
    const { event, wallet, guest } = await createEventWithGuest(chain);
    // The same door key serves the organizer's other event.
    const otherEvent = await createEvent(chain, { eventId: 2n });
    const signedForOtherEvent = await signCheckInCode(DOOR_KEY, otherEvent, 1n, START_TIME);
    const signedForCodeOne = await signCheckInCode(DOOR_KEY, event, 1n, START_TIME);
    const sendWith = async (signed: typeof signedForCodeOne, code: bigint, shownAt: bigint) =>
      chain.sendTransaction([
        getEd25519Instruction(signed.signer, signed.signature, checkInCodeMessage(signed.event, signed.code, signed.shownAt)),
        await getCheckInWithCodeInstructionAsync({ wallet, event, code, shownAt }),
      ]);

    await expectTransactionError(sendWith(signedForOtherEvent, 1n, START_TIME), VENI_ERROR__WRONG_CHECK_IN_MESSAGE);
    await expectTransactionError(sendWith(signedForCodeOne, 99n, START_TIME), VENI_ERROR__WRONG_CHECK_IN_MESSAGE);
    await expectTransactionError(sendWith(signedForCodeOne, 1n, START_TIME + 50n), VENI_ERROR__WRONG_CHECK_IN_MESSAGE);
    expect((await chain.veni.accounts.guest.fetch(guest)).data.hasAttended).toBe(false);
  });

  test("a host's check-in signature can't be passed off as a check-in code", async () => {
    const chain = await createTestChain();
    const { event, wallet, guest } = await createEventWithGuest(chain);
    const hostSigned = await signCheckIn(DOOR_KEY, event, wallet.address);

    await expectTransactionError(
      chain.sendTransaction([
        getEd25519Instruction(hostSigned.signer, hostSigned.signature, checkInMessage(event, wallet.address)),
        await getCheckInWithCodeInstructionAsync({ wallet, event, code: 1n, shownAt: START_TIME }),
      ]),
      VENI_ERROR__WRONG_CHECK_IN_MESSAGE,
    );
    expect((await chain.veni.accounts.guest.fetch(guest)).data.hasAttended).toBe(false);
  });

  test("a guest the host already checked in can't use a check-in code too, so codes aren't wasted", async () => {
    const chain = await createTestChain();
    const { event, wallet } = await createEventWithGuest(chain);
    await checkIn(chain, event, wallet.address);

    await expectTransactionError(scanCheckInCode(chain, event, wallet, 1n), VENI_ERROR__ALREADY_CHECKED_IN);
    const eventAccount = (await chain.veni.accounts.event.fetch(event)).data;
    expect(eventAccount.attendedCount).toBe(1);
    expect(eventAccount.lastCheckInCode).toBe(0n);
  });

  test("the host's check-in and check-in codes work side by side", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithGuests(chain, 2);
    const [byHost, byDoor] = guests;

    await checkIn(chain, event, byHost.wallet.address);
    await scanCheckInCode(chain, event, byDoor.wallet, 1n);

    expect((await chain.veni.accounts.event.fetch(event)).data.attendedCount).toBe(2);
  });

  test("refuses check-in codes once check-in has closed", async () => {
    const chain = await createTestChain();
    const { event, wallet } = await createEventWithGuest(chain);
    jumpTo(chain, CHECK_IN_ENDS_AT);

    await expectTransactionError(scanCheckInCode(chain, event, wallet, 1n, CHECK_IN_ENDS_AT), VENI_ERROR__CHECK_IN_CLOSED);
  });

  test("refuses check-in codes for a cancelled event", async () => {
    const chain = await createTestChain();
    const { event, wallet } = await createEventWithGuest(chain);
    await cancelEvent(chain, event);

    await expectTransactionError(scanCheckInCode(chain, event, wallet, 1n), VENI_ERROR__EVENT_CANCELLED);
  });

  test("a check-in code survives the trip through a QR code, and anything else is refused", async () => {
    const chain = await createTestChain();
    const event = await createEvent(chain);
    const checkInCode = await signCheckInCode(DOOR_KEY, event, 42n, START_TIME);

    const text = encodeCheckInCode(checkInCode);
    const decoded = decodeCheckInCode(text);

    expect(text.startsWith("veni-check-in:")).toBe(true);
    expect(decoded).toEqual({ ...checkInCode, signature: new Uint8Array(checkInCode.signature) });
    for (const notACode of ["", "https://luma.com/abc", "veni-check-in:", "veni-check-in:not*base64", text.slice(0, -4)]) {
      expect(() => decodeCheckInCode(notACode)).toThrow("That isn't a Veni check-in code");
    }
  });
});

describe("cancel_event", () => {
  test("the organizer cancels while RSVPs are open", async () => {
    const chain = await createTestChain();
    const { event } = await createEventWithGuests(chain, 2);
    jumpTo(chain, RSVP_ENDS_AT - 1n);

    await cancelEvent(chain, event);

    expect((await chain.veni.accounts.event.fetch(event)).data.isCancelled).toBe(true);
  });

  test("refuses anyone but the organizer", async () => {
    const chain = await createTestChain();
    const { event, wallet } = await createEventWithGuest(chain);

    await expectTransactionError(cancelEvent(chain, event, wallet), VENI_ERROR__NOT_ORGANIZER);
  });

  test("refuses once RSVPs have closed, so an organizer who doesn't open the door can't turn it into a refund", async () => {
    const chain = await createTestChain();
    const { event } = await createEventWithGuest(chain);
    jumpTo(chain, RSVP_ENDS_AT);

    await expectTransactionError(cancelEvent(chain, event), VENI_ERROR__CANCEL_TOO_LATE);
  });

  test("refuses to cancel twice", async () => {
    const chain = await createTestChain();
    const { event } = await createEventWithGuest(chain);
    await cancelEvent(chain, event);
    chain.svm.expireBlockhash();

    await expectTransactionError(cancelEvent(chain, event), VENI_ERROR__EVENT_CANCELLED);
  });

  test("refuses RSVPs after a cancel", async () => {
    const chain = await createTestChain();
    const event = await createEvent(chain);
    await cancelEvent(chain, event);

    await expectTransactionError(signUp(chain, event, await createGuest(chain)), VENI_ERROR__EVENT_CANCELLED);
  });

  test("a cancelled event never settles, even once check-in would have closed", async () => {
    const chain = await createTestChain();
    const { event } = await createEventWithGuests(chain, 2);
    await cancelEvent(chain, event);
    jumpTo(chain, CHECK_IN_ENDS_AT);

    await expectTransactionError(settleEvent(chain, event), VENI_ERROR__EVENT_CANCELLED);
  });

  test("close_guest refunds every whole stake, even to a guest who had checked in, with no fee", async () => {
    const chain = await createTestChain();
    const organizer = await createWallet(chain);
    const { event, guests } = await createEventWithGuests(chain, 3, { organizer });
    await checkIn(chain, event, guests[0].wallet.address);
    await cancelEvent(chain, event, organizer);

    for (const { wallet, guest } of guests) {
      const guestRent = (await chain.veni.accounts.guest.fetch(guest)).lamports;
      const solBefore = await solBalance(chain, wallet.address);

      await closeGuest(chain, event, wallet.address);

      expect(await usdcBalance(chain, wallet.address)).toBe(10n * USDC);
      expect(await solBalance(chain, wallet.address)).toBe(solBefore + guestRent);
    }
    expect(await usdcBalance(chain, event)).toBe(0n);
    expect(await usdcBalance(chain, TREASURY)).toBe(0n);
    const { data } = await chain.veni.accounts.event.fetch(event);
    expect(data).toMatchObject({ paidCount: 0, closedGuestCount: 3 });

    // Then the event closes as usual, returning both rents to the organizer.
    const rent = await rentHeldBy(chain, event);
    const organizerSolBefore = await solBalance(chain, organizer.address);
    await closeEvent(chain, event, organizer.address);
    expect(await solBalance(chain, organizer.address)).toBe(organizerSolBefore + rent);
    expect(accountsLeftBehind(chain)).toHaveLength(0);
  });
});

describe("settle_event", () => {
  test("when nobody checked in, nothing is forfeited: no fee, and every stake stays for the refunds", async () => {
    const chain = await createTestChain();
    const { event } = await createEventWithGuests(chain, 3);
    jumpTo(chain, CHECK_IN_ENDS_AT);

    await settleEvent(chain, event);

    expect(await usdcBalance(chain, TREASURY)).toBe(0n);
    expect(await usdcBalance(chain, event)).toBe(30n * USDC);
    expect((await chain.veni.accounts.event.fetch(event)).data.isSettled).toBe(true);
  });

  test("6 RSVP at $10 and 4 come: the treasury takes 10% of the $20 no-shows lost and $58 stays for the attendees", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithGuests(chain, 6);
    for (const { wallet } of guests.slice(0, 4)) await checkIn(chain, event, wallet.address);
    jumpTo(chain, CHECK_IN_ENDS_AT);

    await settleEvent(chain, event);

    expect(await usdcBalance(chain, TREASURY)).toBe(2n * USDC);
    expect(await usdcBalance(chain, event)).toBe(58n * USDC);
  });

  test("when everyone came, the treasury takes nothing and the whole vault stays", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithGuests(chain, 2);
    for (const { wallet } of guests) await checkIn(chain, event, wallet.address);
    jumpTo(chain, CHECK_IN_ENDS_AT);

    await settleEvent(chain, event);

    expect(await usdcBalance(chain, TREASURY)).toBe(0n);
    expect(await usdcBalance(chain, event)).toBe(20n * USDC);
  });

  test("rounds the fee down, so the leftover base unit stays with the attendees", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithGuests(chain, 2, { terms: { stakeAmount: 1_000_001n } });
    await checkIn(chain, event, guests[0].wallet.address);
    jumpTo(chain, CHECK_IN_ENDS_AT);

    await settleEvent(chain, event);

    expect(await usdcBalance(chain, TREASURY)).toBe(100_000n);
    expect(await usdcBalance(chain, event)).toBe(1_900_002n);
  });

  test("when everyone checked in, settles as soon as RSVPs close", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithGuests(chain, 2);
    for (const { wallet } of guests) await checkIn(chain, event, wallet.address);
    jumpTo(chain, RSVP_ENDS_AT);

    await settleEvent(chain, event);

    expect((await chain.veni.accounts.event.fetch(event)).data.isSettled).toBe(true);
  });

  test("refuses to settle early while RSVPs are open, even when everyone checked in", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithGuests(chain, 1);
    await checkIn(chain, event, guests[0].wallet.address);
    jumpTo(chain, RSVP_ENDS_AT - 1n);

    await expectTransactionError(settleEvent(chain, event), VENI_ERROR__CHECK_IN_STILL_OPEN);
  });

  test("refuses to settle 1 second before check-in closes while someone hasn't come", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithGuests(chain, 2);
    await checkIn(chain, event, guests[0].wallet.address);
    jumpTo(chain, CHECK_IN_ENDS_AT - 1n);

    await expectTransactionError(settleEvent(chain, event), VENI_ERROR__CHECK_IN_STILL_OPEN);
  });

  test("refuses to settle twice, paying the fee only once", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithGuests(chain, 2);
    await checkIn(chain, event, guests[0].wallet.address);
    jumpTo(chain, CHECK_IN_ENDS_AT);
    await settleEvent(chain, event);
    chain.svm.expireBlockhash(); // a real second try comes later, with a new blockhash

    await expectTransactionError(settleEvent(chain, event), VENI_ERROR__ALREADY_SETTLED);

    expect(await usdcBalance(chain, TREASURY)).toBe(1n * USDC);
  });

  test("refuses to settle an event nobody RSVPed to", async () => {
    const chain = await createTestChain();
    const event = await createEvent(chain);
    jumpTo(chain, CHECK_IN_ENDS_AT);

    await expectTransactionError(settleEvent(chain, event), VENI_ERROR__NOBODY_RSVPED);
  });

  test("refuses to send the fee to any other token account", async () => {
    const chain = await createTestChain();
    const { event } = await createEventWithGuests(chain, 1, { terms: { capacity: 1 } });
    const thief = await createWallet(chain);
    const thiefTokenAccount = await giveUsdc(chain, thief.address, 0n);
    jumpTo(chain, CHECK_IN_ENDS_AT);

    await expectTransactionError(
      settleEvent(chain, event, { treasuryTokenAccount: thiefTokenAccount }),
      ANCHOR_ERROR__CONSTRAINT_TOKEN_OWNER,
    );
  });

  test("refuses a vault in another token than the event's", async () => {
    const chain = await createTestChain();
    const { event } = await createEventWithGuests(chain, 1, { terms: { capacity: 1 } });
    const worthlessToken = (await generateKeyPairSigner()).address;
    createMint(chain, worthlessToken);
    // Anyone can create these token accounts, so they may well exist.
    for (const owner of [event, TREASURY]) {
      await giveTokens(chain, owner, worthlessToken, 0n);
    }
    jumpTo(chain, CHECK_IN_ENDS_AT);

    await expectTransactionError(settleEvent(chain, event, { stakeMint: worthlessToken }), VENI_ERROR__WRONG_STAKE_MINT);
  });
});

describe("close_guest", () => {
  test("when nobody checked in, every guest gets their whole stake back and the event closes empty", async () => {
    const chain = await createTestChain();
    const organizer = await createWallet(chain);
    const { event, guests } = await createEventWithGuests(chain, 3, { organizer });
    jumpTo(chain, CHECK_IN_ENDS_AT);
    await settleEvent(chain, event);

    for (const { wallet } of guests) {
      await closeGuest(chain, event, wallet.address);
      expect(await usdcBalance(chain, wallet.address)).toBe(10n * USDC);
    }
    expect(await usdcBalance(chain, event)).toBe(0n);
    expect(await usdcBalance(chain, TREASURY)).toBe(0n);
    expect((await chain.veni.accounts.event.fetch(event)).data).toMatchObject({ paidCount: 0, closedGuestCount: 3 });

    await closeEvent(chain, event, organizer.address);
    expect(accountsLeftBehind(chain)).toHaveLength(0);
  });

  test("after 6 RSVP at $10 and 4 come, each attendee gets $14.50, the vault empties, and everyone gets their rent back, less a first stamp's deposit", async () => {
    const chain = await createTestChain();
    const { event, attendees, noShows } = await createSettledEvent(chain, 6, 4);
    const stampDeposit = chain.svm.minimumBalanceForRentExemption(13n);

    for (const { wallet, guest } of [...attendees, ...noShows]) {
      const guestRent = (await chain.veni.accounts.guest.fetch(guest)).lamports;
      const solBefore = await solBalance(chain, wallet.address);
      const isAttendee = attendees.some((attendee) => attendee.wallet === wallet);

      // chain.identity sends every close, so the guest pays nothing and signs nothing.
      await closeGuest(chain, event, wallet.address);

      expect(await solBalance(chain, wallet.address)).toBe(solBefore + guestRent - (isAttendee ? stampDeposit : 0n));
      expect((await chain.veni.accounts.guest.fetchMaybe(guest)).exists).toBe(false);
    }

    for (const { wallet } of attendees) expect(await usdcBalance(chain, wallet.address)).toBe(14_500_000n);
    for (const { wallet } of noShows) expect(await usdcBalance(chain, wallet.address)).toBe(0n);
    expect(await usdcBalance(chain, event)).toBe(0n);
    const { data } = await chain.veni.accounts.event.fetch(event);
    expect(data).toMatchObject({ paidCount: 4, closedGuestCount: 6 });
  });

  test("a lone guest who came gets their whole $10 back", async () => {
    const chain = await createTestChain();
    const { event, attendees } = await createSettledEvent(chain, 1, 1, { terms: { capacity: 1 } });

    await closeGuest(chain, event, attendees[0].wallet.address);

    expect(await usdcBalance(chain, attendees[0].wallet.address)).toBe(10n * USDC);
    expect(await usdcBalance(chain, event)).toBe(0n);
  });

  test("pays the last attendee the remainder, so an uneven split still empties the vault", async () => {
    const chain = await createTestChain();
    // 4 stake 1,000,001 base units and 3 come: the vault holds 3,900,004 after
    // settling, which doesn't divide by 3.
    const { event, attendees } = await createSettledEvent(chain, 4, 3, { terms: { stakeAmount: 1_000_001n } });

    for (const { wallet } of attendees) await closeGuest(chain, event, wallet.address);

    const payouts = await Promise.all(attendees.map(({ wallet }) => usdcBalance(chain, wallet.address)));
    expect(payouts).toEqual([1_300_001n, 1_300_001n, 1_300_002n]);
    expect(await usdcBalance(chain, event)).toBe(0n);
  });

  test("refuses before the event is settled or cancelled", async () => {
    const chain = await createTestChain();
    const { event, guests } = await createEventWithGuests(chain, 1);
    await checkIn(chain, event, guests[0].wallet.address);

    await expectTransactionError(closeGuest(chain, event, guests[0].wallet.address), VENI_ERROR__NOT_SETTLED);
  });

  test("refuses to pay an attendee's share into anyone else's token account", async () => {
    const chain = await createTestChain();
    const { event, attendees } = await createSettledEvent(chain, 2, 1);
    const thief = await createWallet(chain);
    const thiefTokenAccount = await giveUsdc(chain, thief.address, 0n);

    await expectTransactionError(
      closeGuest(chain, event, attendees[0].wallet.address, { walletTokenAccount: thiefTokenAccount }),
      ANCHOR_ERROR__CONSTRAINT_SEEDS,
    );
  });

  test("refuses to send a guest's rent to another wallet", async () => {
    const chain = await createTestChain();
    const { event, noShows } = await createSettledEvent(chain, 2, 1);
    const thief = await createWallet(chain);

    await expectTransactionError(
      closeGuest(chain, event, thief.address, { guest: noShows[0].guest }),
      ANCHOR_ERROR__CONSTRAINT_SEEDS,
    );
  });

  test("refuses to close the same guest twice, so nobody is paid twice", async () => {
    const chain = await createTestChain();
    const { event, attendees } = await createSettledEvent(chain, 2, 1);
    await closeGuest(chain, event, attendees[0].wallet.address);
    chain.svm.expireBlockhash(); // a real second try comes later, with a new blockhash

    await expectTransactionError(
      closeGuest(chain, event, attendees[0].wallet.address),
      ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED,
    );

    expect(await usdcBalance(chain, attendees[0].wallet.address)).toBe(19n * USDC);
  });

  test("holds an attendee's share until their token account exists again", async () => {
    const chain = await createTestChain();
    const { event, attendees } = await createSettledEvent(chain, 2, 1);
    const attendee = attendees[0];
    removeAccount(chain, await usdcTokenAccountOf(attendee.wallet.address));

    await expect(closeGuest(chain, event, attendee.wallet.address)).rejects.toThrow();
    expect((await chain.veni.accounts.guest.fetchMaybe(attendee.guest)).exists).toBe(true);

    await giveUsdc(chain, attendee.wallet.address, 0n);
    chain.svm.expireBlockhash();
    await closeGuest(chain, event, attendee.wallet.address);

    expect(await usdcBalance(chain, attendee.wallet.address)).toBe(19n * USDC);
  });

  test("returns rent to a no-show, even after they closed their empty token account", async () => {
    const chain = await createTestChain();
    const { event, noShows } = await createSettledEvent(chain, 2, 1);
    const noShow = noShows[0];
    removeAccount(chain, await usdcTokenAccountOf(noShow.wallet.address));
    const guestRent = (await chain.veni.accounts.guest.fetch(noShow.guest)).lamports;
    const solBefore = await solBalance(chain, noShow.wallet.address);

    await closeGuest(chain, event, noShow.wallet.address);

    expect(await solBalance(chain, noShow.wallet.address)).toBe(solBefore + guestRent);
  });
});

describe("close_event", () => {
  test("once every guest is closed, returns both rents to the organizer and leaves the program owning nothing", async () => {
    const chain = await createTestChain();
    const organizer = await createWallet(chain);
    const { event, attendees, noShows } = await createSettledEvent(chain, 6, 4, { organizer });
    for (const { wallet } of [...attendees, ...noShows]) await closeGuest(chain, event, wallet.address);
    const rent = await rentHeldBy(chain, event);
    const solBefore = await solBalance(chain, organizer.address);

    await closeEvent(chain, event, organizer.address);

    expect(await solBalance(chain, organizer.address)).toBe(solBefore + rent);
    expect(accountsLeftBehind(chain)).toHaveLength(0);
    expect((await chain.rpc.getAccountInfo(await usdcTokenAccountOf(event)).send()).value).toBeNull();
  });

  test("the organizer can close an event nobody RSVPed to right away", async () => {
    const chain = await createTestChain();
    const organizer = await createWallet(chain);
    const event = await createEvent(chain, { organizer });
    const rent = await rentHeldBy(chain, event);
    const solBefore = await solBalance(chain, organizer.address);

    await closeEvent(chain, event, organizer.address, { closer: organizer });

    expect(await solBalance(chain, organizer.address)).toBe(solBefore + rent);
    expect((await chain.rpc.getAccountInfo(event).send()).value).toBeNull();
  });

  test("refuses when someone else closes an event nobody RSVPed to while RSVPs are open", async () => {
    const chain = await createTestChain();
    const organizer = await createWallet(chain);
    const event = await createEvent(chain, { organizer });
    jumpTo(chain, RSVP_ENDS_AT - 1n);

    await expectTransactionError(closeEvent(chain, event, organizer.address), VENI_ERROR__RSVP_STILL_OPEN);
  });

  test("anyone can close an event nobody RSVPed to once RSVPs have closed", async () => {
    const chain = await createTestChain();
    const organizer = await createWallet(chain);
    const event = await createEvent(chain, { organizer });
    const rent = await rentHeldBy(chain, event);
    const solBefore = await solBalance(chain, organizer.address);
    jumpTo(chain, RSVP_ENDS_AT);

    await closeEvent(chain, event, organizer.address);

    expect(await solBalance(chain, organizer.address)).toBe(solBefore + rent);
  });

  test("refuses an event that hasn't settled, so nobody's stake is touched", async () => {
    const chain = await createTestChain();
    const { event } = await createEventWithGuests(chain, 2);
    jumpTo(chain, CHECK_IN_ENDS_AT);

    await expectTransactionError(closeEvent(chain, event, chain.identity.address), VENI_ERROR__GUESTS_STILL_OPEN);

    expect(await usdcBalance(chain, event)).toBe(20n * USDC);
  });

  test("refuses while a guest's account is still open", async () => {
    const chain = await createTestChain();
    const { event, attendees, noShows } = await createSettledEvent(chain, 2, 1);
    await closeGuest(chain, event, noShows[0].wallet.address);

    await expectTransactionError(closeEvent(chain, event, chain.identity.address), VENI_ERROR__GUESTS_STILL_OPEN);

    expect(await usdcBalance(chain, event)).toBe(19n * USDC);
    expect((await chain.veni.accounts.guest.fetchMaybe(attendees[0].guest)).exists).toBe(true);
  });

  test("passes tokens someone sent to the vault to the treasury, so the vault can still close", async () => {
    const chain = await createTestChain();
    const organizer = await createWallet(chain);
    const event = await createEvent(chain, { organizer });
    await giveUsdc(chain, event, 5n * USDC); // someone sends 5 USDC to the vault

    await closeEvent(chain, event, organizer.address, { closer: organizer });

    expect(await usdcBalance(chain, TREASURY)).toBe(5n * USDC);
    expect((await chain.rpc.getAccountInfo(await usdcTokenAccountOf(event)).send()).value).toBeNull();
  });

  test("refuses to send the organizer's rent to another wallet", async () => {
    const chain = await createTestChain();
    const organizer = await createWallet(chain);
    const event = await createEvent(chain, { organizer });
    const thief = await createWallet(chain);
    jumpTo(chain, RSVP_ENDS_AT);

    await expectTransactionError(
      closeEvent(chain, event, thief.address, { closer: thief }),
      ANCHOR_ERROR__CONSTRAINT_HAS_ONE,
    );
  });

  test("refuses to send leftover tokens anywhere but the treasury", async () => {
    const chain = await createTestChain();
    const organizer = await createWallet(chain);
    const event = await createEvent(chain, { organizer });
    await giveUsdc(chain, event, 5n * USDC);
    const thief = await createWallet(chain);
    const thiefTokenAccount = await giveUsdc(chain, thief.address, 0n);

    await expectTransactionError(
      closeEvent(chain, event, organizer.address, { closer: organizer, treasuryTokenAccount: thiefTokenAccount }),
      ANCHOR_ERROR__CONSTRAINT_TOKEN_OWNER,
    );
  });
});
