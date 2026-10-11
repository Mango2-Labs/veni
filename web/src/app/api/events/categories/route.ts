import { isAddress } from "@solana/kit";
import { describeError } from "@veni/sdk";
import { getCategories } from "@/lib/server/categories";

const MAX_EVENTS = 200;

/** The categories of the events named in `events`, comma separated. */
export async function GET(request: Request) {
  const events = (new URL(request.url).searchParams.get("events") ?? "").split(",").filter(Boolean);
  if (events.length > MAX_EVENTS || !events.every(isAddress)) return Response.json({ error: "Send up to 200 event addresses." }, { status: 400 });
  try {
    return Response.json({ categories: await getCategories(events) });
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 500 });
  }
}
