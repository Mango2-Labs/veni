"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSelectedWalletAccount, useSignMessage } from "@solana/react";
import type { UiWalletAccount } from "@wallet-standard/react";
import { address as toAddress, fetchEncodedAccount, isAddress, type Address, type KeyPairSigner } from "@solana/kit";
import { decodeEvent, TEST_USD_MINT, type Event as EventAccount } from "@veni/client";
import { archiveThrough, crankEvent, type CrankReport } from "@veni/crank";
import {
  chainTime,
  decodeCheckInCode,
  describeError,
  fetchGuests,
  getCheckInInstructions,
  getCheckInWithCodeInstructions,
  signCheckIn,
  stampDateOf,
  ticketHoldEndsAt,
  ticketRevenueOf,
  type VeniClient,
} from "@veni/sdk";
import { AppHeader } from "@/components/AppHeader";
import { DoorScanner } from "@/components/DoorScanner";
import { CityStamp, coverClassOf, TypeLabels } from "@/components/EventCard";
import { CoverBanner } from "@/components/EventCover";
import { EventMap } from "@/components/EventMap";
import { hasDismissedStakeNotice, StakeNotice } from "@/components/StakeNotice";
import { TestFundsButton } from "@/components/TestFundsButton";
import { WalletName } from "@/components/WalletName";
import { turnoutPercent, useHostPage, usePastEventsAttendedBy } from "@/lib/archive-client";
import { saveEventDescription, useEventDescription, type SignMessage } from "@/lib/description-client";
import { findDoorKey } from "@/lib/door-key";
import { DESCRIPTION_LIMIT } from "@/lib/event-description";
import { initialsOf } from "@/lib/host-profile";
import { coverOf, isEventAccount, isOutdatedEvent, locationOf, lumaLinkOf } from "@/lib/events";
import type { LumaEvent } from "@/lib/luma";
import { isVerifiedOrganizer } from "@/lib/organizers";
import { mapsLink } from "@/lib/places";
import {
  formatUsd,
  formatUsdShort,
  relativeTime,
  veniReader,
  STAGE_LABEL,
  stageOf,
  tokenBalance,
  tokenLabel,
  useVeniClient,
} from "@/lib/veni";
import { displayNameOf } from "@/lib/usernames-client";

type Guest = Awaited<ReturnType<typeof fetchGuests>>[number];
type Snapshot =
  | { kind: "loading" }
  | { kind: "closed" }
  | { kind: "not-an-event" }
  | { kind: "outdated" }
  | { kind: "error"; message: string }
  | { kind: "open"; event: EventAccount; guests: Guest[]; now: bigint; vaultBalance: bigint };
type OpenSnapshot = Extract<Snapshot, { kind: "open" }>;
type Run = (action: string, work: () => Promise<string>) => Promise<void>;

export default function EventPage() {
  const params = useParams<{ address: string }>();
  const eventAddress = isAddress(params.address) ? toAddress(params.address) : undefined;
  const [account] = useSelectedWalletAccount();
  const [snapshot, setSnapshot] = useState<Snapshot>({ kind: "loading" });
  // A new event can take seconds to reach every RPC node, so only three
  // missed reads in a row mean it's closed.
  const misses = useRef(0);

  // Bumped after each action to re-read the chain.
  const [refreshCount, setRefreshCount] = useState(0);
  const refresh = useCallback(() => setRefreshCount((count) => count + 1), []);

  useEffect(() => {
    if (!eventAddress) return;
    const address = eventAddress;
    async function load() {
      try {
        const encoded = await fetchEncodedAccount(veniReader.rpc, address, { commitment: "confirmed" });
        if (!encoded.exists) {
          misses.current += 1;
          if (misses.current >= 3) setSnapshot({ kind: "closed" });
          return;
        }
        if (isOutdatedEvent(encoded)) {
          setSnapshot({ kind: "outdated" });
          return;
        }
        if (!isEventAccount(encoded)) {
          setSnapshot({ kind: "not-an-event" });
          return;
        }
        const event = decodeEvent(encoded).data;
        const [guests, now, vaultBalance] = await Promise.all([
          fetchGuests(veniReader, address),
          chainTime(veniReader),
          tokenBalance(address, event.stakeMint),
        ]);
        misses.current = 0;
        setSnapshot({ kind: "open", event, guests, now, vaultBalance });
      } catch (error) {
        setSnapshot({ kind: "error", message: describeError(error) });
      }
    }
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [eventAddress, refreshCount]);

  return (
    <>
      <AppHeader />
      <main className="app-main">
        <div className="wrap">
          {!eventAddress && <p className="app-message error">That isn&apos;t an event address.</p>}
          {eventAddress && snapshot.kind === "loading" && <p className="action-note">Loading the event…</p>}
          {snapshot.kind === "error" && <p className="app-message error">{snapshot.message}</p>}
          {snapshot.kind === "not-an-event" && (
            <div className="app-card">
              <h2>This isn&apos;t a Veni event</h2>
              <p>Check the link you were sent.</p>
              <div className="actions"><Link className="btn btn-white btn-sm" href="/events">Find events</Link></div>
            </div>
          )}
          {snapshot.kind === "outdated" && (
            <div className="app-card">
              <h2>This event can&apos;t be shown</h2>
              <p>It was made with an older version of Veni.</p>
              <div className="actions"><Link className="btn btn-white btn-sm" href="/events">Find events</Link></div>
            </div>
          )}
          {snapshot.kind === "closed" && (
            <div className="app-card">
              <h2>This event is over</h2>
              <p>Everyone has been paid.</p>
              <div className="actions">
                <Link className="btn btn-white btn-sm" href="/me">Profile</Link>
                <Link className="btn btn-white btn-sm" href="/events">Find events</Link>
                <Link className="btn btn-primary btn-sm" href="/new">Host an event</Link>
              </div>
            </div>
          )}
          {snapshot.kind === "open" && eventAddress &&
            (account ? (
              <ConnectedEvent account={account} eventAddress={eventAddress} snapshot={snapshot} onChange={refresh} />
            ) : (
              <EventView eventAddress={eventAddress} snapshot={snapshot} onChange={refresh} />
            ))}
        </div>
      </main>
    </>
  );
}

function ConnectedEvent(props: { account: UiWalletAccount; eventAddress: Address; snapshot: OpenSnapshot; onChange: () => void }) {
  const client = useVeniClient(props.account);
  const signMessage = useSignMessage(props.account);
  return <EventView {...props} client={client} wallet={toAddress(props.account.address)} signMessage={signMessage} />;
}

function EventView({
  eventAddress,
  snapshot,
  client,
  wallet,
  signMessage,
  onChange,
}: {
  eventAddress: Address;
  snapshot: OpenSnapshot;
  client?: VeniClient;
  wallet?: Address;
  signMessage?: SignMessage;
  onChange: () => void;
}) {
  const { event, guests, now, vaultBalance } = snapshot;
  const { terms, details } = event;
  const stage = stageOf(event, now);
  const approvedGuests = guests.filter((guest) => guest.data.isApproved);
  const applicants = guests.filter((guest) => !guest.data.isApproved);
  const isHost = wallet === event.organizer;
  const unpaidCount = event.attendedCount - event.paidCount;
  const doorIsOpen = stage === "open" || stage === "running";
  // Cancelled, or nobody checked in: every guest gets their whole stake back.
  const refundsEveryone = stage === "cancelled" || stage === "refunding" || (stage === "ended" && event.attendedCount === 0);
  const cover = coverOf(event);
  const location = locationOf(event);
  const lumaLink = lumaLinkOf(event);
  const [descriptionRefresh, setDescriptionRefresh] = useState(0);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const stored = useEventDescription(eventAddress, descriptionRefresh);
  const storedText = stored.kind === "ready" ? stored.value.description || undefined : undefined;
  // The host's description, else Luma's, read live.
  const about = useLumaDescription(storedText ? undefined : lumaLink);
  const lumaText = about.kind === "ready" ? about.text : "";
  const [busy, setBusy] = useState<string>();
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();

  // The door key signs check-ins. Only the browser that created the event holds it.
  const [doorKey, setDoorKey] = useState<KeyPairSigner>();
  useEffect(() => {
    if (!isHost) return;
    findDoorKey(event.organizer, terms.doorKey).then(setDoorKey, () => setDoorKey(undefined));
  }, [isHost, event.organizer, terms.doorKey]);

  const run: Run = async (action, work) => {
    setBusy(action);
    setMessage(undefined);
    try {
      setMessage({ ok: true, text: await work() });
    } catch (error) {
      setMessage({ ok: false, text: describeError(error) });
    } finally {
      setBusy(undefined);
      onChange();
    }
  };

  /** The door: the door key signs "this guest attended", and the host's wallet sends it. */
  async function checkIn(veniClient: VeniClient, key: KeyPairSigner, guest: Guest) {
    const signed = await signCheckIn(key, eventAddress, guest.data.wallet);
    await veniClient.sendTransaction(await getCheckInInstructions(signed));
  }

  const startsAtDate = new Date(Number(terms.rsvpEndsAt) * 1000);
  const ticket = terms.ticketPrice > 0n ? formatUsdShort(terms.ticketPrice) : undefined;
  const startsAt = formatWhen(terms.rsvpEndsAt);

  return (
    <>
      <div className="event-hero">
        {cover ? (
          <>
            <CoverBanner src={cover} title={terms.title}>
              <TypeLabels ticket={ticket} approval={terms.requiresApproval} />
            </CoverBanner>
            <h1 className="app-title">{terms.title}</h1>
          </>
        ) : (
          <div className={`event-poster ${coverClassOf(eventAddress, { paid: terms.ticketPrice > 0n, approval: terms.requiresApproval })}`}>
            <h1>{terms.title}</h1>
            <TypeLabels ticket={ticket} approval={terms.requiresApproval} />
            <CityStamp city={details.city} date={stampDateOf(startsAtDate)} />
          </div>
        )}
        <span className="event-tags">
          <span className={`stage stage-${stage}`}>{STAGE_LABEL[stage]}</span>
        </span>
      </div>
      <div className="app-grid">
        <section className="app-card" aria-label="About the event">
          <HostCard event={event} />
          <ul className="detail-list">
            <li className="detail-row">
              <span className="detail-icon"><Icon path={CALENDAR} /></span>
              <div>
                <b>{startsAt}</b>
                <span>
                  {stage === "open" ? `Starts ${relativeTime(terms.rsvpEndsAt, now)}` : `Started ${relativeTime(terms.rsvpEndsAt, now)}`}
                  {doorIsOpen && ` · check-in closes ${relativeTime(terms.checkInEndsAt, now)}`}
                </span>
              </div>
            </li>
            <li className="detail-row">
              <span className="detail-icon"><Icon path={PIN} /></span>
              <div>
                <b>{details.venue}</b>
                <span>
                  {details.city}
                  {location && (
                    <>
                      {" · "}
                      <a className="map-link" href={mapsLink(location)} target="_blank" rel="noopener noreferrer">Open in Maps</a>
                    </>
                  )}
                </span>
              </div>
            </li>
            <li className="detail-row">
              <span className="detail-icon"><Icon path={PEOPLE} /></span>
              <div>
                <b>{event.guestCount} of {terms.capacity} going</b>
                <span>
                  {event.attendedCount} checked in
                  {terms.requiresApproval && ` · ${event.applicantCount} waiting for approval`}
                </span>
              </div>
            </li>
          </ul>
          {isEditingDescription && signMessage ? (
            <DescriptionEditor
              initial={storedText ?? lumaText}
              onCancel={() => setIsEditingDescription(false)}
              onSave={async (text) => {
                await saveEventDescription(signMessage, eventAddress, text);
                setIsEditingDescription(false);
                setDescriptionRefresh((count) => count + 1);
              }}
            />
          ) : (
            (storedText || lumaLink || isHost) && (
              <div className="event-about-block">
                {storedText ? (
                  <p className="event-about">{storedText}</p>
                ) : lumaLink && about.kind === "loading" ? (
                  <p className="action-note">Loading the description…</p>
                ) : lumaText ? (
                  <p className="event-about">{lumaText}</p>
                ) : (
                  isHost && <p className="action-note">No description yet.</p>
                )}
                <div className="map-row">
                  {lumaLink && (
                    <a className="map-link" href={lumaLink} target="_blank" rel="noopener noreferrer">
                      Full details on Luma <span aria-hidden="true">→</span>
                    </a>
                  )}
                  {isHost && signMessage && (
                    <button type="button" className="btn btn-white btn-sm" onClick={() => setIsEditingDescription(true)}>
                      {storedText || lumaText ? "Edit description" : "Add a description"}
                    </button>
                  )}
                </div>
              </div>
            )
          )}
          {location && <EventMap point={location} label={`Map with a pin on ${details.venue}, ${details.city}`} />}
          {refundsEveryone && (
            <p className="app-message ok">
              {event.isCancelled ? "Cancelled" : "Nobody checked in"}: every guest gets their {formatUsd(totalOf(event))} back.
            </p>
          )}
          {event.isSettled && unpaidCount > 0 && (
            <p className="app-message ok">
              Each attendee gets{" "}
              {formatUsd((vaultBalance - BigInt(event.applicantCount) * totalOf(event) - ticketRevenueOf(event)) / BigInt(unpaidCount))}.
            </p>
          )}
          <h2>Guests</h2>
          {approvedGuests.length === 0 ? (
            <p className="action-note">{terms.requiresApproval ? "Nobody is approved yet." : "Nobody has signed up yet."}</p>
          ) : (
            <ul className="members">
              {approvedGuests.map((guest) => {
                const checkedIn = guest.data.hasAttended;
                return (
                  <li key={guest.address}>
                    <WalletName wallet={guest.data.wallet} />
                    <span className="member-tags">
                      {guest.data.wallet === wallet && <span className="tag tag-you">You</span>}
                      {checkedIn ? (
                        <span className="tag tag-kept">Checked in</span>
                      ) : doorIsOpen ? (
                        <span className="tag tag-pending">Going</span>
                      ) : refundsEveryone ? (
                        <span className="tag tag-pending">Refund due</span>
                      ) : (
                        <span className="tag tag-missed">Missed</span>
                      )}
                      {isHost && client && doorKey && doorIsOpen && !checkedIn && (
                        <button
                          type="button"
                          className="btn btn-white btn-sm"
                          disabled={busy !== undefined}
                          onClick={() =>
                            run(`door-${guest.address}`, async () => {
                              await checkIn(client, doorKey, guest);
                              return `Checked in ${displayNameOf(guest.data.wallet)}.`;
                            })
                          }
                        >
                          {busy === `door-${guest.address}` ? "Checking in…" : "Check in"}
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="app-card" aria-labelledby="your-move">
          <h2 id="your-move">{isHost ? "Your event" : "Your spot"}</h2>
          {!isHost && <StakeCard event={event} />}
          {isHost && client && terms.requiresApproval && (
            <Applications
              client={client}
              eventAddress={eventAddress}
              event={event}
              applicants={applicants}
              isOpen={stage === "open"}
              busy={busy}
              run={run}
            />
          )}
          {isHost && doorIsOpen && (doorKey ? (
            <div className="field">
              <div className="actions">
                <Link className="btn btn-primary" href={`/e/${eventAddress}/door`}>
                  Open the door screen
                </Link>
              </div>
              <span className="field-hint">Put it at the entrance for guests to scan.</span>
            </div>
          ) : (
            <p className="action-note">Open the door screen from the browser you created this event in.</p>
          ))}
          {isHost && terms.ticketPrice > 0n && (
            <p className="action-note">
              {refundsEveryone ? (
                "Tickets are refunded."
              ) : (
                <>Tickets: <b>{formatUsd(BigInt(event.guestCount) * terms.ticketPrice)}</b>, paid to you {formatWhen(ticketHoldEndsAt(event))}.</>
              )}
            </p>
          )}
          {client && wallet ? (
            <>
              <GuestActions client={client} wallet={wallet} eventAddress={eventAddress} snapshot={snapshot} busy={busy} run={run} />
              {isHost && stage === "open" && (
                <CancelEvent client={client} eventAddress={eventAddress} snapshot={snapshot} busy={busy} run={run} />
              )}
            </>
          ) : (
            <p className="action-note">Sign in to save your spot.</p>
          )}
          {message && <p className={`app-message ${message.ok ? "ok" : "error"}`}>{message.text}</p>}
        </section>
      </div>
    </>
  );
}

const CALENDAR = "M3 9.5h18M8 2.5v4M16 2.5v4M6 4.5h12a3 3 0 0 1 3 3V18a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3z";
const PIN = "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z";
const PEOPLE = "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.15a3.5 3.5 0 0 1 0 6.7";

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

/** The host's review queue: each application, with the applicant's record so far. */
function Applications({
  client,
  eventAddress,
  event,
  applicants,
  isOpen,
  busy,
  run,
}: {
  client: VeniClient;
  eventAddress: Address;
  event: EventAccount;
  applicants: Guest[];
  isOpen: boolean;
  busy: string | undefined;
  run: Run;
}) {
  const isFull = event.guestCount >= event.terms.capacity;
  return (
    <div className="field">
      <div className="map-row">
        <b>Applications</b>
        <span className="action-note">{event.guestCount} of {event.terms.capacity} seats filled</span>
      </div>
      {applicants.length === 0 ? (
        <p className="action-note">{isOpen ? "No applications waiting." : "Applications are closed."}</p>
      ) : (
        <ul className="members">
          {applicants.map((applicant) => (
            <li key={applicant.address} className="applicant">
              <ApplicantRecord wallet={applicant.data.wallet} />
              {isOpen && (
                <span className="member-tags">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={busy !== undefined || isFull}
                    onClick={() =>
                      run(`approve-${applicant.address}`, async () => {
                        await client.veni.instructions
                          .approveApplication({ organizer: client.identity, event: eventAddress, guest: applicant.address })
                          .sendTransaction();
                        return `Approved ${displayNameOf(applicant.data.wallet)}.`;
                      })
                    }
                  >
                    {busy === `approve-${applicant.address}` ? "Approving…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-white btn-sm"
                    disabled={busy !== undefined}
                    onClick={() =>
                      run(`decline-${applicant.address}`, async () => {
                        await client.veni.instructions
                          .removeApplication({
                            remover: client.identity,
                            event: eventAddress,
                            wallet: applicant.data.wallet,
                            stakeMint: event.stakeMint,
                          })
                          .sendTransaction();
                        return `Declined ${displayNameOf(applicant.data.wallet)}. Their stake is back with them.`;
                      })
                    }
                  >
                    {busy === `decline-${applicant.address}` ? "Declining…" : "Decline"}
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {isOpen && isFull && applicants.length > 0 && (
        <span className="field-hint">All seats taken.</span>
      )}
      {!isOpen && applicants.length > 0 && <span className="field-hint">Sign-ups have closed. These stakes go back.</span>}
    </div>
  );
}

/** An applicant's record so far: how many Veni events they've checked in to. */
function ApplicantRecord({ wallet }: { wallet: Address }) {
  const past = usePastEventsAttendedBy(wallet);
  const attended = past.kind === "ready" ? past.value.attended.length : undefined;
  return (
    <span className="applicant-who">
      <WalletName wallet={wallet} />
      <span className={attended ? "turnout" : "action-note"}>
        {attended === undefined ? "…" : attended === 0 ? "First event on Veni" : `${attended} ${attended === 1 ? "event" : "events"} attended`}
      </span>
    </span>
  );
}

/** The host writes or edits the description. Their wallet signs it, so nobody else can. */
function DescriptionEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (text: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial);
  const [status, setStatus] = useState<{ busy?: boolean; error?: string }>({});

  async function save(event: FormEvent) {
    event.preventDefault();
    setStatus({ busy: true });
    try {
      await onSave(text.trim());
    } catch (error) {
      setStatus({ error: describeError(error) });
    }
  }

  return (
    <form className="field" onSubmit={save}>
      <label htmlFor="description">Description</label>
      <textarea id="description" rows={8} maxLength={DESCRIPTION_LIMIT} value={text} onChange={(event) => setText(event.target.value)} />
      <div className="actions">
        <button type="submit" className="btn btn-primary btn-sm" disabled={status.busy}>
          {status.busy ? "Sign in your wallet…" : "Save description"}
        </button>
        <button type="button" className="btn btn-white btn-sm" onClick={onCancel} disabled={status.busy}>
          Cancel
        </button>
      </div>
      {status.error && <p className="app-message error">{status.error}</p>}
    </form>
  );
}

/** The cost to sign up and both outcomes, shown before paying. */
function StakeCard({ event }: { event: EventAccount }) {
  const stake = formatUsdShort(event.terms.stakeAmount);
  const isPaid = event.terms.ticketPrice > 0n;
  const isApplication = event.terms.requiresApproval;
  const verb = isApplication ? "apply" : "sign up";
  return (
    <div className="stake-card">
      <div className="stake-line">
        <b>{isPaid ? `To ${verb}` : `Stake to ${verb}`}</b>
        <span className="stake-amount">
          {formatUsdShort(totalOf(event))} <small className="fee-note">{tokenLabel(event.stakeMint)}</small>
        </span>
      </div>
      {isPaid && (
        <p className="fee-note">
          {formatUsdShort(event.terms.ticketPrice)} ticket + {stake} stake
        </p>
      )}
      <div className="outcomes">
        <p className="outcome outcome-come"><b>You come</b>{stake} back + a share of no-shows</p>
        <p className="outcome outcome-miss"><b>You don&apos;t</b>{stake} goes to those who came</p>
        {isApplication && <p className="outcome outcome-wait"><b>Not picked</b>{formatUsdShort(totalOf(event))} back</p>}
      </div>
      <p className="fee-note">Veni keeps 10% of no-show stakes{isPaid ? ", and nothing from tickets" : ""}.</p>
    </div>
  );
}

/** Stake plus ticket. */
function totalOf(event: EventAccount) {
  return event.terms.stakeAmount + event.terms.ticketPrice;
}

function GuestActions({
  client,
  wallet,
  eventAddress,
  snapshot,
  busy,
  run,
}: {
  client: VeniClient;
  wallet: Address;
  eventAddress: Address;
  snapshot: OpenSnapshot;
  busy: string | undefined;
  run: Run;
}) {
  const { event, guests, now } = snapshot;
  const { terms } = event;
  const stage = stageOf(event, now);
  const me = guests.find((guest) => guest.data.wallet === wallet);
  const total = formatUsd(totalOf(event));
  const isPaid = terms.ticketPrice > 0n;
  const [balance, setBalance] = useState<bigint>();
  const [fundedAt, setFundedAt] = useState(0);

  useEffect(() => {
    tokenBalance(wallet, event.stakeMint).then(setBalance, () => setBalance(undefined));
  }, [wallet, event.stakeMint, snapshot, fundedAt]);

  const isHost = wallet === event.organizer;
  // At an event that requires approval, signing up is applying.
  const isApplying = terms.requiresApproval;
  const myApplication = me && !me.data.isApproved ? me : undefined;
  const myGuest = me?.data.isApproved ? me : undefined;
  const canSignUp = stage === "open" && !isHost && !me && event.guestCount < terms.capacity;
  const isFull = stage === "open" && !isHost && !me && event.guestCount >= terms.capacity;
  const isGoing = (stage === "open" || stage === "running") && myGuest && !myGuest.data.hasAttended;
  const refundsEveryone = stage === "cancelled" || stage === "refunding" || (stage === "ended" && event.attendedCount === 0);
  const missed = (stage === "ended" || stage === "settled") && !refundsEveryone && myGuest && !myGuest.data.hasAttended;
  const notEnough = balance !== undefined && balance < totalOf(event);
  // Applications nobody approved are refunded as soon as sign-ups close.
  const applicationsDue = stage !== "open" && event.applicantCount > 0;
  const paymentsDue = applicationsDue || stage === "ended" || stage === "settled" || stage === "cancelled" || stage === "refunding";
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);
  const signUpLabel = `${isPaid ? "Pay" : "Stake"} ${formatUsdShort(totalOf(event))} and ${isApplying ? "apply" : "sign up"}`;

  function signUp() {
    run("signUp", async () => {
      await client.veni.instructions
        .signUp({ wallet: client.identity, event: eventAddress, stakeMint: event.stakeMint })
        .sendTransaction();
      return isApplying ? "Applied." : "You're going.";
    });
  }

  return (
    <div className="app-form">
      <p className="action-note">
        You have <b>{balance === undefined ? "…" : formatUsd(balance)}</b> {tokenLabel(event.stakeMint)}
      </p>

      {canSignUp && (
        <div className="field">
          <HostCaution event={event} />
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy !== undefined || notEnough}
            onClick={() => (hasDismissedStakeNotice() ? signUp() : setIsNoticeOpen(true))}
          >
            {busy === "signUp" ? (isPaid ? "Paying…" : "Staking…") : signUpLabel}
          </button>
          <StakeNotice
            open={isNoticeOpen}
            stake={formatUsdShort(terms.stakeAmount)}
            ticket={isPaid ? formatUsdShort(terms.ticketPrice) : undefined}
            isApplying={isApplying}
            confirmLabel={signUpLabel}
            onConfirm={() => {
              setIsNoticeOpen(false);
              signUp();
            }}
            onCancel={() => setIsNoticeOpen(false)}
          />
          {notEnough &&
            (event.stakeMint === TEST_USD_MINT ? (
              <TestFundsButton wallet={wallet} onFunded={() => setFundedAt(Date.now())} />
            ) : (
              <span className="field-hint">Not enough {tokenLabel(event.stakeMint)}.</span>
            ))}
        </div>
      )}

      {isFull && <p className="action-note">This event is full.</p>}

      {myApplication && stage === "open" && (
        <div className="field">
          <p className="waiting-note">
            <b>Waiting for the host.</b> Not picked? Your {total} comes back.
          </p>
          <div className="actions">
            <button
              type="button"
              className="btn btn-white btn-sm"
              disabled={busy !== undefined}
              onClick={() =>
                run("withdraw", async () => {
                  await client.veni.instructions
                    .removeApplication({ remover: client.identity, event: eventAddress, wallet, stakeMint: event.stakeMint })
                    .sendTransaction();
                  return "Withdrawn.";
                })
              }
            >
              {busy === "withdraw" ? "Withdrawing…" : "Withdraw my application"}
            </button>
          </div>
        </div>
      )}

      {myApplication && stage !== "open" && (
        <p className="app-message ok">Not picked. Your {total} is on its way back.</p>
      )}

      {isGoing && (
        <>
          <p className="ticket-note">
            <b>You&apos;re going.</b> At the door, scan the code to check in.
          </p>
          <DoorCheckIn client={client} eventAddress={eventAddress} event={event} busy={busy} run={run} />
        </>
      )}

      {myGuest?.data.hasAttended && !refundsEveryone && (
        <p className="app-message ok">
          You&apos;re checked in. Your stake comes back after the event.
        </p>
      )}

      {missed && <p className="app-message error">You missed it. Your stake goes to those who came.</p>}

      {myGuest && refundsEveryone && (
        <p className="app-message ok">
          {event.isCancelled ? "Cancelled" : "Nobody checked in"}. Your {total} comes back.
        </p>
      )}

      {paymentsDue && (
        <div className="field">
          <button
            type="button"
            className="btn btn-blue"
            disabled={busy !== undefined}
            onClick={() =>
              // Archive first: closing deletes the accounts.
              run("move", async () =>
                describeReport(await crankEvent(client, eventAddress, { archive: archiveThrough("/api/archive") })),
              )
            }
          >
            {busy === "move" ? "Sending…" : refundsEveryone || !(stage === "ended" || stage === "settled") ? "Send the refunds now" : "Send the payouts now"}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The guest scans the door code and checks in with their own wallet. The
 * program enforces it; these checks only give clearer messages.
 */
function DoorCheckIn({
  client,
  eventAddress,
  event,
  busy,
  run,
}: {
  client: VeniClient;
  eventAddress: Address;
  event: EventAccount;
  busy: string | undefined;
  run: Run;
}) {
  const [isScanning, setIsScanning] = useState(false);

  function checkInWith(text: string) {
    setIsScanning(false);
    run("check-in-code", async () => {
      const checkInCode = decodeCheckInCode(text);
      if (checkInCode.event !== eventAddress) {
        throw new Error("That code is for another event. Scan the code at this event's door.");
      }
      if (checkInCode.signer !== event.terms.doorKey && checkInCode.signer !== event.organizer) {
        throw new Error("That code wasn't made by this event's door. Scan the code on the door screen.");
      }
      await client.sendTransaction(await getCheckInWithCodeInstructions(checkInCode, client.identity));
      return `Checked in with code #${checkInCode.code}.`;
    });
  }

  if (isScanning) return <DoorScanner onRead={checkInWith} onCancel={() => setIsScanning(false)} />;
  return (
    <button type="button" className="btn btn-primary" disabled={busy !== undefined} onClick={() => setIsScanning(true)}>
      {busy === "check-in-code" ? "Checking in…" : "Scan the check-in code"}
    </button>
  );
}

/** Cancels while sign-ups are open: every guest is refunded. */
function CancelEvent({
  client,
  eventAddress,
  snapshot,
  busy,
  run,
}: {
  client: VeniClient;
  eventAddress: Address;
  snapshot: OpenSnapshot;
  busy: string | undefined;
  run: Run;
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const { event } = snapshot;
  const refund = `${formatUsd(totalOf(event))} ${tokenLabel(event.stakeMint)}`;

  if (!isConfirming) {
    return (
      <div className="actions">
        <button type="button" className="btn btn-white btn-sm" disabled={busy !== undefined} onClick={() => setIsConfirming(true)}>
          Cancel the event
        </button>
      </div>
    );
  }
  return (
    <div className="field" role="group" aria-labelledby="cancel-question">
      <p id="cancel-question" className="action-note">
        Cancel the event?{event.guestCount > 0 && ` All ${event.guestCount} guests get their ${refund} back.`}
      </p>
      <div className="actions">
        <button
          type="button"
          className="btn btn-white btn-sm"
          disabled={busy !== undefined}
          onClick={() =>
            run("cancel", async () => {
              await client.veni.instructions.cancelEvent({ organizer: client.identity, event: eventAddress }).sendTransaction();
              setIsConfirming(false);
              return "Cancelled. Everyone gets their stake back.";
            })
          }
        >
          {busy === "cancel" ? "Cancelling…" : "Yes, cancel and refund"}
        </button>
        <button type="button" className="btn btn-white btn-sm" disabled={busy !== undefined} onClick={() => setIsConfirming(false)}>
          Keep the event
        </button>
      </div>
    </div>
  );
}

/** A chain time, in seconds, as the viewer's local day and time: "Sat, 10 Oct, 23:14". */
function formatWhen(seconds: bigint) {
  return new Date(Number(seconds) * 1000).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function describeReport(report: CrankReport) {
  if (report.errors.length > 0) throw new Error(report.errors.join(" · "));
  const waiting = report.waiting.length > 0 ? ` Still waiting: ${report.waiting.join(" · ")}` : "";
  if (report.guestsClosed > 0) {
    return `Sent to ${report.guestsClosed} guest${report.guestsClosed === 1 ? "" : "s"}.${report.eventsClosed > 0 ? " The event is closed." : ""}${waiting}`;
  }
  if (report.eventsClosed > 0) return `The event is closed.${waiting}`;
  if (report.settled > 0) return `The event is settled. Payouts go out next.${waiting}`;
  return `Nothing to send yet.${waiting}`;
}

type LumaDescription = { kind: "loading" } | { kind: "ready"; text: string } | { kind: "unavailable" };

/** The event's Luma description, read through our server. */
function useLumaDescription(lumaLink: string | undefined): LumaDescription {
  const [state, setState] = useState<{ link?: string; about: LumaDescription }>({ about: { kind: "loading" } });
  useEffect(() => {
    if (!lumaLink) return;
    let isCurrent = true;
    fetch("/api/luma", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: lumaLink }),
    })
      .then((response) => response.json() as Promise<{ event?: LumaEvent }>)
      .then((body) => {
        if (isCurrent) setState({ link: lumaLink, about: body.event ? { kind: "ready", text: body.event.description } : { kind: "unavailable" } });
      })
      .catch(() => {
        if (isCurrent) setState({ link: lumaLink, about: { kind: "unavailable" } });
      });
    return () => {
      isCurrent = false;
    };
  }, [lumaLink]);
  return state.link === lumaLink ? state.about : { kind: "loading" };
}

/** Who hosts it, and how their guests have turned up, on the navy cover. */
function HostCard({ event }: { event: EventAccount }) {
  const host = useHostPage(event.organizer);
  const { hostName } = event.details;
  let record = "";
  if (host.kind === "ready") {
    const { profile, record: past } = host.value;
    const turnout = turnoutPercent(past.attendedCount, past.guestCount);
    record = !profile
      ? "Not registered on Veni yet"
      : past.eventCount === 0
        ? "Registered host · first event on Veni"
        : `${past.eventCount} ${past.eventCount === 1 ? "event" : "events"} hosted${turnout ? ` · ${turnout} of guests show up` : ""}`;
  }
  return (
    <Link className="host-card" href={`/h/${event.organizer}`}>
      <span className="passport-face" aria-hidden="true">{initialsOf(hostName)}</span>
      <span>
        <span className="host-card-name">{hostName}</span>
        <span className="host-card-record">{record || "\u00a0"}</span>
      </span>
    </Link>
  );
}

/** Before staking with a host nobody knows yet: say so. */
function HostCaution({ event }: { event: EventAccount }) {
  const host = useHostPage(event.organizer);
  if (host.kind !== "ready" || host.value.profile || isVerifiedOrganizer(event.organizer)) return null;
  return (
    <p className="caution-note">
      <b>New host on Veni.</b> Only stake if you trust them.
    </p>
  );
}
