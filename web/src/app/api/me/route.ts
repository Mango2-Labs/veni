import { isAddress } from "@solana/kit";
import { describeError } from "@veni/sdk";
import { pastEventsAttendedBy } from "@/lib/server/archive";

/** Past events a wallet checked in to. Public, like the accounts they came from. */
export async function GET(request: Request) {
  const wallet = new URL(request.url).searchParams.get("wallet") ?? "";
  if (!isAddress(wallet)) return Response.json({ error: "That isn't a wallet address." }, { status: 400 });
  try {
    return Response.json({ attended: await pastEventsAttendedBy(wallet) });
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 500 });
  }
}
