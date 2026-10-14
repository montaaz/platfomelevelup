/**
 * Contrôle de sécurité des fichiers déposés par les clients (logo, photos,
 * références, PDF, documents bureautiques, archives).
 *
 * Tout fichier passe, dans l'ordre :
 *   1. taille et nom (longueur, caractères de contrôle, double extension) ;
 *   2. extension dans la liste blanche, type MIME annoncé cohérent ;
 *   3. signature binaire (« magic bytes ») : le contenu doit être ce que
 *      l'extension prétend — un .png qui commence par « MZ » est refusé ;
 *   4. inspection du contenu selon le format : JavaScript, lancement de
 *      programme ou pièce jointe dans un PDF ; code PHP/HTML caché dans une
 *      image ; archive avec chemins « ../ », fichiers exécutables ou taux de
 *      compression anormal (zip bomb) ; texte avec octets nuls ou balises.
 *   5. (côté serveur) analyse antivirus ClamAV si disponible.
 *
 * Pure (aucun accès disque) pour être testée unitairement. Le résultat
 * distingue un simple refus (mauvais format) d'un fichier SUSPECT (indices
 * d'attaque) : le second déclenche une alerte à l'équipe.
 */

export type FileKind = "image" | "pdf" | "document" | "archive" | "text";

export type Verdict =
  | { ok: true; kind: FileKind; mime: string; ext: string; safeName: string }
  | { ok: false; suspect: boolean; reason: string };

export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 Mo par fichier
export const MAX_NAME_LENGTH = 120;

/** Extension → type MIME servi au téléchargement (jamais celui du navigateur). */
export const ALLOWED: Record<string, { mime: string; kind: FileKind }> = {
  jpg: { mime: "image/jpeg", kind: "image" },
  jpeg: { mime: "image/jpeg", kind: "image" },
  png: { mime: "image/png", kind: "image" },
  webp: { mime: "image/webp", kind: "image" },
  gif: { mime: "image/gif", kind: "image" },
  heic: { mime: "image/heic", kind: "image" },
  pdf: { mime: "application/pdf", kind: "pdf" },
  doc: { mime: "application/msword", kind: "document" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", kind: "document" },
  xls: { mime: "application/vnd.ms-excel", kind: "document" },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", kind: "document" },
  ppt: { mime: "application/vnd.ms-powerpoint", kind: "document" },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", kind: "document" },
  odt: { mime: "application/vnd.oasis.opendocument.text", kind: "document" },
  txt: { mime: "text/plain", kind: "text" },
  csv: { mime: "text/csv", kind: "text" },
  zip: { mime: "application/zip", kind: "archive" },
};

/** Extensions jamais acceptées, y compris en double extension (« logo.pdf.exe », « site.php.jpg »). */
const DANGEROUS_EXT = new Set([
  "exe", "dll", "com", "bat", "cmd", "ps1", "psm1", "vbs", "vbe", "js", "jse", "wsf", "wsh", "msi", "msp", "scr", "pif", "cpl",
  "jar", "class", "sh", "bash", "zsh", "py", "rb", "pl", "php", "php3", "php4", "php5", "phtml", "phar", "asp", "aspx", "jsp",
  "cgi", "htm", "html", "xhtml", "svg", "svgz", "xml", "xsl", "xslt", "swf", "hta", "reg", "lnk", "url", "desktop", "app",
  "dmg", "apk", "deb", "rpm", "iso", "img", "vhd", "elf", "so", "bin", "ocx", "sys", "drv", "action", "command", "workflow",
]);

/** Dans une archive ou un document Office, seuls les vrais exécutables et scripts sont bloqués
 *  (les .xml, .rels, .html d'un .docx ou d'un dossier de maquettes sont légitimes). */
const DANGEROUS_IN_ARCHIVE = new Set([
  "exe", "dll", "com", "bat", "cmd", "ps1", "vbs", "vbe", "js", "jse", "wsf", "wsh", "msi", "msp", "scr", "pif", "cpl",
  "jar", "sh", "bash", "php", "phtml", "phar", "hta", "reg", "lnk", "apk", "dmg", "elf", "so", "sys", "ocx",
]);

const SNIFF: Record<string, (b: Uint8Array) => boolean> = {
  jpg: (b) => starts(b, [0xff, 0xd8, 0xff]),
  jpeg: (b) => starts(b, [0xff, 0xd8, 0xff]),
  png: (b) => starts(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  gif: (b) => ascii(b, 0, "GIF87a") || ascii(b, 0, "GIF89a"),
  webp: (b) => ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP"),
  heic: (b) => ascii(b, 4, "ftyp") && /^(heic|heix|hevc|mif1|msf1|heis|hevx)$/.test(text(b, 8, 12)),
  pdf: (b) => ascii(b, 0, "%PDF-"),
  doc: (b) => starts(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  xls: (b) => starts(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  ppt: (b) => starts(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  docx: (b) => isZip(b),
  xlsx: (b) => isZip(b),
  pptx: (b) => isZip(b),
  odt: (b) => isZip(b),
  zip: (b) => isZip(b),
  txt: () => true,
  csv: () => true,
};

function starts(b: Uint8Array, sig: number[]): boolean {
  if (b.length < sig.length) return false;
  return sig.every((v, i) => b[i] === v);
}
function text(b: Uint8Array, from: number, to: number): string {
  let s = "";
  for (let i = from; i < Math.min(to, b.length); i++) s += String.fromCharCode(b[i]!);
  return s;
}
function ascii(b: Uint8Array, at: number, s: string): boolean {
  return text(b, at, at + s.length) === s;
}
function isZip(b: Uint8Array): boolean {
  return starts(b, [0x50, 0x4b, 0x03, 0x04]) || starts(b, [0x50, 0x4b, 0x05, 0x06]);
}

/** Recherche d'un motif texte (insensible à la casse) dans les octets. */
function contains(b: Uint8Array, patterns: RegExp): string | null {
  // Les fichiers sont au plus de 25 Mo : une conversion latin1 reste bon marché.
  const s = Buffer.from(b.buffer, b.byteOffset, b.byteLength).toString("latin1");
  const m = s.match(patterns);
  return m ? m[0] : null;
}

/** Nom d'affichage : sans chemin, sans caractère de contrôle, tronqué. */
export function sanitizeName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, "").replace(/\s+/g, " ").trim();
  return (clean || "fichier").slice(0, MAX_NAME_LENGTH);
}

function extensionsOf(name: string): string[] {
  const parts = name.toLowerCase().split(".");
  parts.shift();
  return parts.map((p) => p.replace(/[^a-z0-9]/g, ""));
}

/** Inspection d'un PDF : actions automatiques, scripts, lancement de programmes, pièces jointes. */
function inspectPdf(b: Uint8Array): string | null {
  const hit = contains(b, /\/(JavaScript|JS|Launch|EmbeddedFile|RichMedia|XFA|OpenAction|AA)\b/);
  if (hit) return `PDF avec contenu actif (${hit})`;
  if (!contains(b, /%%EOF/)) return "PDF tronqué ou malformé (pas de fin de fichier)";
  return null;
}

/** Inspection d'une image : code caché (polyglotte PHP/HTML/JS) dans les données. */
function inspectImage(b: Uint8Array): string | null {
  const hit = contains(b, /<\?php|<script\b|<\/script>|<svg\b|<html\b|<iframe\b|javascript:|eval\(|base64_decode\(|document\.cookie|<%@|<\?=|\bpassthru\(|\bshell_exec\(|\bsystem\(/i);
  return hit ? `code caché dans l'image (${hit})` : null;
}

/** Inspection d'un texte : octets nuls (binaire déguisé) ou balises actives. */
function inspectText(b: Uint8Array): string | null {
  for (let i = 0; i < Math.min(b.length, 1 << 20); i++) if (b[i] === 0) return "fichier binaire déguisé en texte";
  const hit = contains(b, /<\?php|<script\b|<iframe\b|javascript:|\bon(load|error|click)\s*=/i);
  return hit ? `balises actives dans un fichier texte (${hit})` : null;
}

type ZipEntry = { name: string; compressed: number; uncompressed: number; method: number };

/** Lecture des en-têtes locaux d'une archive ZIP (sans décompression). */
export function zipEntries(b: Uint8Array, limit = 5000): { entries: ZipEntry[]; truncated: boolean } {
  const entries: ZipEntry[] = [];
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let p = 0;
  while (p + 30 <= b.length && entries.length < limit) {
    if (view.getUint32(p, true) !== 0x04034b50) break;
    const flags = view.getUint16(p + 6, true);
    const method = view.getUint16(p + 8, true);
    const compressed = view.getUint32(p + 18, true);
    const uncompressed = view.getUint32(p + 22, true);
    const nameLen = view.getUint16(p + 26, true);
    const extraLen = view.getUint16(p + 28, true);
    const name = text(b, p + 30, p + 30 + nameLen);
    entries.push({ name, compressed, uncompressed, method });
    // taille différée (flag 3) : on ne peut pas sauter l'entrée de façon fiable → on s'arrête
    if (flags & 0x08) return { entries, truncated: true };
    p += 30 + nameLen + extraLen + compressed;
  }
  return { entries, truncated: false };
}

const ZIP_MAX_UNCOMPRESSED = 300 * 1024 * 1024; // 300 Mo décompressés
const ZIP_MAX_RATIO = 120;

/** Inspection d'une archive : traversée de chemins, exécutables, bombe de décompression. */
function inspectZip(b: Uint8Array, office: boolean): string | null {
  const { entries, truncated } = zipEntries(b);
  if (entries.length === 0) return "archive vide ou illisible";
  let total = 0;
  let totalCompressed = 0;
  for (const e of entries) {
    if (e.name.includes("../") || e.name.includes("..\\") || e.name.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(e.name) || e.name.includes("\0")) {
      return `archive avec chemin dangereux (${e.name.slice(0, 60)})`;
    }
    const exts = extensionsOf(e.name.split("/").pop() ?? "");
    if (exts.some((x) => DANGEROUS_IN_ARCHIVE.has(x))) return `archive contenant un fichier exécutable ou script (${e.name.slice(0, 60)})`;
    total += e.uncompressed;
    totalCompressed += e.compressed;
    if (total > ZIP_MAX_UNCOMPRESSED) return "archive trop volumineuse une fois décompressée";
  }
  if (totalCompressed > 0 && total / totalCompressed > ZIP_MAX_RATIO && total > 20 * 1024 * 1024) return "taux de compression anormal (bombe de décompression)";
  if (truncated) return null; // entrées à taille différée : contrôle partiel, mais aucun indice d'attaque
  if (office && !entries.some((e) => e.name === "[Content_Types].xml" || e.name === "mimetype")) {
    return "document bureautique sans structure Office/OpenDocument";
  }
  if (office) {
    const macro = entries.find((e) => /vbaProject\.bin$/i.test(e.name) || /\.(bin|exe|dll)$/i.test(e.name) && /macros?\//i.test(e.name));
    if (macro) return `document bureautique avec macros (${macro.name.slice(0, 60)})`;
  }
  return null;
}

/**
 * Verdict complet sur un fichier. `declaredMime` est le type annoncé par le
 * navigateur : il doit rester cohérent avec l'extension, mais ne fait jamais foi.
 */
export function inspectFile(rawName: string, declaredMime: string | null | undefined, bytes: Uint8Array): Verdict {
  const safeName = sanitizeName(rawName);
  if (bytes.length === 0) return { ok: false, suspect: false, reason: "fichier vide" };
  if (bytes.length > MAX_FILE_BYTES) return { ok: false, suspect: false, reason: `fichier trop volumineux (maximum ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} Mo)` };
  if (/[\u0000-\u001f]/.test(rawName) || rawName.length > 255) return { ok: false, suspect: true, reason: "nom de fichier avec caractères de contrôle" };

  const exts = extensionsOf(safeName);
  const ext = exts[exts.length - 1] ?? "";
  if (exts.some((x) => DANGEROUS_EXT.has(x))) return { ok: false, suspect: true, reason: `extension interdite (.${exts.find((x) => DANGEROUS_EXT.has(x))})` };
  const allowed = ALLOWED[ext];
  if (!allowed) return { ok: false, suspect: false, reason: ext ? `format .${ext} non accepté` : "fichier sans extension" };

  const declared = (declaredMime ?? "").toLowerCase().split(";")[0]!.trim();
  if (declared && declared !== "application/octet-stream" && declared !== allowed.mime) {
    // quelques tolérances courantes des navigateurs
    const tolerated =
      (ext === "csv" && (declared === "text/plain" || declared === "application/vnd.ms-excel" || declared === "application/csv")) ||
      (ext === "txt" && declared.startsWith("text/")) ||
      (ext === "zip" && (declared === "application/x-zip-compressed" || declared === "application/x-zip")) ||
      ((ext === "jpg" || ext === "jpeg") && declared === "image/jpg") ||
      (ext === "heic" && declared === "image/heif");
    if (!tolerated) return { ok: false, suspect: true, reason: `type annoncé (${declared}) différent de l'extension .${ext}` };
  }

  if (!SNIFF[ext]!(bytes)) return { ok: false, suspect: true, reason: `le contenu n'est pas un vrai fichier .${ext}` };

  let problem: string | null = null;
  switch (allowed.kind) {
    case "pdf": problem = inspectPdf(bytes); break;
    case "image": problem = inspectImage(bytes); break;
    case "text": problem = inspectText(bytes); break;
    case "archive": problem = inspectZip(bytes, false); break;
    case "document": problem = isZip(bytes) ? inspectZip(bytes, true) : (contains(bytes, /vbaProject|Macros|\x00VBA/i) ? "document avec macros" : null); break;
  }
  if (problem) return { ok: false, suspect: true, reason: problem };

  return { ok: true, kind: allowed.kind, mime: allowed.mime, ext, safeName };
}
