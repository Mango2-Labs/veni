"use client";

import { use, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSelectedWalletAccount, useSignMessage } from "@solana/react";
import type { UiWalletAccount } from "@wallet-standard/react";
import type { Address } from "@solana/kit";
import { TEST_USD_MINT } from "@veni/client";
import {
  accountExists,
  chainTime,
  describeError,
  EVENT_CATEGORIES,
  type EventCategory,
  getCreateOwnTokenAccountInstruction,
  tokenAccountOf,
} from "@veni/sdk";
import { AppHeader } from "@/components/AppHeader";
import { CoverBanner } from "@/components/EventCover";
import { EventMap } from "@/components/EventMap";
import { PlaceSearch } from "@/components/PlaceSearch";
import { saveEventCategory, saveEventDescription } from "@/lib/description-client";
import { doorKeyFor } from "@/lib/door-key";
import { DESCRIPTION_LIMIT } from "@/lib/event-description";
import { useHostPage } from "@/lib/archive-client";
import { checkEventForm, EVENT_LIMITS, fitBytes, isLumaSlug } from "@/lib/events";
import { lumaPageUrl, type LumaEvent } from "@/lib/luma";
import { toGeoPoint, type MapPoint, type Place } from "@/lib/places";
import { veniReader, STAKE_TOKENS, useVeniClient } from "@/lib/veni";

/** Examples to start from. Veni works in any city with a community. */
const EXAMPLES = [
  { title: "Builders Night", host: "Lisbon Builders Club", city: "Lisbon", venue: "LX Factory", point: { latitude: 38.7026, longitude: -9.17866 } },
  { title: "Rust and Anchor night", host: "Lagos Devs", city: "Lagos", venue: "Yaba tech hub", point: { latitude: 6.51873, longitude: 3.37414 } },
  { title: "Mobile builders dinner", host: "Seoul Builders", city: "Seoul", venue: "Seongsu-dong studio", point: { latitude: 37.54446, longitude: 127.0559 } },
  { title: "Validators and pizza", host: "NYC Solana Builders", city: "New York", venue: "Brooklyn Navy Yard", point: { latitude: 40.69933, longitude: -73.97556 } },
  { title: "DeFi study group", host: "São Paulo Builders", city: "São Paulo", venue: "Vila Madalena café", point: { latitude: -23.5465, longitude: -46.69112 } },
  { title: "Hacker house demo day", host: "Jakarta Builders", city: "Jakarta", venue: "SCBD coworking", point: { latitude: -6.2246, longitude: 106.8097 } },
];

/** An example's text fields, which the form edits apart from its pin. */
function detailsOf({ title, host, city, venue }: (typeof EXAMPLES)[number]) {
  return { title, host, city, venue };
}

export default function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [account] = useSelectedWalletAccount();
  // A Luma link from the landing page (?luma=) imports once a wallet connects.
  const lumaParam = use(searchParams).luma;
  const lumaLink = (Array.isArray(lumaParam) ? lumaParam[0] : lumaParam)?.trim() || undefined;
  return (
    <>
      <AppHeader />
      <main className="app-main">
        <div className="wrap">
          <div className="app-head">
            <h1 className="app-title">Host an event</h1>
          </div>
          {account ? (
            <CreateEventForm account={account} lumaLink={lumaLink} />
          ) : (
            <div className="app-card">
              <p>Sign in to host an event.</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

/** A paid event's max stake: $5. */
const MAX_PAID_EVENT_STAKE = 5_000_000n;

function CreateEventForm({ account, lumaLink }: { account: UiWalletAccount; lumaLink?: string }) {
  const client = useVeniClient(account);
  const router = useRouter();
  const [example, setExample] = useState(0);
  const [details, setDetails] = useState(detailsOf(EXAMPLES[0]));
  const [point, setPoint] = useState<MapPoint | undefined>(EXAMPLES[0].point);
  const [cover, setCover] = useState<string>();
  const [stakeMint, setStakeMint] = useState<Address>(TEST_USD_MINT);
  const [stake, setStake] = useState("10");
  const [capacity, setCapacity] = useState("60");
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [category, setCategory] = useState<EventCategory>("Meetup");
  const [isPaid, setIsPaid] = useState(false);
  const [ticketPrice, setTicketPrice] = useState("25");
  // "dates": the real start and end; "demo": starts in a few minutes, to try Veni now.
  const [timing, setTiming] = useState<"dates" | "demo">("demo");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [startMinutes, setStartMinutes] = useState("3");
  const [checkInMinutes, setCheckInMinutes] = useState("5");
  // The imported Luma event's page, linked from the event page.
  const [lumaSlug, setLumaSlug] = useState("");
  // Saved off-chain once the event exists, signed by the host's wallet.
  const [description, setDescription] = useState("");
  const signMessage = useSignMessage(account);
  const [pinIsApproximate, setPinIsApproximate] = useState(false);
  const [status, setStatus] = useState<{ busy?: string; error?: string }>({});

  const set = (field: keyof typeof details) => (event: { target: { value: string } }) =>
    setDetails((current) => ({ ...current, [field]: event.target.value }));

  function nextExample() {
    const next = (example + 1) % EXAMPLES.length;
    setExample(next);
    setDetails(detailsOf(EXAMPLES[next]));
    setPoint(EXAMPLES[next].point);
    setPinIsApproximate(false);
    setCover(undefined);
    setLumaSlug("");
    setDescription("");
  }

  /** The host placed the pin, so it's no longer Luma's guess. */
  function movePin(next: MapPoint) {
    setPoint(next);
    setPinIsApproximate(false);
  }

  /** A searched place fills in the venue and city, and moves the pin. */
  function pickPlace(place: Place) {
    setDetails((current) => ({
      ...current,
      venue: fitBytes(place.name, EVENT_LIMITS.venue),
      city: place.city ? fitBytes(place.city, EVENT_LIMITS.city) : current.city,
    }));
    movePin({ latitude: place.latitude, longitude: place.longitude });
  }

  function fillFromLuma(event: LumaEvent) {
    const { title, host, city, venue } = event;
    setDetails({ title, host, city, venue });
    setPoint(event.location);
    setPinIsApproximate(event.locationIsApproximate);
    setCover(event.cover);
    setLumaSlug(event.lumaSlug);
    setDescription(event.description);
    // Luma's dates if the event is ahead; otherwise the quick demo times.
    const start = event.startsAt ? localInputOf(event.startsAt) : undefined;
    const end = event.endsAt ? localInputOf(event.endsAt) : undefined;
    if (start && end && Date.parse(event.startsAt!) > Date.now()) {
      setStartsAt(start);
      setEndsAt(end);
      setTiming("dates");
    }
    // Focus the first field Luma left empty.
    const empty = (["title", "host", "city", "venue"] as const).find((field) => !event[field]);
    if (empty) requestAnimationFrame(() => document.getElementById(empty)?.focus());
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      const form = {
        title: details.title.trim(),
        host: details.host.trim(),
        city: details.city.trim(),
        venue: details.venue.trim(),
      };
      checkEventForm(form);
      const stakeAmount = BigInt(Math.round(Number(stake) * 1e6));
      const ticketPriceAmount = isPaid ? BigInt(Math.round(Number(ticketPrice) * 1e6)) : 0n;
      if (isPaid && ticketPriceAmount <= 0n) throw new Error("Add the ticket price.");
      if (isPaid && stakeAmount > MAX_PAID_EVENT_STAKE) throw new Error("A paid event's stake can be at most $5.");

      // Times use the chain's clock, as the program does. Sign-ups close at the
      // start; check-in stays open until the end.
      const now = await chainTime(veniReader);
      let rsvpEndsAt: bigint;
      let checkInEndsAt: bigint;
      if (timing === "dates") {
        const start = secondsOfLocalInput(startsAt);
        const end = secondsOfLocalInput(endsAt);
        if (start === undefined || end === undefined) throw new Error("Add when the event starts and ends.");
        if (end <= start) throw new Error("The event has to end after it starts.");
        if (start <= now + 60n) {
          throw new Error("That start time has passed. Pick a later one.");
        }
        rsvpEndsAt = start;
        checkInEndsAt = end;
      } else {
        rsvpEndsAt = now + BigInt(Math.round(Number(startMinutes) * 60));
        checkInEndsAt = rsvpEndsAt + BigInt(Math.round(Number(checkInMinutes) * 60));
      }
      const doorKey = await doorKeyFor(client.identity.address);

      setStatus({ busy: "Confirm in your wallet…" });
      const eventId = BigInt(Date.now());
      const [eventAddress] = await client.veni.pdas.event({ organizer: client.identity.address, eventId });
      // Ticket money is paid into the host's own token account.
      if (isPaid && !(await accountExists(veniReader, await tokenAccountOf(client.identity.address, stakeMint)))) {
        await client.sendTransaction([await getCreateOwnTokenAccountInstruction(client.identity, stakeMint)]);
      }
      const createEvent = await client.veni.instructions.createEvent({
        organizer: client.identity,
        stakeMint,
        eventId,
        terms: {
          stakeAmount,
          ticketPrice: ticketPriceAmount,
          rsvpEndsAt,
          checkInEndsAt,
          capacity: Number(capacity),
          requiresApproval,
          doorKey: doorKey.address,
          title: form.title,
        },
        details: {
          hostName: form.host,
          city: form.city,
          venue: form.venue,
          cover: cover ?? "",
          lumaSlug: isLumaSlug(lumaSlug) ? lumaSlug : "",
          location: point ? toGeoPoint(point) : null,
        },
      });
      // Hosts don't stake; the program refuses the organizer's sign-up.
      await client.sendTransaction([createEvent]);
      const text = description.trim();
      if (text) {
        setStatus({ busy: "Sign to save the description…" });
        // The event exists either way. If this fails, the host adds it from the event page.
        await saveEventDescription(signMessage, eventAddress, text).catch(() => undefined);
      }
      setStatus({ busy: "Sign to save the category…" });
      // As with the description, the event exists either way.
      await saveEventCategory(signMessage, eventAddress, category).catch(() => undefined);
      router.push(`/e/${eventAddress}`);
    } catch (error) {
      setStatus({ error: describeError(error) });
    }
  }

  return (
    <>
      <RegisterPrompt wallet={account.address} />
      <LumaImportForm onImport={fillFromLuma} initialLink={lumaLink} />
      <form className="app-card app-form" onSubmit={onSubmit}>
        {cover && (
          <div className="cover-preview">
            <CoverBanner src={cover} title={details.title} />
            <div className="actions">
              <button type="button" className="btn btn-white btn-sm" onClick={() => setCover(undefined)}>
                Remove cover
              </button>
            </div>
          </div>
        )}
        <div className="field-row">
          <div className="field">
            <label htmlFor="title">Event name</label>
            <input id="title" value={details.title} onChange={set("title")} maxLength={EVENT_LIMITS.title} required />
          </div>
          <div className="field">
            <label htmlFor="host">Hosted by</label>
            <input id="host" value={details.host} onChange={set("host")} maxLength={EVENT_LIMITS.host} required />
          </div>
        </div>
        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            rows={6}
            maxLength={DESCRIPTION_LIMIT}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What happens, who it's for, what to bring."
          />
        </div>
        {lumaSlug && (
          <div className="map-row">
            <span className="field-hint">
              Linked to{" "}
              <a href={`https://luma.com/${lumaSlug}`} target="_blank" rel="noopener noreferrer">
                luma.com/{lumaSlug}
              </a>
            </span>
            <button type="button" className="btn btn-white btn-sm" onClick={() => setLumaSlug("")}>
              Unlink Luma
            </button>
          </div>
        )}
        <div className="field">
          <label htmlFor="place">Location</label>
          <PlaceSearch id="place" onPick={pickPlace} />
        </div>
        {point && (
          <div className="field">
            <EventMap
              point={point}
              label={`Map with a pin on ${details.venue || "the venue"}. Drag the pin or click the map to move it.`}
              onMove={movePin}
            />
            <div className="map-row">
              <span className="field-hint">
                {pinIsApproximate ? "Approximate pin. Drag it to the entrance." : "Drag the pin to the entrance."}
              </span>
              <button type="button" className="btn btn-white btn-sm" onClick={() => setPoint(undefined)}>
                Remove map
              </button>
            </div>
          </div>
        )}
        <div className="field-row">
          <div className="field">
            <label htmlFor="city">City</label>
            <input id="city" value={details.city} onChange={set("city")} maxLength={EVENT_LIMITS.city} required />
          </div>
          <div className="field">
            <label htmlFor="venue">Venue</label>
            <input id="venue" value={details.venue} onChange={set("venue")} maxLength={EVENT_LIMITS.venue} required />
          </div>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-white btn-sm" onClick={nextExample}>
            Try another city
          </button>
        </div>
        <fieldset className="field choice-group">
          <legend className="field-label">Category</legend>
          <div className="choice-cards">
            {EVENT_CATEGORIES.map((name) => (
              <label key={name} className="choice-card">
                <input type="radio" name="category" checked={category === name} onChange={() => setCategory(name)} />
                <b>{name}</b>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="field choice-group">
          <legend className="field-label">Who can come</legend>
          <div className="choice-cards">
            <label className="choice-card">
              <input type="radio" name="access" checked={!requiresApproval} onChange={() => setRequiresApproval(false)} />
              <b>Anyone</b>
            </label>
            <label className="choice-card">
              <input type="radio" name="access" checked={requiresApproval} onChange={() => setRequiresApproval(true)} />
              <b>Guests you approve</b>
            </label>
          </div>
        </fieldset>
        <fieldset className="field choice-group">
          <legend className="field-label">Ticket</legend>
          <div className="choice-cards">
            <label className="choice-card">
              <input type="radio" name="ticket" checked={!isPaid} onChange={() => setIsPaid(false)} />
              <b>Free</b>
            </label>
            <label className="choice-card">
              <input
                type="radio"
                name="ticket"
                checked={isPaid}
                onChange={() => {
                  setIsPaid(true);
                  if (Number(stake) > 5) setStake("5");
                }}
              />
              <b>Paid</b>
            </label>
          </div>
        </fieldset>
        <div className="field-row">
          {isPaid && (
            <div className="field">
              <label htmlFor="ticket-price">Ticket price ($)</label>
              <input id="ticket-price" type="number" min="0.01" max="1000" step="0.01" value={ticketPrice} onChange={(event) => setTicketPrice(event.target.value)} required />
              <span className="field-hint">Paid to you 24 hours after the event.</span>
            </div>
          )}
          <div className="field">
            <label htmlFor="stake">Stake per guest ($)</label>
            <input id="stake" type="number" min="0.01" max={isPaid ? 5 : 100} step="0.01" value={stake} onChange={(event) => setStake(event.target.value)} required />
            {isPaid && <span className="field-hint">At most $5.</span>}
          </div>
          <div className="field">
            <label htmlFor="token">Paid in</label>
            <select id="token" value={stakeMint} onChange={(event) => setStakeMint(event.target.value as Address)}>
              {STAKE_TOKENS.map((token) => (
                <option key={token.mint} value={token.mint}>{token.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="capacity">Capacity</label>
            <input id="capacity" type="number" min="1" max="65535" value={capacity} onChange={(event) => setCapacity(event.target.value)} required />
          </div>
        </div>
        <fieldset className="field choice-group">
          <legend className="field-label">When</legend>
          <label className="check-row">
            <input type="radio" name="timing" value="dates" checked={timing === "dates"} onChange={() => setTiming("dates")} />
            <span>Event dates</span>
          </label>
          <label className="check-row">
            <input type="radio" name="timing" value="demo" checked={timing === "demo"} onChange={() => setTiming("demo")} />
            <span>Start in a few minutes</span>
          </label>
        </fieldset>
        {timing === "dates" ? (
          <div className="field-row">
            <div className="field">
              <label htmlFor="starts-at">Starts</label>
              <input id="starts-at" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required />
              <span className="field-hint">Sign-ups close at the start.</span>
            </div>
            <div className="field">
              <label htmlFor="ends-at">Ends</label>
              <input id="ends-at" type="datetime-local" value={endsAt} min={startsAt || undefined} onChange={(event) => setEndsAt(event.target.value)} required />
              <span className="field-hint">Check-in closes at the end.</span>
            </div>
          </div>
        ) : (
          <div className="field-row">
            <div className="field">
              <label htmlFor="start-minutes">Starts in (minutes)</label>
              <input id="start-minutes" type="number" min="1" step="0.5" value={startMinutes} onChange={(event) => setStartMinutes(event.target.value)} required />
              <span className="field-hint">Sign-ups close at the start.</span>
            </div>
            <div className="field">
              <label htmlFor="check-in-minutes">Check-in open for (minutes)</label>
              <input id="check-in-minutes" type="number" min="1" step="0.5" value={checkInMinutes} onChange={(event) => setCheckInMinutes(event.target.value)} required />
            </div>
          </div>
        )}
        {status.error && <p className="app-message error">{status.error}</p>}
        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={status.busy !== undefined}>
            {status.busy ?? "Create event"}
          </button>
        </div>
      </form>
    </>
  );
}

/** Fills the form from an event the host already runs on Luma. */
function LumaImportForm({ onImport, initialLink }: { onImport: (event: LumaEvent) => void; initialLink?: string }) {
  const [link, setLink] = useState(initialLink ?? "");
  const [status, setStatus] = useState<{ busy?: boolean; error?: string; note?: string }>({});
  const hasAutoImported = useRef(false);

  async function importLink(value: string) {
    try {
      const url = lumaPageUrl(value);
      setStatus({ busy: true });
      const response = await fetch("/api/luma", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const body = (await response.json().catch(() => ({}))) as { event?: LumaEvent; error?: string };
      if (!body.event) throw new Error(body.error ?? `Couldn't read that Luma page (error ${response.status}).`);
      onImport(body.event);
      setStatus({ note: describeImport(body.event) });
    } catch (error) {
      setStatus({ error: describeError(error) });
    }
  }

  // A link in the URL (/new?luma=…) imports straight away, once.
  useEffect(() => {
    if (!initialLink || hasAutoImported.current) return;
    hasAutoImported.current = true;
    void importLink(initialLink);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once for the link the page opened with
  }, [initialLink]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await importLink(link);
  }

  return (
    <form className="app-card app-form" onSubmit={onSubmit} aria-busy={status.busy}>
      <div className="field">
        <label htmlFor="luma-link">Luma event link</label>
        <div className="field-inline">
          <input
            id="luma-link"
            type="text"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="luma.com/abc123"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            aria-invalid={status.error ? true : undefined}
            aria-describedby={status.error ? "luma-error" : "luma-hint"}
            required
          />
          <button type="submit" className="btn btn-white btn-sm" disabled={status.busy}>
            {status.busy ? "Reading Luma…" : "Import"}
          </button>
        </div>
        <span id="luma-hint" className="field-hint">
          Already on Luma? Import it to fill in the details.
        </span>
      </div>
      {status.error && <p id="luma-error" className="app-message error" role="alert">{status.error}</p>}
      {status.note && <p className="app-message ok" role="status">{status.note}</p>}
    </form>
  );
}

/** What's left to fill in after an import. */
function describeImport(event: LumaEvent) {
  const notes = ["Imported."];
  const isAhead = event.startsAt !== undefined && Date.parse(event.startsAt) > Date.now();
  if (event.startsAt && !(isAhead && event.endsAt)) notes.push("Pick new times.");
  if (event.isOnline) notes.push("Add where people meet.");
  else if (!event.location) notes.push("Search for the venue.");
  // Online events have no city or venue; the note above asks for them.
  const fields: ("title" | "host" | "city" | "venue")[] = event.isOnline ? ["title", "host"] : ["title", "host", "city", "venue"];
  const missing = fields.filter((field) => !event[field]).map((field) => (field === "title" ? "name" : field));
  if (missing.length > 0) {
    const list = missing.length > 1 ? `${missing.slice(0, -1).join(", ")} and ${missing.at(-1)}` : missing[0];
    notes.push(`Add the ${list}.`);
  }
  return notes.join(" ");
}

/** An ISO time as "2026-11-02T10:00" in this browser's time zone, for a datetime-local input. */
function localInputOf(iso: string) {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return undefined;
  const offsetMs = new Date(time).getTimezoneOffset() * 60_000;
  return new Date(time - offsetMs).toISOString().slice(0, 16);
}

/** A datetime-local value, read in this browser's time zone, as Unix seconds. */
function secondsOfLocalInput(value: string) {
  // A date and time with no offset parses as local time.
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(time) ? undefined : BigInt(Math.floor(time / 1000));
}

/** Asks unregistered hosts to register, so guests know who they are. */
function RegisterPrompt({ wallet }: { wallet: string }) {
  const host = useHostPage(wallet);
  if (host.kind !== "ready" || host.value.profile) return null;
  return (
    <p className="ticket-note">
      <Link href="/host">Register as a host</Link> so guests see your name and record.
    </p>
  );
}
