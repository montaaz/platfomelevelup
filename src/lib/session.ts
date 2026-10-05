import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";

export type SessionPayload = {
  userId: string; // BigInt serialized as string
  role: "ADMIN" | "CLIENT";
  clientId: string | null;
  fullName: string;
  email: string;
};

const SESSION_COOKIE = "levelup_session";
const SESSION_HOURS = 12;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET missing or too short");
  return new TextEncoder().encode(s);
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // A `Secure` cookie is only kept by the browser over HTTPS. Flagging it from
    // NODE_ENV alone silently breaks login on an HTTP deployment (IP or staging):
    // the login succeeds, the cookie is dropped, and the guard bounces back to
    // /login. So decide from the real protocol of the request instead.
    secure: await isHttpsRequest(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

/** True when the visitor reached us over HTTPS (directly or via a proxy). */
async function isHttpsRequest(): Promise<boolean> {
  // COOKIE_SECURE=true|false forces the behaviour when needed.
  const forced = process.env.COOKIE_SECURE;
  if (forced === "true") return true;
  if (forced === "false") return false;

  const h = await headers();
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (proto) return proto === "https";
  return (process.env.APP_URL ?? "").startsWith("https://");
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, secret());
    return {
      userId: payload.userId,
      role: payload.role,
      clientId: payload.clientId,
      fullName: payload.fullName,
      email: payload.email,
    };
  } catch {
    return null;
  }
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export { SESSION_COOKIE };

/* ---------------------------------------------- paiement avant inscription */

const PREPAID_COOKIE = "levelup_prepaid";
const PREPAID_DAYS = 30;

/**
 * Le visiteur vient de payer depuis le panier du site vitrine mais n'a pas
 * encore de compte : ce cookie signé garde la trace de son paiement jusqu'à
 * l'inscription ou la connexion, où il devient une commande payée.
 */
export async function rememberPrepaidPayment(prepaidId: string) {
  const token = await new SignJWT({ prepaid: prepaidId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PREPAID_DAYS}d`)
    .sign(secret());
  const store = await cookies();
  store.set(PREPAID_COOKIE, token, {
    httpOnly: true,
    secure: await isHttpsRequest(),
    sameSite: "lax",
    path: "/",
    maxAge: PREPAID_DAYS * 86_400,
  });
}

/** Identifiant du paiement à rattacher, ou null. */
export async function readPrepaidPayment(): Promise<string | null> {
  const token = (await cookies()).get(PREPAID_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.prepaid === "string" && /^\d{1,18}$/.test(payload.prepaid) ? payload.prepaid : null;
  } catch {
    return null;
  }
}

export async function forgetPrepaidPayment() {
  (await cookies()).delete(PREPAID_COOKIE);
}
