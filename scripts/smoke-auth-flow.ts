type CookieJar = Record<string, string>;

const API_BASE_URL =
  process.env.SMOKE_API_BASE_URL || "http://localhost:4000/api/v1";
const email =
  process.env.SMOKE_EMAIL ||
  `smoke-${Date.now()}@example.com`;
const password = process.env.SMOKE_PASSWORD || "SmokeTest123!";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function cookieHeader(jar: CookieJar): string {
  return Object.entries(jar)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

function storeCookies(jar: CookieJar, response: Response) {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) return;

  for (const cookie of setCookie.split(/,(?=\s*[^;=]+=[^;]+)/)) {
    const [pair] = cookie.trim().split(";");
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;
    jar[pair.slice(0, separator)] = pair.slice(separator + 1);
  }
}

async function request(
  jar: CookieJar,
  path: string,
  init: RequestInit = {}
) {
  const method = init.method?.toUpperCase() || "GET";
  const headers = new Headers(init.headers);

  if (Object.keys(jar).length > 0) {
    headers.set("Cookie", cookieHeader(jar));
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(method) && jar.csrf_token) {
    headers.set("X-CSRF-Token", jar.csrf_token);
  }

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  storeCookies(jar, response);

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  return { response, data };
}

async function main() {
  const jar: CookieJar = {};

  console.log(`Smoke API: ${API_BASE_URL}`);
  console.log(`Smoke user: ${email}`);

  const register = await request(jar, "/auth/register", {
    method: "POST",
    body: JSON.stringify({
      fullName: "Smoke Test Customer",
      email,
      phone: "+918428489046",
      password,
    }),
  });

  if (!register.response.ok && register.response.status !== 409) {
    throw new Error(`Register failed: ${register.response.status}`);
  }

  const login = await request(jar, "/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  assert(login.response.ok, `Login failed: ${login.response.status}`);
  assert(jar.token, "Auth token cookie was not set");
  assert(jar.csrf_token, "CSRF cookie was not set");
  console.log("Login OK, auth and CSRF cookies set.");

  const me = await request(jar, "/auth/me");
  assert(me.response.ok, `/auth/me failed: ${me.response.status}`);
  assert(me.data?.data?.user?.email === email, "/auth/me returned wrong user");
  console.log("/auth/me OK.");

  const preferredDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const booking = await request(jar, "/bookings", {
    method: "POST",
    body: JSON.stringify({
      serviceType: "Electrical",
      issueDescription: "Smoke test booking created to verify CSRF flow.",
      serviceAddress: "Smoke Test Address, Nagercoil",
      preferredDate,
    }),
  });
  assert(
    booking.response.ok,
    `CSRF-protected booking create failed: ${booking.response.status}`
  );
  console.log("CSRF-protected booking create OK.");

  const logout = await request(jar, "/auth/logout", { method: "POST" });
  assert(logout.response.ok, `Logout failed: ${logout.response.status}`);
  console.log("Logout OK.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
