"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useSelectedWalletAccount, useSignMessage } from "@solana/react";
import type { UiWalletAccount } from "@wallet-standard/react";
import type { Address } from "@solana/kit";
import { toBase64 } from "@/lib/signing";
import {
  normalizeUsername,
  USERNAME_CHANGE_HOURS,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  usernameMessage,
  usernameProblem,
} from "@/lib/usernames";
import { checkUsername, saveUsername, useUsernameOf } from "@/lib/usernames-client";

/** Asks a signed-in wallet with no username to pick one before going on. */
export function UsernameGate() {
  const [account, setAccount] = useSelectedWalletAccount();
  const username = useUsernameOf(account?.address);
  if (!account || username !== null) return null;
  return (
    <UsernamePicker
      key={account.address}
      account={account}
      open
      isRequired
      leaveLabel="Sign out"
      onLeave={() => setAccount(undefined)}
      onDone={() => {}}
    />
  );
}

type Check = { username: string; available: boolean; problem?: string };

/** Picks or changes a username. The wallet signs it, so nobody else can. */
export function UsernamePicker({
  account,
  open,
  current,
  isRequired = false,
  leaveLabel,
  onLeave,
  onDone,
}: {
  account: UiWalletAccount;
  open: boolean;
  /** The username being changed, if there is one. */
  current?: string;
  /** No way out but `onLeave`: Escape does nothing. */
  isRequired?: boolean;
  leaveLabel: string;
  onLeave: () => void;
  onDone: (username: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const inputId = useId();
  const hintId = useId();
  const signMessage = useSignMessage(account);
  const [value, setValue] = useState(current ?? "");
  const [check, setCheck] = useState<Check>();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();

  const username = normalizeUsername(value);
  const problem = username ? usernameProblem(username) : undefined;
  const isUnchanged = current !== undefined && username === current;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Asks whether it's free once typing pauses.
  useEffect(() => {
    if (!username || problem || isUnchanged) return;
    let isCurrent = true;
    const timer = setTimeout(() => {
      checkUsername(username, account.address).then(
        (result) => isCurrent && setCheck({ username, ...result }),
        () => isCurrent && setCheck(undefined),
      );
    }, 300);
    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [username, problem, isUnchanged, account.address]);

  const checked = check?.username === username ? check : undefined;
  const canSave = Boolean(username) && !problem && !isUnchanged && checked?.available === true && !isSaving;
  const status = !username
    ? { text: `${USERNAME_MIN_LENGTH} to ${USERNAME_MAX_LENGTH} letters, numbers or _, starting with a letter.`, tone: "" }
    : problem
      ? { text: problem, tone: "is-bad" }
      : isUnchanged
        ? { text: "That's your username now.", tone: "" }
        : !checked
          ? { text: "Checking…", tone: "" }
          : checked.available
            ? { text: `${username} is free.`, tone: "is-good" }
            : { text: checked.problem ?? "That username is taken.", tone: "is-bad" };

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    setIsSaving(true);
    setError(undefined);
    try {
      const input = { wallet: account.address as Address, username, signedAt: new Date().toISOString() };
      let signature: Uint8Array;
      try {
        ({ signature } = await signMessage({ message: new TextEncoder().encode(usernameMessage(input)) }));
      } catch {
        throw new Error("You didn't sign, so nothing was saved.");
      }
      onDone(await saveUsername({ ...input, signature: toBase64(signature) }));
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="notice"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!isRequired) onLeave();
      }}
    >
      <form className="notice-body" onSubmit={save}>
        <h2 id={titleId}>{current ? "Change your username" : "Pick a username"}</h2>
        <p>
          Hosts and guests see your username instead of your wallet address. You can change it once every{" "}
          {USERNAME_CHANGE_HOURS} hours.
        </p>
        <div className="field">
          <label htmlFor={inputId}>Username</label>
          <input
            id={inputId}
            name="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={USERNAME_MAX_LENGTH + 1}
            value={value}
            // Shown as it will be saved: lowercase, without an @.
            onChange={(event) => setValue(event.target.value.replace(/^@/, "").toLowerCase())}
            aria-describedby={hintId}
            aria-invalid={status.tone === "is-bad"}
            autoFocus
          />
          <span id={hintId} className={`field-hint ${status.tone}`} role="status">
            {status.text}
          </span>
        </div>
        {error && (
          <p className="notice-error" role="alert">
            {error}
          </p>
        )}
        <p className="notice-fine">Your wallet asks you to sign a message. It&apos;s free and moves no money.</p>
        <div className="actions notice-actions">
          <button type="button" className="btn btn-white" onClick={onLeave}>
            {leaveLabel}
          </button>
          <button type="submit" className="btn btn-primary" disabled={!canSave}>
            {isSaving ? "Check your wallet…" : "Save username"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
