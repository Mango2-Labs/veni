"use client";

// Reads the archive (past events, host profiles) from the app's own API.
import { useEffect, useState } from "react";
import type { HostPage, PastEvent } from "./host-profile";

export type Loaded<T> = { kind: "loading" } | { kind: "ready"; value: T } | { kind: "error"; message: string };

/** GETs JSON from an app route, again when `url` or `refresh` changes. */
export function useJson<T>(url: string | undefined, refresh = 0): Loaded<T> {
  const [state, setState] = useState<{ key?: string; loaded: Loaded<T> }>({ loaded: { kind: "loading" } });
  const key = url && `${url}#${refresh}`;
  useEffect(() => {
    if (!url || !key) return;
    let isCurrent = true;
    fetch(url)
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as T & { error?: string };
        if (!response.ok) throw new Error(body.error ?? `The archive answered with error ${response.status}.`);
        if (isCurrent) setState({ key, loaded: { kind: "ready", value: body } });
      })
      .catch((error: unknown) => {
        if (isCurrent) setState({ key, loaded: { kind: "error", message: error instanceof Error ? error.message : String(error) } });
      });
    return () => {
      isCurrent = false;
    };
  }, [url, key]);
  return state.key === key ? state.loaded : { kind: "loading" };
}

export { turnoutOf } from "@veni/sdk";

export function useHostPage(wallet: string | undefined, refresh = 0) {
  return useJson<HostPage>(wallet && `/api/hosts/${wallet}`, refresh);
}

export function usePastEventsAttendedBy(wallet: string | undefined) {
  return useJson<{ attended: PastEvent[] }>(wallet && `/api/me?wallet=${wallet}`);
}

/** "80%" of guests who showed up, or undefined before anyone has signed up. */
export function turnoutPercent(attendedCount: number, guestCount: number) {
  return guestCount > 0 ? `${Math.round((attendedCount / guestCount) * 100)}%` : undefined;
}
