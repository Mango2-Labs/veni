"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { address as toAddress, isAddress, type KeyPairSigner } from "@solana/kit";
import { decodeEvent, type Event as EventAccount } from "@veni/client";
import { describeError, encodeCheckInCode, fetchWithChainTime, signCheckInCode } from "@veni/sdk";
import { QrCode } from "@/components/QrCode";
import { CHECK_IN_CODE_REFRESH_SECONDS, isDoorOpen } from "@/lib/check-in-code";
import { findDoorKey } from "@/lib/door-key";
import { isEventAccount, isOutdatedEvent } from "@/lib/events";
import { veniReader } from "@/lib/veni";

// Re-read each second, to show a new code as soon as one is used.
const POLL_EVERY_MS = 1000;
// How long "checked in" shows, in seconds.
const CHECKED_IN_FLASH_SECONDS = 4n;

type ShownCode = { code: bigint; shownAt: bigint; text: string };
type Door =
  | { kind: "loading" }
  | { kind: "gone"; reason: "closed" | "not-an-event" | "outdated" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      event: EventAccount;
      /** The chain's time at the last read. */
      now: bigint;
      hasDoorKey: boolean;
      shown?: ShownCode;
      lastCheckInAt?: bigint;
      /** Set when the last read failed, so the code may be out of date. */
      problem?: string;
    };

/**
 * The door screen: a full-screen QR code guests scan to check in with their
 * own wallets. The door key this browser keeps signs it, so no wallet is needed.
 */
export default function DoorPage() {
  const params = useParams<{ address: string }>();
  const eventAddress = isAddress(params.address) ? toAddress(params.address) : undefined;
  const [door, setDoor] = useState<Door>({ kind: "loading" });

  useEffect(() => {
    if (!eventAddress) return;
    const address = eventAddress;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // A new event can take seconds to reach every RPC node: three misses in a row
    // mean it's closed.
    let misses = 0;
    let doorKey: KeyPairSigner | undefined;
    let hasLookedForDoorKey = false;
    let shown: ShownCode | undefined;
    let attendedCount: number | undefined;
    let lastCheckInAt: bigint | undefined;

    async function poll() {
      try {
        const { account, now } = await fetchWithChainTime(veniReader, address);
        if (stopped) return;
        if (!account.exists) {
          misses += 1;
          if (misses >= 3) {
            stopped = true;
            setDoor({ kind: "gone", reason: "closed" });
          }
          return;
        }
        if (isOutdatedEvent(account)) {
          stopped = true;
          setDoor({ kind: "gone", reason: "outdated" });
          return;
        }
        if (!isEventAccount(account)) {
          stopped = true;
          setDoor({ kind: "gone", reason: "not-an-event" });
          return;
        }
        misses = 0;
        const event = decodeEvent(account).data;
        if (!hasLookedForDoorKey) {
          doorKey = await findDoorKey(event.organizer, event.terms.doorKey);
          hasLookedForDoorKey = true;
        }
        if (attendedCount !== undefined && event.attendedCount > attendedCount) lastCheckInAt = now;
        attendedCount = event.attendedCount;

        // Only codes above the last used work, so show the next one, re-signed every
        // 30 seconds so it never nears its one-minute limit.
        const nextCode = event.lastCheckInCode + 1n;
        const isStale = !shown || shown.code !== nextCode || now - shown.shownAt >= CHECK_IN_CODE_REFRESH_SECONDS;
        if (doorKey && isDoorOpen(event, now) && isStale) {
          const checkInCode = await signCheckInCode(doorKey, address, nextCode, now);
          shown = { code: nextCode, shownAt: now, text: encodeCheckInCode(checkInCode) };
        }
        if (!stopped) setDoor({ kind: "ready", event, now, hasDoorKey: doorKey !== undefined, shown, lastCheckInAt });
      } catch (error) {
        const message = describeError(error);
        if (!stopped) setDoor((door) => (door.kind === "ready" ? { ...door, problem: message } : { kind: "error", message }));
      } finally {
        if (!stopped) timer = setTimeout(poll, POLL_EVERY_MS);
      }
    }

    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [eventAddress]);

  // Keep the device awake while the door screen is open.
  useEffect(() => {
    let lock: WakeLockSentinel | undefined;
    async function keepAwake() {
      if (document.visibilityState !== "visible") return;
      lock = await navigator.wakeLock?.request("screen").catch(() => undefined);
    }
    keepAwake();
    document.addEventListener("visibilitychange", keepAwake);
    return () => {
      document.removeEventListener("visibilitychange", keepAwake);
      lock?.release();
    };
  }, []);

  const eventLink = eventAddress && (
    <Link className="door-back" href={`/e/${eventAddress}`}>
      Back to the event
    </Link>
  );

  if (!eventAddress) return <DoorMessage title="That isn't an event address" />;
  if (door.kind === "loading") return <DoorMessage title="Opening the door…" />;
  if (door.kind === "error") return <DoorMessage title="The door can't reach Solana" text={door.message}>{eventLink}</DoorMessage>;
  if (door.kind === "gone") {
    if (door.reason === "outdated") {
      return <DoorMessage title="This event can't be shown" text="It was made with an older version of Veni." />;
    }
    return door.reason === "closed" ? (
      <DoorMessage title="This event is over" text="Everyone has been paid." />
    ) : (
      <DoorMessage title="This isn't a Veni event" text="Check the link." />
    );
  }

  const { event, now, hasDoorKey, shown, lastCheckInAt, problem } = door;
  const { title } = event.terms;
  if (!hasDoorKey) {
    return (
      <DoorMessage
        title="Open the door from your browser"
        text="Use the browser you created this event in."
      >
        {eventLink}
      </DoorMessage>
    );
  }
  if (event.isCancelled) {
    return <DoorMessage title="This event was cancelled" text="Every guest gets their stake back.">{eventLink}</DoorMessage>;
  }
  if (!isDoorOpen(event, now)) {
    return (
      <DoorMessage title="Check-in has closed" text={`${event.attendedCount} of ${event.guestCount} guests checked in.`}>
        {eventLink}
      </DoorMessage>
    );
  }

  const secondsLeft = shown ? Number(CHECK_IN_CODE_REFRESH_SECONDS - (now - shown.shownAt)) : 0;
  const justCheckedIn = lastCheckInAt !== undefined && now - lastCheckInAt < CHECKED_IN_FLASH_SECONDS;
  return (
    <main className="door">
      <p className="door-event">Door · {title}</p>
      <h1 className="door-title">Scan with Veni to check in</h1>
      <div className="door-qr">
        {shown ? (
          <QrCode text={shown.text} label={`Check-in code for ${title}`} />
        ) : (
          <p className="door-signing">Signing the first code…</p>
        )}
      </div>
      {shown && (
        <p className="door-refresh">
          <svg className="door-ring" viewBox="0 0 36 36" aria-hidden="true">
            <circle className="bg" cx="18" cy="18" r="15" />
            <circle
              className="fg"
              cx="18"
              cy="18"
              r="15"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - secondsLeft / Number(CHECK_IN_CODE_REFRESH_SECONDS)}
            />
          </svg>
          New code in {secondsLeft} s
        </p>
      )}
      <p className={justCheckedIn ? "door-count is-new" : "door-count"} role="status">
        {justCheckedIn && "Checked in · "}
        {event.attendedCount} of {event.guestCount} checked in
      </p>
      <p className="door-foot">
        {problem ? "Reconnecting…" : `Code #${shown?.code ?? "…"}`}
      </p>
      {eventLink}
    </main>
  );
}

function DoorMessage({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <main className="door">
      <div className="door-message">
        <h1 className="door-title">{title}</h1>
        {text && <p>{text}</p>}
        {children}
      </div>
    </main>
  );
}
