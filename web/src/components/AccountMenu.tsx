"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSelectedWalletAccount } from "@solana/react";
import { address } from "@solana/kit";
import {
  useConnect,
  useDisconnect,
  type UiWallet,
  type UiWalletAccount,
} from "@wallet-standard/react";
import { SOLANA_CLUSTER, formatSol, rpc, shortAddress } from "@/lib/solana";
import { usernameInitials } from "@/lib/usernames";
import { useUsernameOf } from "@/lib/usernames-client";

const INSTALL_LINKS = [
  { name: "Phantom", href: "https://phantom.com/download" },
  { name: "Solflare", href: "https://solflare.com/download" },
  { name: "Backpack", href: "https://backpack.app/download" },
];

/** "Sign in" connects a wallet; once signed in, the avatar opens the account menu. */
export function AccountMenu() {
  const [account, setAccount, wallets] = useSelectedWalletAccount();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const username = useUsernameOf(account?.address);
  const wallet = account
    ? wallets.find((w) => w.accounts.some((a) => a.address === account.address))
    : undefined;

  // Close the menu on an outside click or Escape
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="wallet" ref={rootRef}>
      {account && wallet ? (
        <button
          type="button"
          className="avatar-button"
          aria-label={`Account ${username ?? shortAddress(account.address)}`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((isOpen) => !isOpen)}
        >
          {username ? usernameInitials(username) : "?"}
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-blue btn-sm"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((isOpen) => !isOpen)}
        >
          Sign in
        </button>
      )}

      {open && (
        <div className="wallet-menu" role="menu">
          {account && wallet ? (
            <ConnectedMenu
              key={account.address}
              account={account}
              wallet={wallet}
              username={username ?? undefined}
              onNavigate={() => setOpen(false)}
              onDisconnected={() => {
                setAccount(undefined);
                setOpen(false);
              }}
            />
          ) : (
            <WalletList
              wallets={wallets}
              onConnected={(connected) => {
                setAccount(connected);
                setOpen(false);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function WalletList({
  wallets,
  onConnected,
}: {
  wallets: UiWallet[];
  onConnected: (account: UiWalletAccount) => void;
}) {
  const [error, setError] = useState<string>();

  if (wallets.length === 0) {
    return (
      <>
        <p className="menu-label">No wallet found</p>
        <p className="menu-note">Install a Solana wallet in this browser, then reload the page.</p>
        {INSTALL_LINKS.map((link) => (
          <a key={link.name} className="menu-item" role="menuitem" href={link.href} target="_blank" rel="noopener noreferrer">
            Get {link.name}
          </a>
        ))}
      </>
    );
  }

  return (
    <>
      <p className="menu-label">Choose a wallet</p>
      {wallets.map((wallet) => (
        <WalletOption
          key={wallet.name}
          wallet={wallet}
          onConnected={onConnected}
          onError={() => setError(`${wallet.name} didn't connect. Try again.`)}
        />
      ))}
      {error && <p className="menu-note menu-error" role="alert">{error}</p>}
    </>
  );
}

function WalletOption({
  wallet,
  onConnected,
  onError,
}: {
  wallet: UiWallet;
  onConnected: (account: UiWalletAccount) => void;
  onError: () => void;
}) {
  const [isConnecting, connect] = useConnect(wallet);

  async function handleConnect() {
    try {
      const accounts = await connect();
      const first = accounts[0] ?? wallet.accounts[0];
      if (first) onConnected(first);
    } catch {
      onError();
    }
  }

  return (
    <button type="button" role="menuitem" className="menu-item" disabled={isConnecting} onClick={handleConnect}>
      {/* eslint-disable-next-line @next/next/no-img-element -- wallet icons are data URIs */}
      <img className="wallet-icon" src={wallet.icon} alt="" width={28} height={28} />
      <span>{wallet.name}</span>
      {isConnecting && <span className="menu-hint">Check your wallet…</span>}
    </button>
  );
}

function ConnectedMenu({
  account,
  wallet,
  username,
  onNavigate,
  onDisconnected,
}: {
  account: UiWalletAccount;
  wallet: UiWallet;
  username?: string;
  onNavigate: () => void;
  onDisconnected: () => void;
}) {
  const balance = useBalance(account.address);
  const [copied, setCopied] = useState(false);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(account.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <>
      {username && <p className="menu-name">{username}</p>}
      <p className="menu-label">
        {wallet.name} · {SOLANA_CLUSTER}
      </p>
      <p className="menu-balance">
        {balance === undefined ? "Loading balance…" : balance === null ? "Balance unavailable" : `${formatSol(balance)} SOL`}
      </p>
      <Link className="menu-item" role="menuitem" href="/me" onClick={onNavigate}>
        View profile
      </Link>
      <Link className="menu-item" role="menuitem" href="/new" onClick={onNavigate}>
        Host an event
      </Link>
      <button type="button" role="menuitem" className="menu-item" onClick={copyAddress}>
        {copied ? "Copied" : "Copy address"}
      </button>
      {/* Not every wallet supports disconnecting; for those, forgetting the account is enough */}
      {wallet.features.includes("standard:disconnect") ? (
        <DisconnectItem wallet={wallet} onDisconnected={onDisconnected} />
      ) : (
        <button type="button" role="menuitem" className="menu-item menu-danger" onClick={onDisconnected}>
          Sign out
        </button>
      )}
    </>
  );
}

function DisconnectItem({ wallet, onDisconnected }: { wallet: UiWallet; onDisconnected: () => void }) {
  const [isDisconnecting, disconnect] = useDisconnect(wallet);

  async function handleDisconnect() {
    try {
      await disconnect();
    } finally {
      onDisconnected();
    }
  }

  return (
    <button type="button" role="menuitem" className="menu-item menu-danger" disabled={isDisconnecting} onClick={handleDisconnect}>
      Sign out
    </button>
  );
}

// undefined while loading, null if the RPC call failed
function useBalance(walletAddress: string) {
  const [balance, setBalance] = useState<bigint | null>();

  useEffect(() => {
    const abortController = new AbortController();
    rpc
      .getBalance(address(walletAddress))
      .send({ abortSignal: abortController.signal })
      .then(({ value }) => setBalance(value))
      .catch(() => {
        if (!abortController.signal.aborted) setBalance(null);
      });
    return () => abortController.abort();
  }, [walletAddress]);

  return balance;
}
