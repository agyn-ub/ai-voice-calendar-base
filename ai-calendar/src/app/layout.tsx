import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import '@coinbase/onchainkit/styles.css';
import ClientOnly from "@/components/ClientOnly";
import { OnchainProviders } from "@/components/OnchainProviders";
import { Toaster } from "react-hot-toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Voice Calendar - Base",
  description: "AI-powered calendar management with Base blockchain staking mechanics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ClientOnly>
          <OnchainProviders>
            <Toaster position="top-right" />
            {children}
          </OnchainProviders>
        </ClientOnly>
      </body>
    </html>
  );
}
