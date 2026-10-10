// Usernames: each wallet picks one by signing a message, with no fee. The website, its
// server and the Seeker app build the message here, so all sign and check the same text.
import type { Address } from "@solana/kit";

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
/** A wallet changes its username at most this often, and a name given up stays reserved this long. */
export const USERNAME_CHANGE_HOURS = 24;

const RESERVED = new Set([
  "admin", "api", "events", "help", "host", "hosts", "me", "mango2", "moderator", "new",
  "official", "profile", "root", "seeker", "settings", "skr", "solana", "support", "system", "team", "veni",
]);

export type UsernameInput = {
  wallet: Address;
  /** Already normalized: lowercase, no "@". */
  username: string;
  /** ISO 8601. Signatures expire after a few minutes. */
  signedAt: string;
};

/** "@Zai " → "zai". */
export function normalizeUsername(input: string) {
  return input.trim().replace(/^@/, "").toLowerCase();
}

/** What's wrong with a normalized username, or undefined when it's fine. */
export function usernameProblem(username: string) {
  if (username.length < USERNAME_MIN_LENGTH) return `Use at least ${USERNAME_MIN_LENGTH} characters.`;
  if (username.length > USERNAME_MAX_LENGTH) return `Use ${USERNAME_MAX_LENGTH} characters at most.`;
  if (!/^[a-z][a-z0-9_]*$/.test(username)) return "Start with a letter, then use letters, numbers or _.";
  if (RESERVED.has(username)) return "That username is reserved.";
  return undefined;
}

export function usernameMessage({ wallet, username, signedAt }: UsernameInput) {
  return ["Veni username", `Wallet: ${wallet}`, `Username: ${username}`, `Signed at: ${signedAt}`].join("\n");
}

/** "ZA" for "zai": a person's face until people have photos. */
export function usernameInitials(username: string) {
  return username.replace(/_/g, "").slice(0, 2).toUpperCase() || "?";
}
