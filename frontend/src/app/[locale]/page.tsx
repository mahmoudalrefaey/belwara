import { setRequestLocale } from "next-intl/server";
import { LandingHeader } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { Capture } from "@/components/landing/Capture";
import { Clarity, Understand } from "@/components/landing/Story";
import { CtaBand, Faq, Features, Footer, Pricing, Privacy } from "@/components/landing/Sections";

/**
 * The story, in four acts: chaos → capture → understanding → clarity.
 * All numbers here are illustrative and labelled as examples.
 */
export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <LandingHeader />
      <main id="main" className="overflow-x-clip">
        <Hero />
        <Capture />
        <Understand />
        <Clarity />
        <Features />
        <Privacy />
        <Pricing />
        <Faq />
        <CtaBand />
      </main>
      <Footer />
    </>
  );
}
