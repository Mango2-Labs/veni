"use client";

import type { ReactNode } from "react";
import { SelectedWalletAccountContextProvider } from "@solana/react";
import type { UiWallet } from "@wallet-standard/react";
import { UsernameGate } from "@/components/UsernamePicker";

const STORAGE_KEY = "veni:wallet-account";

// Only list wallets that speak Solana and can be asked to connect.
function isSolanaWallet(wallet: UiWallet) {
  return (
    wallet.chains.some((chain) => chain.startsWith("solana:")) &&
    wallet.features.includes("standard:connect")
  );
}

// Storage may be missing (server) or blocked (private windows), so every call is guarded.
const stateSync = {
  getSelectedWallet() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  },
  storeSelectedWallet(accountKey: string) {
    try {
      window.localStorage.setItem(STORAGE_KEY, accountKey);
    } catch {}
  },
  deleteSelectedWallet() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
  },
};

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SelectedWalletAccountContextProvider filterWallets={isSolanaWallet} stateSync={stateSync}>
      {children}
      <UsernameGate />
    </SelectedWalletAccountContextProvider>
  );
}
