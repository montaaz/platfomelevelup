import { NextResponse, type NextRequest } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { mirrorNotificationEmails } from "@/lib/mail";
import { getSession } from "@/lib/session";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads");
const MAX_SIZE = 100 * 1024 * 1024; // 100 Mo
const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml",
  "video/mp4", "video/quicktime", "video/webm",
  "application/pdf", "application/zip", "application/x-zip-compressed",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

/** Dépôt des livrables (spec §5): types and max size enforced, stored outside
 *  the public folder, instantly visible and downloadable client-side. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const projectIdRaw = form.get("projectId");
  const kind = form.get("kind") === "ELEMENT_CLIENT" ? "ELEMENT_CLIENT" : "LIVRABLE";
  const askValidation = form.get("askValidation") === "1";

  if (!(file instanceof File) || typeof projectIdRaw !== "string" || !/^\d+$/.test(projectIdRaw)) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Fichier vide ou supérieur à 100 Mo." }, { status: 400 });
  }
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json({ error: `Type de fichier non autorisé (${mime}).` }, { status: 400 });
  }

  const projectId = BigInt(projectIdRaw);
  const project = await prisma.project.findFirst({ where: { id: projectId, deletedAt: null } });
  if (!project) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });

  const originalName = path.basename(file.name).slice(0, 255) || "fichier";
  const storageKey = `projects/${projectId}/${crypto.randomUUID()}${path.extname(originalName).slice(0, 12)}`;
  const filePath = path.join(STORAGE_ROOT, storageKey);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, Buffer.from(await file.arrayBuffer()));

  const previous = await prisma.file.aggregate({
    _max: { version: true },
    where: { projectId, originalName, deletedAt: null },
  });

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.file.create({
      data: {
        projectId,
        uploadedByUserId: BigInt(session.userId),
        kind,
        approval: kind === "LIVRABLE" && askValidation ? "EN_ATTENTE" : null,
        originalName,
        storageKey,
        mimeType: mime,
        sizeBytes: BigInt(file.size),
        version: (previous._max.version ?? 0) + 1,
      },
    });

    if (kind === "LIVRABLE" && askValidation && project.status !== "EN_REVISION") {
      await tx.project.update({ where: { id: projectId }, data: { status: "EN_REVISION" } });
      await tx.projectStatusHistory.create({
        data: {
          projectId,
          oldStatus: project.status,
          newStatus: "EN_REVISION",
          changedByUserId: BigInt(session.userId),
          comment: `Livrable « ${originalName} » déposé pour validation.`,
        },
      });
    }

    const clientUsers = await tx.user.findMany({
      where: { role: "CLIENT", clientId: project.clientId, isActive: true },
      select: { id: true },
    });
    if (clientUsers.length > 0) {
      const title = `Nouveau livrable — ${project.title}`;
      const body = `${originalName} est disponible dans votre espace.`;
      await tx.notification.createMany({
        data: clientUsers.map((u) => ({
          userId: u.id,
          type: "NOUVEAU_LIVRABLE" as const,
          title,
          body,
          entityType: "project",
          entityId: projectId,
        })),
      });
      mirrorNotificationEmails(clientUsers.map((u) => u.id), title, body);
    }
    await tx.auditLog.create({
      data: { userId: BigInt(session.userId), action: "FILE_UPLOAD", entityType: "file", entityId: row.id },
    });
    return row;
  });

  return NextResponse.json({ id: created.id.toString(), version: created.version });
}
