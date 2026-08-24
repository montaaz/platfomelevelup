import { notFound } from "next/navigation";
import { requireCtx, ForbiddenError } from "@/server/context";
import { getThread } from "@/server/services/messaging";
import { ThreadView } from "@/components/messaging/ThreadView";

export const dynamic = "force-dynamic";

export default async function AdminThreadPage({ params }: { params: Promise<{ projectId: string }> }) {
  const ctx = await requireCtx("ADMIN");
  const { projectId } = await params;
  if (!/^\d+$/.test(projectId)) notFound();

  try {
    const thread = await getThread(ctx, BigInt(projectId));
    return (
      <div className="pb-8">
        <ThreadView
          projectId={thread.projectId}
          projectTitle={thread.projectTitle}
          backHref="/admin/messagerie"
          messages={thread.messages}
        />
      </div>
    );
  } catch (e) {
    if (e instanceof ForbiddenError) notFound();
    throw e;
  }
}
