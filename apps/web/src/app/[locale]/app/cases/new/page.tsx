"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppShell } from "@/components/app/AppShell";
import { useI18n } from "@/components/providers/I18nProvider";
import { createCase } from "@/lib/db/cases";
import { telemetry } from "@/lib/services/telemetry";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function NewCasePage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [patientCode, setPatientCode] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await createCase(patientCode, notes);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data) {
      // Track telemetry event
      await telemetry.caseCreated(data.id);
      router.push(`/${locale}/app/cases/${data.id}`);
    }
  }

  return (
    <AuthGuard>
      <AppShell>
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/${locale}/app/cases`}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-medical-blue mb-4"
          >
            <ArrowLeft className={`w-4 h-4 ${locale === "ar" ? "rotate-180" : ""}`} />
            {t("common.back")}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("cases.createCase")}
          </h1>
        </div>

        {/* Form */}
        <div className="max-w-2xl bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("cases.patientCode")} *
              </label>
              <input
                type="text"
                required
                value={patientCode}
                onChange={(e) => setPatientCode(e.target.value)}
                placeholder={t("cases.patientCodePlaceholder")}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-medical-blue focus:border-medical-blue"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("cases.notes")}
              </label>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("cases.notesPlaceholder")}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-medical-blue focus:border-medical-blue resize-none"
              />
            </div>

            <div className="flex items-center gap-4 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-6 py-2 bg-medical-blue text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("cases.createCase")}
              </button>
              <Link
                href={`/${locale}/app/cases`}
                className="px-6 py-2 text-gray-700 hover:text-gray-900"
              >
                {t("common.cancel")}
              </Link>
            </div>
          </form>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
