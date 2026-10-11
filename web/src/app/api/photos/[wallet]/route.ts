import { isAddress } from "@solana/kit";
import { getPhoto } from "@/lib/server/photos";

export async function GET(request: Request, { params }: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await params;
  if (!isAddress(wallet)) return new Response(null, { status: 400 });
  const photo = await getPhoto(wallet);
  if (!photo) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  // Each photo's address carries its version, so a matching one never changes.
  const current = new URL(request.url).searchParams.get("v") === String(photo.version);
  return new Response(photo.image.slice().buffer, {
    headers: {
      "Content-Type": "image/jpeg",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": current ? "public, max-age=31536000, immutable" : "public, max-age=60",
    },
  });
}
