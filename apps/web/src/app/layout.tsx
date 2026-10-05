import type { Metadata } from "next";
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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  return {
    // Pages set their own title; this template adds the app name.
    title: { template: `%s · ${t("appName")}`, default: t("appName") },
    description: t("tagline"),
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
          messages={{ login: messages.login, orderForm: messages.orderForm }}
        >
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
