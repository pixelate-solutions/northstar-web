export function StarMark({ size = 24, color = "#111110", core = "#FFC500" }: { size?: number; color?: string; core?: string | null }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M12 1 L14.2 9.8 L23 12 L14.2 14.2 L12 23 L9.8 14.2 L1 12 L9.8 9.8 Z" fill={color} />
      {core ? <circle cx="12" cy="12" r="2.2" fill={core} /> : null}
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <StarMark size={26} />
      <span className="text-[19px] font-extrabold tracking-[-0.02em]">Northstar</span>
    </span>
  );
}
