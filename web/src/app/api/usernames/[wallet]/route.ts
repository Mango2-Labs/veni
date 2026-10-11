import { isAddress } from "@solana/kit";
import { describeError } from "@veni/sdk";
import { getPhotoVersions } from "@/lib/server/photos";
import { getUsername } from "@/lib/server/usernames";

/** One wallet's username, when it may next change, and its photo version. */
export async function GET(_request: Request, { params }: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await params;
  if (!isAddress(wallet)) return Response.json({ error: "That isn't a wallet address." }, { status: 400 });
  try {
    const [found, photos] = await Promise.all([getUsername(wallet), getPhotoVersions([wallet])]);
    const photo = photos[wallet];
    return Response.json(found ? { username: found.username, changeableAt: new Date(found.changeableAt).toISOString(), photo } : { photo });
  } catch (error) {
    return Response.json({ error: `Couldn't read the username: ${describeError(error)}` }, { status: 500 });
  }
}
