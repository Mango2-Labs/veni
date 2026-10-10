"use client";

import { useState } from "react";
import type { Address } from "@solana/kit";
import { getTestFunds } from "@/lib/veni";

/** Devnet only: 50 Test USD for `wallet`, then `onFunded` so the page reads the new balance. */
export function TestFundsButton({ wallet, onFunded }: { wallet: Address; onFunded: () => void }) {
  const [status, setStatus] = useState<"idle" | "sending" | { error: string }>("idle");

  async function send() {
    setStatus("sending");
    try {
      await getTestFunds(wallet);
      setStatus("idle");
      onFunded();
    } catch (error) {
      setStatus({ error: error instanceof Error ? error.message : String(error) });
    }
  }

  return (
    <>
      <button type="button" className="btn btn-white btn-sm" onClick={send} disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Get test funds"}
      </button>
      {typeof status === "object" && (
        <span className="field-hint is-bad" role="alert">
          {status.error}
        </span>
      )}
    </>
  );
}
