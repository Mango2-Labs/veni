"use client";

import { useEffect, useId, useRef, useState } from "react";

const DISMISSED_KEY = "veni:stake-notice-dismissed";

/** False until the guest ticks "Don't show this again". */
export function hasDismissedStakeNotice() {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Shown before a stake until the guest dismisses it for good: once staked,
 * the stake comes back only by showing up.
 */
export function StakeNotice({
  open,
  stake,
  ticket,
  isApplying,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  /** Formatted, like "$10". */
  stake: string;
  /** Formatted ticket price, or undefined at a free event. */
  ticket?: string;
  isApplying: boolean;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [neverAgain, setNeverAgain] = useState(false);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function confirm() {
    if (neverAgain) {
      try {
        window.localStorage.setItem(DISMISSED_KEY, "1");
      } catch {}
    }
    onConfirm();
  }

  return (
    <dialog
      ref={dialogRef}
      className="notice"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <div className="notice-body">
        <h2 id={titleId}>Your stake is locked in</h2>
        <p>
          {isApplying
            ? "You can withdraw your application until the host approves you. After that, you can't take your stake back before the event."
            : "Once you sign up, you can't take your stake back before the event."}
        </p>
        <ul className="notice-list">
          <li>
            <b>You come:</b> {stake} back, plus a share of what no-shows staked.
          </li>
          <li>
            <b>You don&apos;t:</b> your {stake} goes to the guests who came. Veni keeps 10%.
          </li>
          {ticket && (
            <li>
              <b>Your ticket:</b> {ticket} goes to the host.
            </li>
          )}
          <li>You get it all back if the host cancels or nobody checks in.</li>
        </ul>
        <label className="notice-check">
          <input type="checkbox" checked={neverAgain} onChange={(event) => setNeverAgain(event.target.checked)} />
          Don&apos;t show this again
        </label>
        <div className="actions notice-actions">
          <button type="button" className="btn btn-white" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={confirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
