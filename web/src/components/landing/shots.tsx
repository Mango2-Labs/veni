// The landing page's art: a guest's profile with stamps, and a paid-back
// Breakpoint ticket. Static.
import s from "./landing.module.css";

export function ProfileArt() {
  return (
    <div
      className={s.art}
      role="img"
      aria-label="Dana Okafor's Veni profile: 14 events attended and $31.50 from no-shows, stamped in Seoul, Lagos and London. Beside it, her Solana Breakpoint ticket: checked in, $12.25 back."
    >
      <div className={s.stage}>
        <div className={s.passport}>
          <div className={s.cover}>
            <span className={s.kicker}>Profile</span>
            <span className={s.face}>DO</span>
            <span className={s.name}>Dana<br />Okafor</span>
            <span className={s.stats}>
              <span><b>14</b> events attended</span>
              <span><b>$31.50</b> from no-shows</span>
            </span>
          </div>
          <div className={s.leaf}>
            <Stamp className={s.stampSeoul} city="Seoul" date="22 Oct" />
            <Stamp className={s.stampLagos} city="Lagos" date="24 Oct" />
            <Stamp className={s.stampLondon} city="London" date="Breakpoint" />
          </div>
        </div>
        <div className={s.ticket}>
          <span className={s.ticketTitle}>Solana Breakpoint</span>
          <span className={s.ticketWhere}>15–17 Nov · Olympia London</span>
          <span className={s.ticketFoot}>
            <span className={s.chip}>Checked in</span>
            <span className={s.back}>$12.25 back</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function Stamp({ className, city, date }: { className: string; city: string; date: string }) {
  return (
    <span className={`${s.stamp} ${className}`}>
      <small>Checked in</small>
      <strong>{city}</strong>
      <small>{date}</small>
    </span>
  );
}
