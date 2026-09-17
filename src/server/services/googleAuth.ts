import { createRemoteJWKSet, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/server/context";

/**
 * Connexion Google (OpenID Connect).
 * L'jeton d'identité est vérifié cryptographiquement contre les clés publiques
 * de Google : on ne fait jamais confiance à son contenu sans validation.
 */

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleClientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) throw new ValidationError("La connexion Google n'est pas configurée.");
  return id;
}

/** Échange le code d'autorisation contre les jetons Google. */
export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: googleClientId(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    console.error("[google] échange du code refusé:", res.status, await res.text().catch(() => ""));
    throw new ValidationError("Connexion Google refusée. Réessayez.");
  }
  return (await res.json()) as { id_token?: string };
}

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string | null;
};

/** Vérifie la signature de l'id_token et en extrait le profil. */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, JWKS, {
      issuer: GOOGLE_ISSUERS,
      audience: googleClientId(),
    }));
  } catch (e) {
    console.error("[google] id_token invalide:", e);
    throw new ValidationError("Jeton Google invalide.");
  }

  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
  const sub = typeof payload.sub === "string" ? payload.sub : "";
  if (!sub || !email) throw new ValidationError("Profil Google incomplet.");

  // Google peut renvoyer un e-mail non vérifié : refuser, sinon un tiers
  // pourrait revendiquer l'adresse d'un compte existant.
  if (payload.email_verified !== true) {
    throw new ValidationError("Cette adresse Google n'est pas vérifiée.");
  }

  return {
    sub,
    email,
    emailVerified: true,
    name: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : email.split("@")[0]!,
    picture: typeof payload.picture === "string" ? payload.picture : null,
  };
}

/**
 * Retrouve ou crée le compte correspondant au profil Google.
 * - compte Google connu (google_sub)      → connexion
 * - e-mail déjà utilisé par un compte local → on rattache Google à ce compte
 * - inconnu                                → création d'un client + compte CLIENT
 */
export async function findOrCreateGoogleUser(profile: GoogleProfile) {
  const bySub = await prisma.user.findUnique({ where: { googleSub: profile.sub } });
  if (bySub) {
    if (!bySub.isActive) throw new ValidationError("Ce compte est désactivé.");
    await prisma.user.update({
      where: { id: bySub.id },
      data: { lastLoginAt: new Date(), avatarUrl: profile.picture ?? bySub.avatarUrl },
    });
    return bySub;
  }

  const byEmail = await prisma.user.findUnique({ where: { email: profile.email } });
  if (byEmail) {
    if (!byEmail.isActive) throw new ValidationError("Ce compte est désactivé.");
    // rattachement : l'e-mail Google est vérifié, le compte garde son rôle
    const linked = await prisma.user.update({
      where: { id: byEmail.id },
      data: {
        googleSub: profile.sub,
        avatarUrl: profile.picture ?? byEmail.avatarUrl,
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    await prisma.auditLog.create({
      data: { userId: linked.id, action: "GOOGLE_LINK", entityType: "user", entityId: linked.id },
    });
    return linked;
  }

  // nouveau venu : client + compte CLIENT, jamais ADMIN
  const created = await prisma.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: { companyName: profile.name, contactName: profile.name, email: profile.email },
    });
    return tx.user.create({
      data: {
        role: "CLIENT",
        clientId: client.id,
        fullName: profile.name,
        email: profile.email,
        passwordHash: null,
        authProvider: "GOOGLE",
        googleSub: profile.sub,
        avatarUrl: profile.picture,
        lastLoginAt: new Date(),
      },
    });
  });

  await prisma.auditLog.create({
    data: { userId: created.id, action: "GOOGLE_SIGNUP", entityType: "user", entityId: created.id },
  });
  return created;
}
