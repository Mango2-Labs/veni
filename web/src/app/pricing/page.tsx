import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { SiteFooter } from "@/components/SiteFooter";
import s from "./pricing.module.css";

export const metadata: Metadata = { title: "Pricing · Veni" };

const BASIC: ReactNode[] = [
  "Unlimited events and guests",
  "A stake on every sign-up, set by you",
  "Check guests in with a code at the door",
  "Free or paid tickets, in USDC",
  "Ticket money paid to you 24 hours after the event",
  <><b>1% platform fee</b> for paid events</>,
  "Require approval, and see each guest's show-up record",
  "Import events from Luma",
  "A host page with your past events and turnout",
];

const PRO: ReactNode[] = [
  <><b>0% platform fee</b> for paid events</>,
  "Turnout reports for every event",
  "Staff phones that check guests in",
  "Stay in sync with your Luma calendar",
];

export default function PricingPage() {
  return (
    <>
      <AppHeader />
      <main className="wrap">
        <div className={s.page}>
          <h1 className={s.title}>Pricing</h1>
          <div className={s.plans}>
            <section className={s.plan} aria-labelledby="basic">
              <div className={s.head}>
                <h2 id="basic" className={s.name}>Veni Basic</h2>
                <p className={s.price}>Free</p>
                <p className={s.note}>Forever</p>
              </div>
              <Link className="btn btn-primary" href="/new">Host an event</Link>
              <Features items={BASIC} />
            </section>
            <section className={`${s.plan} ${s.pro}`} aria-labelledby="pro">
              <div className={s.head}>
                <h2 id="pro" className={s.name}>Veni Pro</h2>
                <p className={s.price}>Coming soon</p>
                <p className={s.note}>For hosts who run events every month</p>
              </div>
              <p className={s.soon} aria-hidden="true">Coming soon</p>
              <p className={s.lead}>Everything in Basic, plus:</p>
              <Features items={PRO} />
            </section>
          </div>
          <p className={s.footnote}>Prices are in USDC on Solana.</p>
        </div>
      </main>
      <SiteFooter current="/pricing" />
    </>
  );
}

function Features({ items }: { items: ReactNode[] }) {
  return (
    <ul className={s.features}>
      {items.map((item, index) => (
        <li key={index}>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
