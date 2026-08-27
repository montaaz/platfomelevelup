import Link from "next/link";
import { Avatar, EmptyState, Card, CardHeader } from "@/components/ui";
import { relativeTime } from "@/lib/format";

export type ThreadRowData = {
  projectId: string;
  projectTitle: string;
  clientCompany: string;
  serviceName: string;
  lastMessage: string;
  lastSenderName: string;
  lastAt: string;
  unread: number;
};

export function ThreadList({
  threads,
  basePath,
  showClient,
}: {
  threads: ThreadRowData[];
  basePath: string;
  showClient: boolean;
}) {
  return (
    <Card>
      <CardHeader
        title="Conversations"
        subtitle="Un fil de discussion par projet — tout reste rattaché au projet concerné"
      />
      <div className="divide-y divide-ink/4 pb-2">
        {threads.length === 0 && <EmptyState message="Aucune conversation pour le moment." />}
        {threads.map((thread) => (
          <Link
            key={thread.projectId}
            href={`${basePath}/${thread.projectId}`}
            className="flex gap-3.5 px-5 py-4 hover:bg-white/40 sm:px-6"
          >
            <Avatar name={showClient ? thread.clientCompany : thread.projectTitle} size={42} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-[14px] font-semibold text-ink">
                  {showClient ? thread.clientCompany : thread.projectTitle}
                </p>
                {thread.unread > 0 && (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-violet-500 px-1.5 text-[10.5px] font-bold text-white">
                    {thread.unread}
                  </span>
                )}
                <span className="ml-auto shrink-0 text-[11.5px] text-slate-400">{relativeTime(thread.lastAt)}</span>
              </div>
              <p className="truncate text-[12px] font-medium text-brand-500">
                {showClient ? `${thread.projectTitle} · ${thread.serviceName}` : thread.serviceName}
              </p>
              <p className="mt-0.5 truncate text-[12.5px] text-slate-500">
                {thread.lastSenderName.split(" ")[0]} : {thread.lastMessage}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
