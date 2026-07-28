const path = require("path");
const { spawn } = require("child_process");
const { once } = require("events");

const frontendRoot = path.resolve(__dirname, "..");
const nextCli = path.join(
  frontendRoot,
  "node_modules",
  "next",
  "dist",
  "bin",
  "next",
);
const port = Number(process.env.ROUTE_SMOKE_PORT || 3128);
const origin = `http://127.0.0.1:${port}`;

const expectedOkRoutes = [
  "/",
  "/home",
  "/signup",
  "/first-login",
  "/login",
  "/welcome",
  "/forgot",
  "/reset",
  "/verify",
  "/verify/expired",
  "/recover",
  "/create",
  "/create/build-my-card",
  "/create/personalize-a-template",
  "/create/my-cards-and-songs",
  "/my-cards",
  "/pricing",
  "/cart",
  "/delivery",
  "/delivery/confirmation",
  `/delivery/confirmation?orderId=${"0".repeat(8)}-${"0".repeat(4)}-4000-8000-${"0".repeat(12)}`,
  "/account/profile",
  "/account/settings",
  "/account/top-up",
  "/gift",
  "/gift/redeem",
  "/refer",
  "/faq",
  "/contact",
  "/legal/privacy-policy",
  "/legal/terms-of-service",
  "/legal/refund-policy",
  "/legal/cookie-policy",
  `/listen/${"A".repeat(43)}`,
];

const expectedNotFoundRoutes = ["/community-cards"];

const expectedSecurityHeaders = {
  "strict-transport-security": "max-age=31536000",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForServer(server, output) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(
        `Next production server exited before it was ready.\n${output.join("")}`,
      );
    }

    try {
      const response = await fetch(origin, { redirect: "manual" });
      if (response.status === 200) return;
    } catch {
      // The server can refuse connections briefly while Next initializes.
    }
    await delay(250);
  }

  throw new Error(`Next production server was not ready within 30 seconds.`);
}

async function assertRoute(route, expectedStatus) {
  const response = await fetch(`${origin}${route}`, {
    redirect: "manual",
    headers: { Accept: "text/html" },
  });
  if (response.status !== expectedStatus) {
    throw new Error(
      `${route} returned ${response.status}; expected ${expectedStatus}.`,
    );
  }
}

async function assertSecurityHeaders(route) {
  const response = await fetch(`${origin}${route}`, {
    redirect: "manual",
    headers: { Accept: "text/html" },
  });

  for (const [name, expectedValue] of Object.entries(
    expectedSecurityHeaders,
  )) {
    const actualValue = response.headers.get(name);
    if (actualValue !== expectedValue) {
      throw new Error(
        `${route} returned ${name}: ${JSON.stringify(actualValue)}; expected ${JSON.stringify(expectedValue)}.`,
      );
    }
  }

  const poweredBy = response.headers.get("x-powered-by");
  if (poweredBy) {
    throw new Error(
      `${route} exposed x-powered-by: ${JSON.stringify(poweredBy)}.`,
    );
  }
}

async function stopServer(server) {
  if (server.exitCode !== null) return;
  server.kill("SIGTERM");
  await Promise.race([once(server, "exit"), delay(5_000)]);
  if (server.exitCode === null) {
    server.kill("SIGKILL");
    await once(server, "exit");
  }
}

async function main() {
  if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
    throw new Error("ROUTE_SMOKE_PORT must be an integer from 1024 to 65535.");
  }

  const output = [];
  const server = spawn(
    process.execPath,
    [nextCli, "start", "-p", String(port)],
    {
      cwd: frontendRoot,
      env: { ...process.env, NODE_ENV: "production" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  server.stdout.on("data", (chunk) => output.push(chunk.toString()));
  server.stderr.on("data", (chunk) => output.push(chunk.toString()));

  try {
    await waitForServer(server, output);
    for (const route of expectedOkRoutes) {
      await assertRoute(route, 200);
    }
    for (const route of expectedNotFoundRoutes) {
      await assertRoute(route, 404);
    }
    await assertSecurityHeaders("/");
    console.log(
      `Route smoke passed: ${expectedOkRoutes.length} expected routes returned 200, ${expectedNotFoundRoutes.length} intentional route returned 404, and frontend security headers matched policy.`,
    );
  } finally {
    await stopServer(server);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
