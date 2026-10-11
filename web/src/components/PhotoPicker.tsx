"use client";

import { useRef, useState } from "react";
import { useSignMessage } from "@solana/react";
import type { UiWalletAccount } from "@wallet-standard/react";
import { address } from "@solana/kit";
import { PHOTO_MAX_BYTES, PHOTO_SIZE, photoMessage, sha256Hex } from "@veni/sdk";
import { Face } from "@/components/Face";
import { toBase64 } from "@/lib/signing";
import { rememberPhoto } from "@/lib/usernames-client";

/** Your face on your profile: click it to add or change your photo. */
export function PhotoPicker({ account, initials, onError }: { account: UiWalletAccount; initials: string; onError: (message?: string) => void }) {
  const signMessage = useSignMessage(account);
  const input = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function save(file: File) {
    setIsSaving(true);
    onError(undefined);
    try {
      const image = await squareJpeg(file);
      const photo = { wallet: address(account.address), sha256: await sha256Hex(image), signedAt: new Date().toISOString() };
      let signature: Uint8Array;
      try {
        ({ signature } = await signMessage({ message: new TextEncoder().encode(photoMessage(photo)) }));
      } catch {
        throw new Error("You didn't sign, so your photo wasn't saved.");
      }
      const response = await fetch("/api/photos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...photo, image: toBase64(image), signature: toBase64(signature) }),
      });
      const body = (await response.json()) as { version?: number; error?: string };
      if (!response.ok || !body.version) throw new Error(body.error ?? "Couldn't save your photo.");
      rememberPhoto(account.address, body.version);
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <button type="button" className="photo-button" aria-label="Change your photo" disabled={isSaving} onClick={() => input.current?.click()}>
        <Face wallet={account.address} initials={initials} />
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) save(file);
        }}
      />
    </>
  );
}

/** The middle square of the photo, 256×256, as a JPEG under the server's limit. */
async function squareJpeg(file: File) {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("That file isn't a photo Veni can read.");
  });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = PHOTO_SIZE;
  canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
  for (const quality of [0.85, 0.7, 0.5]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= PHOTO_MAX_BYTES) return new Uint8Array(await blob.arrayBuffer());
  }
  throw new Error("That photo is too detailed to save. Try another one.");
}
