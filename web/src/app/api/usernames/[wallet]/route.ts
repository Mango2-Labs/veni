import { isAddress } from "@solana/kit";
import { describeError } from "@veni/sdk";
import { getUsername } from "@/lib/server/usernames";

/** One wallet's username and when it may next change. */
export async function GET(_request: Request, { params }: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await params;
  if (!isAddress(wallet)) return Response.json({ error: "That isn't a wallet address." }, { status: 400 });
  try {
    const found = await getUsername(wallet);
    return Response.json(found ? { username: found.username, changeableAt: new Date(found.changeableAt).toISOString() } : {});
  } catch (error) {
    return Response.json({ error: `Couldn't read the username: ${describeError(error)}` }, { status: 500 });
  }
}
