import { requireCtx } from "@/server/context";
import { listThreads } from "@/server/services/messaging";
import { ThreadList } from "@/components/messaging/ThreadList";

export const dynamic = "force-dynamic";

export default async function ClientMessagesPage() {
  const ctx = await requireCtx("CLIENT");
  const threads = await listThreads(ctx);
  return (
    <div className="pb-8">
      <ThreadList threads={threads} basePath="/client/messages" showClient={false} />
    </div>
  );
}
