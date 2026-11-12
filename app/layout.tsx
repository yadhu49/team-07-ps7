import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RouteWise · Delivery Dispatch Agent",
  description: "PS7 Delivery Dispatch Agent: assign Chennai hub deliveries to riders in plain English.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
