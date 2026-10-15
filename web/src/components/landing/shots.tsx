// The landing page's art: Veni on a phone in front of a Seeker, looping a
// guest's staked sign up, door scan and money back. CSS only, with a pause switch.
import { QrCode } from "@/components/QrCode";
import s from "./landing.module.css";

export function PhoneArt() {
  return (
    <div className={s.art}>
      <input id="hero-pause" type="checkbox" role="switch" className={`sr-only ${s.pauseToggle}`} />
      <div
        className={s.stage}
        role="img"
        aria-label="Veni on a phone: stake $10 to sign up for Solana Breakpoint, scan the door screen to check in, and get $12.25 back after the event."
      >
        <span className={s.seeker} />
        <div className={s.phone}>
          <div className={s.strip}>
            <div className={s.screen}>
              <span className={s.poster} />
              <span className={s.event}>
                <b>Solana Breakpoint</b>
                15–17 Nov · Olympia London
              </span>
              <span className={s.stake}>
                <span className={s.stakeLabel}>
                  <span>Stake to sign up</span>
                  <span className={s.staked}>Staked</span>
                </span>
                <b>$10</b>
              </span>
              <span className={s.act}>
                <span className={s.signUp}>
                  Stake $10 and sign up
                  <i className={s.tap} />
                </span>
                <span className={s.going}>You&apos;re going</span>
              </span>
              <span className={s.scrim} />
              <span className={s.sheet}>
                Stake
                <b>10 USDC</b>
                Solana Breakpoint
                <span className={s.approve}>
                  Approve
                  <i className={s.tap} />
                </span>
              </span>
            </div>
            <div className={`${s.screen} ${s.cam}`}>
              Scan to check in
              <span className={s.finder}>
                <svg viewBox="0 0 176 176" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round">
                  <path d="M2 32V16A14 14 0 0 1 16 2h16M144 2h16a14 14 0 0 1 14 14v16M2 144v16a14 14 0 0 0 14 14h16M174 144v16a14 14 0 0 1-14 14h-16" />
                </svg>
                <span className={s.qr}>
                  <QrCode text="https://www.useveni.xyz" label="Door check-in code" />
                  <i className={s.scan} />
                </span>
              </span>
            </div>
            <div className={`${s.screen} ${s.done}`}>
              <span className={`stamp-ring ${s.stamp}`}>
                <small>Checked in</small>
                <strong>London</strong>
                <small>15 Nov</small>
              </span>
              <span className={s.doneTitle}>Solana Breakpoint</span>
              <span className={s.back}>$12.25 back</span>
              <span className={s.later}>after the event</span>
              <span className={s.split}>$10 stake + $2.25 from no-shows</span>
            </div>
          </div>
        </div>
      </div>
      <label htmlFor="hero-pause" className={s.pause}>
        <span className="sr-only">Pause animation</span>
        <svg className={s.bars} viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 3h3v10H4zM9 3h3v10H9z" />
        </svg>
        <svg className={s.play} viewBox="0 0 16 16" aria-hidden="true">
          <path d="M5 3l8 5-8 5z" />
        </svg>
      </label>
    </div>
  );
}
