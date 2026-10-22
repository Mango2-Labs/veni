import Link from "next/link";
import { Logo } from "./Logo";
import s from "./landing/landing.module.css";

/** The footer under the home and pricing pages. `current` marks the page you're on. */
export function SiteFooter({ current }: { current?: "/pricing" }) {
  return (
    <footer className={s.footer}>
      <div className={`${s.wrap} ${s.footerIn}`}>
        <Link className={s.logo} href="/" aria-label="Veni home">
          <Logo />
        </Link>
        <nav className={s.footerLinks} aria-label="Footer">
          <Link href="/events">Find events</Link>
          <Link href="/new">Host an event</Link>
          <Link href="/pricing" aria-current={current === "/pricing" ? "page" : undefined}>
            Pricing
          </Link>
          <a className={s.footerX} href="https://x.com/useveniapp" target="_blank" rel="noopener noreferrer" aria-label="Veni on X">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
        </nav>
      </div>
    </footer>
  );
}
