import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { ThemeToggle } from "@/components/theme-toggle";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Voyager — Smart Travel Search",
  description:
    "AI-powered travel search. Compare flights, hotels, activities and dining in one stunning view.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a1a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="sunrise" suppressHydrationWarning>
      <body className={`${manrope.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
        <Script id="voyager-theme-init" strategy="beforeInteractive">
          {`
            (function () {
              try {
                var key = "voyager-theme";
                var persisted = localStorage.getItem(key);
                if (persisted === "light") persisted = "sunrise";
                if (persisted === "dark") persisted = "midnight";
                var allowed = ["sunrise", "ocean", "forest", "sunset", "aurora", "midnight"];
                var valid = allowed.indexOf(persisted) >= 0;
                var theme = valid ? persisted : "sunrise";
                document.documentElement.setAttribute("data-theme", theme);
              } catch (_) {}
            })();
          `}
        </Script>
        <div aria-hidden className="voyager-global-bg">
          <div className="voyager-global-grid" />
          <div className="voyager-global-haze" />
          <div className="voyager-orb voyager-orb-a" />
          <div className="voyager-orb voyager-orb-b" />
          <div className="voyager-orb voyager-orb-c" />
        </div>
        <div className="relative z-10">{children}</div>
        <ThemeToggle />
      </body>
    </html>
  );
}
