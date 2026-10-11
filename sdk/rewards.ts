// Rewards for stamps. The program keeps the settings and pays from its vault,
// once per Seeker, to wallets holding a token in the Seeker group.
import {
  address,
  type Address,
  type GetAccountInfoApi,
  type GetMultipleAccountsApi,
  type GetTokenAccountsByOwnerApi,
  type Rpc,
} from "@solana/kit";
import { fetchMaybeRewards, fetchMaybeSeekerClaim, findRewardsPda, findSeekerClaimPda, type RewardSettings } from "@veni/client";

/** Test SKR, which Veni's devnet faucet mints. */
export const TEST_SKR_MINT = address("52SJYkmPhDLdQKnZvfEbrELsjJUgQb2EERsNYfRy9iHL");

const TOKEN_2022_PROGRAM = address("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

type RewardsClient = { rpc: Rpc<GetAccountInfoApi & GetMultipleAccountsApi & GetTokenAccountsByOwnerApi> };
type MintExtensions = { parsed?: { info?: { extensions?: { extension: string; state?: { group?: string } }[] } } };

/** Everything a stamp count has earned, in base units. Matches the program's `earned_by`. */
export function rewardsEarnedBy(settings: RewardSettings, stamps: number) {
  const atMilestones = settings.milestones.reduce((sum, milestone) => (stamps >= milestone.stamps ? sum + milestone.amount : sum), 0n);
  const after = Math.max(0, stamps - settings.milestones[settings.milestones.length - 1].stamps);
  return atMilestones + BigInt(after) * settings.amountPerStampAfter;
}

/** The wallet's token in the Seeker group, if it holds one. */
export async function findSeekerToken(client: RewardsClient, wallet: Address, group: Address) {
  const { value } = await client.rpc.getTokenAccountsByOwner(wallet, { programId: TOKEN_2022_PROGRAM }, { encoding: "jsonParsed" }).send();
  const held = value.filter(({ account }) => account.data.parsed.info.tokenAmount.amount !== "0");
  if (held.length === 0) return undefined;
  const mints = held.map(({ account }) => account.data.parsed.info.mint);
  const { value: mintAccounts } = await client.rpc.getMultipleAccounts(mints, { encoding: "jsonParsed" }).send();
  const index = mintAccounts.findIndex((account) =>
    ((account?.data as MintExtensions | undefined)?.parsed?.info?.extensions ?? []).some(
      ({ extension, state }) => extension === "tokenGroupMember" && state?.group === group,
    ),
  );
  return index === -1 ? undefined : { seekerMint: mints[index], seekerTokenAccount: held[index].pubkey };
}

/** The rewards, the wallet's Seeker token and what that Seeker has claimed. Undefined until rewards are set up. */
export async function fetchRewardsFor(client: RewardsClient, wallet: Address) {
  const [rewardsAddress] = await findRewardsPda();
  const rewards = await fetchMaybeRewards(client.rpc, rewardsAddress);
  if (!rewards.exists) return undefined;
  const seeker = await findSeekerToken(client, wallet, rewards.data.settings.seekerGroup);
  const claim = seeker && (await fetchMaybeSeekerClaim(client.rpc, (await findSeekerClaimPda({ seekerMint: seeker.seekerMint }))[0]));
  return { settings: rewards.data.settings, mint: rewards.data.mint, seeker, claimed: claim?.exists ? claim.data.claimed : 0n };
}
