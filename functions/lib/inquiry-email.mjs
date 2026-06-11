const DEFAULT_TO_EMAIL = "1476080750@qq.com";
const DEFAULT_FROM_EMAIL = "website@msourceio.com";
const DEFAULT_MAILCHANNELS_BASE_URL = "https://api.mailchannels.net/tx/v1";

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const requiredFields = ["fullName", "emailAddress", "message"];

function normalizeProvider(value) {
  const provider = String(value || "").trim().toLowerCase();
  if (!provider || provider === "mailchannels" || provider === "mailchannels-email-api") {
    return "mailchannels";
  }
  if (provider === "cloudflare" || provider === "cloudflare-email-service") {
    return "cloudflare-email-service";
  }
  return provider;
}

function joinUrl(baseUrl, suffix) {
  const normalizedBase = String(baseUrl || "").trim().replace(/\/+$/, "");
  const normalizedSuffix = String(suffix || "").trim().replace(/^\/+/, "");
  return `${normalizedBase}/${normalizedSuffix}`;
}

function parseRecipientEmails(value) {
  const recipients = String(value || "")
    .split(/[\s,;]+/)
    .map((email) => email.trim())
    .filter(Boolean);

  return recipients.length ? [...new Set(recipients)] : [DEFAULT_TO_EMAIL];
}

function extractTextCandidate(value) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (value && typeof value === "object") {
    return (
      extractTextCandidate(value.message) ||
      extractTextCandidate(value.error) ||
      extractTextCandidate(value.detail) ||
      extractTextCandidate(value.reason) ||
      null
    );
  }

  return null;
}

function parseJsonSafely(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractErrorMessage(bodyText, responseBody) {
  const candidates = [];

  if (responseBody && typeof responseBody === "object") {
    candidates.push(
      extractTextCandidate(responseBody.message),
      extractTextCandidate(responseBody.error),
      extractTextCandidate(responseBody.error_message),
      extractTextCandidate(responseBody.detail)
    );

    if (Array.isArray(responseBody.errors)) {
      for (const item of responseBody.errors) {
        candidates.push(extractTextCandidate(item));
      }
    }

    if (Array.isArray(responseBody.messages)) {
      for (const item of responseBody.messages) {
        candidates.push(extractTextCandidate(item));
      }
    }
  }

  return candidates.find(Boolean) || bodyText || "The email service rejected the request.";
}

export function validateInquiryPayload(payload) {
  for (const field of requiredFields) {
    if (!String(payload?.[field] || "").trim()) {
      return {
        ok: false,
        status: 400,
        message: "Please complete the required fields before submitting."
      };
    }
  }

  return { ok: true };
}

export function getInquiryEmailConfig(env = {}) {
  const toEmails = parseRecipientEmails(env.INQUIRY_TO_EMAIL || DEFAULT_TO_EMAIL);

  return {
    provider: normalizeProvider(env.EMAIL_PROVIDER || env.INQUIRY_EMAIL_PROVIDER || "mailchannels"),
    toEmail: toEmails[0],
    toEmails,
    fromEmail: String(env.INQUIRY_FROM_EMAIL || DEFAULT_FROM_EMAIL).trim(),
    mailchannelsApiKey: String(
      env.MAILCHANNELS_API_KEY || env.MAILCHANNELS_SEND_API_KEY || env.MAILCHANNELS_TOKEN || ""
    ).trim(),
    mailchannelsBaseUrl: String(env.MAILCHANNELS_BASE_URL || DEFAULT_MAILCHANNELS_BASE_URL).trim(),
    cloudflareAccountId: String(env.CLOUDFLARE_ACCOUNT_ID || env.CF_ACCOUNT_ID || "").trim(),
    cloudflareApiToken: String(env.CLOUDFLARE_EMAIL_API_TOKEN || env.CLOUDFLARE_API_TOKEN || "").trim()
  };
}

export function buildInquiryEmailContent(payload = {}) {
  const fields = [
    ["Submitted at", new Date().toISOString()],
    ["Full name", payload.fullName],
    ["Company name", payload.companyName],
    ["Email address", payload.emailAddress],
    ["WhatsApp", payload.whatsApp],
    ["Country", payload.country],
    ["Business type", payload.businessType],
    ["Product interest", payload.productInterest],
    ["Estimated quantity", payload.estimatedQuantity],
    ["Need custom logo", payload.needCustomLogo],
    ["Packaging requirement", payload.packagingRequirement],
    ["Message", payload.message]
  ];

  const textBody = fields
    .filter(([, value]) => String(value || "").trim())
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");

  const htmlBody = `
    <h2>New website inquiry</h2>
    <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;font-family:Arial,sans-serif;">
      ${fields
        .filter(([, value]) => String(value || "").trim())
        .map(
          ([label, value]) =>
            `<tr><th align="left">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`
        )
        .join("")}
    </table>
  `;

  return {
    subject: `New website inquiry from ${payload.fullName || "website visitor"}`,
    textBody,
    htmlBody
  };
}

async function sendViaMailChannels({ config, payload, fetchImpl }) {
  if (!config.mailchannelsApiKey) {
    return {
      ok: false,
      status: 500,
      provider: "mailchannels",
      error: "Missing MAILCHANNELS_API_KEY environment variable."
    };
  }

  const { textBody, htmlBody, subject } = buildInquiryEmailContent(payload);
  const replyTo = String(payload.emailAddress || "").trim();
  const responsePayload = {
    personalizations: [
      {
        to: config.toEmails.map((email) => ({ email }))
      }
    ],
    from: {
      email: config.fromEmail,
      name: "Meritsource Studio Website"
    },
    subject,
    content: [
      { type: "text/plain", value: textBody },
      { type: "text/html", value: htmlBody }
    ]
  };

  if (replyTo) {
    responsePayload.reply_to = {
      email: replyTo,
      name: String(payload.fullName || "").trim() || "Website visitor"
    };
  }

  let response;
  try {
    response = await fetchImpl(joinUrl(config.mailchannelsBaseUrl, "send"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Api-Key": config.mailchannelsApiKey
      },
      body: JSON.stringify(responsePayload)
    });
  } catch (error) {
    return {
      ok: false,
      status: 502,
      provider: "mailchannels",
      error: error.message
    };
  }

  const responseText = await response.text();
  const responseJson = parseJsonSafely(responseText);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status || 502,
      provider: "mailchannels",
      error: extractErrorMessage(responseText, responseJson),
      responseText
    };
  }

  return {
    ok: true,
    status: 200,
    provider: "mailchannels",
    deliveryStatus: "sent",
    response: responseJson || responseText || null
  };
}

async function sendViaCloudflareEmailService({ config, payload, fetchImpl }) {
  if (!config.cloudflareAccountId || !config.cloudflareApiToken) {
    return {
      ok: false,
      status: 500,
      provider: "cloudflare-email-service",
      error: "Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_EMAIL_API_TOKEN environment variable."
    };
  }

  const { textBody, htmlBody, subject } = buildInquiryEmailContent(payload);
  const replyTo = String(payload.emailAddress || "").trim();
  const responsePayload = {
    to: config.toEmail,
    from: config.fromEmail,
    subject,
    text: textBody,
    html: htmlBody
  };

  if (replyTo) {
    responsePayload.reply_to = replyTo;
  }

  let response;
  try {
    response = await fetchImpl(
      `https://api.cloudflare.com/client/v4/accounts/${config.cloudflareAccountId}/email/sending/send`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.cloudflareApiToken}`
        },
        body: JSON.stringify(responsePayload)
      }
    );
  } catch (error) {
    return {
      ok: false,
      status: 502,
      provider: "cloudflare-email-service",
      error: error.message
    };
  }

  const responseText = await response.text();
  const responseJson = parseJsonSafely(responseText);

  if (!response.ok || !responseJson?.success) {
    return {
      ok: false,
      status: response.status || 502,
      provider: "cloudflare-email-service",
      error: extractErrorMessage(responseText, responseJson),
      responseText
    };
  }

  return {
    ok: true,
    status: 200,
    provider: "cloudflare-email-service",
    deliveryStatus: "sent",
    response: responseJson.result || null
  };
}

export async function sendInquiryEmail({ env = {}, payload = {}, fetchImpl = fetch } = {}) {
  const config = getInquiryEmailConfig(env);

  if (config.provider === "mailchannels") {
    return sendViaMailChannels({ config, payload, fetchImpl });
  }

  if (config.provider === "cloudflare-email-service") {
    return sendViaCloudflareEmailService({ config, payload, fetchImpl });
  }

  return {
    ok: false,
    status: 500,
    provider: config.provider,
    error: 'Unsupported EMAIL_PROVIDER value. Use "mailchannels" or "cloudflare-email-service".'
  };
}
