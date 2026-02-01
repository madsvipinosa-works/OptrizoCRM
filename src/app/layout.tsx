import type { Metadata } from "next";
// Force Recompile
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { getSiteSettings } from "@/features/cms/actions";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();

  return {
    title: {
      template: `%s | ${settings?.heroTitle || "Optrizo"}`,
      default: settings?.heroTitle || "Optrizo | Digital Transformation Agency",
    },
    description: settings?.heroDescription || "Optrizo is a premium software development agency crafting high-performance websites, complex web apps, and scalable digital solutions.",
    icons: {
      icon: settings?.faviconUrl || "/favicon.ico",
    },
    openGraph: {
      title: settings?.heroTitle || "Optrizo | Digital Transformation Agency",
      description: settings?.heroDescription || "Premium software development agency crafting high-performance websites.",
      url: "https://optrizo.com",
      siteName: "Optrizo",
      images: [
        {
          url: settings?.logoUrl || "/og-image.jpg",
          width: 1200,
          height: 630,
        },
      ],
      locale: "en_US",
      type: "website",
    },
    keywords: ["software agency", "web development", "next.js", "digital transformation", "react"],
  };
}

import { Toaster } from "sonner";

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
        {children}
        <Toaster richColors theme="dark" position="top-center" />
      </body>
    </html>
  );
}
