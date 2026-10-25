# TODO

## Google Maps and Google Search practice discovery
- [ ] The software finds healthcare-practice business prospects from Google Maps and Google Search using a practice specialty/type and a city, state, or region supplied by the operator.
- [ ] Google Maps discovery uses the supported Places API proxy, never scrapes the Maps website, and displays visible Google Maps attribution and a link to the source listing.
- [ ] Google Maps API business names, addresses, phone numbers, websites, ratings, and reviews are displayed only in the live search response and are not persisted, exported, or forwarded to AI, verification, or CRM providers. Only Google Maps Place IDs may be stored for an unverified Maps listing reference.
- [ ] Google Search discovery uses SerpApi for new setups or Google's Custom Search JSON API for accounts with existing access, rather than scraping result-page HTML; results are transient and are not saved directly as lead data.
- [ ] To create a usable lead from either source, an operator independently checks the practice's own official website and enters/confirms its business name, website, contact details, and location. Only independently confirmed business details are eligible for email/social enrichment, verification, export, AI drafting, and CRM synchronization.
- [ ] Saved records distinguish unverified Maps Place ID references from independently confirmed business details. Do not collect patient or sensitive health information.

## Email verifier
- [ ] The software checks independently confirmed business email addresses with the configured email-verification provider and reports deliverable/valid, invalid, uncertain, or unavailable status.
- [ ] Verification results and timestamps are attached to the corresponding lead; an unchecked email is never labelled active or verified.

## Phone verifier
- [ ] The software checks independently confirmed business phone numbers with the configured phone-lookup provider and reports number validity and available line-type information.
- [ ] Phone results do not promise that a person will answer or that a number is reachable; provider failures and unconfigured credentials remain visible.

## Social Media Links Finder
- [ ] Using a business website independently entered/confirmed by the operator, the software finds public LinkedIn, Instagram, and Facebook profile links and attaches them to that lead.
- [ ] Website enrichment validates HTTPS destinations, blocks localhost/private network targets, revalidates redirects, and reports a missing profile instead of inventing one.

## AI Personalized Email Draft/Writer
- [ ] The software uses the configured OpenAI API to draft a personalized pitch/email for an independently confirmed business lead from its available public business context.
- [ ] Generated messages are editable and reviewable before use; generation does not send email automatically.
- [ ] Draft status and the linked lead are visible in the drafts workspace; Maps-only unverified content cannot be sent to the AI provider.

## Duplicate remover
- [ ] The software automatically filters or merges repeated leads using stable Google Maps Place IDs where present, business name, website/domain, email, phone, and location signals.
- [ ] Duplicate merging retains existing useful values and fills missing details from independently confirmed business sources rather than silently replacing confirmed data with provider search content.

## CSV/Excel export
- [ ] The operator can download clean CSV and Excel-compatible spreadsheet data in one click, including independently confirmed business details and useful source/verification metadata.
- [ ] Unverified Google Maps listing content is excluded from exports; a Maps-only record may contain only the permitted Place ID reference and operator-supplied search context.

## CRM integrations
- [ ] The app can synchronize selected independently confirmed leads to HubSpot and Zoho CRM when each provider's credentials are configured.
- [ ] Per-record CRM sync success/error status is visible, and missing credentials, provider errors, or Maps-only unverified details are never shown as a successful sync.

## Backend credentials/settings page
- [ ] An authenticated agency admin can open a backend settings page and add, replace, or remove credentials required for Google Search, OpenAI, email verification, phone lookup, HubSpot, and Zoho.
- [ ] Provider credentials are encrypted server-side before database storage; the browser sees only configured-state metadata, never stored secret values.
- [ ] The settings page explains missing configuration and encryption setup, and never writes credential values to logs or browser persistence.
- [ ] The credential encryption key is supplied as protected server-side `APP_CREDENTIALS_ENCRYPTION_KEY` configuration.

## Protected owner onboarding and public policies
- [ ] All lead, integration, and credentials operations require an authenticated admin account; an unauthenticated visitor cannot access them.
- [ ] Because the starter has no configured admin, the first workspace owner can claim admin access exactly once using the protected server-side `APP_ADMIN_BOOTSTRAP_TOKEN`; competing or later claims are rejected.
- [ ] Public `/terms` and `/privacy` pages explain the business-prospecting-only scope, external providers, credential security, source handling, retention/deletion, and link to applicable Google terms and privacy policies.
- [ ] The public policy pages remain accessible without an administrator login; all workspace and credentials routes remain protected.
