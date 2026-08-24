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
  const isClientPath = pathname.startsWith("/client");
  const isLogin = pathname === "/login";

  if ((isAdminPath || isClientPath) && !session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (isAdminPath && session?.role !== "ADMIN") {
    return session ? NextResponse.redirect(new URL("/client", req.url)) : NextResponse.next();
  }
  if (isClientPath && session?.role !== "CLIENT") {
    return session ? NextResponse.redirect(new URL("/admin", req.url)) : NextResponse.next();
  }
  if (isLogin && session) {
    return NextResponse.redirect(new URL(session.role === "ADMIN" ? "/admin" : "/client", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/client/:path*", "/login"],
};
