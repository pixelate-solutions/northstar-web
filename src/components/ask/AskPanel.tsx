"use client";

import { ArrowUp, History, Map as MapIcon, Paperclip, Plus, Square, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { StarMark } from "@/components/brand/Logo";
import { MenuItem, Popover } from "@/components/ns/overlay";
import { useTrip } from "@/components/trip/TripProvider";
import { api } from "@/lib/api-client";
import type { TripBundle } from "@/lib/client-types";
import { shortDate } from "@/lib/format";
import type { AiCard, AiConversationSummary, AiMessagePayload } from "@/lib/ai/types";

type Message = AiMessagePayload & { pending?: boolean };

function changedEventIds(before: TripBundle, after: TripBundle) {
  const previous = new Map(before.days.flatMap((day) => day.events.map((event) => [event.id, `${event.updatedAt}|${event.dayId}|${event.sortOrder}`] as const)));
  const ids = new Set<number>();
  for (const day of after.days) {
    for (const event of day.events) {
      const signature = `${event.updatedAt}|${event.dayId}|${event.sortOrder}`;
      if (previous.get(event.id) !== signature) ids.add(event.id);
    }
  }
  return ids;
}

/** Minimal formatting: paragraphs, bullet/numbered lines, **bold**. */
function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="flex flex-col gap-2.5 text-[16px] font-medium leading-6">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const isList = lines.every((line) => /^\s*([-*•]|\d+[.)])\s+/.test(line));
        if (isList) {
          return (
            <ul key={i} className="flex flex-col gap-1">
              {lines.map((line, j) => (
                <li key={j} className="flex gap-2">
                  <span className="text-muted">•</span>
                  <span>{renderInline(line.replace(/^\s*([-*•]|\d+[.)])\s+/, ""))}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {renderInline(block)}
          </p>
        );
      })}
    </div>
  );
}

function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>
  );
}

function ChangesCard({
  cards,
  undoable,
  undone,
  onUndo,
  busy,
}: {
  cards: Extract<AiCard, { type: "mutation" }>[];
  undoable: boolean;
  undone: boolean;
  onUndo: () => void;
  busy: boolean;
}) {
  const lines = cards.flatMap((card) => (card.changes.length ? card.changes : [card.title]));
  return (
    <div className="overflow-hidden rounded-[16px] border border-line">
      <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
        <span className="text-[15px] font-bold">
          {lines.length} change{lines.length === 1 ? "" : "s"}
        </span>
        {undone ? <span className="font-mono text-[12px] font-medium text-muted">Undone</span> : null}
      </div>
      <div className="flex flex-col">
        {lines.slice(0, 12).map((line, i) => (
          <div key={i} className="flex gap-3 px-4 py-2.5">
            <span className="mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] bg-lane">
              <span className="h-1.5 w-1.5 rounded-full bg-ink" />
            </span>
            <span className={`text-[14px] font-medium leading-5 ${undone ? "text-muted line-through" : ""}`}>{line}</span>
          </div>
        ))}
        {lines.length > 12 ? <div className="px-4 pb-2 text-[13px] font-medium text-muted">+{lines.length - 12} more</div> : null}
      </div>
      {undoable && !undone ? (
        <div className="flex gap-2 px-4 pb-4 pt-2">
          <button
            type="button"
            disabled={busy}
            onClick={onUndo}
            className="flex items-center gap-1.5 rounded-full border border-line px-[18px] py-2.5 text-[14px] font-semibold transition hover:bg-surface disabled:opacity-50"
          >
            <Undo2 size={14} /> Undo
          </button>
        </div>
      ) : null}
    </div>
  );
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function AskPanel() {
  const { bundle, ask, closeAsk, refresh, setHighlightedEventIds, askConversationId, setAskConversationId } = useTrip();
  const conversationId = askConversationId;
  const setConversationId = setAskConversationId;
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<AiConversationSummary[]>([]);
  const [undoing, setUndoing] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bundleRef = useRef(bundle);
  bundleRef.current = bundle;
  const sentDraft = useRef<string | null>(null);

  const running = status !== null;

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const suggestions = useMemo(() => {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (last?.followups?.length) return last.followups.slice(0, 3);
    const emptyDay = bundle.days.find((day) => day.events.length === 0);
    return [
      emptyDay ? `Plan Day ${emptyDay.dayNumber}${emptyDay.location ? ` in ${emptyDay.location}` : ""}` : "Tighten up tomorrow's plan",
      "Build a packing list for this trip",
      "What still needs to be booked?",
    ];
  }, [messages, bundle.days]);

  const send = useCallback(
    async (raw: string, attachments: File[] = []) => {
      const message = raw.trim();
      if ((!message && !attachments.length) || running) return;
      const before = bundleRef.current;
      setText("");
      setFiles([]);
      const optimisticUser: Message = {
        id: -Date.now(),
        role: "user",
        content: message || attachments.map((f) => f.name).join(", "),
        cards: [],
        followups: [],
        createdAt: new Date().toISOString(),
      };
      setMessages((list) => [...list, optimisticUser]);
      setStatus("Thinking");
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        let body: BodyInit;
        const headers: Record<string, string> = {};
        if (attachments.length) {
          const form = new FormData();
          form.set("message", message);
          if (conversationId) form.set("conversationId", String(conversationId));
          attachments.forEach((file) => form.append("files", file));
          body = form;
        } else {
          headers["Content-Type"] = "application/json";
          body = JSON.stringify({ message, conversationId });
        }
        const response = await fetch("/api/ai/chat", { method: "POST", body, headers, signal: controller.signal });
        if (!response.ok || !response.body) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? "Northstar couldn't respond.");
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const holder: { message: Message | null } = { message: null };
        const patch = (changes: Partial<Message>) => {
          if (!holder.message) return;
          const updated: Message = { ...holder.message, ...changes };
          holder.message = updated;
          setMessages((list) => list.map((m) => (m.id === updated.id ? updated : m)));
        };
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as
              | { type: "status"; value: string }
              | { type: "conversation"; conversation: AiConversationSummary }
              | { type: "message_start"; message: Message }
              | { type: "text_delta"; delta: string }
              | { type: "cards"; cards: AiCard[] }
              | { type: "followups"; followups: string[] }
              | { type: "done" }
              | { type: "error"; error: string };
            if (event.type === "status") setStatus(event.value === "thinking" ? "Thinking" : event.value);
            else if (event.type === "conversation") setConversationId(event.conversation.id);
            else if (event.type === "message_start") {
              const started: Message = { ...event.message, content: "" };
              holder.message = started;
              setStatus(null);
              setMessages((list) => [...list, started]);
            } else if (event.type === "text_delta") patch({ content: (holder.message?.content ?? "") + event.delta });
            else if (event.type === "cards") patch({ cards: event.cards });
            else if (event.type === "followups") patch({ followups: event.followups });
            else if (event.type === "error") throw new Error(event.error);
          }
        }
        // Reload the plan and highlight what changed.
        const hadChanges = (holder.message?.cards ?? []).some((card) => card.type === "mutation");
        if (hadChanges) {
          const next = await api<TripBundle>("/api/trip");
          await refresh();
          const ids = changedEventIds(before, next);
          setHighlightedEventIds(ids);
          window.setTimeout(() => setHighlightedEventIds(new Set()), 12000);
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          toast.error(error instanceof Error ? error.message : "Northstar couldn't respond.");
        }
      } finally {
        setStatus(null);
        abortRef.current = null;
        inputRef.current?.focus();
      }
    },
    [conversationId, running, refresh, setHighlightedEventIds, setConversationId]
  );

  // Open with a draft (e.g. "Plan this day") and optionally send it right away.
  useEffect(() => {
    if (!ask.draft || sentDraft.current === ask.draft) return;
    sentDraft.current = ask.draft;
    if (ask.autoSend) void send(ask.draft);
    else setText(ask.draft);
  }, [ask.draft, ask.autoSend, send]);

  useEffect(() => {
    inputRef.current?.focus();
    // Reopening the panel restores the chat that was open.
    if (askConversationId && !messages.length) {
      api<AiMessagePayload[]>(`/api/ai/history/${askConversationId}`)
        .then((history) => setMessages((current) => (current.length ? current : history)))
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function undo(message: Message) {
    if (!conversationId) return;
    setUndoing(message.id);
    try {
      const result = await api<{ message: AiMessagePayload }>(`/api/ai/messages/${message.id}/undo`, {
        method: "POST",
        headers: { "x-ai-conversation-id": String(conversationId) },
      });
      setMessages((list) => list.map((m) => (m.id === message.id ? { ...m, metadata: result.message.metadata } : m)));
      setHighlightedEventIds(new Set());
      await refresh();
      toast.success("Undone");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't undo that.");
    } finally {
      setUndoing(null);
    }
  }

  async function openHistory() {
    setHistoryOpen((open) => !open);
    try {
      setConversations(await api<AiConversationSummary[]>("/api/ai/conversations"));
    } catch {}
  }

  async function loadConversation(id: number) {
    setHistoryOpen(false);
    try {
      const history = await api<AiMessagePayload[]>(`/api/ai/history/${id}`);
      setConversationId(id);
      setMessages(history);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't open that chat.");
    }
  }

  return (
    <div className="flex h-full w-full flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-3 pt-[max(env(safe-area-inset-top),16px)] lg:px-7 lg:pb-4 lg:pt-6">
        <div className="flex items-center gap-2.5">
          <StarMark size={20} />
          <span className="text-[17px] font-bold tracking-[-0.01em]">Ask Northstar</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <button type="button" onClick={() => void openHistory()} aria-label="Chats" className="flex h-8 w-8 items-center justify-center rounded-full border border-line hover:bg-surface">
              <History size={15} />
            </button>
            <Popover open={historyOpen} onClose={() => setHistoryOpen(false)} className="right-0 top-10 max-h-[360px] w-[280px] overflow-y-auto">
              <MenuItem
                icon={<Plus size={16} />}
                onClick={() => {
                  setHistoryOpen(false);
                  setConversationId(null);
                  setMessages([]);
                }}
              >
                New chat
              </MenuItem>
              {conversations.length ? <div className="mx-1 my-1 h-px bg-line" /> : null}
              {conversations.map((conversation) => (
                <MenuItem key={conversation.id} active={conversation.id === conversationId} onClick={() => void loadConversation(conversation.id)}>
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span className="truncate text-[14px]">{conversation.title}</span>
                    <span className="shrink-0 font-mono text-[11px] font-medium text-muted">{shortDate(conversation.updatedAt.slice(0, 10))}</span>
                  </span>
                </MenuItem>
              ))}
            </Popover>
          </div>
          <button
            type="button"
            onClick={closeAsk}
            className="hidden items-center gap-1.5 rounded-full border border-line px-3 py-[7px] text-[14px] font-semibold hover:bg-surface lg:flex"
          >
            <MapIcon size={14} /> Map
          </button>
          <button type="button" onClick={closeAsk} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full border border-line hover:bg-surface">
            <X size={16} />
          </button>
        </div>
      </div>

      <div ref={threadRef} className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-2 lg:px-7">
        {!messages.length && !running ? (
          <div className="flex flex-1 flex-col justify-end pb-4">
            <p className="text-[28px] font-extrabold leading-8 tracking-display">What should we change?</p>
          </div>
        ) : null}
        {messages.map((message) => {
          if (message.role === "user") {
            return (
              <div key={message.id} className="flex justify-end">
                <div className="max-w-[440px] whitespace-pre-wrap rounded-[18px_18px_4px_18px] bg-surface px-4 py-3 text-[16px] font-medium leading-[23px]">
                  {message.content}
                </div>
              </div>
            );
          }
          const mutations = message.cards.filter((card): card is Extract<AiCard, { type: "mutation" }> => card.type === "mutation");
          const metadata = (message.metadata ?? {}) as { undoable?: boolean; undoApplied?: boolean; sources?: Array<{ url: string; title: string }> };
          return (
            <div key={message.id} className="flex flex-col gap-3.5">
              {message.content ? <RichText text={message.content} /> : null}
              {mutations.length ? (
                <ChangesCard
                  cards={mutations}
                  undoable={Boolean(metadata.undoable)}
                  undone={Boolean(metadata.undoApplied)}
                  busy={undoing === message.id}
                  onUndo={() => void undo(message)}
                />
              ) : null}
              {metadata.sources?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {metadata.sources.map((source) => (
                    <a
                      key={source.url}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="max-w-[260px] truncate rounded-full bg-surface px-2.5 py-[5px] text-[13px] font-semibold hover:bg-line"
                      title={source.title}
                    >
                      {hostname(source.url)}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
        {running ? (
          <div className="flex items-center gap-2.5 text-[15px] font-semibold text-muted">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lane opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-lane" />
            </span>
            {status}…
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col gap-2.5 px-3 pb-[max(env(safe-area-inset-bottom),16px)] pt-3 lg:px-6 lg:pb-6">
        {!running ? (
          <div className="scrollbar-hide flex gap-1.5 overflow-x-auto">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => void send(suggestion)}
                className="shrink-0 whitespace-nowrap rounded-full border border-line px-3 py-[7px] text-[14px] font-semibold transition hover:bg-surface"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
        {files.length ? (
          <div className="flex flex-wrap gap-1.5">
            {files.map((file) => (
              <span key={file.name} className="flex items-center gap-1.5 rounded-full bg-surface py-1 pl-3 pr-1.5 text-[13px] font-semibold">
                {file.name}
                <button type="button" aria-label="Remove file" onClick={() => setFiles((list) => list.filter((f) => f !== file))} className="rounded-full p-0.5 hover:bg-line">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send(text, files);
          }}
          className="flex items-end gap-3 rounded-[28px] bg-ink py-2 pl-[18px] pr-2"
        >
          <button type="button" aria-label="Attach files" onClick={() => fileRef.current?.click()} className="mb-[11px] text-[#A3A39E] hover:text-white">
            <Paperclip size={18} />
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".pdf,.txt,.md,.csv,.json,.docx,.xlsx"
            className="hidden"
            onChange={(event) => {
              setFiles((list) => [...list, ...Array.from(event.target.files ?? [])].slice(0, 6));
              event.target.value = "";
            }}
          />
          <textarea
            ref={inputRef}
            value={text}
            rows={1}
            onChange={(event) => {
              setText(event.target.value);
              event.target.style.height = "auto";
              event.target.style.height = `${Math.min(event.target.scrollHeight, 160)}px`;
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(text, files);
              }
            }}
            placeholder="Ask Northstar"
            className="max-h-40 min-w-0 flex-1 resize-none bg-transparent py-[9px] text-[16px] font-medium leading-6 text-white placeholder:text-[#A3A39E]"
          />
          {running ? (
            <button type="button" aria-label="Stop" onClick={() => abortRef.current?.abort()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button type="submit" aria-label="Send" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lane">
              <ArrowUp size={18} strokeWidth={2.4} />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
