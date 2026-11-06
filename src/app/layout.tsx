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
import { getPublishedPage } from "@/features/cms/content/public-queries";
import type { HomeFields } from "@/features/cms/content/schemas";

export async function generateMetadata(): Promise<Metadata> {
  const [settings, homePage] = await Promise.all([
    getSiteSettings(),
    getPublishedPage("home"),
  ]);
  const homeFields = homePage?.fields as HomeFields | undefined;
  const siteTitle = homeFields?.heading || "Optrizo | Digital Transformation Agency";
  const siteDescription = homeFields?.intro || "Optrizo is a premium software development agency crafting high-performance websites, complex web apps, and scalable digital solutions.";

  return {
    title: {
      template: `%s | ${homeFields?.heading || "Optrizo"}`,
      default: siteTitle,
    },
    description: siteDescription,
    icons: {
      icon: settings?.faviconUrl || "/favicon.ico",
    },
    openGraph: {
      title: siteTitle,
      description: siteDescription,
      url: "https://optrizo.com",
      siteName: "Optrizo",
      images: [
        {
          url: homeFields?.mainImageUrl || settings?.logoUrl || "/og-image.jpg",
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
import { NavigationProgress } from "@/components/ui/navigation-progress";
import { AuthProvider } from "@/components/providers/AuthProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`light ${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("optrizo-theme");var d=t==="dark";if(d){document.documentElement.classList.add("dark");document.documentElement.classList.remove("light");}else{document.documentElement.classList.remove("dark");document.documentElement.classList.add("light");}}catch(e){}})()`,
          }}
        />
      </head>
      <body
        className={`antialiased bg-background text-foreground transition-colors duration-300`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <NavigationProgress />
          {children}
          <Toaster richColors position="top-center" />
        </AuthProvider>
      </body>
    </html>
  );
}
