"use client";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthForm } from "@/components/auth/AuthForm";
import { useI18n } from "@/components/providers/I18nProvider";

export default function ForgotPasswordPage() {
  const { locale } = useI18n();

  return (
    <AuthLayout
      title={locale === "ar" ? "نسيت كلمة المرور" : "Reset Password"}
      subtitle={
        locale === "ar"
          ? "أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين"
          : "Enter your email and we'll send you a reset link"
      }
    >
      <AuthForm mode="forgot" />
    </AuthLayout>
  );
}
