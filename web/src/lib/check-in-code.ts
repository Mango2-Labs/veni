// Door codes in the app: the door screen shows a signed code, and a guest's phone
// scans it to check in. Signing and encoding live in @veni/crank.
import type { Event as EventAccount } from "@veni/client";

/**
 * How often the door signs a fresh code. Codes last a minute, so a scanned
 * one always has at least 30 seconds left.
 */
export const CHECK_IN_CODE_REFRESH_SECONDS = 30n;

/** True until check-in closes, unless cancelled. Matches the program. */
export function isDoorOpen(event: EventAccount, now: bigint) {
  return !event.isCancelled && now < event.terms.checkInEndsAt;
}

type Detector = { detect(source: HTMLVideoElement | ImageBitmap): Promise<{ rawValue: string }[]> };
type DetectorClass = {
  new (options: { formats: string[] }): Detector;
  getSupportedFormats(): Promise<string[]>;
};

let nativeDetector: Promise<Detector | undefined> | undefined;

/** The browser's own QR reader, where it has one: Chrome on Android and macOS does. */
function getNativeDetector() {
  nativeDetector ??= (async () => {
    const BarcodeDetector = (globalThis as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
    if (!BarcodeDetector) return undefined;
    try {
      const formats = await BarcodeDetector.getSupportedFormats();
      return formats.includes("qr_code") ? new BarcodeDetector({ formats: ["qr_code"] }) : undefined;
    } catch {
      return undefined;
    }
  })();
  return nativeDetector;
}

// Big enough for a full-screen screenshot, small enough to scan a few frames a second.
const MAX_SIDE = 1280;
let canvas: HTMLCanvasElement | undefined;

/** The text of the QR code in a camera frame or photo, if there is one. */
export async function readQrCode(source: HTMLVideoElement | ImageBitmap): Promise<string | undefined> {
  const detector = await getNativeDetector();
  if (detector) {
    const [found] = await detector.detect(source);
    return found?.rawValue;
  }

  // Safari and Firefox have no reader of their own, so draw the image and decode it here.
  const width = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
  const height = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
  if (!width || !height) return undefined;
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  canvas ??= document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return undefined;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const { default: jsQR } = await import("jsqr");
  return jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" })?.data;
}
