"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { OPENSTREETMAP_COPYRIGHT, searchPlaces, type Place } from "@/lib/places";

const MIN_QUERY_LENGTH = 3;

/** Search for a venue or address, then pick a result. */
export function PlaceSearch({ id, onPick }: { id: string; onPick: (place: Place) => void }) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [active, setActive] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [status, setStatus] = useState<string>();
  const search = useRef<AbortController>(undefined);

  // Stop a search still running when the form goes away.
  useEffect(() => () => search.current?.abort(), []);

  async function runSearch() {
    const text = query.trim();
    if (text.length < MIN_QUERY_LENGTH) {
      setStatus("Type at least 3 letters.");
      return;
    }
    search.current?.abort();
    const controller = new AbortController();
    search.current = controller;
    setIsSearching(true);
    setStatus("Searching…");
    try {
      const found = await searchPlaces(text, { signal: controller.signal, language: navigator.language });
      setPlaces(found);
      setActive(found.length > 0 ? 0 : -1);
      setIsOpen(true);
      setStatus(found.length === 0 ? "No match. Try the street address." : undefined);
    } catch (error) {
      if (controller.signal.aborted) return;
      setPlaces([]);
      setStatus(error instanceof Error ? error.message : "Place search failed. Type the city and venue below.");
    } finally {
      if (search.current === controller) setIsSearching(false);
    }
  }

  function pick(place: Place) {
    onPick(place);
    setQuery([place.name, place.address].filter(Boolean).join(", "));
    setPlaces([]);
    setActive(-1);
    setIsOpen(false);
    setStatus("Not the right place? Search again.");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const isListShown = isOpen && places.length > 0;
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && places.length > 0) {
      event.preventDefault();
      setIsOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) =>
        current < 0 ? (step > 0 ? 0 : places.length - 1) : (current + step + places.length) % places.length,
      );
    } else if (event.key === "Enter") {
      // Enter picks the highlighted place, or searches. It never submits the event form.
      event.preventDefault();
      if (isListShown && active >= 0) pick(places[active]);
      else void runSearch();
    } else if (event.key === "Escape" && isListShown) {
      event.preventDefault();
      setIsOpen(false);
    }
  }

  const isListShown = isOpen && places.length > 0;
  return (
    <div className="place-search">
      <div className="place-input">
        <div className="field-inline">
          <input
            id={id}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={isListShown}
            aria-controls={listId}
            aria-activedescendant={isListShown && active >= 0 ? `${listId}-${active}` : undefined}
            aria-describedby={status ? `${id}-status` : undefined}
            autoComplete="off"
            spellCheck={false}
            placeholder="Venue or address, like LX Factory Lisbon"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsOpen(false);
            }}
            onKeyDown={onKeyDown}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setIsOpen(false)}
          />
          <button type="button" className="btn btn-white btn-sm" onClick={() => void runSearch()} disabled={isSearching}>
            {isSearching ? "Searching…" : "Search"}
          </button>
        </div>
        {isListShown && (
          // Clicks inside keep focus in the input, so the list stays open until a place is picked.
          <div className="place-list" onMouseDown={(event) => event.preventDefault()}>
            <ul id={listId} role="listbox" aria-label="Places found">
              {places.map((place, index) => (
                <li
                  key={`${place.latitude},${place.longitude},${place.name}`}
                  id={`${listId}-${index}`}
                  className="place-option"
                  role="option"
                  aria-selected={index === active}
                  onClick={() => pick(place)}
                >
                  <b>{place.name}</b>
                  {place.address && <span>{place.address}</span>}
                </li>
              ))}
            </ul>
            <p className="place-credit">
              Places from{" "}
              <a href={OPENSTREETMAP_COPYRIGHT} target="_blank" rel="noopener noreferrer">
                OpenStreetMap
              </a>
            </p>
          </div>
        )}
      </div>
      {status && (
        <p id={`${id}-status`} className="field-hint" role="status">
          {status}
        </p>
      )}
    </div>
  );
}
