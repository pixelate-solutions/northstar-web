"use client";

import { ChevronLeft, ChevronRight, Download, FileText, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export interface ViewerItem {
  filename: string;
  mimeType?: string;
  kind?: "image" | "file";
  /** Where to load it from: the server copy, or this browser's copy of a file just sent. Missing for files sent before copies were kept. */
  src?: string;
  /** Server copies download through the same route with ?download=1. */
  downloadHref?: string;
}

const TEXT_EXTENSIONS = /\.(txt|md|markdown|csv|tsv|json|xml|html?|ya?ml|toml|ini|log|ics|c|cc|cpp|cs|css|go|h|hpp|java|jsx?|tsx?|kt|php|py|rb|rs|sh|sql|swift|tex)$/i;

function previewKind(item: ViewerItem): "image" | "pdf" | "text" | "none" {
  if (!item.src) return "none";
  if (item.kind === "image" || item.mimeType?.startsWith("image/")) return "image";
  if (item.mimeType === "application/pdf" || /\.pdf$/i.test(item.filename)) return "pdf";
  if (item.mimeType?.startsWith("text/") || item.mimeType === "application/json" || item.mimeType === "application/xml" || TEXT_EXTENSIONS.test(item.filename)) return "text";
  return "none";
}

function TextPreview({ src }: { src: string }) {
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch(src)
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error(String(response.status)))))
      .then((value) => !cancelled && setText(value.length > 400_000 ? `${value.slice(0, 400_000)}\n…` : value))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [src]);
  if (failed) return <Unavailable />;
  if (text === null) return <span className="h-3 w-3 animate-[ns-pulse_1.4s_ease-in-out_infinite] rounded-full bg-white" />;
  return (
    <pre className="h-full w-full max-w-[860px] overflow-auto whitespace-pre-wrap break-words rounded-[16px] bg-white p-5 font-mono text-[13px] leading-5 text-ink" onClick={(event) => event.stopPropagation()}>
      {text}
    </pre>
  );
}

function Unavailable({ download }: { download?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3.5 text-white" onClick={(event) => event.stopPropagation()}>
      <FileText size={44} strokeWidth={1.5} className="opacity-60" />
      <p className="text-[17px] font-bold">Can&apos;t preview this file</p>
      {download}
    </div>
  );
}

/** Full-screen photos and files, like Messages. Escape or X closes; arrows move between a message's attachments. */
export function AttachmentViewer({ items, index: initial, onClose }: { items: ViewerItem[]; index: number; onClose: () => void }) {
  const [index, setIndex] = useState(initial);
  const item = items[Math.min(index, items.length - 1)];
  const kind = previewKind(item);
  const many = items.length > 1;

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight") setIndex((i) => Math.min(items.length - 1, i + 1));
      else if (event.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", handler);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = overflow;
    };
  }, [items.length, onClose]);

  const downloadLink = item.src ? (
    <a
      href={item.downloadHref ?? item.src}
      download={item.filename}
      onClick={(event) => event.stopPropagation()}
      className="flex items-center gap-1.5 rounded-full bg-white/15 px-[18px] py-2.5 text-[15px] font-semibold text-white hover:bg-white/25"
    >
      <Download size={15} /> Download
    </a>
  ) : null;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={item.filename} className="fixed inset-0 z-[100] flex flex-col bg-[#000]" onClick={onClose}>
      <div className="flex shrink-0 items-center gap-3 px-3 pb-2 pt-[max(env(safe-area-inset-top),12px)] text-white" onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 hover:bg-white/25">
          <X size={18} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-[15px] font-bold">{item.filename}</p>
          {many ? (
            <p className="font-mono text-[11px] opacity-70">
              {index + 1} of {items.length}
            </p>
          ) : null}
        </div>
        {item.src ? (
          <a
            href={item.downloadHref ?? item.src}
            download={item.filename}
            aria-label="Download"
            title="Download"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
          >
            <Download size={17} />
          </a>
        ) : (
          <span className="h-10 w-10 shrink-0" />
        )}
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 pb-[max(env(safe-area-inset-bottom),16px)] pt-2 lg:px-16">
        {kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={item.src} src={item.src} alt={item.filename} className="h-full w-full object-contain" onClick={(event) => event.stopPropagation()} />
        ) : kind === "pdf" ? (
          <iframe key={item.src} src={item.src} title={item.filename} className="h-full w-full max-w-[960px] rounded-[12px] bg-white" />
        ) : kind === "text" ? (
          <TextPreview key={item.src} src={item.src!} />
        ) : (
          <Unavailable download={downloadLink} />
        )}
        {many && index > 0 ? (
          <button
            type="button"
            aria-label="Previous"
            onClick={(event) => {
              event.stopPropagation();
              setIndex(index - 1);
            }}
            className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <ChevronLeft size={20} />
          </button>
        ) : null}
        {many && index < items.length - 1 ? (
          <button
            type="button"
            aria-label="Next"
            onClick={(event) => {
              event.stopPropagation();
              setIndex(index + 1);
            }}
            className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <ChevronRight size={20} />
          </button>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
