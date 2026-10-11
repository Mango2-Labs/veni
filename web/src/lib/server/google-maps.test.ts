// Google Maps through the server, against a stand-in for Google's API.
//   cd web && bun test src/lib/server
import { afterEach, describe, expect, mock, test } from "bun:test";
import { GoogleMapsNotSetUp, searchGooglePlaces } from "./google-maps";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.GOOGLE_MAPS_API_KEY;
});

function answerWith(response: Response) {
  globalThis.fetch = mock(async () => response) as unknown as typeof fetch;
}

describe("Google place search", () => {
  test("says it isn't set up without a key, so callers use OpenStreetMap", async () => {
    await expect(searchGooglePlaces("LX Factory")).rejects.toBeInstanceOf(GoogleMapsNotSetUp);
  });

  test("reads Google's places, with the name taken out of the address and the town as the city", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    answerWith(
      Response.json({
        places: [
          {
            displayName: { text: "LX Factory" },
            formattedAddress: "LX Factory, R. Rodrigues de Faria 103, Lisboa, Portugal",
            location: { latitude: 38.7029, longitude: -9.1784 },
            addressComponents: [{ longText: "Lisboa", types: ["locality", "political"] }],
          },
        ],
      }),
    );
    expect(await searchGooglePlaces("LX Factory")).toEqual([
      { name: "LX Factory", address: "R. Rodrigues de Faria 103, Lisboa, Portugal", city: "Lisboa", latitude: 38.7029, longitude: -9.1784 },
    ]);
  });

  test("never passes on Google's error text, which can quote the key", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "secret-looking-key";
    answerWith(new Response("API key secret-looking-key isn't allowed here", { status: 403 }));
    const error = await searchGooglePlaces("LX Factory").catch((caught: Error) => caught);
    expect(error.message).not.toContain("secret-looking-key");
  });
});
