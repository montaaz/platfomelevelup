import { NextResponse, type NextRequest } from "next/server";
import { ctxOrNull, ValidationError } from "@/server/context";
import { listClientFiles, uploadClientFiles } from "@/server/services/clientFiles";

/** Fichiers du client connecté (liste filtrable par besoin). */
export async function GET(req: NextRequest) {
  const ctx = await ctxOrNull("CLIENT");
  if (!ctx) return NextResponse.json({ error: "Session expirée." }, { status: 401 });
  const need = req.nextUrl.searchParams.get("need");
  const files = await listClientFiles(ctx, { need: need && /^[A-Z_]{2,40}$/.test(need) ? need : null });
  return NextResponse.json({ files });
}

/**
 * Dépôt de fichiers (multipart : `need`, `files`). Chaque fichier est
 * contrôlé (extension, signature, contenu, antivirus) avant d'être conservé ;
 * les refus sont renvoyés un par un, les fichiers suspects alertent l'équipe.
 */
export async function POST(req: NextRequest) {
  const ctx = await ctxOrNull("CLIENT");
  if (!ctx) return NextResponse.json({ error: "Session expirée." }, { status: 401 });
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const needRaw = form.get("need");
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const meta = {
    ip: req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: req.headers.get("user-agent"),
  };
  try {
    const result = await uploadClientFiles(ctx, typeof needRaw === "string" ? needRaw : null, files, meta);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[fichiers] dépôt:", e);
    return NextResponse.json({ error: "Dépôt impossible pour le moment." }, { status: 500 });
  }
}
