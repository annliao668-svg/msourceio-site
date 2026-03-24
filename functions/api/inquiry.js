const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const requiredFields = ["fullName", "emailAddress", "message"];

export async function onRequestPost(context) {
  try {
    const payload = await context.request.json();

    if (payload.website) {
      return json({ ok: true, message: "Inquiry submitted successfully." });
    }

    for (const field of requiredFields) {
      if (!String(payload[field] || "").trim()) {
        return json(
          { ok: false, message: "Please complete the required fields before submitting." },
          400
        );
      }
    }

    const toEmail = context.env.INQUIRY_TO_EMAIL;
    const fromEmail = context.env.INQUIRY_FROM_EMAIL;

    if (!toEmail || !fromEmail) {
      return json(
        { ok: false, message: "Email delivery is not configured yet. Please contact us on WhatsApp." },
        500
      );
    }

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

    const mailResponse = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: toEmail }] }],
        from: {
          email: fromEmail,
          name: "Meritsource Studio Website"
        },
        reply_to: {
          email: payload.emailAddress,
          name: payload.fullName
        },
        subject: `New website inquiry from ${payload.fullName}`,
        content: [
          { type: "text/plain", value: textBody },
          { type: "text/html", value: htmlBody }
        ]
      })
    });

    if (!mailResponse.ok) {
      const errorText = await mailResponse.text();
      return json(
        {
          ok: false,
          message: "Unable to send inquiry email right now. Please contact us on WhatsApp.",
          error: errorText
        },
        502
      );
    }

    return json({
      ok: true,
      message: "Inquiry submitted successfully. It has been sent to our email inbox for follow-up."
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "Unable to submit the inquiry right now. Please try again later or contact us on WhatsApp.",
        error: error.message
      },
      500
    );
  }
}
