import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { ctxOrNull } from "@/server/context";
import { proofFileFor } from "@/server/services/transfers";

/** Justificatif de virement : admin, ou le client qui l'a déposé. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d{1,18}$/.test(id)) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  const ctx = await ctxOrNull();
  if (!ctx) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  try {
    const { filePath, mimeType, originalName } = await proofFileFor(ctx, BigInt(id));
    const data = await readFile(filePath);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(originalName)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }
}
