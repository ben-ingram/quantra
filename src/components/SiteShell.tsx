import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { SignalField } from "@/components/SignalField";

export function SiteShell({
  children,
  mainClassName = "",
}: {
  children: React.ReactNode;
  mainClassName?: string;
}) {
  return (
    <>
      <SignalField />
      <Nav />
      <main className={`relative z-10 flex-1 ${mainClassName}`}>{children}</main>
      <div className="relative z-10">
        <Footer />
      </div>
    </>
  );
}
