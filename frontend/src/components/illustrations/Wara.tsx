import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Wara'a (ورقة): the receipt who lives in the app.
 * Outline and limbs use currentColor (ink on paper, bone on ink); the face is always ink on paper.
 */
export type WaraPose =
  | "idle"
  | "hello"
  | "shy"
  | "hungry"
  | "reading"
  | "proud"
  | "squint"
  | "sleeping"
  | "crumpled"
  | "party";

const INK = "#0a0a0b";
const PAPER = "#fbfbf8";
const LIME = "#c6f432";

/* Body: rounded top, torn zig-zag bottom. */
function slipPath(teeth = 8, crumple = false) {
  const left = 32;
  const right = 108;
  const base = 110;
  const tip = 117;
  const w = (right - left) / teeth;
  let zig = "";
  for (let i = 0; i < teeth; i++) {
    const x = right - i * w;
    zig += ` L${(x - w / 2).toFixed(2)} ${tip} L${(x - w).toFixed(2)} ${base}`;
  }
  if (crumple) {
    return `M40 18 L70 14 L100 19 Q109 20 107 28 L110 60 L105 84 L108 ${base}${zig} L35 86 L30 58 L33 28 Q32 19 40 18 Z`;
  }
  return `M40 16 H100 Q108 16 108 24 V${base}${zig} V24 Q32 16 40 16 Z`;
}

type Arm = { d: string; hand: [number, number]; r?: number };

const ARMS: Record<WaraPose, [Arm, Arm]> = {
  idle: [
    { d: "M32 76 Q22 88 24 100", hand: [24, 101] },
    { d: "M108 76 Q118 88 116 100", hand: [116, 101] },
  ],
  hello: [
    { d: "M32 76 Q22 88 24 100", hand: [24, 101] },
    { d: "M108 74 Q124 64 124 44", hand: [124, 42] },
  ],
  shy: [
    { d: "M32 76 Q38 62 52 54", hand: [56, 51], r: 8 },
    { d: "M108 76 Q102 62 88 54", hand: [84, 51], r: 8 },
  ],
  hungry: [
    { d: "M32 72 Q18 60 20 40", hand: [20, 38] },
    { d: "M108 72 Q122 60 120 40", hand: [120, 38] },
  ],
  reading: [
    { d: "M32 76 Q22 88 24 100", hand: [24, 101] },
    { d: "M108 82 Q114 78 104 74", hand: [102, 73] },
  ],
  proud: [
    { d: "M32 74 Q18 84 32 96", hand: [33, 96] },
    { d: "M108 74 Q122 84 108 96", hand: [107, 96] },
  ],
  squint: [
    { d: "M32 76 Q22 88 24 100", hand: [24, 101] },
    { d: "M108 80 Q100 92 80 78", hand: [78, 77] },
  ],
  sleeping: [
    { d: "M32 78 Q26 92 30 104", hand: [30, 105] },
    { d: "M108 78 Q114 92 110 104", hand: [110, 105] },
  ],
  crumpled: [
    { d: "M32 78 Q18 76 14 62", hand: [14, 60] },
    { d: "M108 78 Q124 84 126 98", hand: [126, 100] },
  ],
  party: [
    { d: "M32 72 Q16 58 18 36", hand: [18, 34] },
    { d: "M108 72 Q124 58 122 36", hand: [122, 34] },
  ],
};

function Eyes({ pose, animated }: { pose: WaraPose; animated: boolean }) {
  const stroke = { stroke: INK, strokeWidth: 3, strokeLinecap: "round" as const, fill: "none" };
  switch (pose) {
    case "proud":
    case "party":
      return (
        <g {...stroke}>
          <path d="M52 51 Q57 44 62 51" />
          <path d="M78 51 Q83 44 88 51" />
        </g>
      );
    case "sleeping":
      return (
        <g {...stroke}>
          <path d="M52 49 Q57 54 62 49" />
          <path d="M78 49 Q83 54 88 49" />
        </g>
      );
    case "crumpled":
      return (
        <g {...stroke} strokeWidth={2.6}>
          <path d="M53 46 L61 54 M61 46 L53 54" />
          <path d="M79 46 L87 54 M87 46 L79 54" />
        </g>
      );
    case "shy":
      return null;
    default: {
      const big = pose === "hungry";
      const squint = pose === "squint";
      const look = pose === "reading" ? 1.5 : 0;
      return (
        <g className={cn(animated && "wara-eye animate-blink")}>
          <ellipse cx={57 + look} cy={50 + look} rx={big ? 5 : 4.2} ry={squint ? 2.6 : big ? 6 : 5} fill={INK} />
          <ellipse cx={83 + look} cy={50 + look} rx={big ? 5 : 4.2} ry={big ? 6 : 5} fill={INK} />
          {!squint && <circle cx={55.6 + look} cy={48 + look} r={1.4} fill={PAPER} />}
          <circle cx={81.6 + look} cy={48 + look} r={1.4} fill={PAPER} />
        </g>
      );
    }
  }
}

function Brows({ pose }: { pose: WaraPose }) {
  const p = { stroke: INK, strokeWidth: 2.6, strokeLinecap: "round" as const, fill: "none" };
  switch (pose) {
    case "hungry":
    case "hello":
    case "party":
      return (
        <g {...p}>
          <path d="M51 37 Q57 33 63 36" />
          <path d="M77 36 Q83 33 89 37" />
        </g>
      );
    case "reading":
      return (
        <g {...p}>
          <path d="M51 41 L63 40" />
          <path d="M77 39 Q83 36 89 39" />
        </g>
      );
    case "squint":
      return (
        <g {...p}>
          <path d="M51 43 L63 45" />
          <path d="M77 37 Q83 32 89 36" />
        </g>
      );
    case "crumpled":
      return (
        <g {...p}>
          <path d="M51 40 L62 37" />
          <path d="M78 37 L89 40" />
        </g>
      );
    default:
      return null;
  }
}

function Mouth({ pose }: { pose: WaraPose }) {
  const s = { stroke: INK, strokeWidth: 3, strokeLinecap: "round" as const, fill: "none" };
  switch (pose) {
    case "hungry":
      return (
        <g>
          <ellipse cx={70} cy={68} rx={8} ry={9.5} fill={INK} />
          <ellipse cx={70} cy={73.5} rx={4.6} ry={3} fill={LIME} />
        </g>
      );
    case "party":
    case "hello":
      return (
        <g>
          <path d="M60 63 Q70 77 80 63 Z" fill={INK} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
          <path d="M65 69 Q70 73 75 69" fill={LIME} />
        </g>
      );
    case "shy":
    case "sleeping":
      return <ellipse cx={70} cy={67} rx={3} ry={3.4} fill={INK} />;
    case "squint":
    case "crumpled":
      return <path d="M61 68 q4.5 -4 9 0 t9 0" {...s} />;
    case "reading":
      return <path d="M64 67 L76 66" {...s} />;
    default:
      return <path d="M62 64 Q70 72 78 64" {...s} />;
  }
}

function Props({ pose }: { pose: WaraPose }) {
  switch (pose) {
    case "reading":
      return (
        <g>
          <line x1="92" y1="60" x2="101" y2="71" stroke="currentColor" strokeWidth={5} strokeLinecap="round" />
          <circle cx={84} cy={50} r={12.5} fill={LIME} fillOpacity={0.28} stroke="currentColor" strokeWidth={3.2} />
          <ellipse cx={84.5} cy={51} rx={6.4} ry={7.4} fill={INK} />
          <circle cx={82.4} cy={48} r={2} fill={PAPER} />
        </g>
      );
    case "proud":
      return (
        <g transform="rotate(-12 88 96)">
          <circle cx={88} cy={96} r={10.5} fill={LIME} stroke={INK} strokeWidth={2.4} />
          <path d="M83 96 L86.8 99.8 L93.5 92.5" stroke={INK} strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    case "squint":
      return (
        <text x="114" y="30" fontSize="28" fontWeight={800} fill={LIME} stroke="currentColor" strokeWidth={1.4} fontFamily="var(--font-readex), sans-serif">
          ?
        </text>
      );
    case "sleeping":
      return (
        <g fill="currentColor" fontFamily="var(--font-readex), sans-serif" fontWeight={700}>
          <text x="110" y="32" fontSize="13" opacity={0.7}>z</text>
          <text x="119" y="20" fontSize="19">Z</text>
        </g>
      );
    case "party":
      return (
        <g>
          {[
            [16, 18, LIME, 18],
            [126, 14, "#38bdf8", -24],
            [6, 52, "#fbbf24", 40],
            [134, 50, LIME, -10],
            [40, 4, "#fb7185", 60],
            [100, 2, "#2dd4bf", 15],
          ].map(([x, y, c, r], i) => (
            <rect
              key={i}
              x={x as number}
              y={y as number}
              width={7}
              height={11}
              rx={2}
              fill={c as string}
              transform={`rotate(${r} ${x} ${y})`}
              className="animate-float"
              style={{ "--r": `${r}deg`, animationDelay: `${i * 0.35}s` } as CSSProperties}
            />
          ))}
        </g>
      );
    default:
      return null;
  }
}

export function Wara({
  pose = "idle",
  animated = true,
  className,
  title,
  children,
}: {
  pose?: WaraPose;
  animated?: boolean;
  className?: string;
  /** Accessible name; omit when the mascot is decorative. */
  title?: string;
  children?: ReactNode;
}) {
  const [left, right] = ARMS[pose];
  const limb = {
    stroke: "currentColor",
    strokeWidth: 3.6,
    strokeLinecap: "round" as const,
    fill: "none",
  };
  const tilt = pose === "sleeping" ? -6 : pose === "crumpled" ? 5 : 0;

  return (
    <svg
      viewBox="0 0 140 150"
      className={cn("overflow-visible", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <ellipse cx={70} cy={143} rx={30} ry={4} fill="currentColor" opacity={0.12} />
      <g className={cn(animated && pose !== "crumpled" && "animate-bob")}>
        <g transform={`rotate(${tilt} 70 80)`}>
          {/* legs */}
          <g {...limb}>
            <path d="M58 116 L56 133" />
            <path d="M82 116 L84 133" />
          </g>
          <ellipse cx={52} cy={135} rx={6.5} ry={3.4} fill="currentColor" />
          <ellipse cx={88} cy={135} rx={6.5} ry={3.4} fill="currentColor" />

          {/* back arm (behind body) for shy/hello so it reads naturally */}
          <path d={left.d} {...limb} />

          {/* body */}
          <path
            d={slipPath(8, pose === "crumpled")}
            fill={PAPER}
            stroke="currentColor"
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          {/* printed lines */}
          <g stroke={INK} strokeLinecap="round" opacity={0.2} strokeWidth={2.6}>
            <path d="M46 86 H74 M86 86 H94" />
            <path d="M46 94 H68 M84 94 H94" />
          </g>
          <path d="M46 102 H60 M80 102 H94" stroke={INK} strokeLinecap="round" strokeWidth={3.4} opacity={0.45} />
          {pose === "crumpled" && (
            <g stroke={INK} opacity={0.18} strokeWidth={1.6} fill="none">
              <path d="M36 40 L60 58 L44 76" />
              <path d="M104 34 L84 62 L102 82" />
            </g>
          )}

          {/* blush */}
          <ellipse cx={47} cy={63} rx={6} ry={3.4} fill={LIME} opacity={pose === "shy" ? 1 : 0.9} />
          <ellipse cx={93} cy={63} rx={6} ry={3.4} fill={LIME} opacity={pose === "shy" ? 1 : 0.9} />

          <Brows pose={pose} />
          <Eyes pose={pose} animated={animated} />
          <Mouth pose={pose} />

          {/* front arm */}
          <g
            className={cn(animated && pose === "hello" && "animate-wave")}
            style={{ transformOrigin: "108px 74px", transformBox: "view-box" }}
          >
            <path d={right.d} {...limb} />
            <circle cx={right.hand[0]} cy={right.hand[1]} r={right.r ?? 4.6} fill="currentColor" />
          </g>
          <circle cx={left.hand[0]} cy={left.hand[1]} r={left.r ?? 4.6} fill="currentColor" />

          <Props pose={pose} />
          {children}
        </g>
      </g>
    </svg>
  );
}
