"use client";

import { useMemo } from "react";
import { useWalletAccountTransactionSigner } from "@solana/react";
import type { UiWalletAccount } from "@wallet-standard/react";
import type { Address } from "@solana/kit";
import { TEST_USD_MINT, USDC_MINT } from "@veni/client";
import { createVeniClient, fetchTokenBalance } from "@veni/sdk";
import { BROWSER_RPC_URL, rpc } from "./solana";

export { formatUsd, formatUsdShort, relativeTime, STAGE_LABEL, stageOf, type Stage } from "@veni/sdk";

export const DEVNET = "solana:devnet";

/** Reads the program's accounts before any wallet connects. */
export const veniReader = { rpc };

/** USDC, plus Test USD on devnet, which the faucet hands out. */
export const STAKE_TOKENS = [
  { mint: TEST_USD_MINT, label: "Test USD", hint: "Devnet stand-in for USDC, free from the app" },
  { mint: USDC_MINT, label: "USDC", hint: "Circle's devnet USDC, from faucet.circle.com" },
] as const;

/** A client for the program that asks the connected wallet to sign. */
export function useVeniClient(account: UiWalletAccount) {
  const walletSigner = useWalletAccountTransactionSigner(account, DEVNET);
  return useMemo(() => createVeniClient(walletSigner, BROWSER_RPC_URL), [walletSigner]);
}

export function tokenLabel(mint: Address) {
  return STAKE_TOKENS.find((token) => token.mint === mint)?.label ?? "tokens";
}

/** The wallet's balance of a token, 0 when it has no account for it. */
export function tokenBalance(owner: Address, mint: Address) {
  return fetchTokenBalance(veniReader, owner, mint);
}

/** Asks the faucet for 50 Test USD, plus SOL if low. Devnet only. */
export async function getTestFunds(wallet: Address) {
  const response = await fetch("/api/faucet", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `The faucet failed (${response.status})`);
  }
}
