import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

const INK = "#0a0a0b";
const PAPER = "#fbfbf8";
const LIME = "#c6f432";

function Wallet({ mood }: { mood: "worried" | "happy" }) {
  return (
    <g>
      <rect x="10" y="62" width="92" height="64" rx="14" fill={LIME} stroke="currentColor" strokeWidth={3.2} />
      <path d="M10 82 H102" stroke={INK} strokeOpacity={0.2} strokeWidth={2.4} />
      <rect x="70" y="84" width="40" height="26" rx="9" fill="#a8d61a" stroke="currentColor" strokeWidth={3.2} />
      <circle cx="84" cy="97" r="4.2" fill={INK} />
      {/* face */}
      {mood === "worried" ? (
        <g stroke={INK} strokeWidth={2.6} strokeLinecap="round" fill="none">
          <path d="M26 92 L36 89" />
          <path d="M48 89 L58 92" />
          <path d="M30 112 q6 -5 12 0 t12 0" />
        </g>
      ) : (
        <g stroke={INK} strokeWidth={2.6} strokeLinecap="round" fill="none">
          <path d="M27 99 Q32 93 37 99" />
          <path d="M47 99 Q52 93 57 99" />
          <path d="M32 108 Q42 118 52 108" />
        </g>
      )}
      {mood === "worried" && (
        <g fill={INK}>
          <circle cx="32" cy="98" r="3.2" />
          <circle cx="52" cy="98" r="3.2" />
          <path d="M60 76 q3 6 0 9 q-3 -3 0 -9 Z" fill="#38bdf8" />
        </g>
      )}
    </g>
  );
}

function Note({ x, y, r = 0, delay = 0 }: { x: number; y: number; r?: number; delay?: number }) {
  return (
    <g
      className="animate-float"
      style={{ "--r": `${r}deg`, animationDelay: `${delay}s`, transformBox: "fill-box", transformOrigin: "center" } as CSSProperties}
    >
      <g transform={`translate(${x} ${y}) rotate(${r})`}>
        {/* wings */}
        <path d="M14 4 Q4 -14 -8 -6 Q2 -2 8 6 Z" fill={PAPER} stroke="currentColor" strokeWidth={2} strokeLinejoin="round" className="origin-bottom [transform-box:fill-box] animate-[wara-flap_0.5s_ease-in-out_infinite_alternate]" />
        <path d="M34 4 Q44 -14 56 -6 Q46 -2 40 6 Z" fill={PAPER} stroke="currentColor" strokeWidth={2} strokeLinejoin="round" className="origin-bottom [transform-box:fill-box] animate-[wara-flap_0.5s_ease-in-out_infinite_alternate]" />
        <rect x="0" y="0" width="48" height="26" rx="4" fill={PAPER} stroke="currentColor" strokeWidth={2.4} />
        <rect x="5" y="5" width="38" height="16" rx="3" fill="none" stroke={INK} strokeOpacity={0.22} strokeWidth={1.6} />
        <circle cx="24" cy="13" r="5.5" fill={LIME} stroke={INK} strokeWidth={1.4} />
      </g>
    </g>
  );
}

/** "Payday… and then?" Banknotes sprout wings and leave a worried wallet. */
export function FlyingSalary({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 140" className={cn("overflow-visible", className)} aria-hidden focusable="false">
      <path
        d="M70 70 C 110 40, 140 50, 160 30 S 210 10, 230 -6"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.35}
        strokeWidth={2}
        strokeDasharray="2 8"
        strokeLinecap="round"
      />
      <Wallet mood="worried" />
      <Note x={96} y={34} r={-12} />
      <Note x={150} y={6} r={8} delay={0.6} />
      <Note x={196} y={-24} r={-6} delay={1.2} />
    </svg>
  );
}

/** Milestone celebration: a happy wallet and confetti. */
export function WalletParty({ className }: { className?: string }) {
  const bits: [number, number, string, number][] = [
    [8, 30, LIME, 20],
    [30, 8, "#38bdf8", -30],
    [62, 2, "#fbbf24", 45],
    [92, 16, "#fb7185", -15],
    [104, 44, LIME, 60],
    [2, 58, "#2dd4bf", -40],
  ];
  return (
    <svg viewBox="0 0 112 132" className={cn("overflow-visible", className)} aria-hidden focusable="false">
      {bits.map(([x, y, c, rot], i) => (
        <rect
          key={i}
          x={x}
          y={y}
          width={7}
          height={12}
          rx={2}
          fill={c}
          className="animate-float"
          style={{ "--r": `${rot}deg`, animationDelay: `${i * 0.3}s`, transformBox: "fill-box", transformOrigin: "center" } as CSSProperties}
        />
      ))}
      <Wallet mood="happy" />
    </svg>
  );
}
