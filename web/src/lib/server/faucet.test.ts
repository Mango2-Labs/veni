// Reading the faucet's key from FAUCET_KEYPAIR.
//   cd web && bun test src/lib/server
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createKeyPairFromPrivateKeyBytes, getAddressFromPublicKey, type Address } from "@solana/kit";
import { faucetSigner } from "./faucet";

let keypairJson: string;
let address: Address;
let directory: string;

beforeEach(async () => {
  // A keypair file's contents: the 32-byte private key, then the 32-byte public key.
  const privateKey = crypto.getRandomValues(new Uint8Array(32));
  const { publicKey } = await createKeyPairFromPrivateKeyBytes(privateKey, true);
  const publicKeyBytes = new Uint8Array(await crypto.subtle.exportKey("raw", publicKey));
  keypairJson = JSON.stringify([...privateKey, ...publicKeyBytes]);
  address = await getAddressFromPublicKey(publicKey);
  directory = mkdtempSync(path.join(tmpdir(), "veni-faucet-"));
});

afterEach(() => {
  delete process.env.FAUCET_KEYPAIR;
  rmSync(directory, { recursive: true, force: true });
});

describe("faucetSigner", () => {
  test("reads the keypair file FAUCET_KEYPAIR names", async () => {
    const file = path.join(directory, "faucet.json");
    writeFileSync(file, keypairJson);
    process.env.FAUCET_KEYPAIR = file;
    expect((await faucetSigner()).address).toBe(address);
  });

  test("reads the keypair itself when FAUCET_KEYPAIR holds it", async () => {
    process.env.FAUCET_KEYPAIR = ` ${keypairJson}\n`;
    expect((await faucetSigner()).address).toBe(address);
  });

  test("says the faucet isn't set up without FAUCET_KEYPAIR", async () => {
    expect(faucetSigner()).rejects.toThrow("The faucet isn't set up");
  });

  test("never repeats a setting it can't read, since it may be the key", async () => {
    const unreadable = [keypairJson.slice(0, -1), keypairJson.replace("[", "[999,"), `${keypairJson} as a file name`.slice(1)];
    for (const setting of unreadable) {
      process.env.FAUCET_KEYPAIR = setting;
      const error = (await faucetSigner().catch((caught: Error) => caught)) as Error;
      expect(error.message).toBe("The faucet isn't set up: FAUCET_KEYPAIR can't be read.");
      expect(error.message).not.toContain(keypairJson.slice(1, 20));
    }
  });
});
