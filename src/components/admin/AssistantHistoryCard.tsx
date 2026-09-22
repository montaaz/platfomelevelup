import { Card, CardHeader } from "@/components/ui";
import { formatDateFull } from "@/lib/format";
import type { HistoryMessage } from "@/buddy/history";

/**
 * Fiche client : ce que le client a demandé à l'assistant, et ce qu'il a
 * obtenu. Lecture seule — l'équipe y voit les besoins exprimés, les refus
 * (donc les questions que le bot ne sait pas traiter) et les signalements.
 */
export function AssistantHistoryCard({ messages }: { messages: (HistoryMessage & { userName: string })[] }) {
  const questions = messages.filter((m) => m.role === "user").length;
  const refusals = messages.filter((m) => m.kind === "refusal").length;

  // Un séparateur de date à chaque changement de jour.
  let lastDay = "";

  return (
    <Card>
      <CardHeader
        title="Conversations avec l'assistant"
        subtitle={
          messages.length === 0
            ? "Le client n'a encore rien demandé à l'assistant."
            : `${questions} question${questions > 1 ? "s" : ""}${refusals ? ` · ${refusals} sans réponse` : ""} — les plus récentes en bas`
        }
      />
      {messages.length > 0 && (
        <div className="max-h-[28rem] space-y-2 overflow-y-auto px-4 pb-4 sm:px-6">
          {messages.map((m) => {
            const day = formatDateFull(m.createdAt);
            const showDay = day !== lastDay;
            lastDay = day;
            return (
              <div key={m.id}>
                {showDay && (
                  <p className="my-2 text-center text-[10.5px] font-semibold tracking-[0.08em] text-ink/45 uppercase">{day}</p>
                )}
                {m.role === "user" ? (
                  <div className="ml-10 rounded-2xl rounded-tr-md bg-brand-500/90 px-3 py-2 text-[12.5px] text-white">
                    <span className="mb-0.5 block text-[10.5px] text-white/75">{m.userName}</span>
                    {m.text}
                  </div>
                ) : (
                  <div
                    className={`mr-10 whitespace-pre-line rounded-2xl rounded-tl-md px-3 py-2 text-[12.5px] text-ink/85 ${
                      m.kind === "review" ? "border border-amber-200 bg-amber-50" : m.kind === "refusal" ? "bg-ink/5" : "bg-white/70"
                    }`}
                  >
                    {m.text}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
