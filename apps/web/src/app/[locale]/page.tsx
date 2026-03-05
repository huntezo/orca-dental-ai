"use client";

import { useI18n } from "@/components/providers/I18nProvider";
import Link from "next/link";
import { HeroSection } from "@/components/ui/HeroSection";
import { ServiceStrip } from "@/components/ui/ServiceStrip";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { BlogCard } from "@/components/ui/BlogCard";
import { getLatestPosts } from "@/data/posts";
import { CheckCircle, Zap, Cloud, ArrowRight } from "lucide-react";

export default function HomePage() {
  const { t } = useI18n();
  const latestPosts = getLatestPosts(3);

  const features = [
    {
      icon: CheckCircle,
      title: t("home.features.accuracy.title"),
      description: t("home.features.accuracy.description"),
    },
    {
      icon: Zap,
      title: t("home.features.speed.title"),
      description: t("home.features.speed.description"),
    },
    {
      icon: Cloud,
      title: t("home.features.cloud.title"),
      description: t("home.features.cloud.description"),
    },
  ];

  return (
    <>
      {/* Hero Section */}
      <HeroSection
        title={t("home.hero.title")}
        subtitle={t("home.hero.subtitle")}
        size="lg"
      >
        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <Link href="/services">
            <Button variant="default" size="lg">
              {t("home.hero.ctaPrimary")}
            </Button>
          </Link>
          <Link href="/contact">
            <Button variant="outline" size="lg">
              {t("home.hero.ctaSecondary")}
            </Button>
          </Link>
        </div>
      </HeroSection>

      {/* Services Strip */}
      <ServiceStrip />

      {/* About Section */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <SectionTitle
                title={t("home.about.title")}
                align="left"
              />
              <p className="text-gray-600 text-lg leading-relaxed mb-6">
                {t("home.about.description")}
              </p>
              <Link href="/about">
                <Button variant="outline">
                  {t("home.about.cta")}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
            <div className="relative">
              <div className="aspect-square bg-gradient-to-br from-blue-100 to-blue-50 rounded-3xl flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl font-bold text-medical-blue mb-2">
                    20+
                  </div>
                  <div className="text-gray-600">Years of Innovation</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionTitle
            title={t("home.features.title")}
            subtitle=""
          />
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <div
                  key={index}
                  className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                >
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <IconComponent className="w-8 h-8 text-medical-blue" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Latest Blog Posts */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-3xl font-bold text-gray-900">
              Latest Insights
            </h2>
            <Link
              href="/blog"
              className="text-medical-blue font-medium hover:text-blue-700 flex items-center gap-1"
            >
              View All
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {latestPosts.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-medical-blue to-blue-800">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            {t("home.cta.title")}
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            {t("home.cta.description")}
          </p>
          <Link href="/contact">
            <Button
              variant="secondary"
              size="lg"
              className="bg-white text-medical-blue hover:bg-gray-100"
            >
              {t("home.cta.button")}
            </Button>
          </Link>
        </div>
      </section>
    </>
  );
}
