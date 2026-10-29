import nodemailer, { type Transporter } from "nodemailer";
import { ENV } from "./env";

export function isMailConfigured(): boolean {
  return Boolean(ENV.smtpUrl && ENV.mailFrom);
}

let transport: Transporter | null = null;

export async function sendMail(message: { to: string; subject: string; text: string }): Promise<void> {
  if (!isMailConfigured()) throw new Error("Email is not configured (SMTP_URL and MAIL_FROM).");
  transport ??= nodemailer.createTransport(ENV.smtpUrl);
  await transport.sendMail({ from: ENV.mailFrom, to: message.to, subject: message.subject, text: message.text });
}
