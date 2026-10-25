import { z } from "zod";
import { ENV } from "./_core/env";

// Google Places API (New) — Text Search. One request returns everything we show, so a
// search costs a single call. Enable "Places API (New)" for the key in Google Cloud.
const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.internationalPhoneNumber",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
].join(",");

const responseSchema = z.object({
  places: z.array(z.object({
    id: z.string().optional(),
    displayName: z.object({ text: z.string().optional() }).optional(),
    formattedAddress: z.string().optional(),
    internationalPhoneNumber: z.string().optional(),
    nationalPhoneNumber: z.string().optional(),
    websiteUri: z.string().optional(),
    rating: z.number().optional(),
    userRatingCount: z.number().optional(),
  })).optional(),
});

export function isMapsConfigured(): boolean {
  return Boolean(ENV.googleMapsApiKey);
}

export async function searchPlaces(query: string, location: string) {
  const apiKey = ENV.googleMapsApiKey;
  if (!apiKey) throw new Error("Google Maps is not configured. Set GOOGLE_MAPS_API_KEY in the server environment.");

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": FIELD_MASK },
    body: JSON.stringify({ textQuery: `${query} healthcare practice ${location}`, pageSize: 10 }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json() as { error?: { message?: string; status?: string } };
      detail = body.error?.message ?? body.error?.status ?? "";
    } catch { /* non-JSON error body */ }
    throw new Error(`Google Maps returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : "."}`);
  }

  const data = responseSchema.parse(await response.json());
  return (data.places ?? []).flatMap((place) => {
    const name = place.displayName?.text;
    if (!place.id || !name) return [];
    return [{
      source: "google_maps" as const,
      sourceId: place.id,
      sourceUrl: `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(place.id)}`,
      name,
      specialty: query,
      address: place.formattedAddress,
      city: location,
      country: "United States",
      website: place.websiteUri,
      phone: place.internationalPhoneNumber ?? place.nationalPhoneNumber,
      rating: place.rating,
      reviewCount: place.userRatingCount,
    }];
  });
}
