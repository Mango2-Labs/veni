import { useMemo } from "react";
import { encode } from "uqr";

/** A QR code as one SVG path: sharp at any size, in the text color. */
export function QrCode({ text, label }: { text: string; label: string }) {
  const { size, path } = useMemo(() => {
    // Medium error correction, and the standard quiet zone of four modules.
    const { size, data } = encode(text, { ecc: "M", border: 4 });
    // One rectangle per run of dark modules in a row, rather than one per module.
    let path = "";
    data.forEach((row, y) => {
      for (let x = 0; x < size; x++) {
        if (!row[x]) continue;
        const start = x;
        while (row[x + 1]) x++;
        path += `M${start} ${y}h${x - start + 1}v1H${start}z`;
      }
    });
    return { size, path };
  }, [text]);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#FFFFFF" />
      <path d={path} fill="currentColor" />
    </svg>
  );
}
