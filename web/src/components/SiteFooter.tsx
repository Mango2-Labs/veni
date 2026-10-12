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
        </nav>
      </div>
    </footer>
  );
}
