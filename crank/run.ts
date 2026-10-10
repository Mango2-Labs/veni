// Runs the crank once, or on a loop.
//
//   bun run crank          one run (exits 1 if anything failed)
//   bun run crank:loop     a run every CRANK_EVERY_MINUTES (5)
//
// RPC_URL        the devnet RPC from the root .env; the public RPC when unset or failing
// CRANK_KEYPAIR  the crank's keypair file; its SOL pays fees
// ARCHIVE_URL    the app's /api/archive (localhost by default); "off" skips archiving
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { createVeniClient, describeError, PUBLIC_DEVNET_RPC_URL } from "@veni/sdk";
import { archiveThrough, runCrank, type CrankOptions } from "./crank";

const RPC_URL = process.env.RPC_URL ?? PUBLIC_DEVNET_RPC_URL;
const CRANK_KEYPAIR = process.env.CRANK_KEYPAIR ?? `${homedir()}/.config/solana/veni-cranker-devnet.json`;
const EVERY_MINUTES = Number(process.env.CRANK_EVERY_MINUTES ?? 5);
const ARCHIVE_URL = process.env.ARCHIVE_URL ?? "http://localhost:3000/api/archive";
const options: CrankOptions = ARCHIVE_URL === "off" ? {} : { archive: archiveThrough(ARCHIVE_URL) };
if (ARCHIVE_URL === "off") console.warn("ARCHIVE_URL=off: events close without being archived, and their history is lost.");

const wallet = await createKeyPairSignerFromBytes(new Uint8Array(JSON.parse(readFileSync(CRANK_KEYPAIR, "utf8"))));
const client = createVeniClient(wallet, RPC_URL);

/** One run; false if anything failed. A failed run is logged and the next one retries. */
async function runOnce() {
  try {
    const report = await runCrank(client, options);
    console.log(new Date().toISOString(), JSON.stringify(report));
    return report.errors.length === 0;
  } catch (error) {
    console.error(new Date().toISOString(), "The run failed; the next one tries again:", withoutUrls(describeError(error)));
    return false;
  }
}

/** Cuts URLs to their host: the private RPC's URL holds its API key. */
function withoutUrls(message: string) {
  return message.replace(/https?:\/\/[^\s"'<>)]+/g, (url) => {
    try {
      return new URL(url).host;
    } catch {
      return "(a URL)";
    }
  });
}

if (process.argv.includes("--loop")) {
  console.log(`Cranking ${new URL(RPC_URL).host} every ${EVERY_MINUTES} minutes as ${wallet.address}`);
  await runOnce();
  setInterval(runOnce, EVERY_MINUTES * 60 * 1000);
} else {
  process.exit((await runOnce()) ? 0 : 1);
}
