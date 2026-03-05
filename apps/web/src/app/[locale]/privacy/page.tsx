"use client";

import { useI18n } from "@/components/providers/I18nProvider";
import { HeroSection } from "@/components/ui/HeroSection";

export default function PrivacyPage() {
  const { t } = useI18n();

  return (
    <>
      <HeroSection
        title={t("footer.privacy")}
        subtitle="How we protect and handle your data"
        size="sm"
      />

      <section className="py-16 bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
            <div className="prose prose-lg max-w-none">
              <h2>1. Introduction</h2>
              <p>
                Orca Dental AI is committed to protecting your privacy. This Privacy
                Policy explains how we collect, use, disclose, and safeguard your
                information when you use our services.
              </p>

              <h2>2. Information We Collect</h2>
              <p>
                We collect information that you provide directly to us, including
                name, email address, phone number, and professional credentials. We
                also collect patient imaging data that you upload for analysis.
              </p>

              <h2>3. How We Use Your Information</h2>
              <p>
                We use the information we collect to provide and improve our AI
                analysis services, communicate with you, and ensure the security of
                our platform.
              </p>

              <h2>4. Data Security</h2>
              <p>
                We implement enterprise-grade security measures including encryption,
                access controls, and regular security audits to protect your data.
              </p>

              <h2>5. Your Rights</h2>
              <p>
                You have the right to access, correct, or delete your personal
                information. Contact us to exercise these rights.
              </p>

              <h2>6. Contact Us</h2>
              <p>
                If you have any questions about this Privacy Policy, please contact
                us at privacy@orcadental.ai.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
