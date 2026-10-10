"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { readQrCode } from "@/lib/check-in-code";

const SCAN_EVERY_MS = 250;

type Camera = "starting" | "on" | "off";

// Browsers leave out `mediaDevices` on pages served over http, whatever the types say.
const canUseCamera = () => typeof navigator.mediaDevices?.getUserMedia === "function";

/**
 * Reads the door's QR code with the camera and calls `onRead` once. Without a
 * camera, a photo or screenshot of the code works too.
 */
export function DoorScanner({ onRead, onCancel }: { onRead: (text: string) => void; onCancel: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const [camera, setCamera] = useState<Camera>(() => (canUseCamera() ? "starting" : "off"));
  const [photoProblem, setPhotoProblem] = useState<string>();
  const read = useEffectEvent(onRead);

  useEffect(() => {
    if (!canUseCamera()) return;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const stopCamera = () => stream?.getTracks().forEach((track) => track.stop());

    async function scan() {
      const element = video.current;
      if (stopped || !element) return;
      if (element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const text = await readQrCode(element).catch(() => undefined);
        if (stopped) return;
        if (text) {
          stopped = true;
          stopCamera();
          read(text);
          return;
        }
      }
      timer = setTimeout(scan, SCAN_EVERY_MS);
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch {
        if (!stopped) setCamera("off");
        return;
      }
      if (stopped || !video.current) return stopCamera();
      video.current.srcObject = stream;
      await video.current.play().catch(() => undefined);
      setCamera("on");
      scan();
    }

    start();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stopCamera();
    };
  }, []);

  async function readPhoto(file: File) {
    setPhotoProblem(undefined);
    try {
      const bitmap = await createImageBitmap(file);
      const text = await readQrCode(bitmap);
      bitmap.close();
      if (text) onRead(text);
      else setPhotoProblem("No code found. Try again.");
    } catch {
      setPhotoProblem("That picture couldn't be read. Try another.");
    }
  }

  return (
    <div className="scanner">
      {camera !== "off" && (
        <div className="scanner-view">
          <video ref={video} playsInline muted aria-label="Camera view" />
          <span className="scanner-frame" aria-hidden="true" />
        </div>
      )}
      <p className="action-note" role="status">
        {camera === "starting" && "Starting the camera…"}
        {camera === "on" && "Point your camera at the code."}
        {camera === "off" && "No camera here. Use a photo of the code."}
      </p>
      <div className="actions">
        <button
          type="button"
          className={camera === "off" ? "btn btn-primary btn-sm" : "btn btn-white btn-sm"}
          onClick={() => photoInput.current?.click()}
        >
          Use a photo
        </button>
        <button type="button" className="btn btn-white btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <input
        ref={photoInput}
        className="sr-only"
        type="file"
        accept="image/*"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) readPhoto(file);
        }}
      />
      {photoProblem && <p className="app-message error">{photoProblem}</p>}
    </div>
  );
}
