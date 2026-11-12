import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans-app",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-app",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RouteWise · Delivery Dispatch Agent",
  description: "PS7 Delivery Dispatch Agent: assign Chennai hub deliveries to riders in plain English.",
};

/**
 * Applies the saved theme before the first paint, so a reload never flashes
 * the wrong palette. Default is the dark operations console.
 */
const THEME_SCRIPT = `try {
  var saved = localStorage.getItem("routewise-theme");
  var theme = saved === "light" || saved === "dark"
    ? saved
    : (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  document.documentElement.dataset.theme = theme;
} catch (e) {
  document.documentElement.dataset.theme = "dark";
}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={`${inter.variable} ${mono.variable} min-h-screen font-sans`}>{children}</body>
    </html>
  );
}
