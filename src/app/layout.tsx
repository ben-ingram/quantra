import type { Metadata } from "next";
import { Geist, Geist_Mono, Syne } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://quantratech.io"),
  title: {
    default: "Quantra — Intelligence for the construction cycle.",
    template: "%s · Quantra",
  },
  description:
    "See the job before it starts. Protect it while it runs. Close it clean. Quantra builds Parcovi, Certovi, and Acuria—software for every phase of the construction cycle.",
  keywords: [
    "Quantra",
    "quantratech",
    "construction software",
    "Parcovi",
    "Certovi",
    "Acuria",
    "construction notices",
    "territory intelligence",
    "document collection",
    "applied intelligence",
  ],
  openGraph: {
    title: "Quantra — Intelligence for the construction cycle.",
    description:
      "Win the work. Protect the right. Close the file. Flagship systems: Parcovi, Certovi, Acuria.",
    type: "website",
    siteName: "Quantra Technology & Innovation",
    url: "https://quantratech.io",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quantra — Intelligence for the construction cycle.",
    description:
      "See the job before it starts. Protect it while it runs. Close it clean.",
  },
  robots: { index: true, follow: true },
  alternates: {
    canonical: "https://quantratech.io",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${syne.variable} h-full antialiased`}
    >
      <body className="bg-mesh min-h-full flex flex-col font-sans text-ink">
        <div className="noise" aria-hidden />
        {children}
      </body>
    </html>
  );
}
