import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile, unlink, rename, stat } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { clientScope, ForbiddenError, ValidationError, type Ctx } from "@/server/context";
import { inspectFile, MAX_FILE_BYTES, type FileKind } from "@/lib/fileSecurity";
import { MAIN_NEEDS } from "@/lib/onboardingOptions";
import { mirrorNotificationEmails, notifyTeamByEmail } from "@/lib/mail";

/**
 * Fichiers déposés par les clients pour décrire leurs besoins.
 *
 * Défense en profondeur :
 *  - session client obligatoire, fichiers toujours rattachés au client connecté ;
 *  - quotas (par requête, par client, par heure) ;
 *  - contrôle de contenu (lib/fileSecurity : extension, signature, inspection) ;
 *  - antivirus ClamAV quand il est installé (le fichier passe par une quarantaine) ;
 *  - nom de stockage aléatoire, répertoire hors web, droits 0600 ;
 *  - journal de sécurité + alerte des administrateurs ; dépôt suspendu 24 h
 *    après plusieurs fichiers suspects.
 * Les requêtes SQL passent par Prisma (paramétrées) : aucun fragment de
 * requête n'est construit à partir de ce que le navigateur envoie.
 */

const STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads");
const QUARANTINE = path.join(STORAGE_ROOT, "quarantine");
const MAX_PER_REQUEST = 10;
const MAX_FILES_PER_CLIENT = 60;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024; // 200 Mo par client
const MAX_UPLOADS_PER_HOUR = 40;
const SUSPECT_LIMIT_24H = 3;
const SCAN_TIMEOUT_MS = 45_000;

const run = promisify(execFile);

export type ClientFileRow = {
  id: string;
  need: string | null;
  name: string;
  mime: string;
  kind: FileKind;
  size: number;
  createdAt: string;
};

export type UploadMeta = { ip: string | null; userAgent: string | null };

/* ------------------------------------------------------------ limites */

const uploadsPerClient = new Map<string, number[]>();
function rateLimited(clientId: bigint, count: number): boolean {
  const key = clientId.toString();
  const now = Date.now();
  const recent = (uploadsPerClient.get(key) ?? []).filter((t) => now - t < 3_600_000);
  const limited = recent.length + count > MAX_UPLOADS_PER_HOUR;
  if (!limited) for (let i = 0; i < count; i++) recent.push(now);
  uploadsPerClient.set(key, recent);
  if (uploadsPerClient.size > 5000) uploadsPerClient.clear();
  return limited;
}

/* ------------------------------------------------------------ antivirus */

let clamdscanPath: Promise<string | null> | null = null;
function findClamav(): Promise<string | null> {
  if (!clamdscanPath) {
    clamdscanPath = (async () => {
      if (process.env.CLAMAV_DISABLED === "1") return null;
      for (const bin of [process.env.CLAMDSCAN_PATH, "/usr/bin/clamdscan", "/usr/local/bin/clamdscan"]) {
        if (!bin) continue;
        try {
          await stat(bin);
          return bin;
        } catch {
          /* suivant */
        }
      }
      return null;
    })();
  }
  return clamdscanPath;
}

type ScanResult = { status: "clean" | "infected" | "unavailable"; detail: string };

/** Analyse ClamAV d'un fichier en quarantaine. Sans ClamAV installé : « unavailable ». */
async function scanWithClamav(filePath: string): Promise<ScanResult> {
  const bin = await findClamav();
  if (!bin) return { status: "unavailable", detail: "ClamAV non installé" };
  try {
    await run(bin, ["--no-summary", "--fdpass", filePath], { timeout: SCAN_TIMEOUT_MS, maxBuffer: 1 << 20 });
    return { status: "clean", detail: `ClamAV (${path.basename(bin)})` };
  } catch (e) {
    const err = e as { code?: number | string; stdout?: string; stderr?: string; killed?: boolean };
    if (err.code === 1) {
      const name = String(err.stdout ?? "").match(/:\s*(.+?)\s+FOUND/)?.[1] ?? "menace détectée";
      return { status: "infected", detail: name };
    }
    return { status: "unavailable", detail: `ClamAV indisponible (${String(err.stderr ?? err.code ?? "erreur").slice(0, 120)})` };
  }
}

/* ------------------------------------------------------------ journal + alertes */

type Severity = "info" | "suspect" | "critique";

async function recordSecurityEvent(input: {
  clientId: bigint | null;
  userId: bigint | null;
  kind: string;
  severity: Severity;
  reason: string;
  fileName?: string | null;
  sha256?: string | null;
  meta?: UploadMeta;
}) {
  await prisma.securityEvent.create({
    data: {
      clientId: input.clientId,
      userId: input.userId,
      kind: input.kind,
      severity: input.severity,
      reason: input.reason.slice(0, 2000),
      fileName: input.fileName?.slice(0, 255) ?? null,
      sha256: input.sha256 ?? null,
      ip: input.meta?.ip?.slice(0, 64) ?? null,
      userAgent: input.meta?.userAgent?.slice(0, 300) ?? null,
    },
  });
}

/** Alerte dans la cloche des administrateurs + e-mail à l'équipe. Ne lève jamais. */
async function alertAdmins(title: string, body: string) {
  try {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((a) => ({ userId: a.id, type: "ALERTE_SECURITE" as const, title, body, entityType: "security" })),
      });
      mirrorNotificationEmails(admins.map((a) => a.id), title, body);
    }
    notifyTeamByEmail(title, body);
  } catch (e) {
    console.error("[sécurité] alerte non envoyée:", e);
  }
}

let lastUnavailableAlert = 0;

/* ------------------------------------------------------------ dépôt */

export async function uploadClientFiles(
  ctx: Ctx,
  rawNeed: string | null,
  files: File[],
  meta: UploadMeta,
): Promise<{ saved: ClientFileRow[]; rejected: { name: string; reason: string }[] }> {
  const clientId = clientScope(ctx);
  const need = rawNeed && MAIN_NEEDS.some((o) => o.value === rawNeed) ? rawNeed : null;
  if (files.length === 0) throw new ValidationError("Aucun fichier reçu.");
  if (files.length > MAX_PER_REQUEST) throw new ValidationError(`Au plus ${MAX_PER_REQUEST} fichiers à la fois.`);

  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId }, select: { companyName: true } });
  const who = `${client.companyName} (client ${clientId}, ${ctx.fullName})`;

  // Dépôt suspendu après plusieurs fichiers suspects en 24 h.
  const dayAgo = new Date(Date.now() - 86_400_000);
  const suspects = await prisma.securityEvent.count({ where: { clientId, severity: { in: ["suspect", "critique"] }, createdAt: { gte: dayAgo } } });
  if (suspects >= SUSPECT_LIMIT_24H) {
    await recordSecurityEvent({ clientId, userId: ctx.userId, kind: "UPLOAD_BLOQUE", severity: "suspect", reason: `tentative de dépôt pendant la suspension (${suspects} fichiers suspects en 24 h)`, meta });
    throw new ValidationError("Le dépôt de fichiers est suspendu pendant 24 h après plusieurs fichiers refusés pour des raisons de sécurité. L'équipe a été prévenue et vous recontacte.");
  }
  if (rateLimited(clientId, files.length)) throw new ValidationError("Trop de dépôts en une heure. Réessayez un peu plus tard.");

  const existing = await prisma.clientFile.aggregate({ where: { clientId }, _count: { id: true }, _sum: { sizeBytes: true } });
  let count = existing._count.id;
  let total = Number(existing._sum.sizeBytes ?? 0);

  const saved: ClientFileRow[] = [];
  const rejected: { name: string; reason: string }[] = [];

  for (const file of files) {
    const rawName = typeof file.name === "string" ? file.name : "fichier";
    if (file.size > MAX_FILE_BYTES) {
      rejected.push({ name: rawName.slice(0, 120), reason: `fichier trop volumineux (maximum ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} Mo)` });
      continue;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    const verdict = inspectFile(rawName, file.type, bytes);

    if (!verdict.ok) {
      rejected.push({ name: rawName.slice(0, 120), reason: verdict.reason });
      await recordSecurityEvent({
        clientId, userId: ctx.userId, kind: verdict.suspect ? "UPLOAD_SUSPECT" : "UPLOAD_REFUSE",
        severity: verdict.suspect ? "suspect" : "info", reason: verdict.reason, fileName: rawName, sha256, meta,
      });
      if (verdict.suspect) {
        await alertAdmins(
          `⚠️ Fichier suspect refusé — ${client.companyName}`,
          `${who} a tenté de déposer « ${rawName.slice(0, 120)} » : ${verdict.reason}. IP ${meta.ip ?? "inconnue"}. Le fichier n'a pas été conservé. Voir Admin → Sécurité.`,
        );
      }
      continue;
    }

    if (count + 1 > MAX_FILES_PER_CLIENT || total + bytes.length > MAX_TOTAL_BYTES) {
      rejected.push({ name: verdict.safeName, reason: "quota de stockage atteint : supprimez d'anciens fichiers ou contactez l'équipe" });
      continue;
    }

    // Quarantaine → antivirus → stockage définitif (nom aléatoire, hors web, 0600).
    await mkdir(QUARANTINE, { recursive: true, mode: 0o700 });
    const tmp = path.join(QUARANTINE, `${crypto.randomUUID()}.${verdict.ext}`);
    await writeFile(tmp, bytes, { mode: 0o600 });
    const scan = await scanWithClamav(tmp);

    if (scan.status === "infected") {
      await unlink(tmp).catch(() => undefined);
      rejected.push({ name: verdict.safeName, reason: "fichier infecté détecté par l'antivirus" });
      await recordSecurityEvent({ clientId, userId: ctx.userId, kind: "ANTIVIRUS_INFECTE", severity: "critique", reason: `ClamAV : ${scan.detail}`, fileName: rawName, sha256, meta });
      await alertAdmins(
        `🛑 Fichier infecté bloqué — ${client.companyName}`,
        `${who} a déposé « ${rawName.slice(0, 120)} » : ${scan.detail} (ClamAV). IP ${meta.ip ?? "inconnue"}. Le fichier a été détruit. Voir Admin → Sécurité.`,
      );
      continue;
    }
    if (scan.status === "unavailable" && (await findClamav())) {
      // ClamAV installé mais en panne : on refuse plutôt que d'accepter à l'aveugle.
      await unlink(tmp).catch(() => undefined);
      rejected.push({ name: verdict.safeName, reason: "analyse antivirus momentanément indisponible, réessayez dans quelques minutes" });
      if (Date.now() - lastUnavailableAlert > 3_600_000) {
        lastUnavailableAlert = Date.now();
        await recordSecurityEvent({ clientId, userId: ctx.userId, kind: "ANTIVIRUS_INDISPONIBLE", severity: "info", reason: scan.detail, fileName: rawName, meta });
        await alertAdmins("Antivirus indisponible sur le serveur", `${scan.detail}. Les dépôts de fichiers sont refusés tant que ClamAV ne répond pas (vérifier : systemctl status clamav-daemon).`);
      }
      continue;
    }

    const storageKey = `clients/${clientId}/${crypto.randomUUID()}.${verdict.ext}`;
    const finalPath = path.join(STORAGE_ROOT, storageKey);
    await mkdir(path.dirname(finalPath), { recursive: true, mode: 0o700 });
    await rename(tmp, finalPath);

    const row = await prisma.clientFile.create({
      data: {
        clientId, uploadedByUserId: ctx.userId, need, originalName: verdict.safeName, storageKey,
        mimeType: verdict.mime, kind: verdict.kind, sizeBytes: BigInt(bytes.length), sha256,
        scannedWith: scan.status === "clean" ? scan.detail : "contrôle interne (sans antivirus)",
      },
    });
    count += 1;
    total += bytes.length;
    saved.push(toRow(row));
  }

  return { saved, rejected };
}

function toRow(f: { id: bigint; need: string | null; originalName: string; mimeType: string; kind: string; sizeBytes: bigint; createdAt: Date }): ClientFileRow {
  return { id: f.id.toString(), need: f.need, name: f.originalName, mime: f.mimeType, kind: f.kind as FileKind, size: Number(f.sizeBytes), createdAt: f.createdAt.toISOString() };
}

/* ------------------------------------------------------------ lecture / suppression */

/** Fichiers d'un client : les siens pour un client, n'importe lequel pour un administrateur. */
export async function listClientFiles(ctx: Ctx, opts: { clientId?: bigint; need?: string | null } = {}): Promise<ClientFileRow[]> {
  const clientId = ctx.role === "ADMIN" ? opts.clientId : clientScope(ctx);
  if (!clientId) return [];
  const rows = await prisma.clientFile.findMany({
    where: { clientId, ...(opts.need ? { need: opts.need } : {}) },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toRow);
}

async function ownedFile(ctx: Ctx, fileId: bigint) {
  const f = await prisma.clientFile.findUnique({ where: { id: fileId } });
  if (!f) throw new ValidationError("Fichier introuvable.");
  if (ctx.role !== "ADMIN" && f.clientId !== clientScope(ctx)) throw new ForbiddenError();
  const filePath = path.resolve(STORAGE_ROOT, f.storageKey);
  if (!filePath.startsWith(STORAGE_ROOT + path.sep)) throw new ForbiddenError();
  return { f, filePath };
}

export async function clientFileFor(ctx: Ctx, fileId: bigint) {
  const { f, filePath } = await ownedFile(ctx, fileId);
  return { filePath, mimeType: f.mimeType, originalName: f.originalName, size: Number(f.sizeBytes) };
}

export async function deleteClientFile(ctx: Ctx, fileId: bigint) {
  const { f, filePath } = await ownedFile(ctx, fileId);
  await prisma.clientFile.delete({ where: { id: f.id } });
  await unlink(filePath).catch(() => undefined);
}

/** Journal de sécurité pour l'administration. */
export async function listSecurityEvents(ctx: Ctx, limit = 150) {
  if (ctx.role !== "ADMIN") throw new ForbiddenError();
  const rows = await prisma.securityEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { client: { select: { companyName: true } }, user: { select: { email: true, fullName: true } } },
  });
  return rows.map((r) => ({
    id: r.id.toString(), kind: r.kind, severity: r.severity, reason: r.reason, fileName: r.fileName, sha256: r.sha256, ip: r.ip,
    userAgent: r.userAgent, createdAt: r.createdAt, clientId: r.clientId?.toString() ?? null,
    client: r.client?.companyName ?? null, user: r.user ? `${r.user.fullName} <${r.user.email}>` : null,
  }));
}

/** État de l'antivirus, affiché dans Admin → Sécurité. */
export async function antivirusStatus(): Promise<{ installed: boolean; detail: string }> {
  const bin = await findClamav();
  if (!bin) return { installed: false, detail: "ClamAV non installé : contrôle interne seul (signature, inspection du contenu)." };
  try {
    const { stdout } = await run(bin, ["--version"], { timeout: 5000 });
    return { installed: true, detail: stdout.trim().slice(0, 120) };
  } catch {
    return { installed: true, detail: "ClamAV installé mais le démon ne répond pas (systemctl status clamav-daemon)." };
  }
}
