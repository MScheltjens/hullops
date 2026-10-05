import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
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

export const viewport: Viewport = {
  // The browser's address bar takes this colour on phones.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0369a1" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  // Lets the page use the whole screen on phones with a notch; the header and
  // main area add padding for the "safe area" (see (app)/layout.tsx).
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  return {
    // Pages set their own title; this template adds the app name.
    title: { template: `%s · ${t("appName")}`, default: t("appName") },
    description: t("tagline"),
    // iOS ignores the manifest's display mode; this opts in to full screen.
    appleWebApp: { capable: true, title: t("appName") },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Set per request in src/i18n/request.ts.
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/*
          Makes translations available to Client Components. Only the
          namespaces they use are sent to the browser; Server Components
          read every message on the server.
        */}
        <NextIntlClientProvider
          messages={{
            login: messages.login,
            orderForm: messages.orderForm,
            comments: messages.comments,
            statusActions: messages.statusActions,
          }}
        >
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
