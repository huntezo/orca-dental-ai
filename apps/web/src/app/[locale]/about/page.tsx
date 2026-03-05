"use client";

import { useI18n } from "@/components/providers/I18nProvider";
import { HeroSection } from "@/components/ui/HeroSection";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Lightbulb, Shield, Handshake } from "lucide-react";

export default function AboutPage() {
  const { t } = useI18n();

  const milestones = [
    { year: "2001", key: "2001" },
    { year: "2010", key: "2010" },
    { year: "2018", key: "2018" },
    { year: "2024", key: "2024" },
  ];

  const values = [
    {
      key: "innovation",
      icon: Lightbulb,
    },
    {
      key: "quality",
      icon: Shield,
    },
    {
      key: "partnership",
      icon: Handshake,
    },
  ];

  return (
    <>
      <HeroSection
        title={t("about.hero.title")}
        subtitle={t("about.hero.subtitle")}
        size="md"
      />

      {/* History Section */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionTitle title={t("about.history.title")} subtitle="" />
          <div className="max-w-3xl mx-auto text-center mb-16">
            <p className="text-lg text-gray-600 leading-relaxed">
              {t("about.history.description")}
            </p>
          </div>

          {/* Timeline */}
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-px bg-gray-200 hidden md:block" />

            <div className="space-y-12">
              {milestones.map((milestone, index) => (
                <div
                  key={milestone.year}
                  className={`flex flex-col md:flex-row items-center gap-8 ${
                    index % 2 === 1 ? "md:flex-row-reverse" : ""
                  }`}
                >
                  <div className="flex-1 text-center md:text-right">
                    <div
                      className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 ${
                        index % 2 === 1 ? "md:text-left" : "md:text-right"
                      }`}
                    >
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {t(`about.history.milestones.${milestone.key}.title`)}
                      </h3>
                      <p className="text-gray-600">
                        {t(`about.history.milestones.${milestone.key}.description`)}
                      </p>
                    </div>
                  </div>
                  <div className="w-16 h-16 bg-medical-blue rounded-full flex items-center justify-center text-white font-bold text-lg z-10 shadow-lg">
                    {milestone.year}
                  </div>
                  <div className="flex-1 hidden md:block" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 bg-gradient-to-br from-medical-blue to-blue-800">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-6">
            {t("about.mission.title")}
          </h2>
          <p className="text-xl text-blue-100 leading-relaxed">
            {t("about.mission.description")}
          </p>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionTitle title={t("about.values.title")} subtitle="" />
          <div className="grid md:grid-cols-3 gap-8">
            {values.map((value) => {
              const IconComponent = value.icon;
              return (
                <div
                  key={value.key}
                  className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                >
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <IconComponent className="w-8 h-8 text-medical-blue" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    {t(`about.values.${value.key}.title`)}
                  </h3>
                  <p className="text-gray-600">
                    {t(`about.values.${value.key}.description`)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
