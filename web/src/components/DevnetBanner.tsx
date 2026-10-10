"use client";

import { useState } from "react";
import { useSelectedWalletAccount } from "@solana/react";
import { address } from "@solana/kit";
import { getTestFunds } from "@/lib/veni";

/** Says this is devnet, and gives the connected wallet free test funds. */
export function DevnetBanner() {
  const [account] = useSelectedWalletAccount();
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | string>("idle");

  async function sendTestFunds() {
    if (!account) return;
    setStatus("sending");
    try {
      await getTestFunds(address(account.address));
      setStatus("sent");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="app-banner" role="note">
      <span>
        <b>Test mode:</b> the money isn&apos;t real.
      </span>
      {account ? (
        <span className="banner-action">
          {status === "sent" && <span className="banner-status">Sent 50 Test USD.</span>}
          {status !== "idle" && status !== "sending" && status !== "sent" && (
            <span className="banner-status error">{status}</span>
          )}
          <button type="button" className="btn btn-white btn-sm" onClick={sendTestFunds} disabled={status === "sending"}>
            {status === "sending" ? "Sending…" : "Get test funds"}
          </button>
        </span>
      ) : (
        <span className="banner-status">Sign in to get test funds.</span>
      )}
    </div>
  );
}
