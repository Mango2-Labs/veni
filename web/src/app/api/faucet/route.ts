import { describeError } from "@veni/sdk";
import { faucetSigner, giveTestFunds, readWallet } from "@/lib/server/faucet";
import { giveTestSeekerToken } from "@/lib/server/seeker";
import { SERVER_RPC_URL } from "@/lib/server/rpc";

/** Devnet only: 50 Test USD, 0.05 SOL if the wallet is low, and a test Seeker token if it holds a real one. */
export async function POST(request: Request) {
  try {
    const wallet = await readWallet(request);
    const faucet = await faucetSigner();
    await giveTestFunds(faucet, SERVER_RPC_URL, wallet);
    return Response.json({ ok: true, seekerToken: await giveTestSeekerToken(faucet, SERVER_RPC_URL, wallet) });
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 500 });
  }
}
