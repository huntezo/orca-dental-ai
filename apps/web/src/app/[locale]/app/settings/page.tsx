"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppShell } from "@/components/app/AppShell";
import { useI18n } from "@/components/providers/I18nProvider";
import { Loader2, User, Mail, CreditCard, LogOut, AlertTriangle } from "lucide-react";

export default function SettingsPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<{
    full_name: string;
    email: string;
    subscription_status: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.push(`/${locale}/auth/login`);
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userData.user.id)
      .single();

    if (profileData) {
      setProfile({
        ...profileData,
        email: userData.user.email || "",
      });
      setFullName(profileData.full_name || "");
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    setMessage(null);

    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", userData.user?.id);

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({ type: "success", text: t("profile.updateSuccess") });
    }
    setSaving(false);
  }

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push(`/${locale}/auth/login`);
    router.refresh();
  }

  if (loading) {
    return (
      <AuthGuard>
        <AppShell>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-medical-blue" />
          </div>
        </AppShell>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <AppShell>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          {t("profile.title")}
        </h1>

        <div className="max-w-2xl space-y-6">
          {/* Profile Info */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              {t("profile.title")}
            </h2>

            {message && (
              <div
                className={`mb-4 p-4 rounded-lg ${
                  message.type === "success"
                    ? "bg-green-50 text-green-600"
                    : "bg-red-50 text-red-600"
                }`}
              >
                {message.text}
              </div>
            )}

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("profile.fullName")}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-medical-blue focus:border-medical-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("profile.email")}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={profile?.email || ""}
                    disabled
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("profile.subscription")}
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={profile?.subscription_status || ""}
                    disabled
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-500 capitalize"
                  />
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-medical-blue text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  t("common.save")
                )}
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-white rounded-xl border border-red-200 shadow-sm p-6">
            <div className="flex items-center gap-2 text-red-600 mb-4">
              <AlertTriangle className="w-5 h-5" />
              <h2 className="text-lg font-semibold">{t("profile.dangerZone")}</h2>
            </div>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-2 px-6 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              {loggingOut ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              {t("profile.signOut")}
            </button>
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
