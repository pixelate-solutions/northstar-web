"use client";

import { X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);
}

/** Anchored popover. Closes on outside click and Escape. */
export function Popover({
  open,
  onClose,
  className = "",
  children,
}: {
  open: boolean;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEscape(open, onClose);
  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const id = window.setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("mousedown", handler);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div ref={ref} className={`absolute z-[1100] rounded-[16px] bg-white p-1.5 shadow-pop ${className}`}>
      {children}
    </div>
  );
}

export function MenuItem({
  icon,
  children,
  onClick,
  danger,
  active,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left text-[15px] font-semibold transition hover:bg-surface ${
        danger ? "text-stop" : "text-ink"
      } ${active ? "bg-surface" : ""}`}
    >
      {icon ? <span className="flex w-4 shrink-0 justify-center">{icon}</span> : null}
      {children}
    </button>
  );
}

/** Centered dialog on desktop, bottom sheet on mobile. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEscape(open, onClose);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[1200] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-ink/30" onClick={onClose} />
      <div
        className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[24px] bg-white pb-[max(env(safe-area-inset-bottom),16px)] sm:rounded-[22px] sm:pb-0 ${
          wide ? "sm:max-w-[560px]" : "sm:max-w-[440px]"
        }`}
      >
        <div className="flex justify-center pt-2 sm:hidden">
          <div className="h-[5px] w-9 rounded-full bg-[#D6D6D2]" />
        </div>
        {title ? (
          <div className="flex items-center justify-between px-5 pb-2 pt-3 sm:px-6 sm:pt-5">
            <h2 className="text-[22px] font-extrabold tracking-[-0.025em]">{title}</h2>
            <IconButton label="Close" onClick={onClose}>
              <X size={16} strokeWidth={2.2} />
            </IconButton>
          </div>
        ) : null}
        <div className="overflow-y-auto px-5 pb-5 sm:px-6 sm:pb-6">{children}</div>
      </div>
    </div>,
    document.body
  );
}

export function IconButton({
  label,
  onClick,
  children,
  className = "",
  floating,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  floating?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${
        floating ? "h-10 w-10 bg-white shadow-float hover:bg-surface" : "border border-line hover:bg-surface"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function PillButton({
  children,
  onClick,
  tone = "outline",
  type = "button",
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tone?: "outline" | "ink" | "lane" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const tones = {
    outline: "border border-line bg-white hover:bg-surface",
    ink: "bg-ink text-white hover:bg-ink/90",
    lane: "bg-lane text-ink hover:brightness-95",
    danger: "bg-stop text-white hover:brightness-95",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-[18px] py-2.5 text-[14px] font-bold transition disabled:opacity-50 ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "h-12 w-full rounded-[12px] bg-surface px-4 text-[16px] font-medium placeholder:text-faint focus:ring-2 focus:ring-ink";

interface ConfirmRequest {
  title: string;
  actionLabel?: string;
  resolve: (ok: boolean) => void;
}

const ConfirmContext = createContext<(title: string, actionLabel?: string) => Promise<boolean>>(async () => true);

/** "Are you sure?" before destructive actions. `await confirm("Delete X?")`. */
export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const confirm = useCallback(
    (title: string, actionLabel = "Delete") => new Promise<boolean>((resolve) => setRequest({ title, actionLabel, resolve })),
    []
  );
  const close = (ok: boolean) => {
    request?.resolve(ok);
    setRequest(null);
  };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Sheet open={Boolean(request)} onClose={() => close(false)}>
        <div className="flex flex-col gap-5 pt-5">
          <h2 className="text-[20px] font-extrabold tracking-[-0.02em]">{request?.title}</h2>
          <div className="flex justify-end gap-2">
            <PillButton onClick={() => close(false)}>Cancel</PillButton>
            <PillButton tone="danger" onClick={() => close(true)}>
              {request?.actionLabel}
            </PillButton>
          </div>
        </div>
      </Sheet>
    </ConfirmContext.Provider>
  );
}
