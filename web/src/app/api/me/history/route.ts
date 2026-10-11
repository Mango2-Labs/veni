import { isAddress } from "@solana/kit";
import { describeError } from "@veni/sdk";
import { historyOf } from "@/lib/server/archive";

/** A wallet's past events, checked in or missed, with what each paid. Public, like the accounts they came from. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const wallet = params.get("wallet") ?? "";
  const offset = Number(params.get("offset") ?? 0);
  if (!isAddress(wallet)) return Response.json({ error: "That isn't a wallet address." }, { status: 400 });
  if (!Number.isSafeInteger(offset) || offset < 0) return Response.json({ error: "That isn't a page." }, { status: 400 });
  try {
    return Response.json(await historyOf(wallet, offset));
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 500 });
  }
}
