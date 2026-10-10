import { describeError } from "@veni/sdk";
import type { HostProfileInput } from "@/lib/host-profile";
import { registerHost } from "@/lib/server/hosts";

/** Registers or updates a host profile, signed by the wallet. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<Record<keyof HostProfileInput | "signature", unknown>>;
  const fields = ["wallet", "name", "lumaCalendar", "signedAt", "signature"] as const;
  if (fields.some((field) => typeof body[field] !== "string")) {
    return Response.json({ error: "Send the wallet, name, Luma calendar, time and signature." }, { status: 400 });
  }
  try {
    const profile = await registerHost(body as HostProfileInput & { signature: string });
    return Response.json({ profile });
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 400 });
  }
}
