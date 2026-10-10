// Reading Veni's accounts. Reads use "confirmed", so new sign-ups and
// check-ins show up right away.
import {
  assertAccountExists,
  fetchEncodedAccounts,
  getAddressEncoder,
  getBase64Decoder,
  parseBase64RpcAccount,
  type Address,
  type Base64EncodedBytes,
  type GetAccountInfoApi,
  type GetMultipleAccountsApi,
  type GetProgramAccountsApi,
  type ReadonlyUint8Array,
  type Rpc,
  type TransactionSigner,
} from "@solana/kit";
import { fetchSysvarClock, getSysvarClockDecoder, SYSVAR_CLOCK_ADDRESS } from "@solana/sysvars";
import { findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstructionAsync, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { decodeGuest, EVENT_DISCRIMINATOR, GUEST_DISCRIMINATOR, VENI_PROGRAM_ADDRESS } from "@veni/client";

/** Reads the program's accounts, with no wallet. */
export type ReadClient = {
  rpc: Rpc<GetAccountInfoApi & GetMultipleAccountsApi & GetProgramAccountsApi>;
};

/** The chain's clock, which the program checks deadlines against. */
export async function chainTime(client: ReadClient) {
  return (await fetchSysvarClock(client.rpc)).unixTimestamp;
}

/** An account and the chain's clock, read at the same slot. The door screen dates codes by it. */
export async function fetchWithChainTime(client: ReadClient, address: Address) {
  const [account, clock] = await fetchEncodedAccounts(client.rpc, [address, SYSVAR_CLOCK_ADDRESS], {
    commitment: "confirmed",
  });
  assertAccountExists(clock);
  return { account, now: getSysvarClockDecoder().decode(clock.data).unixTimestamp };
}

/** Every Event account's size. Older, shorter events can't be read by the program. */
export const EVENT_ACCOUNT_SIZE = 549;

/** Every Guest account's size. Older ones are shorter. */
export const GUEST_ACCOUNT_SIZE = 75;

export async function fetchEventAddresses(client: ReadClient) {
  const accounts = await client.rpc
    .getProgramAccounts(VENI_PROGRAM_ADDRESS, {
      commitment: "confirmed",
      encoding: "base64",
      dataSlice: { offset: 0, length: 0 },
      filters: [startsWith(0, EVENT_DISCRIMINATOR), { dataSize: BigInt(EVENT_ACCOUNT_SIZE) }],
    })
    .send();
  return accounts.map(({ pubkey }) => pubkey);
}

/** An organizer's events still on-chain. */
export async function fetchEventAddressesOf(client: ReadClient, organizer: Address) {
  // Event data: discriminator, then organizer.
  const accounts = await client.rpc
    .getProgramAccounts(VENI_PROGRAM_ADDRESS, {
      commitment: "confirmed",
      encoding: "base64",
      dataSlice: { offset: 0, length: 0 },
      filters: [
        startsWith(0, EVENT_DISCRIMINATOR),
        startsWith(EVENT_DISCRIMINATOR.length, getAddressEncoder().encode(organizer)),
        { dataSize: BigInt(EVENT_ACCOUNT_SIZE) },
      ],
    })
    .send();
  return accounts.map(({ pubkey }) => pubkey);
}

/** A wallet's sign-ups still on-chain, one per event. */
export async function fetchGuestsOfWallet(client: ReadClient, wallet: Address) {
  // Guest data: discriminator, event, then wallet.
  const accounts = await client.rpc
    .getProgramAccounts(VENI_PROGRAM_ADDRESS, {
      commitment: "confirmed",
      encoding: "base64",
      filters: [
        startsWith(0, GUEST_DISCRIMINATOR),
        startsWith(GUEST_DISCRIMINATOR.length + 32, getAddressEncoder().encode(wallet)),
        { dataSize: BigInt(GUEST_ACCOUNT_SIZE) },
      ],
    })
    .send();
  return accounts.map(({ pubkey, account }) => decodeGuest(parseBase64RpcAccount(pubkey, account)));
}

export async function fetchGuests(client: ReadClient, eventAddress: Address) {
  // Guest data: discriminator, then event.
  const accounts = await client.rpc
    .getProgramAccounts(VENI_PROGRAM_ADDRESS, {
      commitment: "confirmed",
      encoding: "base64",
      filters: [
        startsWith(0, GUEST_DISCRIMINATOR),
        startsWith(GUEST_DISCRIMINATOR.length, getAddressEncoder().encode(eventAddress)),
        { dataSize: BigInt(GUEST_ACCOUNT_SIZE) },
      ],
    })
    .send();
  return accounts.map(({ pubkey, account }) => decodeGuest(parseBase64RpcAccount(pubkey, account)));
}

/** Creates `owner`'s token account for `mint` if missing, paid by `owner`. */
export function getCreateOwnTokenAccountInstruction(owner: TransactionSigner, mint: Address) {
  return getCreateAssociatedTokenIdempotentInstructionAsync({ payer: owner, owner: owner.address, mint });
}

export async function tokenAccountOf(owner: Address, mint: Address) {
  const [tokenAccount] = await findAssociatedTokenPda({ owner, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  return tokenAccount;
}

export async function accountExists(client: ReadClient, address: Address) {
  const { value } = await client.rpc
    .getAccountInfo(address, { encoding: "base64", dataSlice: { offset: 0, length: 0 } })
    .send();
  return value !== null;
}

/** An RPC filter matching accounts whose data holds `bytes` at `offset`. */
function startsWith(offset: number, bytes: ReadonlyUint8Array) {
  return {
    memcmp: {
      offset: BigInt(offset),
      bytes: getBase64Decoder().decode(bytes) as Base64EncodedBytes,
      encoding: "base64" as const,
    },
  };
}
