import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner"; // Import Toaster

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | Optrizo",
    default: "Optrizo | Digital Transformation Agency",
  },
  description: "Optrizo is a premium software development agency crafting high-performance websites, complex web apps, and scalable digital solutions.",
  openGraph: {
    title: "Optrizo | Digital Transformation Agency",
    description: "Premium software development agency crafting high-performance websites.",
    url: "https://optrizo.com",
    siteName: "Optrizo",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
      },
    ],
    locale: "en_US",
    type: "website",
  },
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
        {children}
        <Toaster richColors theme="dark" position="top-center" />
      </body>
    </html>
  );
}
