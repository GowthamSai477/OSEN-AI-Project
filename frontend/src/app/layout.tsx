import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/ThemeProvider";
import Script from "next/script";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Planora AI - Adaptive Life Planning",
  description: "Your intelligent agent for adaptive life planning.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
};

const themeScript = `
  (function() {
    try {
      var localTheme = localStorage.getItem('planora_theme');
      var theme = localTheme || 'dark';
      document.documentElement.setAttribute('data-theme', theme);

      var character = localStorage.getItem('planora_character_theme');
      if (character && character !== 'default') {
        document.documentElement.setAttribute('data-character', character);
      }
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${inter.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <head>
          <Script id="theme-script" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript }} />
        </head>
        <body className="min-h-full flex flex-col font-sans selection:bg-accent/30 transition-colors duration-300 ease-in-out bg-background text-foreground">
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
