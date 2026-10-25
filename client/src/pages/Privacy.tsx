import PolicyLayout from "@/components/PolicyLayout";

export default function Privacy() {
  return <PolicyLayout title="Privacy notice" updatedAt="October 25, 2026">
    <p><strong>Prototype notice:</strong> This is an independent concept demo prepared for discussion, not an official Evolve Results service. The person or organization that adopts and operates it must confirm the final controller/operator details and replace this notice before production.</p>
    <h2>1. Information in the demo</h2>
    <p>The application uses a signed-in user's account name, email, and account identifier for login and administrator access. An administrator may add healthcare-practice business name, specialty, public address, public business website, business email, and business phone after checking the practice's own website. The app can also retain social profile links, provider verification status, editable outreach drafts, CRM sync status, and Google Maps Place IDs.</p>
    <p>Do not enter patient information, appointment records, clinical information, or other sensitive health data. The prospecting workspace is designed for business-to-business agency outreach only.</p>
    <h2>2. Search and source treatment</h2>
    <p>Google Maps and Google Search results are shown for the current search and are not stored as lead details. An unverified Google Maps listing can be retained only as a Place ID reference. Google search result text is temporary. An operator must independently enter and confirm the practice's business details from its official website before those details can be saved, enriched, exported, sent to an AI provider, or synchronized to a CRM.</p>
    <h2>3. Processing by providers</h2>
    <p>Search queries are sent to the selected Google Maps or Google-results search service. When an administrator requests specific actions, independently confirmed business details may be sent to OpenAI to draft an email, ZeroBounce to check an email address, Twilio to look up a phone number, or HubSpot/Zoho to create a CRM record. Requests are made only for the action selected in the workspace. No email is automatically sent.</p>
    <h2>4. Storage and security</h2>
    <p>Lead records and drafts are held in the project's managed database. Provider API credentials are encrypted on the server with AES-256-GCM before storage; the encryption key is supplied separately through protected server configuration. The browser receives only whether a provider is configured, not its saved secret value. Access to workspace records and credentials requires the authenticated admin role.</p>
    <h2>5. Retention and deletion</h2>
    <p>Stored business records and drafts remain until an administrator deletes them. Saved provider credentials can be removed from Settings. Removing a lead also removes its associated drafts from the application database. This notice does not control separate retention by Google, search services, verification services, AI providers, CRM providers, or the hosting platform.</p>
    <h2>6. Third-party policies and updates</h2>
    <p>Google Maps use is subject to the <a href="https://developers.google.com/maps/documentation/places/web-service/policies" target="_blank" rel="noreferrer">Places API policies</a> and <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google's Privacy Policy</a>. The operator must review each provider's current terms and privacy policy before production deployment. This prototype notice should be updated with the adopting organization's identity, contact details, applicable retention rules, and any required disclosures.</p>
  </PolicyLayout>;
}
