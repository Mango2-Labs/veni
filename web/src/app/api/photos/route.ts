import { describeError, type PhotoInput } from "@veni/sdk";
import { savePhoto } from "@/lib/server/photos";

/** Saves a profile photo, signed by the wallet. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<Record<keyof PhotoInput | "image" | "signature", unknown>>;
  const fields = ["wallet", "sha256", "signedAt", "image", "signature"] as const;
  if (fields.some((field) => typeof body[field] !== "string")) {
    return Response.json({ error: "Send the wallet, photo, its SHA-256, time and signature." }, { status: 400 });
  }
  try {
    return Response.json({ version: await savePhoto(body as PhotoInput & { image: string; signature: string }) });
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 400 });
  }
}
