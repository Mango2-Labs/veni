// The devnet RPC the server calls (RPC_URL from the root .env). Its URL holds
// an API key, so the browser goes through /api/rpc instead.
import { PUBLIC_DEVNET_RPC_URL } from "@veni/sdk";

export const SERVER_RPC_URL = process.env.RPC_URL ?? PUBLIC_DEVNET_RPC_URL;
