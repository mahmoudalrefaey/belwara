import { ImageResponse } from "next/og";

export const alt = "Bel War’a · بالورقة";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social card: ink, lime, and the receipt mark. Latin-only text (OG renderer has no Arabic shaping). */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#0a0a0b",
          padding: "80px 96px",
          color: "#f4f4f0",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 680 }}>
          <div style={{ fontSize: 30, letterSpacing: 6, textTransform: "uppercase", color: "#c6f432" }}>
            Bel War’a
          </div>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05 }}>
            Every receipt, read and counted. To the letter.
          </div>
          <div style={{ fontSize: 30, color: "rgba(244,244,240,0.65)" }}>
            Snap receipts · see where your money went · ask in Arabic or English
          </div>
        </div>
        <svg width="300" height="300" viewBox="0 0 32 32">
          <path
            d="M8 3.5h16a2.5 2.5 0 0 1 2.5 2.5v20.5l-3.08-2.2-3.09 2.2-3.08-2.2-3.08 2.2-3.09-2.2-3.08 2.2V6A2.5 2.5 0 0 1 8 3.5Z"
            fill="#c6f432"
          />
          <circle cx="12.4" cy="11.6" r="1.7" fill="#0a0a0b" />
          <circle cx="19.6" cy="11.6" r="1.7" fill="#0a0a0b" />
          <path d="M11.6 16.6l3 2.9 5.8-6" fill="none" stroke="#0a0a0b" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    size,
  );
}
