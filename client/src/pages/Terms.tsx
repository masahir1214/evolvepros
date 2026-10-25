import PolicyLayout from "@/components/PolicyLayout";

export default function Terms() {
  return <PolicyLayout title="Terms of use" updatedAt="October 25, 2026">
    <p><strong>This is an independent concept demo.</strong> It was prepared for discussion with Evolve Results and is not operated, approved, or endorsed by Evolve Results unless the agency separately adopts it. Evolve names and logos remain the property of their owners.</p>
    <h2>1. Scope</h2>
    <p>The prototype is for agency-side research and management of public healthcare-practice business prospects. It is not a patient-acquisition delivery service, clinical tool, or source of medical advice. Do not enter patient names, appointment details, protected health information, or other sensitive health data.</p>
    <h2>2. Source data and provider rules</h2>
    <p>Google Maps and Google Search results are discovery references, not verified facts. Maps listings are displayed with attribution; this demo retains only the Google Maps Place ID for an unverified listing. Before a business name, website, address, email, or phone number is saved for follow-up, an operator must independently confirm it from the practice's own official website. Search results are not stored as lead records.</p>
    <p>Use of Google Maps Platform is subject to the <a href="https://cloud.google.com/maps-platform/terms" target="_blank" rel="noreferrer">Google Maps Platform Terms</a>, the applicable <a href="https://developers.google.com/maps/documentation/places/web-service/policies" target="_blank" rel="noreferrer">Places API policies</a>, and <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google's Privacy Policy</a>. Google Custom Search is supported only for accounts with existing access; Google's stated service timeline is described in its <a href="https://developers.google.com/custom-search/v1/overview" target="_blank" rel="noreferrer">official API notice</a>. SerpApi use is subject to its <a href="https://serpapi.com/terms" target="_blank" rel="noreferrer">terms</a>.</p>
    <h2>3. Business contact use</h2>
    <p>Users are responsible for checking the accuracy and permitted use of business contact details, respecting provider terms, honoring opt-outs, and complying with applicable marketing, privacy, and anti-spam laws. Email and phone verification provide limited provider signals; they do not establish consent or guarantee delivery or reachability.</p>
    <h2>4. Drafts and integrations</h2>
    <p>AI-generated email drafts are suggestions for human review, not factual guarantees. This prototype does not send email automatically. CRM synchronization is initiated by an administrator and sends confirmed business details to the selected CRM using its configured credentials.</p>
    <h2>5. Security and availability</h2>
    <p>Provider credentials are encrypted server-side, and workspace functions are restricted to authenticated administrators. This concept demo is provided for evaluation, without a guarantee of uninterrupted operation, search-result completeness, or provider availability. The project owner should review and replace this notice before production use.</p>
    <h2>6. Deletion and contact</h2>
    <p>An administrator can remove stored lead records from the workspace and remove saved provider credentials from Settings. Provider and platform data may be subject to their own retention rules. Before production, the adopting organization should add its official contact and legal notice.</p>
  </PolicyLayout>;
}
