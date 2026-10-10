// Server only. The devnet faucet hands out Test USD and a little SOL so anyone
// can try Veni. Its key stays on the server.
import { readFileSync } from "node:fs";
import { createKeyPairSignerFromBytes, isAddress, lamports, type Address, type KeyPairSigner } from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import { tokenProgram } from "@solana-program/token";
import { TEST_USD_MINT } from "@veni/client";
import { createVeniClient } from "@veni/sdk";

/** 50 Test USD per request, in base units. */
export const TEST_USD_PER_REQUEST = 50_000_000n;

/** Enough SOL for rent and fees while trying Veni: 0.05 SOL. */
const SOL_TOP_UP = 50_000_000n;

/** Gives the wallet 50 Test USD, and 0.05 SOL if it has less than that. */
export async function giveTestFunds(faucet: KeyPairSigner, rpcUrl: string, wallet: Address) {
  const client = createVeniClient(faucet, rpcUrl).use(tokenProgram());
  await client.token.instructions
    .mintToATA({ mint: TEST_USD_MINT, owner: wallet, mintAuthority: faucet, amount: TEST_USD_PER_REQUEST, decimals: 6 })
    .sendTransaction();
  const { value: solBalance } = await client.rpc.getBalance(wallet).send();
  if (solBalance < SOL_TOP_UP) {
    await client.sendTransaction([
      getTransferSolInstruction({ source: faucet, destination: wallet, amount: lamports(SOL_TOP_UP) }),
    ]);
  }
}

export function faucetSigner() {
  const path = process.env.FAUCET_KEYPAIR;
  if (!path) throw new Error("The faucet isn't set up: FAUCET_KEYPAIR should name its keypair file.");
  return createKeyPairSignerFromBytes(readKeypairFile(path));
}

export function readKeypairFile(path: string) {
  return new Uint8Array(JSON.parse(readFileSync(path, "utf8")));
}

/** The wallet address in a request's JSON body. */
export async function readWallet(request: Request): Promise<Address> {
  const { wallet } = (await request.json()) as { wallet?: unknown };
  if (typeof wallet !== "string" || !isAddress(wallet)) throw new Error("That isn't a Solana address.");
  return wallet;
}
