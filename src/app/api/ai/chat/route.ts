import { requireDb } from "@/lib/ai/db";
import { runAiTurn } from "@/lib/ai/orchestrator";
import {
  toConversationSummary,
  toMessagePayload,
  type AiUploadedFile,
} from "@/lib/ai/types";
import {
  addUploadPart,
  classifyAttachment,
  completeUpload,
  createUpload,
  MAX_FILE_BYTES,
  MAX_FILES_PER_MESSAGE,
  MAX_REQUEST_FILE_BYTES,
  sanitizeFilename,
  unseal,
  type AttachmentRecord,
} from "@/lib/ai/uploads";
import { requireRouteTripContext } from "@/lib/route-auth";

export const runtime = "nodejs";
// Multi-step planning turns (web search + many tool calls) can take a few minutes.
export const maxDuration = 300;

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
      attachments: [] as unknown[],
    };
  }

  const payload = (await request.json().catch(() => null)) as
    | { message?: string; conversationId?: number | null; attachments?: unknown[] }
    | null;

  return {
    message: payload?.message ?? "",
    conversationId: payload?.conversationId ?? null,
    files: [] as File[],
    /** Signed references from /api/ai/uploads/complete. */
    attachments: Array.isArray(payload?.attachments) ? payload.attachments : [],
  };
}

/** Verifies attachment references were issued to this user. */
function attachmentsFromRefs(userId: number, refs: unknown[]): AiUploadedFile[] {
  if (refs.length > MAX_FILES_PER_MESSAGE) throw new Error(`Attach up to ${MAX_FILES_PER_MESSAGE} files per message.`);
  const files = refs.map((ref) => {
    const record = unseal<AttachmentRecord>(userId, ref);
    if (!record?.fileId) throw new Error("One of the attachments couldn't be verified. Attach it again.");
    return { fileId: record.fileId, filename: record.filename, mimeType: record.mimeType, bytes: record.bytes, kind: record.kind, blobUrl: record.blobUrl };
  });
  if (files.reduce((sum, file) => sum + file.bytes, 0) > MAX_REQUEST_FILE_BYTES) throw new Error("Attachments can total up to 50 MB per message.");
  return files;
}

/** Older clients send files inline (multipart); upload them the same way as chunked uploads. */
async function filesToModelInputs(files: File[]): Promise<AiUploadedFile[]> {
  if (files.length > MAX_FILES_PER_MESSAGE) throw new Error(`Attach up to ${MAX_FILES_PER_MESSAGE} files per message.`);
  const uploaded: AiUploadedFile[] = [];
  for (const file of files) {
    const filename = sanitizeFilename(file.name);
    if (file.size > MAX_FILE_BYTES) throw new Error(`${filename} is too large. Files can be up to 50 MB.`);
    const type = classifyAttachment(filename, file.type);
    if (!type) throw new Error(`${filename} isn't a file type Northstar can read.`);
    const upload = await createUpload({ filename, bytes: file.size, mimeType: type.mimeType, kind: type.kind });
    const part = await addUploadPart(upload.id, file);
    const done = await completeUpload(upload.id, [part.id]);
    if (!done.file?.id) throw new Error(`Couldn't upload ${filename}.`);
    uploaded.push({ fileId: done.file.id, filename, mimeType: type.mimeType, bytes: file.size, kind: type.kind });
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
  if (!message && !payload.files.length && !payload.attachments.length) {
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
        const uploadedFiles = [
          ...attachmentsFromRefs(context.appUser.id, payload.attachments),
          ...(await filesToModelInputs(payload.files)),
        ];

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
