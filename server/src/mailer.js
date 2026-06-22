import nodemailer from 'nodemailer';

// Optional SMTP. If SMTP_HOST is unset, email is disabled and the caller falls
// back to returning the link for manual sharing.
const HOST = process.env.SMTP_HOST || '';
const FROM = process.env.MAIL_FROM || 'Wall of Fame <noreply@example.com>';
const TOKEN_TTL_DAYS = Number(process.env.TOKEN_TTL_DAYS || 14);

let transport = null;
if (HOST) {
  transport = nodemailer.createTransport({
    host: HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
}

export const mailEnabled = Boolean(transport);

export async function sendInvite(to, name, link) {
  if (!transport) return { sent: false };
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto">
      <h2>You're on the Wall of Fame 🏆</h2>
      <p>Hi ${name || 'there'},</p>
      <p>We'd love to add your project story to our Wall of Fame. It takes a couple of
      minutes and you don't need to create any account — just click below:</p>
      <p><a href="${link}" style="background:#b45309;color:#fff;padding:12px 20px;
        border-radius:8px;text-decoration:none;display:inline-block">Add my testimonial</a></p>
      <p style="color:#6b7280;font-size:13px">This link is personal and expires in
      ${TOKEN_TTL_DAYS} days. If the button doesn't work, paste this URL:<br>${link}</p>
    </div>`;
  await transport.sendMail({ from: FROM, to, subject: 'Add your testimonial', html });
  return { sent: true };
}
