import { NextResponse, type NextRequest } from "next/server";
import { destroySession } from "@/lib/session";

export async function POST(_req: NextRequest) {
  await destroySession();
  // Relative Location header: the browser stays on the host it used (IP, domain,
  // or localhost). An absolute URL built from req.url would send everyone to
  // whatever address the server believes it has — e.g. localhost behind a proxy.
  return new NextResponse(null, { status: 303, headers: { Location: "/login" } });
}
