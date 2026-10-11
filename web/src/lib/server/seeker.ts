// Server only. Seeker Genesis Tokens: the real ones on mainnet, and test ones
// in Veni's devnet group, which the faucet gives to wallets that hold a real one.
import { address, createSolanaRpc, type Address, type KeyPairSigner } from "@solana/kit";
import { findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstruction, getTransferCheckedInstruction } from "@solana-program/token";
import { fetchMaybeRewards, findRewardsPda } from "@veni/client";
import { createVeniClient, findSeekerToken } from "@veni/sdk";

const TOKEN_2022_PROGRAM = address("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
// Solana Mobile's Seeker Genesis Token group, on mainnet.
const SEEKER_GENESIS_GROUP = address("GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te");
const mainnet = { rpc: createSolanaRpc(process.env.MAINNET_RPC_URL || "https://api.mainnet-beta.solana.com") };

/** Whether the wallet holds a real Seeker Genesis Token on mainnet. */
export async function holdsSeekerGenesisToken(wallet: Address) {
  return (await findSeekerToken(mainnet, wallet, SEEKER_GENESIS_GROUP)) !== undefined;
}

/**
 * Sends the wallet one of the faucet's test Seeker tokens, so it can claim
 * rewards on devnet, if it holds a real one on mainnet and has no test one yet.
 * True if it sent one.
 */
export async function giveTestSeekerToken(faucet: KeyPairSigner, rpcUrl: string, wallet: Address) {
  const client = createVeniClient(faucet, rpcUrl);
  const rewards = await fetchMaybeRewards(client.rpc, (await findRewardsPda())[0]);
  if (!rewards.exists) return false;
  const group = rewards.data.settings.seekerGroup;
  if (await findSeekerToken(client, wallet, group)) return false;
  if (!(await holdsSeekerGenesisToken(wallet))) return false;
  const spare = await findSeekerToken(client, faucet.address, group);
  if (!spare) throw new Error("The faucet has run out of test Seeker tokens.");
  const mint = spare.seekerMint;
  const [destination] = await findAssociatedTokenPda({ owner: wallet, mint, tokenProgram: TOKEN_2022_PROGRAM });
  await client.sendTransaction([
    getCreateAssociatedTokenIdempotentInstruction({ payer: faucet, ata: destination, owner: wallet, mint, tokenProgram: TOKEN_2022_PROGRAM }),
    getTransferCheckedInstruction(
      { source: spare.seekerTokenAccount, mint, destination, authority: faucet, amount: 1n, decimals: 0 },
      { programAddress: TOKEN_2022_PROGRAM },
    ),
  ]);
  return true;
}
