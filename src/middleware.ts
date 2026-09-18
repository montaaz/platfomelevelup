import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "levelup_session";

/**
 * First security gate: no page of either space renders without a valid session
 * of the right role. The real authorization (data scoping) happens again in
 * every resolver/service — this is defense in depth, not the only check.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;

  let session: { role?: string } | null = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET!));
      session = payload as { role?: string };
    } catch {
      session = null;
    }
  }

  const isAdminPath = pathname.startsWith("/admin");
  const isClientPath = pathname.startsWith("/client") || pathname === "/bienvenue" || pathname === "/paiement";
  // pages publiques d'authentification : connexion et inscription
  const isLogin = pathname === "/login" || pathname === "/inscription";

  /**
   * Middleware requires an absolute Location, so rebuild it from the host the
   * browser actually used (x-forwarded-* when behind a proxy, else Host).
   * Using req.url directly would send everyone to the address the server
   * believes it has — typically localhost behind a proxy.
   */
  const redirectTo = (path: string) => {
    const url = new URL(path, req.url);
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (host) {
      url.host = host;
      url.protocol = req.headers.get("x-forwarded-proto") ?? url.protocol;
    }
    return NextResponse.redirect(url, 307);
  };

  if ((isAdminPath || isClientPath) && !session) {
    return redirectTo(`/login?next=${encodeURIComponent(pathname)}`);
  }
  if (isAdminPath && session?.role !== "ADMIN") {
    return session ? redirectTo("/client") : NextResponse.next();
  }
  if (isClientPath && session?.role !== "CLIENT") {
    return session ? redirectTo("/admin") : NextResponse.next();
  }
  if (isLogin && session) {
    return redirectTo(session.role === "ADMIN" ? "/admin" : "/client");
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/client/:path*", "/bienvenue", "/paiement", "/login", "/inscription"],
};
