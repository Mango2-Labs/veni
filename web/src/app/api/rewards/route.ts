import { isAddress } from "@solana/kit";
import { describeError } from "@veni/sdk";
import { readWallet } from "@/lib/server/faucet";
import { claimSkr, rewardsOf } from "@/lib/server/rewards";

/** Whether the wallet can claim SKR, and how much its Seeker has claimed. */
export async function GET(request: Request) {
  const wallet = new URL(request.url).searchParams.get("wallet") ?? "";
  if (!isAddress(wallet)) return Response.json({ error: "That isn't a wallet address." }, { status: 400 });
  try {
    return Response.json(await rewardsOf(wallet));
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 500 });
  }
}

/** Devnet: pays Test SKR for the wallet's stamps. Anyone may ask; it only ever pays the wallet itself. */
export async function POST(request: Request) {
  try {
    return Response.json(await claimSkr(await readWallet(request)));
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 500 });
  }
}
