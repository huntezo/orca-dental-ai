"use client";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthForm } from "@/components/auth/AuthForm";
import { useI18n } from "@/components/providers/I18nProvider";

export default function LoginPage() {
  const { locale } = useI18n();

  return (
    <AuthLayout
      title={locale === "ar" ? "تسجيل الدخول" : "Sign In"}
      subtitle={
        locale === "ar"
          ? "أدخل بيانات الاعتماد الخاصة بك للوصول إلى حسابك"
          : "Enter your credentials to access your account"
      }
    >
      <AuthForm mode="login" />
    </AuthLayout>
  );
}
