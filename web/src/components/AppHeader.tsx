import Link from "next/link";
import { Logo } from "./Logo";
import { AccountMenu } from "./AccountMenu";
import { DevnetBanner } from "./DevnetBanner";

/** The header for the app pages. `current` marks the page you're on. */
export function AppHeader({ current }: { current?: "/events" }) {
  return (
    <>
      <header className="wrap nav">
        <Link className="logo" href="/" aria-label="Veni home">
          <Logo />
        </Link>
        <nav className="nav-actions" aria-label="App">
          <Link className="nav-link" href="/events" aria-current={current === "/events" ? "page" : undefined}>
            Find events
          </Link>
          <AccountMenu />
        </nav>
      </header>
      <div className="wrap">
        <DevnetBanner />
      </div>
    </>
  );
}
