import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";

const root = "D:\\msourceio-site";
const capturedRequests = [];

const mockServer = http.createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) {
    body += typeof chunk === "string" ? chunk : chunk.toString("utf8");
  }

  capturedRequests.push({
    method: req.method,
    url: req.url,
    headers: req.headers,
    body
  });

  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ success: true, result: { id: "mock-mailchannels-delivery" } }));
});

function spawnNode(args, env) {
  const child = spawn("node", args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[${args[0]}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${args[0]} err] ${chunk}`));
  return child;
}

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close(() => resolve(port));
    });
  });
}

async function waitForHttp(url, retries = 50) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok) return;
    } catch {
      // Keep waiting.
    }
    await delay(100);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

const mockPort = await getFreePort();
const appPort = await getFreePort();

await new Promise((resolve) => {
  mockServer.listen(mockPort, "127.0.0.1", resolve);
});

const app = spawnNode(["server.mjs", "--port", String(appPort)], {
  EMAIL_PROVIDER: "mailchannels",
  INQUIRY_TO_EMAIL: "1476080750@qq.com",
  MAILCHANNELS_API_KEY: "test-key",
  MAILCHANNELS_BASE_URL: `http://127.0.0.1:${mockPort}/tx/v1`
});

try {
  await waitForHttp(`http://127.0.0.1:${appPort}/contact.html`);

  const response = await fetch(`http://127.0.0.1:${appPort}/api/inquiry`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fullName: "Test User",
      emailAddress: "tester@example.com",
      companyName: "Acme",
      whatsApp: "123456",
      country: "China",
      businessType: "Distributor",
      productInterest: "Pilates Grip Socks",
      estimatedQuantity: "100",
      needCustomLogo: "Yes",
      packagingRequirement: "Gift box",
      message: "Hello from the local verification script"
    })
  });

  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(`Unexpected response: ${response.status} ${JSON.stringify(data)}`);
  }

  const sent = capturedRequests[0];
  if (!sent) {
    throw new Error("MailChannels mock did not receive any request.");
  }

  const sentBody = JSON.parse(sent.body);
  const recipients = sentBody.personalizations?.[0]?.to?.map((recipient) => recipient.email) || [];
  for (const email of ["1476080750@qq.com", "annliao@msourceio.com"]) {
    if (!recipients.includes(email)) {
      throw new Error(`Expected MailChannels recipient ${email}.`);
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        response: data,
        mailchannelsRequest: {
          method: sent.method,
          url: sent.url,
          apiKeyHeaderPresent: Boolean(sent.headers["x-api-key"]),
          to: recipients,
          from: sentBody.from?.email,
          subject: sentBody.subject
        }
      },
      null,
      2
    )
  );
} finally {
  mockServer.close();
  app.kill("SIGTERM");
}
