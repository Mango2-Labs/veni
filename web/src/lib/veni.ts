"use client";

import { useMemo } from "react";
import { useWalletAccountTransactionSigner } from "@solana/react";
import type { UiWalletAccount } from "@wallet-standard/react";
import type { Address } from "@solana/kit";
import { TEST_USD_MINT, USDC_MINT, type Event as EventAccount } from "@veni/client";
import { createVeniClient, fetchTokenBalance } from "@veni/sdk";
import { BROWSER_RPC_URL, rpc } from "./solana";

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

/** Both stake tokens are dollars with 6 decimals. */
export function formatUsd(baseUnits: bigint) {
  return `$${(Number(baseUnits) / 1e6).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
}

/** "$10" or "$12.25": an amount without empty cents, for cards and buttons. */
export function formatUsdShort(baseUnits: bigint) {
  return formatUsd(baseUnits).replace(/\.00$/, "");
}

/** The wallet's balance of a token, 0 when it has no account for it. */
export function tokenBalance(owner: Address, mint: Address) {
  return fetchTokenBalance(veniReader, owner, mint);
}

export type Stage = "open" | "running" | "ended" | "settled" | "refunding" | "cancelled";

export function stageOf(event: EventAccount, now: bigint): Stage {
  if (event.isCancelled) return "cancelled";
  // Settled with nobody checked in: the event didn't happen, so every stake comes back.
  if (event.isSettled) return event.attendedCount === 0 ? "refunding" : "settled";
  if (now < event.terms.rsvpEndsAt) return "open";
  if (now < event.terms.checkInEndsAt) return "running";
  return "ended";
}

// Sign-ups close at the start; check-in stays open a while after.
export const STAGE_LABEL: Record<Stage, string> = {
  open: "Sign-ups open",
  running: "Check-in open",
  ended: "Check-in closed",
  settled: "Paying out",
  refunding: "Refunding everyone",
  cancelled: "Cancelled, refunding",
};

/** "in 2m 05s" or "2m 05s ago", from the chain's clock. */
export function relativeTime(target: bigint, now: bigint) {
  const seconds = Number(target - now);
  const absolute = Math.abs(seconds);
  const days = Math.floor(absolute / 86400);
  const hours = Math.floor((absolute % 86400) / 3600);
  const minutes = Math.floor((absolute % 3600) / 60);
  const rest = absolute % 60;
  const text =
    days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${String(rest).padStart(2, "0")}s`;
  return seconds >= 0 ? `in ${text}` : `${text} ago`;
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
