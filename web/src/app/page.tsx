import Image from "next/image";
import Link from "next/link";
import { AccountMenu } from "@/components/AccountMenu";
import { Logo } from "@/components/Logo";
import { Icon, type IconName } from "@/components/landing/parts";
import { PhoneArt } from "@/components/landing/shots";
import { SiteFooter } from "@/components/SiteFooter";
import s from "@/components/landing/landing.module.css";

// The hero speaks to hosts; below, hosts and guests each get their reasons.

// Where to get Veni's Android app. Until there's a link, the badges say it's coming.
const ANDROID_APK_URL: string | undefined = undefined;
const DAPP_STORE_URL: string | undefined = undefined;

const STEPS: { icon: IconName; title: string; body: string; tone?: "teal" }[] = [
  { icon: "calendar", title: "The host creates it", body: "Set the stake and times, or import it from Luma." },
  { icon: "coin", title: "Guests stake to sign up", body: "A few dollars in USDC holds a spot. A program keeps it, not the host." },
  { icon: "scan", title: "Scan in, get stamped", body: "Scan the host's door screen. The event goes on your profile." },
  { icon: "check", title: "Showing up pays", body: "Your stake comes back, plus a share of what no-shows lose.", tone: "teal" },
];

export default function Home() {
  return (
    <div className={s.page}>
      <header className={`${s.wrap} ${s.header}`}>
        <Link className={s.logo} href="/" aria-label="Veni home">
          <Logo />
        </Link>
        <nav className={s.nav} aria-label="Main">
          <Link className={s.navLink} href="/events">Find events</Link>
          <AccountMenu />
        </nav>
      </header>

      <main>
        <section className={`${s.wrap} ${s.hero}`} aria-labelledby="hero-title">
          <div>
            <h1 id="hero-title" className={s.h1}>Host events people show up to</h1>
            <p className={s.lead}>
              From meetups to hackathons and side events, guests stake a few dollars to sign up and get it back when
              they show up.
            </p>
            <div className={s.heroActions}>
              <Link className="btn btn-primary" href="/new">Host an event</Link>
              <Link className={s.textLink} href="/events">
                Going to an event? Find it <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className={s.badges} aria-label="Veni on Android and Seeker">
              <StoreBadge href={ANDROID_APK_URL} src="/badges/android-apk.svg" alt="Download the Android APK" height={239} />
              <StoreBadge
                href={DAPP_STORE_URL}
                src="/badges/solana-mobile.svg"
                alt="Download on the dApp Store by Solana Mobile"
                height={241}
              />
            </div>
            {!(ANDROID_APK_URL || DAPP_STORE_URL) && <p className={s.badgeNote}>Coming soon to Android and Seeker</p>}
          </div>
          <PhoneArt />
        </section>

        <section className={s.steps} aria-labelledby="how-it-works">
          <div className={s.wrap}>
            <h2 id="how-it-works" className={s.h2}>How it works</h2>
            <ol className={s.stepList}>
              {STEPS.map((step) => (
                <li key={step.title} className={s.step}>
                  <span className={step.tone === "teal" ? `${s.stepIcon} ${s.stepIconTeal}` : s.stepIcon}>
                    <Icon name={step.icon} />
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
            <p className={s.example}>
              Say 60 people sign up at $10 and 12 don&apos;t come. Their $120 pays Veni&apos;s 10% ($12), and the 48 who
              came each get their $10 back plus $2.25.
            </p>
          </div>
        </section>

        <section className={`${s.wrap} ${s.sides}`} aria-label="For hosts and for guests">
          <article className={`${s.side} ${s.sideHost}`}>
            <p className={s.sideKicker}>For hosts</p>
            <h2>A guest list that turns up, and a record that travels with you</h2>
            <p>
              Every sign-up comes with a stake, so your headcount means something. Guests see your past events and how
              many people came, so new guests trust you. Free events cost you nothing.
            </p>
            <Link className="btn btn-primary" href="/new">Host an event</Link>
          </article>
          <article className={`${s.side} ${s.sideGuest}`}>
            <p className={s.sideKicker}>For guests</p>
            <h2>Get paid for showing up, and keep every stamp</h2>
            <p>
              Cancelled, or nobody checked in? Everyone gets their whole stake back. Veni&apos;s 10% only comes out of
              no-show stakes.
            </p>
            <Link className={s.textLink} href="/events">
              Find events <span aria-hidden="true">→</span>
            </Link>
          </article>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

/** A store's own badge art, linked once the app is out there. */
function StoreBadge({ href, src, alt, height }: { href?: string; src: string; alt: string; height: number }) {
  const badge = <Image className={s.badge} src={src} alt={alt} width={714} height={height} />;
  return href ? <a className={s.badgeLink} href={href}>{badge}</a> : badge;
}
