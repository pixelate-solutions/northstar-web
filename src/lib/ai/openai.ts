import "server-only";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_FILES_URL = "https://api.openai.com/v1/files";

export interface ResponsesFunctionCall {
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
  status?: string;
}

interface ResponsesOutputTextContent {
  type: "output_text";
  text: string;
}

interface ResponsesMessage {
  type: "message";
  role: string;
  content?: Array<ResponsesOutputTextContent | { type: string; text?: string }>;
}

export interface ResponsesApiResponse {
  id: string;
  output?: Array<ResponsesFunctionCall | ResponsesMessage | { type: string; [key: string]: unknown }>;
  output_text?: string;
}

export function isOpenAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function createOpenAiResponse(input: {
  body: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<ResponsesApiResponse> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for Northstar AI.");
  }

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(input.body),
    cache: "no-store",
    signal: input.signal,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `OpenAI Responses API error (${response.status}): ${errorBody || response.statusText}`
    );
  }

  return (await response.json()) as ResponsesApiResponse;
}

export async function uploadOpenAiInputFile(input: {
  file: File;
  filename: string;
  signal?: AbortSignal;
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for Northstar AI file uploads.");
  }

  const formData = new FormData();
  formData.set("purpose", "user_data");
  formData.set("file", input.file, input.filename);

  const response = await fetch(OPENAI_FILES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
    cache: "no-store",
    signal: input.signal,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `OpenAI Files API error (${response.status}): ${errorBody || response.statusText}`
    );
  }

  return (await response.json()) as {
    id: string;
    filename?: string;
    bytes?: number;
    purpose?: string;
  };
}

export function getFunctionCalls(response: ResponsesApiResponse) {
  return (response.output ?? []).filter(
    (item): item is ResponsesFunctionCall => item.type === "function_call"
  );
}

export function getResponseText(response: ResponsesApiResponse) {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const parts = (response.output ?? [])
    .filter((item): item is ResponsesMessage => item.type === "message")
    .flatMap((message) => message.content ?? [])
    .filter((content): content is ResponsesOutputTextContent => content.type === "output_text")
    .map((content) => content.text.trim())
    .filter(Boolean);

  return parts.join("\n\n").trim();
}

export function buildFunctionCallOutput(callId: string, output: unknown) {
  return {
    type: "function_call_output",
    call_id: callId,
    output: typeof output === "string" ? output : JSON.stringify(output),
  };
}

/** url_citation annotations from web search, deduped by URL. */
export function getResponseSources(response: ResponsesApiResponse) {
  const sources: Array<{ url: string; title: string }> = [];
  for (const item of response.output ?? []) {
    if (item.type !== "message") continue;
    for (const content of (item as ResponsesMessage).content ?? []) {
      const annotations = (content as { annotations?: Array<{ type?: string; url?: string; title?: string }> }).annotations ?? [];
      for (const annotation of annotations) {
        if (annotation.type === "url_citation" && annotation.url && !sources.some((s) => s.url === annotation.url)) {
          sources.push({ url: annotation.url, title: annotation.title ?? annotation.url });
        }
      }
    }
  }
  return sources;
}
