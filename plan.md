# Evolve Practice Prospecting — Implementation Plan

## Product and implementation

Build an authenticated prospecting workspace tailored to Evolve Results. Evolve's public positioning emphasizes full-funnel patient acquisition for growth-minded mid-market healthcare practices, with demand generation plus intake/process improvement; this tool supports agency-side business prospecting only and must not collect patient, appointment, or clinical data. Source: [Evolve Results](https://ehmresults.com/).

Use the initialized React, Express, tRPC, Drizzle, and managed MySQL starter. Keep provider calls and credentials on the server. The starter has no configured owner identity, so the first administrator must claim the workspace with a one-time `APP_ADMIN_BOOTSTRAP_TOKEN`; every lead/settings procedure remains behind the actual authenticated admin role. Provider credentials are AES-256-GCM encrypted in the database with a separate `APP_CREDENTIALS_ENCRYPTION_KEY`. Never echo credentials to the browser, log them, or persist them in browser storage.

### Search, attribution, and data retention

- Google Maps discovery uses the supported server-side Maps Places proxy; never scrape the Maps website. Render live Places results with visible, correctly styled “Google Maps” attribution and links to the source listing. Google's [Places policy](https://developers.google.com/maps/documentation/places/web-service/policies) restricts storing Places content; persist only the exempt Place ID for an unverified Maps-only reference. Do not cache/store Maps business names, addresses, phones, websites, ratings, or reviews from the API. Do not export or pass unverified Maps-only content to AI, verifiers, or CRMs.
- After an operator checks the practice's own official website, they can manually enter/confirm the independent business name, website, business email/phone, and location. Only that explicitly verified business detail can be enriched, exported, drafted from, or synchronized. Do not treat a Google listing as verification of independent contact data.
- Do not scrape Google Search result-page HTML. The official [Custom Search JSON API](https://developers.google.com/custom-search/v1/overview) is closed to new customers and scheduled to end on January 1, 2027; support it only for existing account holders and offer [SerpApi's Google Search API](https://serpapi.com/search-api) as the new-account search option. Search results are transient and not persisted: operators must independently confirm a practice's details on its official site before adding it to the lead database.
- Preserve source links, verification status, and provider status. Never state a number is definitely active or reachable when a provider reports only validity or line-type information.

### Enrichment, drafts, and operations

Validate HTTPS website destinations, block localhost/private IPs, and revalidate redirects before finding only public LinkedIn, Instagram, and Facebook links. Use ZeroBounce for email deliverability and Twilio Lookup for phone validity/line-type details. Generate editable outreach drafts server-side with the agency's OpenAI API key; drafts are reviewed/edited and never automatically sent. Deduplicate using stable Place IDs, normalized business email, business name, website/domain, phone, and location signals; merge missing values and preserve manual review state. Exports create CSV and Excel-compatible SpreadsheetML without a new dependency; export only independently confirmed business details and safe source/verification metadata. Provide HubSpot private-app company sync and Zoho OAuth account sync with per-record status and explicit provider errors; repeated sync updates the existing CRM record when its ID is known.

Publish public Terms and Privacy pages that link to relevant Google Maps terms and privacy policies, and explain the business-data-only workflow, saved credential treatment, third-party providers, admin controls, and retention/deletion behavior. The concept demo is labeled independent, not an official Evolve Results product or endorsement. No automated outreach sending is included. The product interface is in English for the US-based agency team.

## Project structure

- `client/src/pages/`: overview, discovery, lead workspace, email drafts, integration status, protected credentials, first-owner setup, and public Terms/Privacy pages.
- `client/src/components/`: responsive app shell and reusable source/status indicators, plus a public policy-page layout.
- `client/src/App.tsx` and `client/src/index.css`: public/private route wiring and the Electric Growth Lab design system.
- `server/routers.ts`: admin-protected search/save/list/enrichment/verification/drafting/export/CRM/settings procedures, plus the one-time protected owner claim.
- `server/lead-service.ts`: verified lead persistence, policy-safe Maps Place ID references, duplicate merging, drafts, and status updates.
- `server/provider-service.ts`, `server/website-enrichment.ts`, and `server/credential-store.ts`: Maps/Search/verifier/OpenAI/CRM API adapters, SSRF-safe social-link discovery, and authenticated AES-256-GCM secret persistence.
- `drizzle/schema.ts` and `drizzle/`: users, owner-claim slot, leads, drafts, and encrypted provider settings.
- `client/public/manus-routes.json`: synchronized public/private website route declarations required by Preview.

## Design — Electric Growth Lab

Teen rare-tail design options par nazar dali gayi: **white clinical SaaS (0.04)**, **warm editorial growth journal (0.07)**, aur **Electric Growth Lab dark command center (0.06; selected)**. Neeche sirf selected style ko detail mein expand kiya gaya hai.

- **Design Movement:** Healthcare growth-tech command center; clinical status clarity ko modern agency-operations energy ke saath milana.
- **Core Principles:** Jaldi scanning; source aur verification ki imandaar labels; compact lekin readable tables; credentials aur patient information ko sensitive samajhna.
- **Color Philosophy:** Deep indigo focus aur trust ka ehsaas deta hai. Electric chartreuse sirf next action aur confirmed progress ko highlight karta hai. Slate surfaces se data readable rehta hai, bina stock-clinic imagery ke.
- **Layout Paradigm:** Baen taraf permanent navigation, upar chhota action header, aur beech mein khula work surface. Discovery se review stream tak flow ho; selected lead ki tafseel right-side rail mein aaye, na ke aik generic centered dashboard mein.
- **Signature Elements:** Patli chartreuse action line; source/verification chips; selected lead context ke liye halka dark-glass panel treatment.
- **Interaction Philosophy:** Har lead par aik wazeh next action; har status nazar aaye; drafts editable hon; website details aur CRM sync se pehle operator ki explicit tasdeeq ho. Credentials na hon to success ka ghalat impression na diya jaye.
- **Animation:** Navigation aur state change par mukhtasar opacity/position transitions; looping animation nahi; reduced-motion preferences ka ehtiram.
- **Typography System:** Headings aur metrics ke liye Space Grotesk; tables aur form content ke liye neutral system sans-serif. Google Maps attribution ko provider ke required readable treatment mein dikhana.
- **Brand Essence:** Healthcare patient-acquisition teams ke liye focused prospecting workspace jo public business context ko reviewed action mein badle; personality: focused, precise, transparent.
- **Brand Voice:** Seedhi, action-oriented aur ehtiyat-pasand. Misalain: “Find the practices worth a closer look.” “Verify the business contact before you draft.”
- **Wordmark & Logo:** Navigation mein public Evolve Healthcare Marketing wordmark, saath internal workspace ke liye chhota rising-line motif; har public-facing surface par concept-demo status wazeh rahe.
- **Signature Brand Color:** Electric chartreuse `#7CFF6B`, sirf focus aur verified states ke liye.

## Main application areas

Private/admin routes are `/` (overview), `/search` (live Google Maps and Google Search discovery), `/leads` (stored references and operator-confirmed business records), `/drafts` (editable personalized outreach), `/integrations` (provider readiness), and `/settings` (encrypted provider credentials). Public routes are `/terms` and `/privacy`. Lead detail uses a side panel rather than an invented dynamic URL.

## External facts and sources

- Evolve's positioning: https://ehmresults.com/
- Google Custom Search API lifecycle/eligibility: https://developers.google.com/custom-search/v1/overview
- Google Places retention and attribution rules: https://developers.google.com/maps/documentation/places/web-service/policies
- Google Maps service terms: https://cloud.google.com/maps-platform/terms/maps-service-terms
- SerpApi Google Search API endpoint and query format: https://serpapi.com/search-api
