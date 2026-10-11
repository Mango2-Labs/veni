// Rewards for stamps, which only Seeker owners can claim, once per Seeker.
import { beforeEach, describe, expect, test } from "bun:test";
import {
  generateKeyPairSigner,
  getAddressEncoder,
  getProgramDerivedAddress,
  getU16Encoder,
  getU64Encoder,
  none,
  type Address,
  type KeyPairSigner,
} from "@solana/kit";
import { AccountState, fetchToken, findAssociatedTokenPda, getMintEncoder, getTokenEncoder, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import {
  fetchSeekerClaim,
  findRewardsPda,
  findSeekerClaimPda,
  findStampCountPda,
  getStampCountEncoder,
  VENI_ERROR__MILESTONES_OUT_OF_ORDER,
  VENI_ERROR__NOT_A_SEEKER,
  VENI_ERROR__NOT_REWARDS_ADMIN,
  VENI_ERROR__NOT_UPGRADE_AUTHORITY,
  VENI_ERROR__NOTHING_TO_CLAIM,
  VENI_ERROR__REWARDS_PAUSED,
  VENI_ERROR__SEEKER_TOKEN_NOT_HELD,
  VENI_PROGRAM_ADDRESS,
  type RewardSettingsArgs,
} from "@veni/client";
import { createMint, createTestChain, createWallet, expectTransactionError, giveTokens, writeAccount, type TestChain } from "./litesvm";

const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb" as Address;
const UPGRADEABLE_LOADER = "BPFLoaderUpgradeab1e11111111111111111111111" as Address;
const SKR = 1_000_000n;

let chain: TestChain;
let mint: Address;
let group: Address;
let programData: Address;

beforeEach(async () => {
  chain = await createTestChain();
  mint = (await generateKeyPairSigner()).address;
  group = (await generateKeyPairSigner()).address;
  createMint(chain, mint);
  [programData] = await getProgramDerivedAddress({ programAddress: UPGRADEABLE_LOADER, seeds: [getAddressEncoder().encode(VENI_PROGRAM_ADDRESS)] });
  setUpgradeAuthority(chain.identity.address);
});

/** LiteSVM deploys with no upgrade authority; this writes one in. */
function setUpgradeAuthority(authority: Address) {
  const account = chain.svm.getAccount(programData);
  if (!account.exists) throw new Error("The program has no program data account.");
  const data = new Uint8Array(account.data);
  data[12] = 1; // Some(authority), after the 4-byte variant and the 8-byte slot
  data.set(getAddressEncoder().encode(authority), 13);
  chain.svm.setAccount({ ...account, data });
}

function settingsWith(overrides: Partial<RewardSettingsArgs> = {}): RewardSettingsArgs {
  return {
    admin: chain.identity.address,
    seekerGroup: group,
    milestones: [
      { stamps: 1, amount: 25n * SKR },
      { stamps: 5, amount: 75n * SKR },
      { stamps: 10, amount: 150n * SKR },
      { stamps: 15, amount: 250n * SKR },
      { stamps: 20, amount: 500n * SKR },
    ],
    amountPerStampAfter: 10n * SKR,
    isPaused: false,
    ...overrides,
  };
}

async function setUpRewards() {
  await chain.veni.instructions.initRewards({ authority: chain.identity, mint, programData, settings: settingsWith() }).sendTransaction();
  const [rewards] = await findRewardsPda();
  await giveTokens(chain, rewards, mint, 10_000n * SKR);
}

/** A Token-2022 mint in `memberOf`'s group, like a Seeker Genesis Token, with one token in `owner`'s account. */
async function giveSeekerToken(owner: Address, memberOf = group) {
  const seekerMint = (await generateKeyPairSigner()).address;
  const base = getMintEncoder().encode({ mintAuthority: none(), supply: 1n, decimals: 0, isInitialized: true, freezeAuthority: none() });
  const data = new Uint8Array(166 + 4 + 72);
  data.set(base, 0);
  data[165] = 1; // a mint, with extensions after
  data.set(getU16Encoder().encode(23), 166); // TokenGroupMember
  data.set(getU16Encoder().encode(72), 168);
  data.set(getAddressEncoder().encode(seekerMint), 170);
  data.set(getAddressEncoder().encode(memberOf), 202);
  data.set(getU64Encoder().encode(1n), 234);
  writeAccount(chain, { address: seekerMint, data, programAddress: TOKEN_2022_PROGRAM });
  const seekerTokenAccount = await holdSeekerToken(seekerMint, owner, 1n);
  return { seekerMint, seekerTokenAccount };
}

async function holdSeekerToken(seekerMint: Address, owner: Address, amount: bigint) {
  const [address] = await findAssociatedTokenPda({ owner, mint: seekerMint, tokenProgram: TOKEN_2022_PROGRAM });
  const data = getTokenEncoder().encode({
    mint: seekerMint,
    owner,
    amount,
    delegate: none(),
    state: AccountState.Initialized,
    isNative: none(),
    delegatedAmount: 0n,
    closeAuthority: none(),
  });
  writeAccount(chain, { address, data, programAddress: TOKEN_2022_PROGRAM });
  return address;
}

async function setStamps(wallet: Address, count: number) {
  const [address, bump] = await findStampCountPda({ wallet });
  writeAccount(chain, { address, data: getStampCountEncoder().encode({ bump, count }), programAddress: VENI_PROGRAM_ADDRESS });
}

function claim(wallet: KeyPairSigner, seeker: { seekerMint: Address; seekerTokenAccount: Address }) {
  chain.svm.expireBlockhash(); // claims repeat, and a repeat needs a new blockhash
  return chain.veni.instructions.claimRewards({ wallet, mint, ...seeker }).sendTransaction();
}

async function rewardBalance(owner: Address) {
  const [account] = await findAssociatedTokenPda({ owner, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  return (await fetchToken(chain.rpc, account)).data.amount;
}

describe("rewards", () => {
  test("pays a Seeker owner what their stamps have earned, once", async () => {
    await setUpRewards();
    const wallet = await createWallet(chain);
    const seeker = await giveSeekerToken(wallet.address);
    await setStamps(wallet.address, 5);

    await claim(wallet, seeker);
    expect(await rewardBalance(wallet.address)).toBe(100n * SKR);
    const [seekerClaim] = await findSeekerClaimPda({ seekerMint: seeker.seekerMint });
    expect((await fetchSeekerClaim(chain.rpc, seekerClaim)).data.claimed).toBe(100n * SKR);
    await expectTransactionError(claim(wallet, seeker), VENI_ERROR__NOTHING_TO_CLAIM);

    await setStamps(wallet.address, 10);
    await claim(wallet, seeker);
    expect(await rewardBalance(wallet.address)).toBe(250n * SKR);
  });

  test("counts claims per Seeker, so moving its token to another wallet claims nothing more", async () => {
    await setUpRewards();
    const [first, second] = [await createWallet(chain), await createWallet(chain)];
    const seeker = await giveSeekerToken(first.address);
    await setStamps(first.address, 1);
    await setStamps(second.address, 1);
    await claim(first, seeker);

    await holdSeekerToken(seeker.seekerMint, first.address, 0n);
    const moved = { seekerMint: seeker.seekerMint, seekerTokenAccount: await holdSeekerToken(seeker.seekerMint, second.address, 1n) };
    await expectTransactionError(claim(second, moved), VENI_ERROR__NOTHING_TO_CLAIM);
    await expectTransactionError(claim(first, seeker), VENI_ERROR__SEEKER_TOKEN_NOT_HELD);
  });

  test("only pays for tokens in the Seeker group", async () => {
    await setUpRewards();
    const wallet = await createWallet(chain);
    await setStamps(wallet.address, 1);
    const outsider = await giveSeekerToken(wallet.address, (await generateKeyPairSigner()).address);

    await expectTransactionError(claim(wallet, outsider), VENI_ERROR__NOT_A_SEEKER);
  });

  test("only the upgrade authority sets rewards up, and only the admin changes or pauses them", async () => {
    const stranger = await createWallet(chain);
    await expectTransactionError(
      chain.veni.instructions.initRewards({ authority: stranger, mint, programData, settings: settingsWith() }).sendTransaction(),
      VENI_ERROR__NOT_UPGRADE_AUTHORITY,
    );
    await setUpRewards();

    const update = (admin: KeyPairSigner, settings: RewardSettingsArgs) =>
      chain.veni.instructions.updateRewards({ admin, settings }).sendTransaction();
    await expectTransactionError(update(stranger, settingsWith({ isPaused: true })), VENI_ERROR__NOT_REWARDS_ADMIN);
    const [first, ...rest] = settingsWith().milestones;
    await expectTransactionError(
      update(chain.identity as KeyPairSigner, settingsWith({ milestones: [{ ...first, stamps: 0 }, ...rest] })),
      VENI_ERROR__MILESTONES_OUT_OF_ORDER,
    );
    await update(chain.identity as KeyPairSigner, settingsWith({ isPaused: true }));

    const wallet = await createWallet(chain);
    await setStamps(wallet.address, 1);
    await expectTransactionError(claim(wallet, await giveSeekerToken(wallet.address)), VENI_ERROR__REWARDS_PAUSED);
  });
});
