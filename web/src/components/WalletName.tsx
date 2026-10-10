"use client";

import { shortAddress } from "@/lib/solana";
import { useUsernameOf } from "@/lib/usernames-client";

/** A wallet as people see it: "menor", or its short address while it has no username. */
export function WalletName({ wallet }: { wallet: string }) {
  const username = useUsernameOf(wallet);
  if (username) return <span className="wallet-name">{username}</span>;
  return <span className="mono">{username === undefined ? "…" : shortAddress(wallet)}</span>;
}
