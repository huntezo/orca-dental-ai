"use client";

import { useI18n } from "@/components/providers/I18nProvider";
import Link from "next/link";
import { HeroSection } from "@/components/ui/HeroSection";
import { PartnerLogoGrid } from "@/components/ui/PartnerLogoGrid";
import { Button } from "@/components/ui/button";

export default function PartnersPage() {
  const { t } = useI18n();

  return (
    <>
      <HeroSection
        title={t("partners.hero.title")}
        subtitle={t("partners.hero.subtitle")}
        size="md"
      />

      <section className="py-20 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <p className="text-lg text-gray-600 leading-relaxed">
              {t("partners.description")}
            </p>
          </div>

          <PartnerLogoGrid columns={4} />
        </div>
      </section>

      {/* Become a Partner CTA */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            {t("partners.becomePartner.title")}
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            {t("partners.becomePartner.description")}
          </p>
          <Link href="/contact">
            <Button size="lg">
              {t("partners.becomePartner.button")}
            </Button>
          </Link>
        </div>
      </section>
    </>
  );
}
