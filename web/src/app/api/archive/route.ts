import { isAddress } from "@solana/kit";
import { describeError } from "@veni/sdk";
import { archiveEvent } from "@/lib/server/archive";

/**
 * Archives an event from the chain. Anyone may call it: it only copies what's
 * on-chain.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { address?: unknown };
  if (typeof body.address !== "string" || !isAddress(body.address)) {
    return Response.json({ error: "Send the event's address." }, { status: 400 });
  }
  try {
    return Response.json(await archiveEvent(body.address));
  } catch (error) {
    return Response.json({ error: `Couldn't archive the event: ${describeError(error)}` }, { status: 500 });
  }
}
