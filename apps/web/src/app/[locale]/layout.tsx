import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { I18nProvider } from "@/components/providers/I18nProvider";
import { routing } from "@/i18n/routing";
import "../globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  title: {
    default: "Orca Dental AI - Advanced Dental Imaging Solutions",
    template: "%s - Orca Dental AI",
  },
  description:
    "Orca Dental AI provides cutting-edge AI-powered dental imaging analysis, including cephalometric analysis, teeth segmentation, and CBCT processing for orthodontic professionals.",
  keywords: [
    "dental AI",
    "orthodontic imaging",
    "cephalometric analysis",
    "CBCT segmentation",
    "dental technology",
  ],
  authors: [{ name: "Orca Dental AI" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Orca Dental AI",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
  },
};

async function getMessages(locale: string): Promise<Record<string, unknown>> {
  try {
    return (await import(`@/messages/${locale}.json`)).default;
  } catch (error) {
    notFound();
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  
  // Validate locale
  if (!routing.locales.includes(locale as "en" | "ar")) {
    notFound();
  }
  
  const messages = await getMessages(locale);
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} className={inter.variable}>
      <body className="min-h-screen bg-gray-50 font-sans antialiased">
        <I18nProvider locale={locale} messages={messages}>
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}
