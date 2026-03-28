"use client";

import { Fragment, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  Bot,
  Check,
  History,
  Loader2,
  Maximize2,
  MessageSquare,
  Minimize2,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AiCard, AiConversationSummary, AiMessagePayload } from "@/lib/ai/types";

interface StreamMessage extends AiMessagePayload {
  pending?: boolean;
}

const SMALL_SCREEN_BREAKPOINT = 768;
const DEFAULT_SHEET_WIDTH = 544;
const MAX_EXPANDED_SHEET_WIDTH = 980;

function renderInlineMarkdown(content: string) {
  const parts = content.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[0.92em] text-slate-700"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return <Fragment key={index}>{part}</Fragment>;
  });
}

function renderInlineMarkdownWithBreaks(lines: string[]) {
  return lines.map((line, index) => (
    <Fragment key={index}>
      {index > 0 ? <br /> : null}
      {renderInlineMarkdown(line)}
    </Fragment>
  ));
}

function renderMarkdownBlocks(content: string): ReactNode[] {
  const lines = content.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trimEnd();

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const className =
        level === 1
          ? "text-base font-bold tracking-[-0.02em] text-slate-900"
          : level === 2
            ? "text-sm font-bold tracking-[-0.01em] text-slate-900"
            : "text-sm font-semibold text-slate-800";
      blocks.push(
        <div key={`heading-${index}`} className={className}>
          {renderInlineMarkdown(text)}
        </div>
      );
      index += 1;
      continue;
    }

    const unorderedMatch = line.match(/^[-*]\s+(.+)$/);
    if (unorderedMatch) {
      const items: ReactNode[] = [];
      let listIndex = index;
      while (listIndex < lines.length) {
        const match = lines[listIndex].trimEnd().match(/^[-*]\s+(.+)$/);
        if (!match) break;
        items.push(
          <li key={`ul-${listIndex}`} className="ml-5 list-disc">
            {renderInlineMarkdown(match[1])}
          </li>
        );
        listIndex += 1;
      }
      blocks.push(
        <ul key={`ul-block-${index}`} className="space-y-1">
          {items}
        </ul>
      );
      index = listIndex;
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      const items: ReactNode[] = [];
      let listIndex = index;
      while (listIndex < lines.length) {
        const match = lines[listIndex].trimEnd().match(/^\d+\.\s+(.+)$/);
        if (!match) break;
        items.push(
          <li key={`ol-${listIndex}`} className="ml-5 list-decimal">
            {renderInlineMarkdown(match[1])}
          </li>
        );
        listIndex += 1;
      }
      blocks.push(
        <ol key={`ol-block-${index}`} className="space-y-1">
          {items}
        </ol>
      );
      index = listIndex;
      continue;
    }

    const paragraphLines = [line];
    let paragraphIndex = index + 1;
    while (paragraphIndex < lines.length) {
      const next = lines[paragraphIndex];
      if (!next.trim()) break;
      if (/^(#{1,3})\s+/.test(next)) break;
      if (/^[-*]\s+/.test(next)) break;
      if (/^\d+\.\s+/.test(next)) break;
      paragraphLines.push(next.trimEnd());
      paragraphIndex += 1;
    }

    blocks.push(
      <p key={`paragraph-${index}`} className="leading-6">
        {renderInlineMarkdownWithBreaks(paragraphLines)}
      </p>
    );
    index = paragraphIndex;
  }

  return blocks;
}

function MarkdownMessage({
  content,
  pending,
}: {
  content: string;
  pending?: boolean;
}) {
  if (!content && pending) {
    return <span>Thinking…</span>;
  }

  return <div className="space-y-3">{renderMarkdownBlocks(content)}</div>;
}

function isUndoableAssistantMessage(message: StreamMessage) {
  if (message.role !== "assistant" || message.pending) {
    return false;
  }

  return message.metadata?.undoable === true && message.metadata?.undoApplied !== true;
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ApprovalCard({
  card,
  onApprove,
  onReject,
  status,
}: {
  card: Extract<AiCard, { type: "approval" }>;
  onApprove: () => void;
  onReject: () => void;
  status?: "approved" | "rejected";
}) {
  return (
    <div className="rounded-3xl border border-amber-200/80 bg-amber-50/90 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700/80">
            Approval Required
          </p>
          <h4 className="mt-2 text-sm font-semibold text-slate-900">{card.title}</h4>
          <p className="mt-2 text-sm leading-6 text-slate-600">{card.description}</p>
          {card.provider ? (
            <Badge className="mt-3 bg-amber-100 text-amber-900">{card.provider}</Badge>
          ) : null}
        </div>
        {status === "approved" ? (
          <Badge className="bg-emerald-100 text-emerald-900">Approved</Badge>
        ) : status === "rejected" ? (
          <Badge className="bg-slate-200 text-slate-700">Rejected</Badge>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          className="rounded-full bg-amber-600 text-white hover:bg-amber-700"
          disabled={Boolean(status)}
          onClick={onApprove}
        >
          <Check className="size-4" />
          {card.actionLabel}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-full"
          disabled={Boolean(status)}
          onClick={onReject}
        >
          <X className="size-4" />
          Reject
        </Button>
      </div>
    </div>
  );
}

function MessageCards({
  cards,
  approvalStatusById,
  onApprove,
  onReject,
}: {
  cards: AiCard[];
  approvalStatusById: Record<number, "approved" | "rejected">;
  onApprove: (approvalId: number, externalUrl?: string | null) => void;
  onReject: (approvalId: number) => void;
}) {
  if (!cards.length) return null;

  return (
    <div className="mt-3 space-y-3">
      {cards.map((card, index) => {
        if (card.type === "mutation") {
          return (
            <div
              key={`${card.type}-${index}`}
              className="rounded-3xl border border-emerald-200/80 bg-emerald-50/90 p-4 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700/80">
                Trip Updated
              </p>
              <h4 className="mt-2 text-sm font-semibold text-slate-900">{card.title}</h4>
              {card.description ? (
                <p className="mt-2 text-sm text-slate-600">{card.description}</p>
              ) : null}
              <div className="mt-3 flex flex-col gap-2">
                {card.changes.map((change) => (
                  <div
                    key={change}
                    className="rounded-2xl bg-white/70 px-3 py-2 text-sm text-slate-700"
                  >
                    {change}
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (card.type === "approval") {
          return (
            <ApprovalCard
              key={`${card.type}-${card.approvalId}`}
              card={card}
              status={approvalStatusById[card.approvalId]}
              onApprove={() => onApprove(card.approvalId, card.externalUrl)}
              onReject={() => onReject(card.approvalId)}
            />
          );
        }

        if (card.type === "reservation") {
          return (
            <div
              key={`${card.type}-${index}`}
              className="rounded-3xl border border-sky-200/80 bg-sky-50/90 p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700/80">
                    Imported Reservation
                  </p>
                  <h4 className="mt-2 text-sm font-semibold text-slate-900">{card.title}</h4>
                  <p className="mt-2 text-sm text-slate-600">
                    {[card.category, card.subtitle].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {card.status ? <Badge className="bg-sky-100 text-sky-900">{card.status}</Badge> : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {card.dateLabel ? (
                  <Badge className="bg-white text-slate-700">{formatDateLabel(card.dateLabel)}</Badge>
                ) : null}
                {card.confirmationCode ? (
                  <Badge className="bg-white text-slate-700">{card.confirmationCode}</Badge>
                ) : null}
              </div>
            </div>
          );
        }

        return (
          <a
            key={`${card.type}-${index}`}
            href={card.href ?? "#"}
            target={card.href ? "_blank" : undefined}
            rel={card.href ? "noreferrer" : undefined}
            className={cn(
              "block rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-sm transition hover:border-slate-300",
              !card.href && "pointer-events-none"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  {card.category}
                </p>
                <h4 className="mt-2 text-sm font-semibold text-slate-900">{card.title}</h4>
                {card.subtitle ? (
                  <p className="mt-2 text-sm text-slate-600">{card.subtitle}</p>
                ) : null}
              </div>
              {card.href ? (
                <ArrowRightLeft className="size-4 shrink-0 text-slate-400" />
              ) : null}
            </div>
            {card.description ? (
              <p className="mt-3 text-sm leading-6 text-slate-600">{card.description}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {card.priceLabel ? <Badge className="bg-slate-100 text-slate-700">{card.priceLabel}</Badge> : null}
              {card.ratingLabel ? <Badge className="bg-slate-100 text-slate-700">{card.ratingLabel}</Badge> : null}
              {(card.badges ?? []).map((badge) => (
                <Badge key={badge} className="bg-slate-100 text-slate-700">
                  {badge}
                </Badge>
              ))}
            </div>
          </a>
        );
      })}
    </div>
  );
}

export function AiConciergeSheet({
  tripName,
  enabled = true,
}: {
  tripName: string;
  enabled?: boolean;
}) {
  const router = useRouter();
  const maxComposerLines = 6;
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === "undefined" ? 1280 : window.innerWidth
  );
  const [conversations, setConversations] = useState<AiConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [approvalStatusById, setApprovalStatusById] = useState<
    Record<number, "approved" | "rejected">
  >({});
  const [conversationPendingDelete, setConversationPendingDelete] =
    useState<AiConversationSummary | null>(null);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);
  const [undoingMessageId, setUndoingMessageId] = useState<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    void loadConversations();
  }, [open]);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";

    const lineHeight = Number.parseFloat(window.getComputedStyle(textarea).lineHeight) || 24;
    const borderHeight = textarea.offsetHeight - textarea.clientHeight;
    const maxHeight = Math.round(lineHeight * maxComposerLines + borderHeight);
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);

    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [input]);

  const isSmallScreen = viewportWidth < SMALL_SCREEN_BREAKPOINT;
  const expandedSheetWidth = Math.max(
    DEFAULT_SHEET_WIDTH,
    Math.min(MAX_EXPANDED_SHEET_WIDTH, viewportWidth - 32)
  );
  const sheetWidth = isSmallScreen
    ? viewportWidth
    : isExpanded
      ? expandedSheetWidth
      : DEFAULT_SHEET_WIDTH;

  useEffect(() => {
    if (isSmallScreen && isExpanded) {
      setIsExpanded(false);
    }
  }, [isExpanded, isSmallScreen]);

  const followups = useMemo(() => {
    const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
    return lastAssistant?.followups ?? [];
  }, [messages]);

  async function loadConversations() {
    const response = await fetch("/api/ai/conversations", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as AiConversationSummary[];
    setConversations(data);
  }

  async function loadHistory(conversationId: number) {
    setActiveConversationId(conversationId);
    const response = await fetch(`/api/ai/history/${conversationId}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      toast.error("Unable to load that conversation.");
      return;
    }
    const data = (await response.json()) as AiMessagePayload[];
    setMessages(data);
    setShowHistory(false);
  }

  function resetDraft() {
    setActiveConversationId(null);
    setMessages([]);
    setShowHistory(false);
    setInput("");
  }

  async function handleApproval(approvalId: number, approved: boolean, externalUrl?: string | null) {
    const path = approved ? "approve" : "reject";
    const response = await fetch(`/api/ai/approvals/${approvalId}/${path}`, {
      method: "POST",
    });
    if (!response.ok) {
      toast.error(`Unable to ${approved ? "approve" : "reject"} action.`);
      return;
    }

    setApprovalStatusById((current) => ({
      ...current,
      [approvalId]: approved ? "approved" : "rejected",
    }));

    const body = (await response.json().catch(() => null)) as
      | { externalUrl?: string | null }
      | null;

    if (approved && (body?.externalUrl || externalUrl)) {
      window.location.href = body?.externalUrl || externalUrl || "/app";
      return;
    }

    router.refresh();
    toast.success(approved ? "Approved." : "Rejected.");
  }

  async function handleDeleteConversation() {
    if (!conversationPendingDelete || isDeletingConversation) {
      return;
    }

    setIsDeletingConversation(true);

    try {
      const response = await fetch(
        `/api/ai/conversations/${conversationPendingDelete.id}`,
        { method: "DELETE" }
      );

      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        toast.error(data?.error ?? "Unable to delete that conversation.");
        return;
      }

      const deletedId = conversationPendingDelete.id;
      setConversations((current) => current.filter((conversation) => conversation.id !== deletedId));

      if (activeConversationId === deletedId) {
        setActiveConversationId(null);
        setMessages([]);
      }

      setConversationPendingDelete(null);
      toast.success("Conversation deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete that conversation.");
    } finally {
      setIsDeletingConversation(false);
    }
  }

  async function handleUndo(messageId: number) {
    if (!activeConversationId || undoingMessageId === messageId) {
      return;
    }

    setUndoingMessageId(messageId);

    try {
      const response = await fetch(`/api/ai/messages/${messageId}/undo`, {
        method: "POST",
        headers: {
          "x-ai-conversation-id": String(activeConversationId),
        },
      });

      const data = (await response.json().catch(() => null)) as
        | { summary?: string; error?: string; message?: AiMessagePayload }
        | null;

      if (!response.ok) {
        toast.error(data?.error ?? "Unable to undo that response.");
        return;
      }

      const updatedMessage = data?.message ?? null;
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                metadata: updatedMessage?.metadata ?? {
                  ...(message.metadata ?? {}),
                  undoApplied: true,
                },
              }
            : message
        )
      );

      router.refresh();
      toast.success(data?.summary ?? "Undo complete.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to undo that response.");
    } finally {
      setUndoingMessageId(null);
    }
  }

  async function handleSend(nextMessage?: string) {
    const content = (nextMessage ?? input).trim();
    if (!content || isLoading) return;

    const optimisticUser: StreamMessage = {
      id: Date.now(),
      role: "user",
      content,
      cards: [],
      followups: [],
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [...current, optimisticUser]);
    setInput("");
    setIsLoading(true);
    let shouldRefreshRoute = false;

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          conversationId: activeConversationId,
        }),
      });

      if (!response.ok || !response.body) {
        toast.error("Unable to reach Northstar AI.");
        setIsLoading(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let draftMessageId = Date.now() + 1;

      setMessages((current) => [
        ...current,
        {
          id: draftMessageId,
          role: "assistant",
          content: "",
          cards: [],
          followups: [],
          createdAt: new Date().toISOString(),
          pending: true,
        },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;

          const event = JSON.parse(line) as Record<string, unknown>;
          if (event.type === "conversation") {
            const conversation = event.conversation as AiConversationSummary;
            setActiveConversationId(conversation.id);
            setConversations((current) => {
              const next = current.filter((item) => item.id !== conversation.id);
              return [conversation, ...next];
            });
            continue;
          }

          if (event.type === "message_start") {
            draftMessageId = Number((event.message as AiMessagePayload).id);
            setMessages((current) =>
              current.map((message) =>
                message.pending
                  ? {
                      ...(event.message as AiMessagePayload),
                      content: "",
                      pending: true,
                    }
                  : message
              )
            );
            continue;
          }

          if (event.type === "text_delta") {
            const delta = String(event.delta ?? "");
            setMessages((current) =>
              current.map((message) =>
                message.id === draftMessageId
                  ? {
                      ...message,
                      content: `${message.content}${delta}`,
                    }
                  : message
              )
            );
            continue;
          }

          if (event.type === "cards") {
            const cards = (event.cards as AiCard[]) ?? [];
            if (
              cards.some((card) => card.type === "mutation" || card.type === "reservation")
            ) {
              shouldRefreshRoute = true;
            }
            setMessages((current) =>
              current.map((message) =>
                message.id === draftMessageId
                  ? {
                      ...message,
                      cards,
                    }
                  : message
              )
            );
            continue;
          }

          if (event.type === "followups") {
            const nextFollowups = (event.followups as string[]) ?? [];
            setMessages((current) =>
              current.map((message) =>
                message.id === draftMessageId
                  ? {
                      ...message,
                      followups: nextFollowups,
                    }
                  : message
              )
            );
            continue;
          }

          if (event.type === "error") {
            setMessages((current) =>
              current.map((message) =>
                message.id === draftMessageId
                  ? {
                      ...message,
                      content: String(event.error ?? "Something went wrong."),
                      pending: false,
                    }
                  : message
              )
            );
            toast.error(String(event.error ?? "Unable to process AI response."));
            continue;
          }

          if (event.type === "done") {
            setMessages((current) =>
              current.map((message) =>
                message.id === draftMessageId
                  ? {
                      ...message,
                      pending: false,
                    }
                  : message
              )
            );
            void loadConversations();
            if (shouldRefreshRoute) {
              router.refresh();
            }
          }
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to process AI response.");
    } finally {
      setIsLoading(false);
    }
  }

  if (!enabled) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 rounded-full bg-slate-900 px-5 py-6 text-white shadow-[0_20px_60px_rgba(15,23,42,0.35)] hover:bg-slate-800"
      >
        <Sparkles className="size-4" />
        Northstar AI
      </Button>
      <SheetContent
        side="right"
        keepMounted
        showCloseButton={false}
        className="w-full max-w-none border-l border-white/60 bg-[linear-gradient(180deg,rgba(248,251,253,0.98),rgba(243,248,249,0.96))] p-0 transition-[width,transform,opacity]"
        style={{
          width: isSmallScreen ? "100vw" : `${sheetWidth}px`,
          maxWidth: isSmallScreen ? "100vw" : `${sheetWidth}px`,
        }}
      >
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-border/70 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <SheetTitle className="flex items-center gap-2 text-slate-900">
                  <Bot className="size-5 text-primary" />
                  Northstar AI
                </SheetTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  Planning <span className="font-semibold text-slate-700">{tripName}</span>
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setShowHistory((current) => !current)}
                  title="History"
                >
                  <History className="size-4" />
                </Button>
                <Button size="icon-sm" variant="ghost" onClick={resetDraft} title="New chat">
                  <Plus className="size-4" />
                </Button>
                {!isSmallScreen ? (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setIsExpanded((current) => !current)}
                    title={isExpanded ? "Collapse chat width" : "Expand chat width"}
                  >
                    {isExpanded ? (
                      <Minimize2 className="size-4" />
                    ) : (
                      <Maximize2 className="size-4" />
                    )}
                  </Button>
                ) : null}
                <Button size="icon-sm" variant="ghost" title="Close" onClick={() => setOpen(false)}>
                  <X className="size-4" />
                </Button>
              </div>
            </div>
          </SheetHeader>

          <div className="relative min-h-0 flex-1 overflow-hidden">
            <aside
              className={cn(
                "absolute inset-y-0 left-0 z-10 w-full overflow-y-auto border-r border-border/70 bg-white/90 p-4 backdrop-blur-sm transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform",
                showHistory
                  ? "translate-x-0 opacity-100"
                  : "translate-x-full opacity-0 pointer-events-none"
              )}
              aria-hidden={!showHistory}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Recent Conversations
                </p>
                <Button size="sm" variant="ghost" onClick={() => setShowHistory(false)}>
                  Close
                </Button>
              </div>
              <div className="space-y-2">
                {conversations.length ? (
                  conversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      className={cn(
                        "flex items-start gap-2 rounded-3xl border px-4 py-3 transition hover:border-slate-300 hover:bg-white",
                        activeConversationId === conversation.id
                          ? "border-primary/30 bg-primary/5"
                          : "border-border/70 bg-white/70"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => void loadHistory(conversation.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {conversation.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDateLabel(conversation.updatedAt)}
                        </p>
                      </button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="mt-0.5 shrink-0 text-slate-500 hover:text-red-600"
                        title="Delete conversation"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setConversationPendingDelete(conversation);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="rounded-3xl border border-dashed border-border/80 bg-white/60 p-5 text-sm text-muted-foreground">
                    No AI conversations yet.
                  </div>
                )}
              </div>
            </aside>

            <div
              className={cn(
                "h-full overflow-y-auto px-4 py-5 transition-[transform,opacity,filter] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] sm:px-5",
                showHistory
                  ? "-translate-x-3 opacity-80 blur-[1px]"
                  : "translate-x-0 opacity-100 blur-0"
              )}
            >
              {messages.length ? (
                <div className="space-y-4">
                  {messages.map((message) => {
                    const isAssistant = message.role === "assistant";
                    const isUndoing = undoingMessageId === message.id;
                    const canUndo = isUndoableAssistantMessage(message);
                    return (
                      <div
                        key={message.id}
                        className={cn("flex", isAssistant ? "justify-start" : "justify-end")}
                      >
                        <div
                          className={cn(
                            "max-w-[92%] rounded-[2rem] px-4 py-3 shadow-sm",
                            isAssistant
                              ? "w-full border border-border/70 bg-white/90"
                              : "bg-slate-900 text-white"
                          )}
                        >
                          <div
                            className={cn(
                              "whitespace-pre-wrap text-sm leading-6",
                              isAssistant ? "text-slate-800" : "text-white"
                            )}
                          >
                            {isAssistant ? (
                              <MarkdownMessage
                                content={message.content}
                                pending={message.pending}
                              />
                            ) : (
                              message.content || (message.pending ? "Thinking…" : "")
                            )}
                          </div>
                          {message.pending ? (
                            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                              <Loader2 className="size-3 animate-spin" />
                              Working through the trip
                            </div>
                          ) : null}
                          {isAssistant ? (
                            <MessageCards
                              cards={message.cards}
                              approvalStatusById={approvalStatusById}
                              onApprove={(approvalId, externalUrl) =>
                                void handleApproval(approvalId, true, externalUrl)
                              }
                              onReject={(approvalId) => void handleApproval(approvalId, false)}
                            />
                          ) : null}
                          {canUndo || message.metadata?.undoApplied === true ? (
                            <div className="mt-3 flex justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-full bg-white/80"
                                disabled={!canUndo || isUndoing}
                                onClick={() => void handleUndo(message.id)}
                              >
                                {message.metadata?.undoApplied === true
                                  ? "Undone"
                                  : isUndoing
                                    ? "Undoing…"
                                    : "Undo changes"}
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={scrollRef} />
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center rounded-[2rem] border border-dashed border-border/70 bg-white/55 px-6 py-10 text-center">
                  <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <MessageSquare className="size-6" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-slate-900">
                    Plan in natural language
                  </h3>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    Ask Northstar AI to build days, research stops, estimate budgets, update packing,
                    look up flights, or prep reservation flows for the active trip.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {[
                      "Build a relaxed 3-day plan for Sedona",
                      "Find dinner options near our Day 2 hotel",
                      "Create a basic packing list for this trip",
                    ].map((suggestion) => (
                      <Button
                        key={suggestion}
                        variant="outline"
                        size="sm"
                        className="rounded-full bg-white/80"
                        onClick={() => void handleSend(suggestion)}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border/70 bg-white/70 px-4 py-4 sm:px-5">
            {followups.length ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {followups.map((followup) => (
                  <Button
                    key={followup}
                    variant="outline"
                    size="sm"
                    className="rounded-full bg-white/90"
                    onClick={() => void handleSend(followup)}
                    disabled={isLoading}
                  >
                    {followup}
                  </Button>
                ))}
              </div>
            ) : null}
            <div className="flex items-end gap-2">
              <Textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Ask Northstar…"
                className="min-h-0 flex-1 resize-none rounded-[1.6rem] border-border/80 bg-white/90 px-4 py-3 text-[15px]"
                disabled={isLoading}
              />
              <Button
                className="h-12 rounded-full px-4"
                disabled={isLoading || !input.trim()}
                onClick={() => void handleSend()}
              >
                <Send className="size-4" />
                Send
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
      <Dialog
        open={Boolean(conversationPendingDelete)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !isDeletingConversation) {
            setConversationPendingDelete(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete conversation?</DialogTitle>
            <DialogDescription>
              This will permanently remove
              {conversationPendingDelete ? ` "${conversationPendingDelete.title}"` : " this conversation"}
              {" "}from your AI history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConversationPendingDelete(null)}
              disabled={isDeletingConversation}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDeleteConversation()}
              disabled={isDeletingConversation}
            >
              {isDeletingConversation ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
