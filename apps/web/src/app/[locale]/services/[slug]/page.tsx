import { notFound } from "next/navigation";
import Link from "next/link";
import { HeroSection } from "@/components/ui/HeroSection";
import { Button } from "@/components/ui/button";
import { getServiceBySlug, getAllServiceSlugs } from "@/data/services";
import { Locale } from "@/i18n/config";
import { ArrowLeft, CheckCircle } from "lucide-react";

interface ServiceDetailPageProps {
  params: Promise<{ locale: Locale; slug: string }>;
}

export async function generateStaticParams() {
  const slugs = getAllServiceSlugs();
  const params = [];
  for (const slug of slugs) {
    params.push({ locale: "en", slug });
    params.push({ locale: "ar", slug });
  }
  return params;
}

export default async function ServiceDetailPage({
  params,
}: ServiceDetailPageProps) {
  const { locale, slug } = await params;
  const service = getServiceBySlug(slug);

  if (!service) {
    notFound();
  }

  const title = locale === "ar" ? service.title_ar : service.title_en;
  const description =
    locale === "ar" ? service.description_ar : service.description_en;
  const features =
    locale === "ar" ? service.features_ar : service.features_en;
  const benefits =
    locale === "ar" ? service.benefits_ar : service.benefits_en;

  // Translations for static labels
  const t = {
    backToServices: locale === "ar" ? "العودة إلى الخدمات" : "Back to Services",
    features: locale === "ar" ? "المميزات الرئيسية" : "Key Features",
    benefits: locale === "ar" ? "الفوائد" : "Benefits",
    ctaTitle: locale === "ar" ? "هل أنت جاهز للبدء؟" : "Ready to get started?",
    ctaButton: locale === "ar" ? "تواصل معنا" : "Contact Us",
  };

  return (
    <>
      <HeroSection
        title={title}
        subtitle={description.slice(0, 200) + "..."}
        size="md"
      />

      <section className="py-16 bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Back Link */}
          <Link
            href="/services"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-medical-blue mb-8"
          >
            <ArrowLeft
              className={`w-4 h-4 ${locale === "ar" ? "rotate-180" : ""}`}
            />
            <span>{t.backToServices}</span>
          </Link>

          {/* Description */}
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 mb-8">
            <p className="text-lg text-gray-600 leading-relaxed">
              {description}
            </p>
          </div>

          {/* Features */}
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {t.features}
            </h2>
            <ul className="grid md:grid-cols-2 gap-4">
              {features.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-medical-blue flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Benefits */}
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {t.benefits}
            </h2>
            <ul className="grid md:grid-cols-2 gap-4">
              {benefits.map((benefit, index) => (
                <li key={index} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <div className="bg-gradient-to-r from-medical-blue to-blue-700 rounded-2xl p-8 text-center">
            <h3 className="text-xl font-bold text-white mb-4">
              {t.ctaTitle}
            </h3>
            <Link href="/contact">
              <Button
                variant="secondary"
                className="bg-white text-medical-blue hover:bg-gray-100"
              >
                {t.ctaButton}
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
