import { Resend } from 'resend'

// Using Resend shared domain until crm.shopbrain.co DNS is verified with Resend
// Switch to: 'ShopBrain CRM <noreply@shopbrain.co>' once domain is verified
const FROM = 'ShopBrain CRM <onboarding@resend.dev>'

// Lazy-initialize so the constructor never runs at build time when the key is absent.
let _resend = null
function getResend() {
  if (!process.env.RESEND_API_KEY) return null
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

// ─── HTML email template ──────────────────────────────────────────────────────

function buildHtml({ title, body, link }) {
  const appUrl = process.env.NEXTAUTH_URL || 'https://shopbrain.com'
  const btnSection = link
    ? `
      <tr>
        <td align="center" style="padding: 24px 0 8px;">
          <a href="${appUrl}${link}"
            style="display:inline-block;background:#5061F6;color:#ffffff;font-family:Arial,sans-serif;
                   font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">
            View in CRM
          </a>
        </td>
      </tr>`
    : ''

  const bodySection = body
    ? `<tr><td style="padding:0 0 16px;font-family:Arial,sans-serif;font-size:14px;color:#6b7280;line-height:1.6;">${body}</td></tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background:#5061F6;padding:20px 32px;">
              <span style="font-family:Arial,sans-serif;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">
                ShopBrain CRM
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 8px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:0 0 12px;font-family:Arial,sans-serif;font-size:17px;font-weight:700;color:#111827;">
                    ${title}
                  </td>
                </tr>
                ${bodySection}
                ${btnSection}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px 28px;font-family:Arial,sans-serif;font-size:12px;color:#9ca3af;border-top:1px solid #f3f4f6;">
              You are receiving this because you are a member of ShopBrain CRM.
              ${link ? `<br>Or copy this link: <a href="${appUrl}${link}" style="color:#5061F6;">${appUrl}${link}</a>` : ''}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Send a single notification email.
 * Silent no-op when RESEND_API_KEY is absent (dev without key).
 * @param {{ to: string, title: string, body?: string, link?: string }} opts
 */
export async function sendEmail({ to, title, body, link }) {
  const client = getResend()
  if (!client) return
  try {
    await client.emails.send({
      from: FROM,
      to,
      subject: title,
      html: buildHtml({ title, body, link }),
    })
  } catch (err) {
    console.error('[email] sendEmail failed:', err?.message)
  }
}

/**
 * Send notification emails to multiple recipients using Resend batch API.
 * @param {Array<{ email: string }>} users
 * @param {{ title: string, body?: string, link?: string }} payload
 */
export async function sendEmailBatch(users, { title, body, link }) {
  const client = getResend()
  if (!client || !users.length) return
  try {
    const emails = users
      .filter((u) => u.email)
      .map((u) => ({
        from: FROM,
        to: u.email,
        subject: title,
        html: buildHtml({ title, body, link }),
      }))
    if (emails.length) await client.batch.send(emails)
  } catch (err) {
    console.error('[email] sendEmailBatch failed:', err?.message)
  }
}
