import { VENI_PROGRAM_ADDRESS } from "@veni/client";
import { SERVER_RPC_URL } from "@/lib/server/rpc";

// Only the calls the app makes, so this isn't a free RPC on our key. Refused
// calls fall back to devnet's public RPC.
const ALLOWED_METHODS = new Set([
  "getAccountInfo",
  "getBalance",
  "getEpochInfo",
  "getLatestBlockhash",
  "getMinimumBalanceForRentExemption",
  "getMultipleAccounts",
  "getProgramAccounts",
  "getSignatureStatuses",
  "getSlot",
  "getTokenAccountBalance",
  "sendTransaction",
  "simulateTransaction",
]);
const MAX_BODY_BYTES = 64 * 1024;

/**
 * Passes one JSON-RPC call to the devnet RPC, keeping its key off the browser.
 * On an error, the browser falls back to the public RPC.
 */
export async function POST(request: Request) {
  const tooBig = Response.json({ error: "That call is too big." }, { status: 413 });
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) return tooBig;
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return tooBig;
  const call = parseCall(body);
  if (!call || !ALLOWED_METHODS.has(call.method)) {
    return Response.json({ error: "The app's RPC doesn't answer that call." }, { status: 403 });
  }
  // Scanning a program's accounts is the costly call, so only Veni's own.
  if (call.method === "getProgramAccounts" && call.params[0] !== VENI_PROGRAM_ADDRESS) {
    return Response.json({ error: "The app's RPC only scans Veni's accounts." }, { status: 403 });
  }
  try {
    const answer = await fetch(SERVER_RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal: request.signal,
    });
    return new Response(answer.body, {
      status: answer.status,
      headers: { "content-type": answer.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    // Not the error itself: its message can hold the RPC's URL, and so its key.
    return Response.json({ error: "The devnet RPC didn't answer." }, { status: 502 });
  }
}

/** One JSON-RPC call; a batch of several isn't one. */
function parseCall(body: string) {
  try {
    const call = JSON.parse(body) as { method?: unknown; params?: unknown };
    if (typeof call.method !== "string") return undefined;
    return { method: call.method, params: Array.isArray(call.params) ? call.params : [] };
  } catch {
    return undefined;
  }
}
