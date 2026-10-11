"use client";

import { usernameInitials } from "@veni/sdk";
import { usePhotoOf, useUsernameOf } from "@/lib/usernames-client";

/** A person's photo, or their initials until they add one. */
export function Face({ wallet, initials, className = "passport-face" }: { wallet: string; initials?: string; className?: string }) {
  const photo = usePhotoOf(wallet);
  const username = useUsernameOf(initials ? undefined : wallet);
  return (
    <span className={className} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- served by our own API at 256×256 */}
      {photo ? <img src={photo} alt="" /> : (initials ?? (username ? usernameInitials(username) : "?"))}
    </span>
  );
}
