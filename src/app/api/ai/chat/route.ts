import { requireDb } from "@/lib/ai/db";
import { runAiTurn } from "@/lib/ai/orchestrator";
import {
  toConversationSummary,
  toMessagePayload,
  type AiUploadedFile,
} from "@/lib/ai/types";
import { requireRouteTripContext } from "@/lib/route-auth";

export const runtime = "nodejs";
// Multi-step planning turns (web search + many tool calls) can take a few minutes.
export const maxDuration = 300;

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_FILES_PER_MESSAGE = 6;
const SUPPORTED_FILE_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

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

function sanitizeFilename(value: string) {
  return value.replace(/[^\w.\- ()]/g, "_").slice(0, 160) || "upload";
}

function sanitizeMimeType(value: string) {
  return value || "application/octet-stream";
}

function isSupportedUpload(file: File) {
  if (SUPPORTED_FILE_TYPES.has(file.type)) {
    return true;
  }

  return /\.(pdf|txt|md|markdown|csv|json|docx|xlsx)$/i.test(file.name);
}

async function parseChatRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const message = String(formData.get("message") ?? "");
    const rawConversationId = formData.get("conversationId");
    const conversationId =
      rawConversationId === null || String(rawConversationId).trim() === ""
        ? null
        : Number(rawConversationId);
    const files = formData
      .getAll("files")
      .filter((item): item is File => item instanceof File && item.size > 0);

    return {
      message,
      conversationId: Number.isFinite(conversationId) ? conversationId : null,
      files,
    };
  }

  const payload = (await request.json().catch(() => null)) as
    | { message?: string; conversationId?: number | null }
    | null;

  return {
    message: payload?.message ?? "",
    conversationId: payload?.conversationId ?? null,
    files: [] as File[],
  };
}

async function filesToModelInputs(files: File[]): Promise<AiUploadedFile[]> {
  if (!files.length) {
    return [];
  }

  if (files.length > MAX_FILES_PER_MESSAGE) {
    throw new Error(`Upload up to ${MAX_FILES_PER_MESSAGE} files per message.`);
  }

  const uploaded: AiUploadedFile[] = [];
  for (const file of files) {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error(`${file.name} is too large. Upload files up to 25 MB.`);
    }

    if (!isSupportedUpload(file)) {
      throw new Error(`${file.name} is not a supported file type.`);
    }

    const filename = sanitizeFilename(file.name);
    const mimeType = sanitizeMimeType(file.type);
    const buffer = Buffer.from(await file.arrayBuffer());

    uploaded.push({
      filename,
      mimeType,
      bytes: file.size,
      fileData: `data:${mimeType};base64,${buffer.toString("base64")}`,
    });
  }

  return uploaded;
}

export async function POST(request: Request) {
  const context = await requireRouteTripContext({ minimumRole: "collaborator" });
  if ("error" in context) {
    return context.error;
  }

  const payload = await parseChatRequest(request);

  const message = payload?.message?.trim() ?? "";
  if (!message && !payload.files.length) {
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
        const uploadedFiles = await filesToModelInputs(payload.files);

        const result = await runAiTurn({
          appUser: context.appUser,
          activeTrip: context.activeTrip,
          conversationId: payload.conversationId ?? null,
          message: message || "Please read and summarize the uploaded file(s).",
          uploadedFiles,
          signal: request.signal,
          onProgress: (label) => write({ type: "status", value: label }),
          onStep: (step) => write({ type: "step", step }),
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
