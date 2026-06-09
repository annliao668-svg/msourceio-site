import http from "node:http";
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { sendInquiryEmail, validateInquiryPayload } from "./functions/lib/inquiry-email.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = parsePort(process.argv, 8000);
const inquiryDir = path.join(root, "work", "website-inquiries");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

function parsePort(argv, fallback) {
  const index = argv.indexOf("--port");
  if (index >= 0 && argv[index + 1]) {
    const value = Number(argv[index + 1]);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return fallback;
}

function send(res, statusCode, body, headers = {}) {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body), "utf8");
  res.writeHead(statusCode, {
    "Content-Length": buffer.length,
    ...headers
  });
  res.end(buffer);
}

function sendJson(res, statusCode, payload) {
  send(res, statusCode, JSON.stringify(payload), {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
}

function getContentType(filePath) {
  return contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function buildRecord(payload) {
  return {
    submittedAt: new Date().toISOString(),
    fullName: String(payload.fullName || ""),
    companyName: String(payload.companyName || ""),
    emailAddress: String(payload.emailAddress || ""),
    whatsApp: String(payload.whatsApp || ""),
    country: String(payload.country || ""),
    businessType: String(payload.businessType || ""),
    productInterest: String(payload.productInterest || ""),
    estimatedQuantity: String(payload.estimatedQuantity || ""),
    needCustomLogo: String(payload.needCustomLogo || ""),
    packagingRequirement: String(payload.packagingRequirement || ""),
    message: String(payload.message || "")
  };
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function saveInquiry(record) {
  await fs.mkdir(inquiryDir, { recursive: true });

  const safeStamp = record.submittedAt.replace(/[:.]/g, "-");
  const jsonPath = path.join(inquiryDir, `inquiry-${safeStamp}.json`);
  const csvPath = path.join(inquiryDir, "website-inquiries.csv");

  await fs.writeFile(jsonPath, JSON.stringify(record, null, 2), "utf8");

  const columns = [
    ["Submitted At", "submittedAt"],
    ["Full Name", "fullName"],
    ["Company Name", "companyName"],
    ["Email Address", "emailAddress"],
    ["WhatsApp", "whatsApp"],
    ["Country", "country"],
    ["Business Type", "businessType"],
    ["Product Interest", "productInterest"],
    ["Estimated Quantity", "estimatedQuantity"],
    ["Need Custom Logo", "needCustomLogo"],
    ["Packaging Requirement", "packagingRequirement"],
    ["Message", "message"]
  ];

  const row = columns
    .map(([, key]) => csvEscape(record[key]))
    .join(",");
  const csvLine = `${row}\r\n`;

  if (await fileExists(csvPath)) {
    await fs.appendFile(csvPath, csvLine, "utf8");
  } else {
    const header = `${columns.map(([label]) => csvEscape(label)).join(",")}\r\n`;
    await fs.writeFile(csvPath, `${header}${csvLine}`, "utf8");
  }

  return { jsonPath, csvPath };
}

async function resolveStaticFile(requestPath) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(requestPath || "/");
  } catch {
    return null;
  }

  if (!decodedPath || decodedPath === "/") {
    decodedPath = "/index.html";
  }

  const trimmed = decodedPath.replace(/^\/+/, "");
  const basePath = path.resolve(root, trimmed);
  const candidates = [];

  if (decodedPath.endsWith("/")) {
    candidates.push(path.join(basePath, "index.html"));
  }

  candidates.push(basePath);

  if (!path.extname(basePath)) {
    candidates.push(`${basePath}.html`);
  }

  if (!decodedPath.endsWith("/")) {
    candidates.push(path.join(basePath, "index.html"));
  }

  const seen = new Set();
  for (const candidate of candidates) {
    const normalized = path.resolve(candidate);
    const relative = path.relative(root, normalized);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      continue;
    }
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);

    try {
      const stats = await fs.stat(normalized);
      if (stats.isFile()) {
        return normalized;
      }
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url || "/", "http://127.0.0.1");

    if (pathname === "/api/inquiry") {
      if (req.method !== "POST") {
        sendJson(res, 405, {
          ok: false,
          message: "Method not allowed."
        });
        return;
      }

      const rawBody = await readBody(req);
      const payload = rawBody ? JSON.parse(rawBody) : {};

      if (payload.website) {
        sendJson(res, 200, {
          ok: true,
          message: "Inquiry submitted successfully."
        });
        return;
      }

      const validation = validateInquiryPayload(payload);
      if (!validation.ok) {
        sendJson(res, validation.status, {
          ok: false,
          message: validation.message
        });
        return;
      }

      const emailResult = await sendInquiryEmail({
        env: process.env,
        payload
      });

      if (!emailResult.ok) {
        sendJson(res, emailResult.status || 502, {
          ok: false,
          message: "Sorry — we can't submit your inquiry right now. For immediate assistance, please contact us on WhatsApp.",
          error: emailResult.error
        });
        return;
      }

      const record = buildRecord(payload);
      const saved = await saveInquiry(record);

      sendJson(res, 200, {
        ok: true,
        message: "Inquiry submitted successfully. It has been sent to our email inbox for follow-up.",
        savedTo: saved.csvPath,
        deliveryStatus: "sent"
      });
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, {
        ok: false,
        message: "Method not allowed."
      });
      return;
    }

    const filePath = await resolveStaticFile(pathname);
    if (!filePath) {
      send(res, 404, "Not Found", {
        "Content-Type": "text/plain; charset=utf-8"
      });
      return;
    }

    const fileBytes = await fs.readFile(filePath);
    res.writeHead(200, {
      "Content-Type": getContentType(filePath),
      "Content-Length": fileBytes.length
    });
    if (req.method === "HEAD") {
      res.end();
    } else {
      res.end(fileBytes);
    }
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      message: "Server Error",
      error: error.message
    });
  }
});

server.listen(port, () => {
  console.log(`Serving demo at http://127.0.0.1:${port} from ${root}`);
});
