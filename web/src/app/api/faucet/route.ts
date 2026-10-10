import { describeError } from "@veni/sdk";
import { faucetSigner, giveTestFunds, readWallet } from "@/lib/server/faucet";
import { SERVER_RPC_URL } from "@/lib/server/rpc";

/** Devnet only: 50 Test USD, plus 0.05 SOL if the wallet is low. */
export async function POST(request: Request) {
  try {
    const wallet = await readWallet(request);
    await giveTestFunds(await faucetSigner(), SERVER_RPC_URL, wallet);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 500 });
  }
}
