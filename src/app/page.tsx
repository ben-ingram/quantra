import { ConstructionCycle } from "@/components/ConstructionCycle";
import { Contact } from "@/components/Contact";
import { Hero } from "@/components/Hero";
import { Platform } from "@/components/Platform";
import { Products } from "@/components/Products";
import { SiteShell } from "@/components/SiteShell";

export default function Home() {
  return (
    <SiteShell>
      <Hero />
      <ConstructionCycle />
      <Products />
      <Platform />
      <Contact />
    </SiteShell>
  );
}
