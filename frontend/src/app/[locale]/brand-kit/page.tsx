import { notFound } from "next/navigation";
import { Camera, MessagesSquare, ScanLine, Sparkles } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { Wara } from "@/components/illustrations/Wara";
import { FlyingSalary, WalletParty } from "@/components/illustrations/Scenes";
import { cn } from "@/lib/utils";

/**
 * Brand kit artboards (logo exports, social covers). Dev only: open /ar/brand-kit or /en/brand-kit
 * with `npm run dev`, then screenshot each [data-artboard] at its native size.
 */

type Lang = "ar" | "en";

const COPY = {
  ar: {
    titleA: "المرتب نزل…",
    titleB: "وطار؟",
    sub: "صوّر فواتيرك، وورقة يقولك فلوسك راحت فين، بالورقة والقلم.",
    cta: "ابدأ ببلاش",
    tagline: "كل فاتورة متقرية ومحسوبة.",
    how: "صوّرها. ورقة يقراها.",
    howMark: "وإنت تعرف.",
    steps: [
      { t: "صوّر أو ارفع", b: "صورة أو PDF، حتى لو متكرمشة." },
      { t: "ورقة يقرا", b: "المحل والتاريخ والبنود والإجمالي." },
      { t: "اسأل", b: "«صرفت كام على الأكل؟»" },
    ],
    ask: "اسأل",
    askMark: "ورقة",
    askSub: "بالعربي أو بالإنجليزي، من فواتيرك إنت.",
    q: "صرفت كام على البقالة الشهر ده؟",
    a1: "لحد النهارده صرفت",
    amt: "1,640.00 EGP",
    a2: "على البقالة في 9 فواتير.",
    ai: "إجابة بالذكاء الاصطناعي من الفواتير",
    example: "مثال توضيحي",
    where: "فلوسك",
    whereMark: "راحت فين؟",
    free: "مجاني لحد 30 فاتورة في الشهر",
    long: ["عيش", "لبن", "جبنة", "شاي", "تسالي", "«حاجة واحدة بس»", "عيش", "لبن"],
    longTitle: "مشوار السوبرماركت",
  },
  en: {
    titleA: "Payday came…",
    titleB: "and flew away?",
    sub: "Snap your receipts and Wara’a shows you where it all went, to the letter.",
    cta: "Start free",
    tagline: "Every receipt, read and counted.",
    how: "Snap it. Wara’a reads it.",
    howMark: "You get it.",
    steps: [
      { t: "Snap or upload", b: "A photo or PDF, even a crumpled one." },
      { t: "Wara’a reads", b: "Merchant, date, items and total." },
      { t: "Ask", b: "“How much went on food?”" },
    ],
    ask: "Ask",
    askMark: "Wara’a",
    askSub: "In Arabic or English, from your own receipts.",
    q: "How much did I spend on groceries this month?",
    a1: "So far this month you’ve spent",
    amt: "1,640.00 EGP",
    a2: "on groceries across 9 receipts.",
    ai: "AI answer from the receipts",
    example: "Example",
    where: "Where did",
    whereMark: "it all go?",
    free: "Free for up to 30 receipts a month",
    long: ["Bread", "Milk", "Cheese", "Tea", "Snacks", "“Just one thing”", "Bread", "Milk"],
    longTitle: "Supermarket run",
  },
} as const;

/** Lime marker behind words, fully drawn (no scroll trigger in static exports). */
function Mark({ children }: { children: React.ReactNode }) {
  return (
    <span className="highlight" data-in="true">
      {children}
    </span>
  );
}

function Board({
  id,
  w,
  h,
  lang,
  className,
  children,
}: {
  id: string;
  w: number;
  h: number;
  lang: Lang;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      data-artboard={id}
      dir={lang === "ar" ? "rtl" : "ltr"}
      lang={lang}
      style={{ width: w, height: h }}
      className={cn("relative shrink-0 overflow-hidden", className)}
    >
      {children}
    </section>
  );
}

/** Loose receipts drifting in the background. */
function Slips({ items }: { items: { x: string; y: string; r: number; w: number; o?: number }[] }) {
  return (
    <>
      {items.map((s, i) => (
        <div
          key={i}
          aria-hidden
          className="absolute"
          style={{ left: s.x, top: s.y, width: s.w, rotate: `${s.r}deg`, opacity: s.o ?? 0.16 }}
        >
          <div className="edge-torn rounded-t-md bg-bone px-[8%] pt-[8%] pb-[18%]" style={{ ["--tooth" as string]: `${Math.max(8, s.w / 9)}px` }}>
            {[70, 50, 85, 40, 62].map((wd, j) => (
              <div key={j} className="mb-[7%] rounded-full bg-ink/45" style={{ width: `${wd}%`, height: Math.max(4, s.w / 26) }} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function LongReceipt({ lang, width, height }: { lang: Lang; width: number; height: number }) {
  const c = COPY[lang];
  return (
    <div className="drop-shadow-[0_24px_36px_rgb(0_0_0/0.45)]" style={{ width, height }}>
      <div className="edge-torn h-full rounded-t-2xl bg-paper px-[9%] pt-[8%] text-ink" style={{ ["--tooth" as string]: `${width / 14}px` }}>
        <p className="text-center font-mono font-semibold uppercase tracking-[0.2em] text-ink/50" style={{ fontSize: width / 17 }}>
          {c.longTitle}
        </p>
        <div className="my-[5%] border-t-2 border-dashed border-ink/20" />
        <ul className="font-mono" style={{ fontSize: width / 13 }}>
          {c.long.map((it, i) => (
            <li key={i} className="mb-[4%] flex items-end gap-1">
              <span className="truncate">{it}</span>
              <span className="leader" aria-hidden />
              <span className="text-ink/55">??.??</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const STEP_ICONS = [Camera, ScanLine, MessagesSquare];

/* ── Facebook cover 1640×624 (shown at 820×312; profile photo overlaps the bottom-left) ── */
function FacebookCover({ lang }: { lang: Lang }) {
  const c = COPY[lang];
  return (
    <Board id={`facebook-cover-${lang}`} w={1640} h={624} lang={lang} className="bg-ink text-bone">
      <Slips items={[{ x: "31%", y: "80%", r: 10, w: 80 }, { x: "93%", y: "74%", r: 12, w: 90 }]} />
      {/* text block on the right half (clear of the profile photo at bottom-left) */}
      <div className={cn("absolute top-1/2 -translate-y-1/2 space-y-7", lang === "ar" ? "right-[6%] w-[50%]" : "right-[3%] w-[50%]")}>
        <Logo className="text-[30px]" markClassName="size-16 text-ink" />
        <h1 className={cn("font-heading font-bold leading-[1.05] tracking-tight", lang === "ar" ? "text-[88px]" : "text-[76px]")}>
          {c.titleA} <Mark>{c.titleB}</Mark>
        </h1>
        <p className="max-w-[90%] text-[32px] text-bone/75">{c.sub}</p>
      </div>
      {/* illustration in the middle-left, above the profile photo zone */}
      <FlyingSalary className="absolute left-[3%] top-[12%] w-[300px] text-bone" />
      <div dir="ltr" className="absolute left-[19%] top-[7%] flex items-start gap-3">
        <Wara pose="squint" animated={false} className="mt-[190px] w-[180px] text-bone" />
        <LongReceipt lang={lang} width={240} height={420} />
      </div>
    </Board>
  );
}

/* ── Instagram post 1: hero ── */
function PostHero({ lang }: { lang: Lang }) {
  const c = COPY[lang];
  return (
    <Board id={`instagram-post-1-hero-${lang}`} w={1080} h={1080} lang={lang} className="bg-ink text-bone">
      <Slips items={[{ x: "84%", y: "76%", r: 14, w: 100 }, { x: "40%", y: "84%", r: -10, w: 80 }]} />
      <div className="absolute inset-x-[7%] top-[7%] flex items-center justify-between">
        <Logo className="text-[26px]" markClassName="size-14 text-ink" />
      </div>
      <FlyingSalary className={cn("absolute top-[13%] w-[380px] text-bone", lang === "ar" ? "left-[4%]" : "right-[4%]")} />
      <h1 className="absolute inset-x-[7%] top-[34%] font-heading text-[104px] font-bold leading-[1.04] tracking-tight">
        {c.titleA}
        <br />
        <Mark>{c.titleB}</Mark>
      </h1>
      <p className="absolute inset-x-[7%] top-[63%] text-[34px] leading-snug text-bone/75">{c.sub}</p>
      <div className="absolute bottom-[7%] inset-x-[7%] flex items-end justify-between">
        <span className="rounded-full bg-lime px-9 py-4 text-[32px] font-semibold text-ink shadow-[inset_0_-4px_0_rgb(10_10_11/0.25)]">{c.cta}</span>
        <Wara pose="hello" animated={false} className="-mb-6 w-[210px] text-bone" />
      </div>
    </Board>
  );
}

/* ── Instagram post 2: how it works ── */
function PostHow({ lang }: { lang: Lang }) {
  const c = COPY[lang];
  return (
    <Board id={`instagram-post-2-how-${lang}`} w={1080} h={1080} lang={lang} className="bg-bone text-ink">
      <div className="absolute inset-x-[7%] top-[7%] flex items-center justify-between">
        <Logo className="text-[26px]" markClassName="size-14 text-ink" />
        <Wara pose="reading" animated={false} className="w-[150px] text-ink" />
      </div>
      <h1 className="absolute inset-x-[7%] top-[24%] font-heading text-[86px] font-bold leading-[1.08] tracking-tight">
        {c.how}
        <br />
        <Mark>{c.howMark}</Mark>
      </h1>
      <ol className="absolute inset-x-[7%] bottom-[7%] space-y-5">
        {c.steps.map((s, i) => {
          const Icon = STEP_ICONS[i];
          return (
            <li key={i} className="flex items-center gap-7 rounded-[32px] bg-white px-8 py-6 shadow-paper">
              <span className="grid size-[84px] shrink-0 place-items-center rounded-3xl bg-lime">
                <Icon className="size-10" strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <p className="font-heading text-[38px] font-bold leading-tight">
                  <span className="num me-3 text-ink/35">0{i + 1}</span>
                  {s.t}
                </p>
                <p className="text-[28px] text-ink/60">{s.b}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Board>
  );
}

/* ── Instagram post 3: ask Wara'a ── */
function PostAsk({ lang }: { lang: Lang }) {
  const c = COPY[lang];
  return (
    <Board id={`instagram-post-3-ask-${lang}`} w={1080} h={1080} lang={lang} className="bg-lime text-ink">
      <div className="absolute inset-x-[7%] top-[7%] flex items-center justify-between">
        <Logo className="text-[26px]" markClassName="size-14 text-ink" />
        <span className="rounded-full border-2 border-dashed border-ink/40 px-5 py-2 font-mono text-[20px] uppercase tracking-wider text-ink/70">
          {c.example}
        </span>
      </div>
      <h1 className="absolute inset-x-[7%] top-[21%] font-heading text-[112px] font-bold leading-none tracking-tight">
        {c.ask} <span className="rounded-[0.18em] bg-ink px-[0.15em] text-lime">{c.askMark}</span>
      </h1>
      <p className="absolute inset-x-[7%] top-[35%] text-[34px] text-ink/70">{c.askSub}</p>
      <div className="absolute inset-x-[7%] bottom-[8%] space-y-6">
        <div className="ms-auto w-fit max-w-[80%] rounded-[40px] rounded-ee-lg bg-ink px-9 py-6 text-[34px] text-bone">{c.q}</div>
        <div className="flex items-end gap-4">
          <Wara pose="proud" animated={false} className="w-[150px] shrink-0 text-ink" />
          <div className="space-y-3">
            <div className="rounded-[40px] rounded-es-lg bg-paper px-9 py-6 text-[32px] leading-snug shadow-lift">
              {c.a1}{" "}
              <code dir="ltr" className="rounded-lg bg-lime/60 px-2 py-0.5 font-mono font-semibold">
                {c.amt}
              </code>{" "}
              {c.a2}
            </div>
            <p className="flex items-center gap-2 px-4 text-[22px] text-ink/60">
              <Sparkles className="size-6" /> {c.ai}
            </p>
          </div>
        </div>
      </div>
    </Board>
  );
}

/* ── Instagram story 1080×1920 (keep top/bottom 250px clear for the app UI) ── */
function Story({ lang }: { lang: Lang }) {
  const c = COPY[lang];
  return (
    <Board id={`instagram-story-${lang}`} w={1080} h={1920} lang={lang} className="bg-ink text-bone">
      <Slips items={[{ x: "6%", y: "52%", r: -12, w: 100 }, { x: "80%", y: "74%", r: 8, w: 100 }, { x: "10%", y: "78%", r: 14, w: 80 }]} />
      <div className="absolute inset-x-[8%] top-[260px] flex justify-center">
        <Logo className="text-[32px]" markClassName="size-16 text-ink" />
      </div>
      <h1 className="absolute inset-x-[8%] top-[420px] text-center font-heading text-[118px] font-bold leading-[1.04] tracking-tight">
        {c.titleA}
        <br />
        <Mark>{c.titleB}</Mark>
      </h1>
      <p className="absolute inset-x-[10%] top-[760px] text-center text-[38px] leading-snug text-bone/75">{c.sub}</p>
      <div className="absolute inset-x-0 top-[930px] flex items-start justify-center gap-4">
        <Wara pose="squint" animated={false} className="mt-[180px] w-[230px] text-bone" />
        <LongReceipt lang={lang} width={300} height={500} />
      </div>
      <div className="absolute inset-x-0 bottom-[290px] flex justify-center">
        <span className="rounded-full bg-lime px-12 py-5 text-[40px] font-semibold text-ink shadow-[inset_0_-5px_0_rgb(10_10_11/0.25)]">{c.cta}</span>
      </div>
    </Board>
  );
}

/* ── TikTok / Reels cover 1080×1920 (text in the central safe zone) ── */
function ReelsCover({ lang }: { lang: Lang }) {
  const c = COPY[lang];
  return (
    <Board id={`tiktok-reels-cover-${lang}`} w={1080} h={1920} lang={lang} className="bg-lime text-ink">
      <div className="absolute inset-x-0 top-[300px] flex justify-center">
        <Logo className="text-[30px]" markClassName="size-16 text-ink" />
      </div>
      <h1 className="absolute inset-x-[8%] top-[520px] text-center font-heading text-[140px] font-bold leading-[1.02] tracking-tight">
        {c.where}
        <br />
        <span className="rounded-[0.15em] bg-ink px-[0.12em] text-lime">{c.whereMark}</span>
      </h1>
      <div className="absolute inset-x-0 top-[920px] flex justify-center">
        <Wara pose="party" animated={false} className="w-[460px] text-ink" />
      </div>
      <p className="absolute inset-x-[10%] top-[1440px] text-center text-[40px] font-medium leading-snug text-ink/75">{c.tagline}</p>
    </Board>
  );
}

/* ── YouTube channel art 2560×1440 (logo + text inside the 1546×423 safe area) ── */
function YouTubeBanner({ lang }: { lang: Lang }) {
  const c = COPY[lang];
  return (
    <Board id={`youtube-banner-${lang}`} w={2560} h={1440} lang={lang} className="bg-ink text-bone">
      <Slips
        items={[
          { x: "6%", y: "12%", r: -14, w: 200 }, { x: "86%", y: "10%", r: 12, w: 170 },
          { x: "12%", y: "70%", r: 10, w: 160 }, { x: "80%", y: "72%", r: -10, w: 190 },
          { x: "46%", y: "4%", r: 6, w: 120 }, { x: "50%", y: "84%", r: -8, w: 130 },
        ]}
      />
      {/* safe area: x 507..2053, y 509..932 */}
      <div className="absolute left-[507px] top-[509px] flex h-[423px] w-[1546px] items-center justify-between gap-12 px-6">
        <div className="space-y-6">
          <Logo className="text-[40px]" markClassName="size-24 text-ink" />
          <h1 className="font-heading text-[104px] font-bold leading-[1.02] tracking-tight">
            {c.titleA} <Mark>{c.titleB}</Mark>
          </h1>
          <p className="text-[38px] text-bone/70">{c.tagline}</p>
        </div>
        <Wara pose="hello" animated={false} className="w-[330px] shrink-0 text-bone" />
      </div>
    </Board>
  );
}

/* ── Link preview / WhatsApp share 1200×630 ── */
function ShareImage({ lang }: { lang: Lang }) {
  const c = COPY[lang];
  return (
    <Board id={`share-link-preview-${lang}`} w={1200} h={630} lang={lang} className="bg-bone text-ink">
      <div className="absolute inset-y-0 start-0 flex w-[62%] flex-col justify-center gap-6 ps-[6%]">
        <Logo className="text-[26px]" markClassName="size-14 text-ink" />
        <h1 className="font-heading text-[72px] font-bold leading-[1.05] tracking-tight">
          {c.titleA} <Mark>{c.titleB}</Mark>
        </h1>
        <p className="text-[28px] text-ink/65">{c.sub}</p>
      </div>
      <div className="absolute inset-y-0 end-0 grid w-[38%] place-items-center bg-ink">
        <div className="relative">
          <WalletParty className="absolute -top-24 -end-28 w-24 text-bone" />
          <Wara pose="hello" animated={false} className="w-[280px] text-bone" />
        </div>
      </div>
    </Board>
  );
}

/* ── Profile pictures and logo exports (language neutral) ── */
function Profiles() {
  return (
    <>
      <Board id="profile-ink-1080" w={1080} h={1080} lang="ar" className="grid place-items-center bg-ink">
        <LogoMark className="size-[640px] text-ink" />
      </Board>
      <Board id="profile-lime-1080" w={1080} h={1080} lang="ar" className="grid place-items-center bg-lime">
        <LogoMark className="size-[640px] text-ink" />
      </Board>
      <Board id="profile-mascot-1080" w={1080} h={1080} lang="ar" className="grid place-items-center bg-lime">
        <Wara pose="hello" animated={false} className="w-[700px] text-ink" />
      </Board>
    </>
  );
}

function LogoExports() {
  return (
    <>
      <Board id="logo-full-on-light" w={1600} h={600} lang="ar" className="grid place-items-center">
        <Logo className="text-[120px] text-ink" markClassName="size-[300px] text-ink" />
      </Board>
      <Board id="logo-full-on-dark" w={1600} h={600} lang="ar" className="grid place-items-center">
        <Logo className="text-[120px] text-bone" markClassName="size-[300px] text-ink" />
      </Board>
      <Board id="logo-mark" w={1024} h={1024} lang="ar" className="grid place-items-center">
        <LogoMark className="size-[1000px] text-ink" />
      </Board>
      <Board id="logo-stacked-on-light" w={1200} h={1200} lang="ar" className="grid place-items-center">
        <div className="flex flex-col items-center gap-10 text-ink">
          <LogoMark className="size-[520px] text-ink" />
          <div className="text-center leading-none">
            <p className="font-heading text-[190px] font-bold">بالورقة</p>
            <p className="mt-6 font-mono text-[64px] font-medium uppercase tracking-[0.18em] opacity-70">Bel War’a</p>
          </div>
        </div>
      </Board>
      <Board id="logo-stacked-on-dark" w={1200} h={1200} lang="ar" className="grid place-items-center">
        <div className="flex flex-col items-center gap-10 text-bone">
          <LogoMark className="size-[520px] text-ink" />
          <div className="text-center leading-none">
            <p className="font-heading text-[190px] font-bold">بالورقة</p>
            <p className="mt-6 font-mono text-[64px] font-medium uppercase tracking-[0.18em] opacity-70">Bel War’a</p>
          </div>
        </div>
      </Board>
    </>
  );
}

export default async function BrandKit({ params }: { params: Promise<{ locale: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  await params;
  const langs: Lang[] = ["ar", "en"];
  return (
    <main className="flex flex-col items-start gap-16 bg-[repeating-conic-gradient(#ddd_0_25%,#fff_0_50%)] bg-[length:24px_24px] p-10">
      <LogoExports />
      <Profiles />
      <div className="flex flex-wrap gap-6 text-ink">
        {(["idle", "hello", "shy", "hungry", "reading", "proud", "squint", "sleeping", "crumpled", "party"] as const).map((pose) => (
          <div key={pose} data-mascot={pose} className="w-[280px]">
            <Wara pose={pose} animated={false} className="w-full" />
          </div>
        ))}
        <div data-mascot-mark className="w-[280px]">
          <LogoMark className="size-[280px] text-ink" />
        </div>
      </div>
      {langs.map((lang) => (
        <div key={lang} className="flex flex-col items-start gap-16">
          <FacebookCover lang={lang} />
          <PostHero lang={lang} />
          <PostHow lang={lang} />
          <PostAsk lang={lang} />
          <Story lang={lang} />
          <ReelsCover lang={lang} />
          <YouTubeBanner lang={lang} />
          <ShareImage lang={lang} />
        </div>
      ))}
    </main>
  );
}
