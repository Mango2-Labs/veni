// What a wallet can spend on Veni: its dollars (the stake tokens) and SOL for fees.
import type { Address, GetAccountInfoApi, GetBalanceApi, GetTokenAccountBalanceApi, Rpc } from "@solana/kit";
import { TEST_USD_MINT, USDC_MINT } from "@veni/client";
import { tokenAccountOf } from "./accounts";

/** The tokens events take for stakes and tickets: dollars, with 6 decimals. Test USD is devnet's. */
export const STAKE_MINTS = [TEST_USD_MINT, USDC_MINT] as const;

/** Below this a wallet may not cover a sign-up's account deposit and fee: 0.01 SOL. */
export const LOW_SOL_LAMPORTS = 10_000_000n;

type BalanceClient = { rpc: Rpc<GetAccountInfoApi & GetBalanceApi & GetTokenAccountBalanceApi> };

/** `owner`'s balance of `mint` in base units, 0 without a token account. */
export async function fetchTokenBalance(client: BalanceClient, owner: Address, mint: Address) {
  const tokenAccount = await tokenAccountOf(owner, mint);
  const { value } = await client.rpc
    .getAccountInfo(tokenAccount, { encoding: "base64", dataSlice: { offset: 0, length: 0 } })
    .send();
  if (!value) return 0n;
  const { value: balance } = await client.rpc.getTokenAccountBalance(tokenAccount).send();
  return BigInt(balance.amount);
}

/** `owner`'s SOL in lamports, and each stake token in base units. */
export async function fetchWalletBalances(client: BalanceClient, owner: Address) {
  const [{ value: lamports }, ...dollars] = await Promise.all([
    client.rpc.getBalance(owner).send(),
    ...STAKE_MINTS.map((mint) => fetchTokenBalance(client, owner, mint)),
  ]);
  return {
    lamports,
    dollars: STAKE_MINTS.map((mint, i) => ({ mint, amount: dollars[i] as bigint })),
  };
}

export type WalletBalances = Awaited<ReturnType<typeof fetchWalletBalances>>;
