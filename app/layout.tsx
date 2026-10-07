import type { Metadata } from "next";
import type { Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import "./review.css";
import SwipeNavigation from "@/components/swipe-navigation";
import EVENT_CONFIG from "@/lib/event-config";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap" });

export const metadata: Metadata = {
  title: EVENT_CONFIG.name,
  description: `${EVENT_CONFIG.name} · ${EVENT_CONFIG.venue}`,
  icons: { icon: "/icon.svg", apple: [{ url: "/icon.svg", type: "image/svg+xml" }] },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

const snowflakes = Array.from({ length: 12 }, (_, index) => index);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className={`${inter.variable} ${sora.variable}`}>
    <div className="ambient-background" aria-hidden="true"><span className="ambient-blob" /><div className="snowfall">{snowflakes.map(index => <i key={index} />)}</div></div>
    {children}
    <SwipeNavigation />
  </body></html>;
}
