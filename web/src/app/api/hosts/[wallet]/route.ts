import { isAddress } from "@solana/kit";
import { describeError } from "@veni/sdk";
import type { HostPage } from "@/lib/host-profile";
import { pastEventsHostedBy, recordOf } from "@/lib/server/archive";
import { getHost } from "@/lib/server/hosts";
import { getVerifiedHosts } from "@/lib/server/verified-hosts";

/** A host's public page: their profile if they registered, whether Veni verified them, and how their past events went. */
export async function GET(_request: Request, { params }: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await params;
  if (!isAddress(wallet)) return Response.json({ error: "That isn't a wallet address." }, { status: 400 });
  try {
    const [profile, pastEvents, verified] = await Promise.all([getHost(wallet), pastEventsHostedBy(wallet), getVerifiedHosts([wallet])]);
    const page: HostPage = { profile, isVerified: verified.length > 0, record: recordOf(pastEvents), pastEvents };
    return Response.json(page);
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 500 });
  }
}
