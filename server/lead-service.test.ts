import { describe, expect, it } from "vitest";
import { sanitizeCandidateForStorage } from "./lead-service";

describe("sanitizeCandidateForStorage", () => {
  it("retains only a Google Maps Place ID and operator-supplied query context", () => {
    const retained = sanitizeCandidateForStorage({
      source: "google_maps",
      sourceId: "ChIJ-example-place-id",
      sourceUrl: "https://maps.example/untrusted",
      name: "Practice name from Maps",
      address: "Address from Maps",
      city: "City from operator query",
      website: "https://listing-provided-site.example",
      phone: "+1 555 0100",
      rating: 4.9,
      reviewCount: 123,
      specialty: "Pain management from operator query",
    });
    expect(retained).toEqual({
      source: "google_maps",
      sourceId: "ChIJ-example-place-id",
      sourceUrl: "https://www.google.com/maps/search/?api=1&query_place_id=ChIJ-example-place-id",
      name: "Unverified Google Maps place",
      specialty: "Pain management from operator query",
      city: "City from operator query",
    });
  });

  it("rejects Google Search result payloads instead of persisting them", () => {
    expect(() => sanitizeCandidateForStorage({
      source: "google_search",
      name: "Search result title",
      sourceUrl: "https://result.example",
      website: "https://result.example",
    })).toThrow(/temporary/i);
  });

  it("requires a Place ID before persisting an unverified Maps reference", () => {
    expect(() => sanitizeCandidateForStorage({ source: "google_maps", name: "A Maps result" })).toThrow(/Place ID/i);
  });

  it("keeps operator-entered website details for verified manual leads", () => {
    const manual = { source: "manual" as const, name: "Practice from official site", website: "https://practice.example", email: "contact@practice.example" };
    expect(sanitizeCandidateForStorage(manual)).toEqual(manual);
  });
});
