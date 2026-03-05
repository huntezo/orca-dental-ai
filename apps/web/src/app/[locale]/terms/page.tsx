"use client";

import { useI18n } from "@/components/providers/I18nProvider";
import { HeroSection } from "@/components/ui/HeroSection";

export default function TermsPage() {
  const { t } = useI18n();

  return (
    <>
      <HeroSection
        title={t("footer.terms")}
        subtitle="The terms and conditions governing your use of our services"
        size="sm"
      />

      <section className="py-16 bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
            <div className="prose prose-lg max-w-none">
              <h2>1. Acceptance of Terms</h2>
              <p>
                By accessing or using Orca Dental AI services, you agree to be bound
                by these Terms of Service. If you do not agree to these terms, please
                do not use our services.
              </p>

              <h2>2. Description of Services</h2>
              <p>
                Orca Dental AI provides AI-powered dental imaging analysis services
                for licensed dental professionals. Our services include
                cephalometric analysis, CBCT segmentation, and diagnostic reporting.
              </p>

              <h2>3. User Accounts</h2>
              <p>
                You are responsible for maintaining the confidentiality of your
                account credentials and for all activities that occur under your
                account.
              </p>

              <h2>4. Medical Disclaimer</h2>
              <p>
                Our AI analysis is intended to assist qualified dental professionals
                and should not be used as a substitute for professional medical
                judgment.
              </p>

              <h2>5. Data Ownership</h2>
              <p>
                You retain ownership of all patient data uploaded to our platform.
                We process this data solely to provide the requested analysis
                services.
              </p>

              <h2>6. Limitation of Liability</h2>
              <p>
                Orca Dental AI shall not be liable for any indirect, incidental,
                special, consequential, or punitive damages arising from your use of
                our services.
              </p>

              <h2>7. Contact Information</h2>
              <p>
                For questions about these Terms of Service, please contact us at
                legal@orcadental.ai.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
