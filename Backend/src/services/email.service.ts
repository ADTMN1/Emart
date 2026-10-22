import { BrevoClient } from '@getbrevo/brevo';
import config from '../config/env';

export const SELLER_APPROVAL_SUBJECT = 'Your Marcari23 Seller Application Has Been Approved';

export interface SendEmailResult {
  sent: boolean;
  messageId?: string;
  error?: string;
  reason?: string;
}

export interface SendEmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SellerApprovalEmailParams {
  to: string;
  applicantName?: string;
  storeName?: string;
}

export interface EmailServiceOptions {
  apiKey: string;
  from: string;
  fromName: string;
  frontendUrl: string;
}

interface BrevoSendInput {
  from: string;
  fromName: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface BrevoClientResult {
  status?: number;
  messageId?: string;
}

/** Minimal structural view of the parts of the Brevo API client we use. */
export interface EmailClientLike {
  send: (input: BrevoSendInput) => Promise<BrevoClientResult>;
}

function defaultOptions(): EmailServiceOptions {
  return {
    apiKey: config.email.apiKey,
    from: config.email.from,
    fromName: config.email.fromName,
    frontendUrl: config.frontendUrl,
  };
}

/** Escape user-controlled values before interpolating into HTML. */
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Build a safe `Name <addr>` sender, stripping anything that could break headers. */
function buildFrom(options: EmailServiceOptions): string {
  const from = options.from.replace(/[\r\n<>"']/g, '').trim();
  const name = options.fromName.replace(/[\r\n<>"']/g, '').trim();
  if (!from) return '';
  return name ? `"${name}" <${from}>` : from;
}

/** Dashboard URL is ALWAYS config base + fixed `/seller` path — never user input. */
function dashboardUrl(options: EmailServiceOptions): string {
  const base = /^https?:\/\//i.test(options.frontendUrl) ? options.frontendUrl : 'http://localhost:5173';
  return `${base.replace(/\/+$/, '')}/seller`;
}

function maskRecipient(email: string): string {
  const at = email.indexOf('@');
  if (at <= 1) return email;
  return `${email[0]}${'*'.repeat(Math.min(3, at - 1))}${email.slice(at)}`;
}

function approvalHtml(name: string, storeName: string | undefined, url: string): string {
  const storeLine = storeName
    ? ` for <strong>${escapeHtml(storeName)}</strong>`
    : '';
  return [
    '<!doctype html><html><body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">',
    '<div style="max-width:600px;margin:24px auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">',
    '<div style="background:#111827;padding:20px 28px;"><span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:1px;">Marcari23</span></div>',
    '<div style="padding:32px 28px;color:#111827;">',
    `<h1 style="margin:0 0 12px;font-size:22px;">Congratulations, ${escapeHtml(name)}!</h1>`,
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Your seller application${storeLine} has been <strong>approved</strong>. You can now access your Seller Dashboard, manage your products, and start selling on Marcari23.</p>`,
    `<p style="margin:0 0 24px;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;">Go to Seller Dashboard</a></p>`,
    '<p style="margin:0 0 8px;font-size:14px;color:#6b7280;">If the button does not work, copy and open this link in your browser:</p>',
    `<p style="margin:0 0 24px;font-size:14px;"><a href="${escapeHtml(url)}" style="color:#2563eb;word-break:break-all;">${escapeHtml(url)}</a></p>`,
    '<p style="margin:0;font-size:13px;color:#9ca3af;">This is an automated message from Marcari23. Do not reply to this email.</p>',
    '</div></div></body></html>',
  ].join('');
}

function approvalText(name: string, storeName: string | undefined, url: string): string {
  const storeLine = storeName ? ` for ${storeName}` : '';
  return [
    'Your Marcari23 Seller Application Has Been Approved',
    '',
    `Hi ${name},`,
    '',
    `Your seller application${storeLine} has been approved. You can now access your Seller Dashboard, manage your products, and start selling on Marcari23.`,
    '',
    `Go to Seller Dashboard: ${url}`,
    `(If the button doesn't work, copy the link above into your browser.)`,
    '',
    '- Marcari23',
  ].join('\n');
}

/**
 * Transactional email service backed by Brevo. Fail-safe by design: every
 * send returns a structured result instead of throwing, so callers (e.g. the
 * seller approval flow) can keep going when email infrastructure fails.
 *
 * Settings come from env via `config.email` / `config.frontendUrl`; the
 * constructor accepts explicit options + a client so tests run fully in memory.
 */
export class EmailService {
  private readonly options: EmailServiceOptions;
  private readonly fromAddress: string;
  private readonly client: EmailClientLike | null;

  constructor(options: EmailServiceOptions = defaultOptions(), client?: EmailClientLike) {
    this.options = options;
    this.fromAddress = buildFrom(options);
    this.client = options.apiKey ? (client ?? this.buildBrevoClient(options.apiKey)) : null;
  }

  /** Adapt the Brevo v6 API client into our minimal client contract. */
  private buildBrevoClient(apiKey: string): EmailClientLike {
    const client = new BrevoClient({ apiKey });
    return {
      async send(input: BrevoSendInput): Promise<BrevoClientResult> {
        const { data, rawResponse } = await client.transactionalEmails
          .sendTransacEmail({
            sender: { email: input.from, name: input.fromName },
            to: [{ email: input.to }],
            subject: input.subject,
            htmlContent: input.html,
            textContent: input.text,
          })
          .withRawResponse();
        return { status: rawResponse?.status, messageId: data?.messageId };
      },
    };
  }

  isConfigured(): boolean {
    return Boolean(this.client && this.fromAddress);
  }

  async send(payload: SendEmailPayload): Promise<SendEmailResult> {
    if (!this.client) {
      console.warn('[EmailService] Email skipped: BREVO_API_KEY is not configured.');
      return { sent: false, reason: 'email-not-configured' };
    }
    if (!this.fromAddress) {
      console.warn('[EmailService] Email skipped: EMAIL_FROM is not configured.');
      return { sent: false, reason: 'email-from-not-configured' };
    }
    const to = String(payload.to ?? '').trim();
    if (!to) {
      console.warn('[EmailService] Email skipped: no recipient address.');
      return { sent: false, reason: 'missing-recipient' };
    }

    try {
      const { status, messageId } = await this.client.send({
        from: this.options.from,
        fromName: this.options.fromName,
        to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });
      console.info(
        `[EmailService] Email sent via Brevo to <${maskRecipient(to)}> (HTTP ${status ?? 'n/a'})${messageId ? ` messageId=${messageId}` : ''}.`,
      );
      return { sent: true, messageId };
    } catch (err) {
      const status =
        (err as { statusCode?: number; response?: { status?: number } })?.statusCode ??
        (err as { response?: { status?: number } })?.response?.status;
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`[EmailService] Brevo API error${status ? ` (HTTP ${status})` : ''}: ${detail}`);
      return { sent: false, error: detail };
    }
  }

  /** Seller application approval confirmation — used by the admin approve flow. */
  async sendSellerApprovalEmail(params: SellerApprovalEmailParams): Promise<SendEmailResult> {
    const url = dashboardUrl(this.options);
    const name = String(params.applicantName ?? '').trim() || 'Seller';
    const storeName = params.storeName?.trim() || undefined;
    return this.send({
      to: params.to,
      subject: SELLER_APPROVAL_SUBJECT,
      html: approvalHtml(name, storeName, url),
      text: approvalText(name, storeName, url),
    });
  }
}

export default new EmailService();