// The landing page's art: Veni on a phone in front of a Seeker, looping a
// guest's staked sign up, door scan and money back. CSS only.
import s from "./landing.module.css";

export function PhoneArt() {
  return (
    <div
      className={s.art}
      role="img"
      aria-label="Veni on a phone: stake $10 to sign up for Solana Breakpoint, scan the door screen to check in, and get $12.25 back."
    >
      <div className={s.stage}>
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
                  <QrMark />
                  <i className={s.scan} />
                </span>
              </span>
            </div>
            <div className={`${s.screen} ${s.done}`}>
              <span className={s.stamp}>
                <small>Checked in</small>
                <strong>London</strong>
                <small>15 Nov</small>
              </span>
              <span className={s.doneTitle}>Checked in</span>
              Solana Breakpoint
              <span className={s.back}>$12.25 back</span>
              <span className={s.split}>$10 stake + $2.25 from no-shows</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// A door screen's code, drawn rather than scanned.
function QrMark() {
  return (
    <svg viewBox="0 0 21 21" fill="var(--ink)">
      <path
        fillRule="evenodd"
        d="M0 0h7v7H0zM1 1v5h5V1zM2 2h3v3H2zM14 0h7v7h-7zM15 1v5h5V1zM16 2h3v3h-3zM0 14h7v7H0zM1 15v5h5v-5zM2 16h3v3H2z"
      />
      <path d="M8 0h1v1H8zM10 0h1v1h-1zM12 1h1v1h-1zM9 2h1v1H9zM11 3h1v1h-1zM8 4h1v1H8zM10 5h1v1h-1zM12 6h1v1h-1zM9 8h1v1H9zM8 10h1v1H8zM0 8h1v1H0zM2 8h1v1H2zM4 9h1v1H4zM6 10h1v1H6zM1 11h1v1H1zM3 12h1v1H3zM5 8h1v1H5zM10 9h1v1h-1zM12 10h1v1h-1zM14 8h1v1h-1zM16 9h1v1h-1zM18 8h1v1h-1zM20 10h1v1h-1zM15 11h1v1h-1zM17 12h1v1h-1zM19 13h1v1h-1zM9 13h1v1H9zM11 14h1v1h-1zM13 15h1v1h-1zM8 16h1v1H8zM10 17h1v1h-1zM12 18h1v1h-1zM9 19h1v1H9zM11 20h1v1h-1zM14 16h1v1h-1zM16 17h1v1h-1zM18 15h1v1h-1zM20 18h1v1h-1zM15 19h1v1h-1zM17 20h1v1h-1zM19 20h1v1h-1zM13 12h1v1h-1zM11 11h1v1h-1zM7 12h1v1H7z" />
    </svg>
  );
}
