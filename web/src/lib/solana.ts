import { createVeniReader } from "@veni/sdk";

// The program runs on devnet until it is audited.
export const SOLANA_CLUSTER = "Devnet";

/**
 * The browser's RPC: our /api/rpc, which hides the API key, with devnet's public
 * RPC as the fallback.
 */
export const BROWSER_RPC_URL = "/api/rpc";

export const { rpc } = createVeniReader(BROWSER_RPC_URL);

export function shortAddress(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function formatSol(lamports: bigint) {
  return (Number(lamports) / 1e9).toLocaleString("en-US", { maximumFractionDigits: 4 });
}
