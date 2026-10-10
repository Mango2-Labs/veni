import { describeError } from "@veni/sdk";
import { lumaPageUrl, parseLumaEvent } from "@/lib/luma";

/** Allows lu.ma's redirect to luma.com, each hop checked like the link. */
const MAX_REDIRECTS = 3;

/** An event page is about 150 KB. Anything far bigger isn't one. */
const MAX_PAGE_BYTES = 2_000_000;

/** Reads a public Luma event page for the host form, since browsers can't. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: unknown };
    let url = lumaPageUrl(typeof body.url === "string" ? body.url : "");
    for (let redirects = 0; ; redirects += 1) {
      const response = await fetch(url, {
        redirect: "manual",
        headers: { accept: "text/html" },
        signal: AbortSignal.timeout(8_000),
      }).catch((error: unknown) => {
        throw new Error(
          error instanceof Error && error.name === "TimeoutError"
            ? "Luma took too long to answer. Try again in a moment."
            : "Couldn't reach Luma. Try again in a moment.",
        );
      });
      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location) {
        if (redirects === MAX_REDIRECTS) throw new Error("That Luma link keeps redirecting. Paste the event's own link.");
        url = lumaPageUrl(new URL(location, url).href);
        continue;
      }
      if (response.status === 404) throw new Error("Luma has no event at that link.");
      if (!response.ok) throw new Error(`Luma didn't send the page (error ${response.status}). Try again in a moment.`);
      const event = parseLumaEvent(await readPage(response), url);
      return Response.json({ ok: true, event });
    }
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 500 });
  }
}

/** The page's HTML, read up to the size limit. */
async function readPage(response: Response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let html = "";
  let size = 0;
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    size += chunk.value.byteLength;
    if (size > MAX_PAGE_BYTES) {
      await reader.cancel();
      throw new Error("That Luma page is too big to be an event page.");
    }
    html += decoder.decode(chunk.value, { stream: true });
  }
  return html + decoder.decode();
}
