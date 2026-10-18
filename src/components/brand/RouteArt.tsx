const STOPS = [
  { x: 130, y: 580, label: "Las Vegas" },
  { x: 350, y: 350, label: "Zion" },
  { x: 490, y: 230, label: "Bryce Canyon" },
  { x: 580, y: 440, label: "Page" },
  { x: 490, y: 580, label: "Grand Canyon" },
  { x: 580, y: 700, label: "Sedona", last: true },
];

const ROUTE =
  "M130 580 C 200 480, 280 400, 350 350 C 400 310, 440 250, 490 230 C 560 260, 600 360, 580 440 C 560 500, 520 540, 490 580 C 520 630, 560 660, 580 700";

/** Static illustration of a trip route, used on the landing page. */
export function RouteArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="40 120 760 640" preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label="A road trip route across six stops">
      <rect x="0" y="0" width="820" height="780" fill="#EEEDE8" />
      <path d="M250 260 C 300 220, 380 240, 400 300 C 420 360, 360 400, 300 380 C 250 365, 220 300, 250 260 Z" fill="#DCE5D3" />
      <path d="M430 150 C 480 130, 540 160, 530 220 C 520 270, 460 280, 430 250 C 405 225, 400 165, 430 150 Z" fill="#DCE5D3" />
      <path d="M330 520 C 420 480, 560 500, 600 560 C 620 600, 540 620, 460 610 C 380 600, 300 580, 330 520 Z" fill="#DCE5D3" />
      <path d="M520 360 C 560 380, 600 370, 640 400 C 670 420, 700 410, 740 430 L 745 445 C 700 430, 670 440, 635 418 C 600 395, 560 400, 515 375 Z" fill="#CFDDE3" />
      <path d="M0 640 C 60 610, 120 650, 150 700 C 170 740, 140 780, 0 780 Z" fill="#CFDDE3" />
      <path d="M640 418 C 620 470, 560 520, 520 540 C 470 565, 420 560, 380 600 C 340 640, 300 700, 280 780" fill="none" stroke="#CFDDE3" strokeWidth="7" strokeLinecap="round" />
      <path d="M0 600 L 820 520" stroke="#fff" strokeWidth="5" />
      <path d="M60 780 L 300 360 L 520 120 L 700 0" stroke="#fff" strokeWidth="5" fill="none" />
      <path d="M420 0 L 470 220 L 600 440 L 640 780" stroke="#fff" strokeWidth="4" fill="none" />
      <path d="M0 300 L 820 360" stroke="#fff" strokeWidth="3" fill="none" />
      <path d="M180 780 L 560 700 L 820 650" stroke="#fff" strokeWidth="3" fill="none" />
      <path d={ROUTE} fill="none" stroke="#111110" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d={ROUTE} fill="none" stroke="#FFC500" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      {STOPS.map((stop, index) => (
        <g key={stop.label}>
          <circle cx={stop.x} cy={stop.y} r="15" fill={stop.last ? "#FFC500" : "#111110"} stroke={stop.last ? "#111110" : "#fff"} strokeWidth="3" />
          <text x={stop.x} y={stop.y + 4.5} textAnchor="middle" fontSize="12" fontWeight="600" fill={stop.last ? "#111110" : "#fff"} fontFamily="var(--font-mono)">
            {index + 1}
          </text>
          <rect x={stop.x + 23} y={stop.y - 14} rx="14" height="28" width={stop.label.length * 8.2 + 20} fill="#fff" />
          <text x={stop.x + 33} y={stop.y + 5} fontSize="14" fontWeight="700" fill="#111110" fontFamily="var(--font-sans)">
            {stop.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
