import { describe, expect, it } from "vitest";
import { inspectFile, sanitizeName, zipEntries } from "@/lib/fileSecurity";

const bytes = (...parts: Array<number[] | string>) => {
  const out: number[] = [];
  for (const p of parts) {
    if (typeof p === "string") for (const ch of p) out.push(ch.charCodeAt(0) & 0xff);
    else out.push(...p);
  }
  return new Uint8Array(out);
};
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPG = [0xff, 0xd8, 0xff, 0xe0];
const pad = (n: number) => Array.from({ length: n }, () => 0x20);

/** Archive ZIP minimale avec une entrée « stockée » (sans compression). */
function zip(name: string, content: string): Uint8Array {
  const le16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
  const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
  return bytes([0x50, 0x4b, 0x03, 0x04], le16(20), le16(0), le16(0), le16(0), le16(0), le32(0), le32(content.length), le32(content.length), le16(name.length), le16(0), name, content);
}

describe("contrôle de sécurité des fichiers déposés", () => {
  it("accepte une vraie image PNG et un vrai PDF", () => {
    expect(inspectFile("logo.png", "image/png", bytes(PNG, pad(200)))).toMatchObject({ ok: true, kind: "image", mime: "image/png", ext: "png" });
    expect(inspectFile("brief.pdf", "application/pdf", bytes("%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF"))).toMatchObject({ ok: true, kind: "pdf" });
    expect(inspectFile("photo.JPG", "image/jpeg", bytes(JPG, pad(50)))).toMatchObject({ ok: true, ext: "jpg" });
  });

  it("refuse un exécutable renommé en image (signature incohérente) comme suspect", () => {
    const v = inspectFile("logo.png", "image/png", bytes("MZ", pad(100)));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.suspect).toBe(true);
  });

  it("refuse les extensions dangereuses, y compris en double extension", () => {
    for (const name of ["virus.exe", "site.php", "page.html", "icone.svg", "brief.pdf.exe", "logo.php.jpg", "script.js"]) {
      const v = inspectFile(name, "application/octet-stream", bytes(PNG, pad(10)));
      expect(v.ok, name).toBe(false);
      if (!v.ok) expect(v.suspect, name).toBe(true);
    }
  });

  it("refuse un PDF avec JavaScript ou lancement de programme", () => {
    const v = inspectFile("devis.pdf", "application/pdf", bytes("%PDF-1.7\n<< /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>\n%%EOF"));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toMatch(/JavaScript|OpenAction/);
  });

  it("refuse une image contenant du code PHP ou HTML caché", () => {
    const v = inspectFile("logo.jpg", "image/jpeg", bytes(JPG, pad(20), "<?php system($_GET['c']); ?>"));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.suspect).toBe(true);
  });

  it("refuse un type annoncé incohérent avec l'extension", () => {
    const v = inspectFile("logo.png", "text/html", bytes(PNG, pad(10)));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.suspect).toBe(true);
  });

  it("refuse un fichier texte binaire ou avec balises actives", () => {
    expect(inspectFile("notes.txt", "text/plain", bytes("hello", [0x00], "world")).ok).toBe(false);
    expect(inspectFile("notes.txt", "text/plain", bytes("<script>alert(1)</script>")).ok).toBe(false);
    expect(inspectFile("notes.txt", "text/plain", bytes("Mon brief : site vitrine, 5 pages.")).ok).toBe(true);
  });

  it("archives : lit les entrées, refuse la traversée de chemin et les exécutables", () => {
    expect(zipEntries(zip("logo/brand.ai", "x")).entries[0]!.name).toBe("logo/brand.ai");
    expect(inspectFile("assets.zip", "application/zip", zip("images/logo.png", "png")).ok).toBe(true);
    expect(inspectFile("assets.zip", "application/zip", zip("../../etc/passwd", "x")).ok).toBe(false);
    expect(inspectFile("assets.zip", "application/zip", zip("tools/setup.exe", "MZ")).ok).toBe(false);
  });

  it("documents Office : structure attendue, macros refusées", () => {
    expect(inspectFile("brief.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", zip("[Content_Types].xml", "<Types/>")).ok).toBe(true);
    expect(inspectFile("brief.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", zip("word/vbaProject.bin", "x")).ok).toBe(false);
  });

  it("refuse les fichiers vides, trop gros, sans extension ou de format inconnu (sans alerte)", () => {
    expect(inspectFile("logo.png", "image/png", new Uint8Array(0))).toMatchObject({ ok: false, suspect: false });
    expect(inspectFile("fichier", null, bytes(PNG))).toMatchObject({ ok: false, suspect: false });
    expect(inspectFile("video.mp4", "video/mp4", bytes(pad(10)))).toMatchObject({ ok: false, suspect: false });
  });

  it("nettoie le nom affiché (chemin, caractères de contrôle, longueur)", () => {
    expect(sanitizeName("..\\..\\C:\\Users\\x\\logo final.png")).toBe("logo final.png");
    expect(sanitizeName("a\u0000b\u202ec.pdf")).toBe("abc.pdf");
    expect(sanitizeName("x".repeat(300) + ".pdf").length).toBe(120);
  });
});
