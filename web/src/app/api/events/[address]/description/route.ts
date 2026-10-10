import { isAddress } from "@solana/kit";
import { describeError } from "@veni/sdk";
import type { EventDescriptionInput } from "@/lib/event-description";
import { getDescription, saveDescription } from "@/lib/server/descriptions";

type Params = { params: Promise<{ address: string }> };

/** The description its host wrote. `description` is null when they haven't. */
export async function GET(_request: Request, { params }: Params) {
  const { address } = await params;
  if (!isAddress(address)) return Response.json({ error: "That isn't an event address." }, { status: 400 });
  try {
    return Response.json({ description: (await getDescription(address)) ?? null });
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 500 });
  }
}

/** Saves the description. The body carries the organizer's signature over it. */
export async function POST(request: Request, { params }: Params) {
  const { address } = await params;
  const body = (await request.json().catch(() => ({}))) as Partial<Record<"description" | "signedAt" | "signature", unknown>>;
  if (typeof body.description !== "string" || typeof body.signedAt !== "string" || typeof body.signature !== "string") {
    return Response.json({ error: "Send the description, time and signature." }, { status: 400 });
  }
  try {
    const input = { event: address, description: body.description, signedAt: body.signedAt } as EventDescriptionInput;
    await saveDescription({ ...input, signature: body.signature });
    return Response.json({ saved: true });
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 400 });
  }
}
