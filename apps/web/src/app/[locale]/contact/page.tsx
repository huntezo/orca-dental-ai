"use client";

import { useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { HeroSection } from "@/components/ui/HeroSection";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, Mail, Clock } from "lucide-react";
import { Locale } from "@/i18n/config";

export default function ContactPage() {
  const { t, locale } = useI18n();
  const typedLocale = locale as Locale;
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const contactInfo = [
    {
      icon: MapPin,
      label: t("contact.info.address"),
      value: t("contact.office.address"),
    },
    {
      icon: Phone,
      label: t("contact.info.phone"),
      value: t("contact.office.phone"),
    },
    {
      icon: Mail,
      label: t("contact.info.email"),
      value: t("contact.office.email"),
    },
    {
      icon: Clock,
      label: t("contact.info.hours"),
      value: t("contact.office.hours"),
    },
  ];

  return (
    <>
      <HeroSection
        title={t("contact.hero.title")}
        subtitle={t("contact.hero.subtitle")}
        size="md"
      />

      <section className="py-20 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                {t("contact.form.title")}
              </h2>

              {submitted ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-6 h-6 text-green-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <p className="text-green-800 font-medium">
                    {t("contact.form.success")}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t("contact.form.name")}
                      </label>
                      <input
                        type="text"
                        required
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-medical-blue focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t("contact.form.email")}
                      </label>
                      <input
                        type="email"
                        required
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-medical-blue focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t("contact.form.phone")}
                      </label>
                      <input
                        type="tel"
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-medical-blue focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t("contact.form.company")}
                      </label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-medical-blue focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t("contact.form.subject")}
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-medical-blue focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t("contact.form.message")}
                    </label>
                    <textarea
                      rows={5}
                      required
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-medical-blue focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-none"
                    />
                  </div>

                  <Button type="submit" variant="default" className="w-full">
                    {t("contact.form.submit")}
                  </Button>
                </form>
              )}
            </div>

            {/* Contact Information */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                {t("contact.info.title")}
              </h2>

              <div className="space-y-6">
                {contactInfo.map((item, index) => {
                  const IconComponent = item.icon;
                  return (
                    <div
                      key={index}
                      className="flex items-start gap-4 bg-white rounded-xl p-6 shadow-sm border border-gray-100"
                    >
                      <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <IconComponent className="w-6 h-6 text-medical-blue" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {item.label}
                        </h3>
                        <p className="text-gray-600">{item.value}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Map Placeholder */}
              <div className="mt-8 bg-gray-200 rounded-xl h-64 flex items-center justify-center">
                <span className="text-gray-500">
                  {typedLocale === "ar" ? "خريطة الموقع" : "Map Location"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
