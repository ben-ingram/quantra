import type { Metadata } from "next";
import { AboutContent } from "@/components/about/AboutContent";
import { SiteShell } from "@/components/SiteShell";
import { brand } from "@/lib/content";

export const metadata: Metadata = {
  title: "About",
  description: `${brand.ambitious} ${brand.slogan}`,
  openGraph: {
    title: "About Quantra — Intelligence for the construction cycle.",
    description: brand.hero,
  },
};

export default function AboutPage() {
  return (
    <SiteShell>
      <AboutContent />
    </SiteShell>
  );
}
