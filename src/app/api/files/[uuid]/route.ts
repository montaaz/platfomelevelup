import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Files are stored OUTSIDE the public folder (spec §7). This route is the only
 * way to reach one: valid session + ownership of the file's project, checked
 * server-side on every request. The URL uses the file's UUID — non-guessable.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await params;
  if (!UUID_RE.test(uuid)) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const file = await prisma.file.findFirst({
    where: {
      publicId: uuid,
      deletedAt: null,
      // a client only ever reaches files of their own projects — enforced in SQL
      ...(session.role === "CLIENT"
        ? { project: { clientId: BigInt(session.clientId ?? "-1"), deletedAt: null } }
        : {}),
    },
  });
  if (!file) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  // storage_key is server-generated; resolve + verify it stays inside the root
  const filePath = path.resolve(STORAGE_ROOT, file.storageKey);
  if (!filePath.startsWith(STORAGE_ROOT)) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  let data: Buffer;
  try {
    data = await readFile(filePath);
  } catch {
    return NextResponse.json({ error: "Fichier indisponible." }, { status: 404 });
  }

  await prisma.auditLog.create({
    data: {
      userId: BigInt(session.userId),
      action: "FILE_DOWNLOAD",
      entityType: "file",
      entityId: file.id,
    },
  });

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(file.originalName)}"`,
      "Content-Length": String(data.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}
