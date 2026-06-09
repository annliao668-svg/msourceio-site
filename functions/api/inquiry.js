import {
  sendInquiryEmail,
  validateInquiryPayload
} from "../lib/inquiry-email.mjs";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept'
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: Object.assign(
      {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      },
      CORS_HEADERS
    )
  });

export function onRequestOptions(context) {
  // Handle preflight CORS requests
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS
  });
}

export async function onRequestPost(context) {
  try {
    const payload = await context.request.json();

    if (payload.website) {
      return json({ ok: true, message: "Inquiry submitted successfully." });
    }

    const validation = validateInquiryPayload(payload);
    if (!validation.ok) {
      return json({ ok: false, message: validation.message }, validation.status);
    }

    const emailResult = await sendInquiryEmail({
      env: context.env,
      payload
    });

    if (!emailResult.ok) {
      return json(
        {
          ok: false,
          message: "Sorry — we couldn't send your inquiry. For immediate assistance, please contact us on WhatsApp.",
          error: emailResult.error
        },
        emailResult.status || 502
      );
    }

    return json({
      ok: true,
      message: "Inquiry submitted successfully. It has been sent to our email inbox for follow-up.",
      deliveryStatus: "sent"
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "Sorry — we couldn't submit your inquiry right now. For immediate assistance, please contact us on WhatsApp.",
        error: error.message
      },
      500
    );
  }
}
