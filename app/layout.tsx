import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "sonner";
import { DocumentThemeSync } from "@/components/DocumentThemeSync";
import { ThemeToggle } from "@/components/ThemeToggle";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stock Analyzer",
  description: "Stock ticker lookup and backtesting utilities",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <DocumentThemeSync />
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var s=localStorage.getItem(k);var dark=s==="dark"||(s!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",dark);}catch(e){}})();`,
          }}
        />
        <header className="flex shrink-0 justify-end border-b border-zinc-200/80 bg-white/80 px-4 py-3 backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-950/80">
          <ThemeToggle />
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
        <SpeedInsights />
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
