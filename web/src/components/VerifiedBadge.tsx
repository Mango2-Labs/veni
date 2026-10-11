"use client";

import { useIsVerifiedHost } from "@/lib/usernames-client";

/** The check beside a host Veni verified. */
export function VerifiedBadge() {
  return (
    <svg className="verified-badge" viewBox="0 0 24 24" role="img" aria-label="Verified host">
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

/** The check, for a host Veni verified: an example marked so, or a wallet on Veni's list. */
export function HostVerifiedBadge({ wallet, isVerified }: { wallet?: string; isVerified?: boolean }) {
  const isListed = useIsVerifiedHost(isVerified ? undefined : wallet);
  return isVerified || isListed ? <VerifiedBadge /> : null;
}
