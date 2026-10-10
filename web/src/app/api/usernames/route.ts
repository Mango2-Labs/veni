import { isAddress, type Address } from "@solana/kit";
import { describeError } from "@veni/sdk";
import type { UsernameInput } from "@/lib/usernames";
import { claimUsername, getUsernames, MAX_WALLETS_PER_LOOKUP } from "@/lib/server/usernames";

/** Usernames for up to 100 wallets: ?wallets=a,b,c */
export async function GET(request: Request) {
  const wallets = (new URL(request.url).searchParams.get("wallets") ?? "").split(",").filter(Boolean);
  if (wallets.length > MAX_WALLETS_PER_LOOKUP) {
    return Response.json({ error: `Ask for ${MAX_WALLETS_PER_LOOKUP} wallets at most.` }, { status: 400 });
  }
  if (!wallets.every((wallet) => isAddress(wallet))) {
    return Response.json({ error: "One of those isn't a wallet address." }, { status: 400 });
  }
  try {
    return Response.json({ usernames: await getUsernames(wallets as Address[]) });
  } catch (error) {
    return Response.json({ error: `Couldn't read usernames: ${describeError(error)}` }, { status: 500 });
  }
}

/** Saves a username, signed by the wallet. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<Record<keyof UsernameInput | "signature", unknown>>;
  const fields = ["wallet", "username", "signedAt", "signature"] as const;
  if (fields.some((field) => typeof body[field] !== "string")) {
    return Response.json({ error: "Send the wallet, username, time and signature." }, { status: 400 });
  }
  try {
    const username = await claimUsername(body as UsernameInput & { signature: string });
    return Response.json({ username });
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 400 });
  }
}
