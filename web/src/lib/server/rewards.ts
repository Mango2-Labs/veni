// Server only. Test SKR for stamps, for Seeker owners: each Seeker Genesis Token
// claims each reward once, whichever wallet holds it.
import { createSolanaRpc, type Address } from "@solana/kit";
import { tokenProgram } from "@solana-program/token";
import { fetchMaybeStampCount, findStampCountPda } from "@veni/client";
import { createVeniClient, createVeniReader, SKR_DECIMALS, skrEarnedBy, TEST_SKR_MINT } from "@veni/sdk";
import { getDatabase } from "./db";
import { faucetSigner } from "./faucet";
import { SERVER_RPC_URL } from "./rpc";

const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
// Solana Mobile's Seeker Genesis Token: its group and its metadata share this address.
const SEEKER_GENESIS = "GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te";
// The token is on mainnet. Veni only reads it there, and pays on devnet.
const mainnet = createSolanaRpc(process.env.MAINNET_RPC_URL || "https://api.mainnet-beta.solana.com");
const reader = createVeniReader(SERVER_RPC_URL);

type MintExtensions = { parsed?: { info?: { extensions?: { extension: string; state?: { group?: string; metadataAddress?: string } }[] } } };

/** The mint of the wallet's Seeker Genesis Token, if it holds one. */
export async function seekerGenesisMintOf(wallet: Address) {
  const { value: accounts } = await mainnet
    .getTokenAccountsByOwner(wallet, { programId: TOKEN_2022_PROGRAM as Address }, { encoding: "jsonParsed" })
    .send();
  // A token moved away leaves its account open and empty.
  const mints = accounts.map(({ account }) => account.data.parsed.info).filter((info) => info.tokenAmount.amount !== "0").map((info) => info.mint);
  if (mints.length === 0) return undefined;
  const { value: mintAccounts } = await mainnet.getMultipleAccounts(mints, { encoding: "jsonParsed" }).send();
  return mints.find((_, index) => {
    const account = mintAccounts[index];
    const extensions = (account?.data as MintExtensions | undefined)?.parsed?.info?.extensions ?? [];
    const has = (name: string, matches: (state: { group?: string; metadataAddress?: string }) => boolean) =>
      extensions.some(({ extension, state }) => extension === name && state !== undefined && matches(state));
    return (
      account?.owner === TOKEN_2022_PROGRAM &&
      has("tokenGroupMember", ({ group }) => group === SEEKER_GENESIS) &&
      has("metadataPointer", ({ metadataAddress }) => metadataAddress === SEEKER_GENESIS)
    );
  });
}

async function stampsOf(wallet: Address) {
  const [address] = await findStampCountPda({ wallet });
  const account = await fetchMaybeStampCount(reader.rpc, address);
  return account.exists ? account.data.count : 0;
}

/** Whole SKR this Seeker has claimed. */
async function claimedBy(seeker: Address) {
  const db = await getDatabase();
  const [row] = await db.query<{ claimed: number }>("SELECT claimed FROM skr_claims WHERE seeker_mint = $1", [seeker]);
  return Number(row?.claimed ?? 0);
}

/** Records the Seeker's claims as `earned`, only if they still stand at `claimed`. False if another claim got there first. */
export async function recordClaim(seeker: Address, wallet: Address, claimed: number, earned: number) {
  const db = await getDatabase();
  const rows = await db.query(
    `INSERT INTO skr_claims (seeker_mint, wallet, claimed) VALUES ($1, $2, $4)
     ON CONFLICT (seeker_mint) DO UPDATE SET wallet = EXCLUDED.wallet, claimed = EXCLUDED.claimed, updated_at = now()
     WHERE skr_claims.claimed = $3
     RETURNING claimed`,
    [seeker, wallet, claimed, earned],
  );
  return rows.length > 0;
}

/** Whether the wallet holds a Seeker Genesis Token, and how much SKR that Seeker has claimed. */
export async function rewardsOf(wallet: Address) {
  const seeker = await seekerGenesisMintOf(wallet);
  return { hasSeeker: seeker !== undefined, claimed: seeker ? await claimedBy(seeker) : 0 };
}

/** Sends the wallet what its stamps have earned and its Seeker hasn't claimed. Throws a readable message. */
export async function claimSkr(wallet: Address) {
  const seeker = await seekerGenesisMintOf(wallet);
  if (!seeker) throw new Error("Claiming SKR needs a Seeker Genesis Token in this wallet.");
  const [earned, claimed] = await Promise.all([stampsOf(wallet).then(skrEarnedBy), claimedBy(seeker)]);
  if (earned <= claimed) throw new Error("Nothing to claim yet.");
  // Recorded before paying, so two claims at once can't both pay.
  if (!(await recordClaim(seeker, wallet, claimed, earned))) throw new Error("Another claim just went through.");
  try {
    const faucet = await faucetSigner();
    await createVeniClient(faucet, SERVER_RPC_URL)
      .use(tokenProgram())
      .token.instructions.mintToATA({
        mint: TEST_SKR_MINT,
        owner: wallet,
        mintAuthority: faucet,
        amount: BigInt(earned - claimed) * 10n ** BigInt(SKR_DECIMALS),
        decimals: SKR_DECIMALS,
      })
      .sendTransaction();
  } catch (error) {
    await recordClaim(seeker, wallet, earned, claimed);
    throw error;
  }
  return { claimed: earned };
}
