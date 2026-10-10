// Organizers Veni has verified, so guests can tell a known host from a stranger.
// Empty for now, so every organizer shows as new.
import type { Address } from "@solana/kit";

const VERIFIED_ORGANIZERS: ReadonlySet<Address> = new Set<Address>([]);

export function isVerifiedOrganizer(organizer: Address) {
  return VERIFIED_ORGANIZERS.has(organizer);
}
