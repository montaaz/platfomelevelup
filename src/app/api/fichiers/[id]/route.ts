import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { ctxOrNull, ForbiddenError, ValidationError } from "@/server/context";
import { clientFileFor, deleteClientFile } from "@/server/services/clientFiles";

const parseId = (raw: string) => (/^\d{1,18}$/.test(raw) ? BigInt(raw) : null);

/**
 * Téléchargement d'un fichier client (son propriétaire ou un administrateur).
 * Toujours en pièce jointe, avec le type MIME de notre liste blanche (jamais
 * celui du navigateur) et sans interprétation possible par le navigateur.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await ctxOrNull();
  if (!ctx) return NextResponse.json({ error: "Session expirée." }, { status: 401 });
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
  try {
    const { filePath, mimeType, originalName, size } = await clientFileFor(ctx, id);
    const data = await readFile(filePath);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(size),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(originalName)}`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 404 });
    console.error("[fichiers] lecture:", e);
    return NextResponse.json({ error: "Fichier indisponible." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await ctxOrNull();
  if (!ctx) return NextResponse.json({ error: "Session expirée." }, { status: 401 });
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
  try {
    await deleteClientFile(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 404 });
    console.error("[fichiers] suppression:", e);
    return NextResponse.json({ error: "Suppression impossible." }, { status: 500 });
  }
}
