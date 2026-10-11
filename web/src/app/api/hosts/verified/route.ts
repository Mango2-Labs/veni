import { describeError, type VerifiedHostInput } from "@veni/sdk";
import { saveVerifiedHost } from "@/lib/server/verified-hosts";

/** Adds or removes a verified host, signed by Veni's admin wallet. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<Record<keyof VerifiedHostInput | "signature", unknown>>;
  const isText = (["wallet", "name", "signedAt", "signature"] as const).every((field) => typeof body[field] === "string");
  if (!isText || typeof body.isVerified !== "boolean") {
    return Response.json({ error: "Send the wallet, name, whether it's verified, the time and the signature." }, { status: 400 });
  }
  try {
    await saveVerifiedHost(body as VerifiedHostInput & { signature: string });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 400 });
  }
}
