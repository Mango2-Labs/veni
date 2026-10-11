import { describeError, type EventCategoryInput } from "@veni/sdk";
import { saveCategory } from "@/lib/server/categories";

type Params = { params: Promise<{ address: string }> };

/** Saves the event's category. The body carries the organizer's signature over it. */
export async function POST(request: Request, { params }: Params) {
  const { address } = await params;
  const body = (await request.json().catch(() => ({}))) as Partial<Record<"category" | "signedAt" | "signature", unknown>>;
  if (typeof body.category !== "string" || typeof body.signedAt !== "string" || typeof body.signature !== "string") {
    return Response.json({ error: "Send the category, time and signature." }, { status: 400 });
  }
  try {
    const input = { event: address, category: body.category, signedAt: body.signedAt } as EventCategoryInput;
    await saveCategory({ ...input, signature: body.signature });
    return Response.json({ saved: true });
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 400 });
  }
}
