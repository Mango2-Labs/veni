import { existsSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// RPC_URL, the devnet RPC with its API key, lives in the repo's root .env with the
// crank's and scripts' settings. Only the server reads it: nothing in that file is
// NEXT_PUBLIC_, and the browser reaches the RPC through /api/rpc. Variables already
// set, by web/.env.local or the host, win.
const ROOT_ENV = path.join(__dirname, "..", ".env");
if (existsSync(ROOT_ENV)) process.loadEnvFile(ROOT_ENV);

const nextConfig: NextConfig = {
  // The archive's database drivers run on the server as they are, not bundled. See src/lib/server/db.ts.
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  images: {
    // Event covers: posters hosts uploaded to Luma. See isCoverUrl in src/lib/events.ts.
    remotePatterns: [{ protocol: "https", hostname: "images.lumacdn.com", port: "", pathname: "/uploads/**", search: "" }],
  },
};

export default nextConfig;
