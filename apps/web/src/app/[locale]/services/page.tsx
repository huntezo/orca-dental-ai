"use client";

import { useI18n } from "@/components/providers/I18nProvider";
import { HeroSection } from "@/components/ui/HeroSection";
import { ServiceCard } from "@/components/ui/ServiceCard";
import { services } from "@/data/services";

export default function ServicesPage() {
  const { t } = useI18n();

  return (
    <>
      <HeroSection
        title={t("services.hero.title")}
        subtitle={t("services.hero.subtitle")}
        size="md"
      />

      <section className="py-20 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-6">
            {services.map((service) => (
              <ServiceCard key={service.slug} service={service} showFeatures />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
