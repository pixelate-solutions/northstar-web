"use client";

import { ArrowUp, ChevronRight, CornerDownRight, Map as MapIcon, Menu, Paperclip, Search, Sparkle, SquarePen, Square, Undo2, Wrench, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { StarMark } from "@/components/brand/Logo";
import { useTrip } from "@/components/trip/TripProvider";
import { api } from "@/lib/api-client";
import type { TripBundle } from "@/lib/client-types";
import { shortDate } from "@/lib/format";
import type { AiCard, AiConversationSummary, AiMessagePayload } from "@/lib/ai/types";

type Message = AiMessagePayload & { pending?: boolean };
type Step = { kind: "thought" | "search" | "tool" | "result"; text: string };

const isFinePointer = () => typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;

function PulsingDot() {
  return <span className="inline-block h-3 w-3 shrink-0 animate-[ns-pulse_1.4s_ease-in-out_infinite] rounded-full bg-ink" aria-label="Thinking" />;
}

function StepIcon({ step }: { step: Step }) {
  const className = step.kind === "result" && step.text.startsWith("Error") ? "text-stop" : "text-muted";
  const Icon = step.kind === "search" ? Search : step.kind === "tool" ? Wrench : step.kind === "result" ? CornerDownRight : Sparkle;
  return <Icon size={12} strokeWidth={2.4} className={`mt-[3px] shrink-0 ${className}`} />;
}

/** The actual reasoning summaries and tool calls behind an answer. */
function StepList({ steps }: { steps: Step[] }) {
  return (
    <div className="ml-1 flex flex-col gap-2 border-l-2 border-line pl-3">
      {steps.map((step, i) => (
        <div key={i} className="flex gap-2.5">
          <StepIcon step={step} />
          {step.kind === "thought" ? (
            <p className="line-clamp-4 text-[14px] font-medium leading-5 text-muted">{step.text.replaceAll("**", "").trim()}</p>
          ) : (
            <p className={`line-clamp-3 break-words font-mono text-[12px] leading-[18px] ${step.kind === "result" ? "text-muted" : "text-ink"}`}>{step.text}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function Thinking({ steps }: { steps: Step[] }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5">
        <PulsingDot />
        {steps.length ? <span className="text-[15px] font-semibold text-muted">Thinking · {seconds}s</span> : null}
      </div>
      {steps.length ? <StepList steps={steps.slice(-8)} /> : null}
    </div>
  );
}

function ThoughtFor({ ms, steps }: { ms: number; steps: Step[] }) {
  const [open, setOpen] = useState(false);
  const seconds = Math.max(1, Math.round(ms / 1000));
  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        disabled={!steps.length}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 self-start text-[14px] font-semibold text-muted hover:text-ink disabled:hover:text-muted"
      >
        Thought for {seconds} second{seconds === 1 ? "" : "s"}
        {steps.length ? <ChevronRight size={13} strokeWidth={2.6} className={`transition-transform ${open ? "rotate-90" : ""}`} /> : null}
      </button>
      {open ? <StepList steps={steps} /> : null}
    </div>
  );
}

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
  const [steps, setSteps] = useState<Step[]>([]);
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
  }, [messages, status, steps.length]);

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
      setSteps([]);
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
              | { type: "step"; step: Step }
              | { type: "conversation"; conversation: AiConversationSummary }
              | { type: "message_start"; message: Message }
              | { type: "text_delta"; delta: string }
              | { type: "cards"; cards: AiCard[] }
              | { type: "followups"; followups: string[] }
              | { type: "done" }
              | { type: "error"; error: string };
            if (event.type === "status") setStatus(event.value === "thinking" ? "Thinking" : event.value);
            else if (event.type === "step") setSteps((list) => [...list, event.step]);
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
        setSteps([]);
        abortRef.current = null;
        if (isFinePointer()) inputRef.current?.focus();
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
    // No keyboard popping up on phones; desktop gets the cursor in the box.
    if (isFinePointer()) inputRef.current?.focus();
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

  function newChat() {
    abortRef.current?.abort();
    setHistoryOpen(false);
    setConversationId(null);
    setMessages([]);
  }

  async function openHistory() {
    setHistoryOpen(true);
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
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-white">
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 pb-3 pt-[max(env(safe-area-inset-top),16px)] lg:px-6 lg:pb-4 lg:pt-6">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => void openHistory()} aria-label="Chats" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface">
            <Menu size={18} />
          </button>
          <StarMark size={20} />
          <span className="text-[17px] font-bold tracking-[-0.01em]">Ask Northstar</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={newChat}
            disabled={!messages.length && !running}
            aria-label="New chat"
            title="New chat"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface disabled:opacity-40"
          >
            <SquarePen size={17} />
          </button>
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

      {/* Chats slide in from the left. */}
      <div className={`absolute inset-0 z-20 transition ${historyOpen ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!historyOpen}>
        <button
          type="button"
          aria-label="Close chats"
          tabIndex={historyOpen ? 0 : -1}
          onClick={() => setHistoryOpen(false)}
          className={`absolute inset-0 bg-ink/25 transition-opacity duration-300 ${historyOpen ? "opacity-100" : "opacity-0"}`}
        />
        <aside
          className={`absolute inset-y-0 left-0 flex w-[min(82%,320px)] flex-col bg-white pt-[max(env(safe-area-inset-top),12px)] shadow-pop transition-transform duration-300 ease-out ${
            historyOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="px-3 pb-2 pt-3">
            <button type="button" onClick={newChat} className="flex h-12 w-full items-center gap-2.5 rounded-[14px] bg-lane px-4 text-[16px] font-bold">
              <SquarePen size={17} /> New chat
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4 [mask-image:linear-gradient(to_bottom,transparent,black_12px,black_calc(100%-12px),transparent)]">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => void loadConversation(conversation.id)}
                className={`flex h-11 shrink-0 items-center justify-between gap-2 rounded-[12px] px-3.5 text-left hover:bg-surface ${
                  conversation.id === conversationId ? "bg-surface font-bold" : "font-medium"
                }`}
              >
                <span className="truncate text-[15px]">{conversation.title}</span>
                <span className="shrink-0 font-mono text-[11px] font-medium text-muted">{shortDate(conversation.updatedAt.slice(0, 10))}</span>
              </button>
            ))}
          </div>
        </aside>
      </div>

      <div
        ref={threadRef}
        className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-4 [mask-image:linear-gradient(to_bottom,transparent,black_24px,black_calc(100%-24px),transparent)] lg:px-7"
      >
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
          const metadata = (message.metadata ?? {}) as {
            undoable?: boolean;
            undoApplied?: boolean;
            sources?: Array<{ url: string; title: string }>;
            steps?: Step[];
            thoughtMs?: number;
          };
          return (
            <div key={message.id} className="flex flex-col gap-3.5">
              {typeof metadata.thoughtMs === "number" ? <ThoughtFor ms={metadata.thoughtMs} steps={metadata.steps ?? []} /> : null}
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
        {running ? <Thinking steps={steps} /> : null}
      </div>

      <div className="flex shrink-0 flex-col gap-2.5 px-3 pb-[max(env(safe-area-inset-bottom),16px)] pt-3 lg:px-6 lg:pb-6">
        {!running ? (
          <div className="scrollbar-hide flex gap-1.5 overflow-x-auto [mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-12px),transparent)] px-3 -mx-3">
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
