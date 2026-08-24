/**
 * Seed — demo data matching the two mockups of the cahier des charges.
 * Run: npm run db:seed   (idempotent: wipes and recreates demo data)
 *
 * Accounts created:
 *   Admin  : sarra@levelupia.tn   / Admin2026!
 *   Client : amine@carthage.tn    / Client2026!  (Résidence Carthage)
 */
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();
const D = (s: string) => new Date(s);
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000);

async function main() {
  console.log("Seeding…");

  // wipe (FK-safe order)
  await prisma.$transaction([
    prisma.messageRead.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.message.deleteMany(),
    prisma.file.deleteMany(),
    prisma.projectStatusHistory.deleteMany(),
    prisma.projectStep.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.invoiceLine.deleteMany(),
    prisma.projectRequest.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.project.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.teamMember.deleteMany(),
    prisma.user.deleteMany(),
    prisma.client.deleteMany(),
    prisma.service.deleteMany(),
    prisma.invoiceCounter.deleteMany(),
  ]);

  // ---------------- services
  const [videoIA, siteWeb, social] = await Promise.all([
    prisma.service.create({ data: { name: "Vidéo IA", color: "#6c24fc", defaultPrice: 900 } }),
    prisma.service.create({ data: { name: "Création de site", color: "#38bdf8", defaultPrice: 1200 } }),
    prisma.service.create({ data: { name: "Réseaux sociaux", color: "#a855f7", defaultPrice: 600 } }),
  ]);

  // ---------------- clients
  const mkClient = (companyName: string, contactName: string, city: string, email: string) =>
    prisma.client.create({ data: { companyName, contactName, city, email, phone: "+216 20 000 000" } });

  const carthage = await mkClient("Résidence Carthage", "Amine Trabelsi", "Carthage", "contact@carthage.tn");
  const nour = await mkClient("Boutique Nour", "Nour Ben Salah", "Tunis", "hello@boutiquenour.tn");
  const medina = await mkClient("Café Medina", "Karim Jaziri", "Tunis", "cafe@medina.tn");
  const optique = await mkClient("Optique Belvédère", "Leïla Gharbi", "Tunis", "contact@optiquebelvedere.tn");
  const atelier = await mkClient("Atelier Sidi Bou", "Selim Ayari", "Sidi Bou Saïd", "atelier@sidibou.tn");

  // ---------------- users
  const [adminHash, clientHash] = await Promise.all([bcrypt.hash("Admin2026!", 12), bcrypt.hash("Client2026!", 12)]);
  const sarra = await prisma.user.create({
    data: { role: "ADMIN", fullName: "Sarra Dhaouadi", email: "sarra@levelupia.tn", passwordHash: adminHash },
  });
  const amine = await prisma.user.create({
    data: { role: "CLIENT", clientId: carthage.id, fullName: "Amine Trabelsi", email: "amine@carthage.tn", passwordHash: clientHash },
  });
  const nourUser = await prisma.user.create({
    data: { role: "CLIENT", clientId: nour.id, fullName: "Nour Ben Salah", email: "nour@boutiquenour.tn", passwordHash: clientHash },
  });

  // ---------------- team
  const [yassine, mehdi, sarraTm] = await Promise.all([
    prisma.teamMember.create({ data: { fullName: "Yassine Bouazizi", jobTitle: "Social media manager", email: "yassine@levelupia.tn" } }),
    prisma.teamMember.create({ data: { fullName: "Mehdi Khelifi", jobTitle: "Développeur web", email: "mehdi@levelupia.tn" } }),
    prisma.teamMember.create({ data: { fullName: "Sarra Dhaouadi", jobTitle: "Direction / montage IA", email: "sarra@levelupia.tn", userId: sarra.id } }),
  ]);

  // ---------------- projects
  const mkProject = (data: Prisma.ProjectUncheckedCreateInput) => prisma.project.create({ data });

  // Featured: Résidence Carthage — Vidéo IA + landing page (EN_REVISION)
  const pCarthage = await mkProject({
    clientId: carthage.id, serviceId: videoIA.id, assignedTeamMemberId: sarraTm.id, createdByUserId: sarra.id,
    title: "Vidéo IA + landing page", price: 1900, status: "EN_REVISION",
    startDate: D("2026-08-12"), dueDate: D("2026-08-28"),
  });
  await prisma.projectStep.createMany({
    data: [
      { projectId: pCarthage.id, label: "Brief reçu", position: 1, reachedAt: D("2026-08-12T10:00:00Z") },
      { projectId: pCarthage.id, label: "Production", position: 2, reachedAt: D("2026-08-16T14:00:00Z") },
      { projectId: pCarthage.id, label: "Première version", position: 3, reachedAt: D("2026-08-21T09:30:00Z") },
      { projectId: pCarthage.id, label: "Votre validation", position: 4 },
      { projectId: pCarthage.id, label: "Livraison finale", position: 5 },
    ],
  });

  const pNourSept = await mkProject({
    clientId: nour.id, serviceId: social.id, assignedTeamMemberId: yassine.id, createdByUserId: sarra.id,
    title: "Pack réseaux sociaux, septembre", price: 650, status: "EN_COURS",
    startDate: D("2026-08-18"), dueDate: D("2026-09-02"),
  });
  await prisma.projectStep.createMany({
    data: [
      { projectId: pNourSept.id, label: "Brief reçu", position: 1, reachedAt: D("2026-08-18T09:00:00Z") },
      { projectId: pNourSept.id, label: "Production", position: 2, reachedAt: D("2026-08-20T09:00:00Z") },
      { projectId: pNourSept.id, label: "Validation", position: 3 },
      { projectId: pNourSept.id, label: "Livraison", position: 4 },
    ],
  });

  const pMedina = await mkProject({
    clientId: medina.id, serviceId: siteWeb.id, assignedTeamMemberId: mehdi.id, createdByUserId: sarra.id,
    title: "Création de site vitrine", price: 1200, status: "EN_ATTENTE",
    startDate: D("2026-08-10"), dueDate: daysFromNow(-1),
  });
  const pOptique = await mkProject({
    clientId: optique.id, serviceId: social.id, assignedTeamMemberId: yassine.id, createdByUserId: sarra.id,
    title: "Pack réseaux sociaux", price: 600, status: "EN_COURS",
    startDate: D("2026-08-15"), dueDate: D("2026-09-09"),
  });
  const pAtelier = await mkProject({
    clientId: atelier.id, serviceId: videoIA.id, assignedTeamMemberId: mehdi.id, createdByUserId: sarra.id,
    title: "Vidéo produit IA", price: 850, status: "LIVRE",
    startDate: D("2026-08-05"), dueDate: D("2026-08-22"), deliveredAt: D("2026-08-22T16:00:00Z"),
  });
  // second project of Carthage (mockup: "Nour x Carthage — Vidéo produit IA, en attente d'éléments")
  const pCarthage2 = await mkProject({
    clientId: carthage.id, serviceId: videoIA.id, assignedTeamMemberId: mehdi.id, createdByUserId: sarra.id,
    title: "Nour x Carthage — Vidéo produit IA", price: 900, status: "EN_ATTENTE",
    startDate: D("2026-08-18"),
  });
  await prisma.projectStep.createMany({
    data: [
      { projectId: pCarthage2.id, label: "Brief reçu", position: 1, reachedAt: D("2026-08-18T11:00:00Z") },
      { projectId: pCarthage2.id, label: "Éléments client", position: 2 },
      { projectId: pCarthage2.id, label: "Production", position: 3 },
      { projectId: pCarthage2.id, label: "Livraison", position: 4 },
    ],
  });

  // a few more delivered projects for volume (12 actifs au compteur du mockup ≈)
  const extras: Prisma.ProjectUncheckedCreateInput[] = [
    { clientId: nour.id, serviceId: social.id, assignedTeamMemberId: yassine.id, title: "Pack réseaux sociaux, août", price: 650, status: "EN_COURS", startDate: D("2026-08-01"), dueDate: D("2026-08-31") },
    { clientId: medina.id, serviceId: videoIA.id, assignedTeamMemberId: sarraTm.id, title: "Vidéo menu du soir", price: 700, status: "EN_COURS", startDate: D("2026-08-14"), dueDate: D("2026-09-05") },
    { clientId: optique.id, serviceId: videoIA.id, assignedTeamMemberId: sarraTm.id, title: "Vidéo lancement collection", price: 900, status: "EN_COURS", startDate: D("2026-08-16"), dueDate: D("2026-09-12") },
    { clientId: atelier.id, serviceId: siteWeb.id, assignedTeamMemberId: mehdi.id, title: "Boutique en ligne", price: 1800, status: "EN_COURS", startDate: D("2026-08-19"), dueDate: D("2026-09-20") },
    { clientId: nour.id, serviceId: videoIA.id, assignedTeamMemberId: sarraTm.id, title: "Vidéo IA visuels septembre", price: 750, status: "EN_COURS", startDate: D("2026-08-21"), dueDate: D("2026-09-10") },
    { clientId: optique.id, serviceId: siteWeb.id, assignedTeamMemberId: mehdi.id, title: "Refonte page rendez-vous", price: 640, status: "EN_COURS", startDate: D("2026-08-22"), dueDate: D("2026-09-15") },
    { clientId: medina.id, serviceId: social.id, assignedTeamMemberId: yassine.id, title: "Animation Instagram", price: 500, status: "EN_COURS", startDate: D("2026-08-23"), dueDate: D("2026-09-18") },
  ];
  for (const e of extras) await mkProject(e);

  // ---------------- deliverable files (small demo files on disk)
  const storageRoot = path.join(process.cwd(), "storage", "uploads");
  await mkdir(storageRoot, { recursive: true });
  const demoFiles = [
    { key: "demo/carthage_video_v2.mp4", name: "Carthage_video_v2.mp4", mime: "video/mp4", version: 2 },
    { key: "demo/landing_page_maquette.pdf", name: "Landing_page_maquette.pdf", mime: "application/pdf", version: 1 },
    { key: "demo/carthage_visuels_reseaux.zip", name: "Carthage_visuels_reseaux.zip", mime: "application/zip", version: 1 },
  ];
  const uploadDates = [D("2026-08-21T10:00:00Z"), D("2026-08-19T15:00:00Z"), D("2026-08-18T12:00:00Z")];
  for (let i = 0; i < demoFiles.length; i++) {
    const f = demoFiles[i]!;
    const filePath = path.join(storageRoot, f.key);
    await mkdir(path.dirname(filePath), { recursive: true });
    const content = Buffer.from(`Fichier de démonstration Level Up IA — ${f.name}\n`.repeat(200));
    await writeFile(filePath, content);
    await prisma.file.create({
      data: {
        projectId: pCarthage.id, uploadedByUserId: sarra.id, kind: "LIVRABLE",
        approval: i === 0 ? "EN_ATTENTE" : null,
        originalName: f.name, storageKey: f.key, mimeType: f.mime,
        sizeBytes: BigInt(content.byteLength), version: f.version, createdAt: uploadDates[i]!,
      },
    });
  }

  // ---------------- invoices (sequential numbers, chart history dec→août)
  type Inv = { n: number; clientId: bigint; projectId?: bigint; status: "PAYEE" | "EN_ATTENTE" | "EN_RETARD"; date: string; due?: string; total: number };
  const history: Inv[] = [
    { n: 12, clientId: nour.id, status: "PAYEE", date: "2025-12-10", total: 2600 },
    { n: 14, clientId: medina.id, status: "PAYEE", date: "2026-01-12", total: 3100 },
    { n: 17, clientId: optique.id, status: "PAYEE", date: "2026-02-10", total: 2900 },
    { n: 20, clientId: atelier.id, status: "PAYEE", date: "2026-03-11", total: 4200 },
    { n: 23, clientId: carthage.id, status: "PAYEE", date: "2026-04-09", total: 4800 },
    { n: 26, clientId: nour.id, status: "PAYEE", date: "2026-05-12", total: 5400 },
    { n: 29, clientId: medina.id, status: "PAYEE", date: "2026-06-10", total: 6300 },
    { n: 33, clientId: optique.id, status: "PAYEE", date: "2026-07-10", total: 8200 },
    { n: 38, clientId: nour.id, projectId: pNourSept.id, status: "PAYEE", date: "2026-08-06", total: 1450 },
    { n: 36, clientId: atelier.id, projectId: pAtelier.id, status: "PAYEE", date: "2026-08-03", total: 850 },
    { n: 37, clientId: carthage.id, status: "PAYEE", date: "2026-08-04", total: 2100 },
    { n: 40, clientId: medina.id, status: "PAYEE", date: "2026-08-12", total: 1990 },
    { n: 42, clientId: optique.id, status: "PAYEE", date: "2026-08-15", total: 1650 },
    { n: 43, clientId: nour.id, status: "PAYEE", date: "2026-08-18", total: 1600 },
    { n: 39, clientId: medina.id, projectId: pMedina.id, status: "EN_RETARD", date: "2026-08-08", due: "2026-08-18", total: 780 },
    { n: 41, clientId: carthage.id, projectId: pCarthage.id, status: "EN_ATTENTE", date: "2026-08-14", due: "2026-08-30", total: 1900 },
    { n: 44, clientId: optique.id, projectId: pOptique.id, status: "EN_ATTENTE", date: "2026-08-20", due: "2026-09-05", total: 1250 },
  ];
  for (const inv of history) {
    const subtotal = Math.round((inv.total / 1.19) * 1000) / 1000;
    await prisma.invoice.create({
      data: {
        invoiceNumber: `F-${inv.date.slice(0, 4)}-${String(inv.n).padStart(3, "0")}`,
        clientId: inv.clientId, projectId: inv.projectId ?? null, status: inv.status,
        issueDate: D(inv.date), dueDate: inv.due ? D(inv.due) : D(inv.date),
        subtotal, vatAmount: Math.round((inv.total - subtotal) * 1000) / 1000, total: inv.total,
        paidAt: inv.status === "PAYEE" ? D(inv.date) : null,
        createdByUserId: sarra.id,
        lines: { create: [{ description: "Prestation Level Up IA", quantity: 1, unitPrice: subtotal, lineTotal: subtotal }] },
      },
    });
  }
  await prisma.invoiceCounter.createMany({ data: [{ year: 2025, lastNumber: 13 }, { year: 2026, lastNumber: 44 }] });

  // ---------------- subscriptions
  await prisma.subscription.createMany({
    data: [
      { clientId: nour.id, planName: "Pro", monthlyAmount: 650, status: "ACTIF", startDate: D("2026-03-01"), renewalDate: daysFromNow(8) },
      { clientId: medina.id, planName: "Starter", monthlyAmount: 350, status: "ACTIF", startDate: D("2026-05-01"), renewalDate: daysFromNow(24) },
      { clientId: optique.id, planName: "Pro", monthlyAmount: 650, status: "ACTIF", startDate: D("2026-06-15"), renewalDate: daysFromNow(3) },
      { clientId: atelier.id, planName: "Starter", monthlyAmount: 350, status: "EXPIRE", startDate: D("2025-11-01"), renewalDate: D("2026-05-01"), autoRenew: false },
    ],
  });

  // ---------------- messages (mockup content)
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);
  await prisma.message.create({
    data: {
      projectId: pCarthage.id, senderUserId: sarra.id, createdAt: hoursAgo(3),
      body: "La version 2 est en ligne avec le nouveau montage. Dites-nous si le rythme vous convient, on garde la musique actuelle en attendant votre retour.",
    },
  });
  await prisma.message.create({
    data: {
      projectId: pCarthage.id, senderUserId: amine.id, createdAt: hoursAgo(0.2),
      body: "Bonjour, la vidéo est très bien. Est-ce qu'on peut raccourcir le plan d'ouverture et remplacer la musique ?",
    },
  });
  await prisma.message.create({
    data: {
      projectId: pCarthage2.id, senderUserId: sarra.id, createdAt: hoursAgo(26),
      body: "Il nous manque les photos du produit en 3 angles pour démarrer la production. Vous pouvez les déposer directement dans le projet.",
    },
  });
  await prisma.message.create({
    data: {
      projectId: pMedina.id, senderUserId: sarra.id, createdAt: hoursAgo(4),
      body: "Bonjour Karim, on attend vos retours sur la maquette pour continuer.",
    },
  });
  await prisma.message.create({
    data: {
      projectId: pMedina.id, senderUserId: sarra.id, createdAt: hoursAgo(2),
      body: "Je vous envoie les photos du menu ce soir, désolé pour le retard.",
    },
  });
  await prisma.message.create({
    data: {
      projectId: pNourSept.id, senderUserId: nourUser.id, createdAt: hoursAgo(20),
      body: "Parfait pour les visuels de septembre, on valide tout.",
    },
  });

  // ---------------- notifications for the client
  await prisma.notification.createMany({
    data: [
      { userId: amine.id, type: "NOUVEAU_LIVRABLE", title: "Nouveau livrable — Vidéo IA + landing page", body: "Carthage_video_v2.mp4 est disponible.", entityType: "project", entityId: pCarthage.id },
      { userId: amine.id, type: "NOUVELLE_FACTURE", title: "Nouvelle facture F-2026-041", body: "1 900,00 DT — échéance 30 août.", entityType: "invoice", entityId: null },
    ],
  });

  console.log("Seed OK.");
  console.log("  Admin  : sarra@levelupia.tn / Admin2026!");
  console.log("  Client : amine@carthage.tn  / Client2026!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
