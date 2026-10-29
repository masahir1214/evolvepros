// All configuration is read at use time from the server environment (.env in development).
export const ENV = {
  get databaseUrl() { return process.env.DATABASE_URL ?? ""; },
  get sessionSecret() { return process.env.SESSION_SECRET ?? ""; },
  get googleMapsApiKey() { return process.env.GOOGLE_MAPS_API_KEY ?? ""; },
  get adminBootstrapToken() { return process.env.APP_ADMIN_BOOTSTRAP_TOKEN ?? ""; },
  // Anyone may create an account unless this is explicitly set to "false".
  get signupOpen() { return (process.env.ALLOW_SIGNUP ?? "true").trim().toLowerCase() !== "false"; },
  // Public address of the app, used to build password-reset links (no trailing slash).
  get appBaseUrl() { return (process.env.APP_BASE_URL ?? "").trim().replace(/\/+$/, ""); },
  // e.g. smtps://user:app-password@smtp.gmail.com:465 — emails are only sent when this is set.
  get smtpUrl() { return (process.env.SMTP_URL ?? "").trim(); },
  get mailFrom() { return (process.env.MAIL_FROM ?? "").trim(); },
  get isProduction() { return process.env.NODE_ENV === "production"; },
};
