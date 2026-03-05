"use client";

import { useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { HeroSection } from "@/components/ui/HeroSection";
import { FAQAccordion } from "@/components/ui/FAQAccordion";
import { faqs, faqCategories } from "@/data/faqs";
import { Locale } from "@/i18n/config";
import Link from "next/link";

export default function FAQPage() {
  const { t, locale } = useI18n();
  const typedLocale = locale as Locale;
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filteredFAQs =
    activeCategory === "all"
      ? faqs
      : faqs.filter((faq) => faq.category === activeCategory);

  return (
    <>
      <HeroSection
        title={t("faq.hero.title")}
        subtitle={t("faq.hero.subtitle")}
        size="md"
      />

      <section className="py-20 bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Category Filter */}
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            <button
              onClick={() => setActiveCategory("all")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeCategory === "all"
                  ? "bg-medical-blue text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {typedLocale === "ar" ? "الكل" : "All"}
            </button>
            {faqCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === category.id
                    ? "bg-medical-blue text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                {typedLocale === "ar" ? category.label_ar : category.label_en}
              </button>
            ))}
          </div>

          {/* FAQ Accordion */}
          <FAQAccordion faqs={filteredFAQs} />

          {/* Still Have Questions */}
          <div className="mt-16 text-center">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              {t("faq.stillHaveQuestions")}
            </h3>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 text-medical-blue font-medium hover:text-blue-700"
            >
              {t("faq.contactUs")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
