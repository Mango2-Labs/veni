// SKR rewards for stamps: an amount at each milestone, then a little for every stamp after the last.
import { address } from "@solana/kit";

/** [stamps, SKR] */
export const SKR_MILESTONES = [
  [1, 25],
  [5, 75],
  [10, 150],
  [15, 250],
  [20, 500],
] as const;

export const SKR_PER_STAMP_AFTER_MILESTONES = 10;

/** Test SKR, which Veni's devnet faucet mints. */
export const TEST_SKR_MINT = address("52SJYkmPhDLdQKnZvfEbrELsjJUgQb2EERsNYfRy9iHL");
export const SKR_DECIMALS = 6;

/** Everything a stamp count has earned, in whole SKR. */
export function skrEarnedBy(stamps: number) {
  const [last] = SKR_MILESTONES[SKR_MILESTONES.length - 1];
  const milestones = SKR_MILESTONES.reduce((sum, [at, skr]) => (stamps >= at ? sum + skr : sum), 0);
  return milestones + Math.max(0, stamps - last) * SKR_PER_STAMP_AFTER_MILESTONES;
}
