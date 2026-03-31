import { requireDb } from "@/lib/ai/db";
import { runAiTurn } from "@/lib/ai/orchestrator";
import { toConversationSummary, toMessagePayload } from "@/lib/ai/types";
import { requireRouteTripContext } from "@/lib/route-auth";

export const runtime = "nodejs";

function createAbortError() {
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  return error;
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function chunkText(text: string, size = 120) {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size));
  }
  return chunks;
}

export async function POST(request: Request) {
  const context = await requireRouteTripContext({ minimumRole: "collaborator" });
  if ("error" in context) {
    return context.error;
  }

  const payload = (await request.json().catch(() => null)) as
    | { message?: string; conversationId?: number | null }
    | null;

  const message = payload?.message?.trim() ?? "";
  if (!message) {
    return Response.json({ error: "A message is required." }, { status: 400 });
  }

  requireDb();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const assertNotAborted = () => {
        if (request.signal.aborted) {
          throw createAbortError();
        }
      };

      const write = (data: Record<string, unknown>) => {
        assertNotAborted();
        controller.enqueue(encoder.encode(`${JSON.stringify(data)}\n`));
      };

      const closeStream = () => {
        try {
          controller.close();
        } catch {}
      };

      const handleAbort = () => {
        closeStream();
      };

      request.signal.addEventListener("abort", handleAbort, { once: true });

      try {
        assertNotAborted();
        write({ type: "status", value: "thinking" });

        const result = await runAiTurn({
          appUser: context.appUser,
          activeTrip: context.activeTrip,
          conversationId: payload?.conversationId ?? null,
          message,
          signal: request.signal,
        });

        assertNotAborted();
        const conversation = toConversationSummary(result.conversation);
        const finalMessage = toMessagePayload(result.message);

        write({ type: "conversation", conversation });
        write({
          type: "message_start",
          message: {
            ...finalMessage,
            content: "",
          },
        });

        for (const chunk of chunkText(finalMessage.content)) {
          write({ type: "text_delta", delta: chunk });
        }

        if (finalMessage.cards.length) {
          write({ type: "cards", cards: finalMessage.cards });
        }

        if (finalMessage.followups.length) {
          write({ type: "followups", followups: finalMessage.followups });
        }

        write({ type: "done", messageId: finalMessage.id });
      } catch (error) {
        if (!isAbortError(error) && !request.signal.aborted) {
          write({
            type: "error",
            error: error instanceof Error ? error.message : "Unable to process AI chat.",
          });
        }
      } finally {
        request.signal.removeEventListener("abort", handleAbort);
        closeStream();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
    },
  });
}
