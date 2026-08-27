import { prisma } from "@/lib/prisma";

/**
 * E-mail mirror for notifications (spec: alerts by e-mail AND in the dashboard).
 * Uses Resend's HTTP API when RESEND_API_KEY is set; otherwise it only logs,
 * so development works without any external service.
 * Sender and template text live here — editable without touching business code.
 */
const FROM = process.env.EMAIL_FROM ?? "Level Up IA <notifications@levelupia.tn>";
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

function emailHtml(title: string, body: string | null): string {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f5f6fb;font-family:Arial,Helvetica,sans-serif;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden">
    <div style="background:#07112e;padding:20px 28px">
      <span style="color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:1px">LEVEL UP <span style="color:#8527ff">IA</span></span>
    </div>
    <div style="padding:28px">
      <h1 style="margin:0 0 8px;font-size:17px;color:#07112e">${title}</h1>
      ${body ? `<p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#475569">${body}</p>` : ""}
      <a href="${APP_URL}" style="display:inline-block;background:#1687ff;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:11px 22px;border-radius:10px">Ouvrir mon espace</a>
    </div>
    <p style="margin:0;padding:0 28px 24px;font-size:11px;color:#94a3b8">Level Up IA — Digital marketing powered by AI</p>
  </div></body></html>`;
}

/**
 * Fire-and-forget: mirrors freshly created notifications to e-mail.
 * Never throws — a mail failure must never break the business action.
 */
export function mirrorNotificationEmails(userIds: bigint[], title: string, body: string | null): void {
  void (async () => {
    try {
      const apiKey = process.env.RESEND_API_KEY;
      const users = await prisma.user.findMany({
        where: { id: { in: userIds }, isActive: true },
        select: { id: true, email: true },
      });
      if (users.length === 0) return;

      if (!apiKey) {
        console.log(`[mail:dev] "${title}" → ${users.map((u) => u.email).join(", ")}`);
        return;
      }

      for (const user of users) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: FROM, to: user.email, subject: title, html: emailHtml(title, body) }),
        });
        if (res.ok) {
          await prisma.notification.updateMany({
            where: { userId: user.id, title, emailedAt: null },
            data: { emailedAt: new Date() },
          });
        }
      }
    } catch (e) {
      console.error("[mail] envoi impossible:", e);
    }
  })();
}
