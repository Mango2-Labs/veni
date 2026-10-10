// The program client shared by the crank, the web app and the Seeker app. Calls go to the
// given RPC, falling back to devnet's public RPC (retried when rate-limited).
// Sent transactions also go to the public RPC, which rebroadcasts them.
// Confirmation polls over HTTP, since the public RPC refuses WebSockets.
import {
  commitmentComparator,
  createClient,
  createDefaultRpcTransport,
  createSolanaRpcFromTransport,
  isSolanaError,
  SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR,
  type Commitment,
  type RpcSubscriptions,
  type RpcTransport,
  type Signature,
  type SignatureNotificationsApi,
  type SlotNotificationsApi,
  type TransactionSigner,
} from "@solana/kit";
import {
  rpcConnection,
  rpcGetMinimumBalance,
  rpcSubscriptionsConnection,
  rpcTransactionPlanner,
  rpcTransactionPlanSendingExecutor,
  rpcTransactionPlanSigningExecutor,
} from "@solana/kit-plugin-rpc";
import { signer } from "@solana/kit-plugin-signer";
import { veniProgram } from "@veni/client";

/** Sends transactions signed by `wallet`, which pays the fees. */
export function createVeniClient(wallet: TransactionSigner, rpcUrl: string) {
  const rpc = createDevnetRpc(rpcUrl);
  return createClient()
    .use(signer(wallet))
    .use(rpcConnection(rpc))
    .use(rpcSubscriptionsConnection(createPollingSubscriptions(rpc)))
    .use(rpcGetMinimumBalance())
    .use(rpcTransactionPlanner())
    .use(rpcTransactionPlanSigningExecutor())
    .use(rpcTransactionPlanSendingExecutor())
    .use(veniProgram());
}

export type VeniClient = ReturnType<typeof createVeniClient>;

/** Read-only, so no wallet. */
export function createVeniReader(rpcUrl: string) {
  return { rpc: createDevnetRpc(rpcUrl) };
}

/** Devnet's public RPC: free but rate-limited, so only the fallback. */
export const PUBLIC_DEVNET_RPC_URL = "https://api.devnet.solana.com";

const MAX_ATTEMPTS = 6;
const POLL_EVERY_MS = 1500;

/** Tries `rpcUrl`, then the public RPC when that fails. */
function createDevnetRpc(rpcUrl: string) {
  const fallback = retryWhenRateLimited(createDefaultRpcTransport({ url: PUBLIC_DEVNET_RPC_URL }));
  if (rpcUrl === PUBLIC_DEVNET_RPC_URL) return createSolanaRpcFromTransport(fallback);
  const preferred = createDefaultRpcTransport({ url: rpcUrl });
  const transport = (async (request) => {
    try {
      const response = await preferred(request);
      // Providers may not rebroadcast, so the public RPC gets it too. It can only land once.
      if (isSendTransaction(request.payload)) fallback(request).catch(() => undefined);
      return response;
    } catch (error) {
      if (request.signal?.aborted) throw error;
      warnOfFallbackOnce(error);
      return await fallback(request);
    }
  }) as RpcTransport;
  return createSolanaRpcFromTransport(transport);
}

function isSendTransaction(payload: unknown) {
  return typeof payload === "object" && payload !== null && (payload as { method?: unknown }).method === "sendTransaction";
}

function retryWhenRateLimited(transport: RpcTransport) {
  return (async (request) => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await transport(request);
      } catch (error) {
        if (!isRateLimited(error) || attempt === MAX_ATTEMPTS) throw error;
        await sleep(1000 * attempt);
      }
    }
  }) as RpcTransport;
}

function isRateLimited(error: unknown) {
  return isSolanaError(error, SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR) && error.context.statusCode === 429;
}

let hasWarnedOfFallback = false;

// Logs why without the error's message, which can hold the RPC URL and its key.
function warnOfFallbackOnce(error: unknown) {
  if (hasWarnedOfFallback) return;
  hasWarnedOfFallback = true;
  const reason = isSolanaError(error, SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR)
    ? `HTTP ${error.context.statusCode}`
    : error instanceof Error
      ? error.name
      : "no answer";
  console.warn(`The devnet RPC failed (${reason}). Calls it fails go to devnet's public RPC instead.`);
}

type Rpc = ReturnType<typeof createDevnetRpc>;

/** Kit's two confirmation subscriptions, answered by polling over HTTP. */
function createPollingSubscriptions(rpc: Rpc) {
  const subscriptions = {
    signatureNotifications(signature: Signature, config?: { commitment?: Commitment }) {
      const commitment = config?.commitment ?? "finalized";
      return {
        subscribe: async ({ abortSignal }: { abortSignal: AbortSignal }) =>
          (async function* () {
            while (!abortSignal.aborted) {
              const { context, value } = await rpc.getSignatureStatuses([signature]).send({ abortSignal });
              const status = value[0];
              if (status?.confirmationStatus && commitmentComparator(status.confirmationStatus, commitment) >= 0) {
                yield { context, value: { err: status.err } };
                return;
              }
              await sleep(POLL_EVERY_MS);
            }
          })(),
      };
    },
    slotNotifications() {
      return {
        subscribe: async ({ abortSignal }: { abortSignal: AbortSignal }) =>
          (async function* () {
            while (!abortSignal.aborted) {
              const slot = await rpc.getSlot().send({ abortSignal });
              yield { parent: slot - 1n, root: slot, slot };
              await sleep(POLL_EVERY_MS);
            }
          })(),
      };
    },
  };
  return subscriptions as unknown as RpcSubscriptions<SignatureNotificationsApi & SlotNotificationsApi>;
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
