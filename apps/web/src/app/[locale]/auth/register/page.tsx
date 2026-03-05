"use client";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthForm } from "@/components/auth/AuthForm";
import { useI18n } from "@/components/providers/I18nProvider";
import { isBetaModeEnabled, getBetaMessages } from "@/lib/services/beta";
import { Mail } from "lucide-react";

export default function RegisterPage() {
  const { locale } = useI18n();
  const betaEnabled = isBetaModeEnabled();
  const betaMessages = getBetaMessages(locale);

  return (
    <AuthLayout
      title={locale === "ar" ? "إنشاء حساب" : "Create Account"}
      subtitle={
        locale === "ar"
          ? "سجل للحصول على حساب جديد في Orca Dental AI"
          : "Sign up for a new Orca Dental AI account"
      }
    >
      {betaEnabled && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900">{betaMessages.title}</h3>
              <p className="text-sm text-blue-700 mt-1">
                {betaMessages.description}
              </p>
              <p className="text-sm text-blue-600 mt-2">
                {locale === "ar" 
                  ? "إذا لم تكن في القائمة، " 
                  : "If you're not on the list, "}
                <a 
                  href="mailto:beta@orcadental.ai" 
                  className="underline hover:text-blue-800"
                >
                  {betaMessages.contactUs}
                </a>
                {locale === "ar" 
                  ? " للوصول المبكر." 
                  : " for early access."}
              </p>
            </div>
          </div>
        </div>
      )}
      <AuthForm mode="register" />
    </AuthLayout>
  );
}
