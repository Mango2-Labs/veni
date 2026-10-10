import { expect } from "bun:test";
import {
  createClient,
  generateKeyPairSigner,
  isSolanaError,
  lamports,
  none,
  SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM,
  type Address,
  type ReadonlyUint8Array,
} from "@solana/kit";
import { litesvm } from "@solana/kit-plugin-litesvm";
import { SYSTEM_PROGRAM_ADDRESS } from "@solana-program/system";
import { airdropSigner, generatedSigner } from "@solana/kit-plugin-signer";
import {
  AccountState,
  findAssociatedTokenPda,
  getMintEncoder,
  getTokenEncoder,
  TOKEN_PROGRAM_ADDRESS,
  tokenProgram,
} from "@solana-program/token";
import {
  VENI_PROGRAM_ADDRESS,
  TREASURY,
  veniProgram,
  USDC_MINT,
} from "@veni/client";

export const DAY_SECONDS = 24n * 60n * 60n;

/** Oct 1, 2026. LiteSVM's clock starts at 0, so every test chain starts here instead. */
export const START_TIME = BigInt(Date.UTC(2026, 9, 1) / 1000);

/**
 * A fresh chain with the program and the USDC mint deployed, plus the
 * treasury's USDC account that the deploy script creates. Its
 * funded wallet, `chain.identity`, signs and pays for every transaction by default.
 */
export async function createTestChain() {
  const chain = await createClient()
    .use(generatedSigner())
    .use(litesvm())
    .use(airdropSigner(lamports(10_000_000_000n)))
    .use(tokenProgram())
    .use(veniProgram());
  chain.svm.addProgramFromFile(VENI_PROGRAM_ADDRESS, "target/deploy/veni.so");
  createMint(chain, USDC_MINT);
  await giveUsdc(chain, TREASURY, 0n);
  jumpTo(chain, START_TIME);
  return chain;
}

export type TestChain = Awaited<ReturnType<typeof createTestChain>>;

/** A new wallet with 1 SOL for fees and rent. */
export async function createWallet(chain: TestChain) {
  const wallet = await generateKeyPairSigner();
  await chain.airdrop(wallet.address, lamports(1_000_000_000n));
  return wallet;
}

/** Writes a 6-decimal mint straight into the chain, at any address. */
export function createMint(chain: TestChain, mintAddress: Address) {
  const data = getMintEncoder().encode({
    mintAuthority: none(),
    supply: 0n,
    decimals: 6,
    isInitialized: true,
    freezeAuthority: none(),
  });
  writeAccount(chain, { address: mintAddress, data, programAddress: TOKEN_PROGRAM_ADDRESS });
}

/**
 * Sets the owner's associated token account for a mint to hold exactly this
 * many base units, creating the account if needed. Returns its address.
 */
export async function giveTokens(chain: TestChain, owner: Address, mint: Address, amount: bigint) {
  const [tokenAccount] = await findAssociatedTokenPda({ owner, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  const data = getTokenEncoder().encode({
    mint,
    owner,
    amount,
    delegate: none(),
    state: AccountState.Initialized,
    isNative: none(),
    delegatedAmount: 0n,
    closeAuthority: none(),
  });
  writeAccount(chain, { address: tokenAccount, data, programAddress: TOKEN_PROGRAM_ADDRESS });
  return tokenAccount;
}

export function giveUsdc(chain: TestChain, owner: Address, amount: bigint) {
  return giveTokens(chain, owner, USDC_MINT, amount);
}

function writeAccount(
  chain: TestChain,
  account: { address: Address; data: ReadonlyUint8Array; programAddress: Address },
) {
  chain.svm.setAccount({
    ...account,
    data: new Uint8Array(account.data),
    executable: false,
    lamports: lamports(chain.svm.minimumBalanceForRentExemption(BigInt(account.data.length))),
    space: BigInt(account.data.length),
  });
}

/** Deletes an account, the way closing it would. */
export function removeAccount(chain: TestChain, address: Address) {
  chain.svm.setAccount({
    address,
    data: new Uint8Array(),
    executable: false,
    lamports: lamports(0n),
    programAddress: SYSTEM_PROGRAM_ADDRESS,
    space: 0n,
  });
}

/** Moves the chain's clock to a Unix timestamp, in seconds. */
export function jumpTo(chain: TestChain, unixTimestamp: bigint) {
  const clock = chain.svm.getClock();
  clock.unixTimestamp = unixTimestamp;
  chain.svm.setClock(clock);
}

/** Expects the transaction to fail with this custom program error code. */
export async function expectTransactionError(transaction: Promise<unknown>, errorCode: number) {
  const error = await transaction.then(
    () => undefined,
    (error: unknown) => error,
  );
  expect(error).toBeDefined();
  expect(findCustomErrorCode(error)).toBe(errorCode);
}

export function findCustomErrorCode(error: unknown): number | undefined {
  for (let cause = error; cause instanceof Error; cause = cause.cause) {
    if (isSolanaError(cause, SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM)) return cause.context.code;
  }
  return undefined;
}
