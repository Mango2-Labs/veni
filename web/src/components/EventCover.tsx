import type { ReactNode } from "react";
import Image from "next/image";

/** The cover across the top: the square poster centered on a blurred copy of itself. */
export function CoverBanner({ src, title, children }: { src: string; title: string; children?: ReactNode }) {
  return (
    <div className="cover-banner">
      {/* At the top of the page, so no lazy loading. */}
      <Image src={src} alt="" fill sizes="256px" className="cover-backdrop" loading="eager" />
      <Image src={src} alt={`Poster for ${title}`} fill sizes="300px" className="cover-poster" loading="eager" fetchPriority="high" />
      {children}
    </div>
  );
}

/** A square cover for lists, or a tile in a cover color picked by address. */
export function CoverThumb({ src, title, seed }: { src?: string; title: string; seed: string }) {
  if (src) return <Image src={src} alt="" width={64} height={64} className="cover-thumb" />;
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return (
    <span className={`cover-thumb cover-tile tile-${hash % 6}`} aria-hidden="true">
      {[...title.trim()][0]?.toUpperCase()}
    </span>
  );
}
