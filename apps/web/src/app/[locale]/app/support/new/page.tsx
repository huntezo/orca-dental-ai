"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { createSupportTicket, type TicketType } from "@/lib/services/support";
import { telemetry } from "@/lib/services/telemetry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, Bug, Lightbulb, HelpCircle } from "lucide-react";
import Link from "next/link";

interface TicketTypeOption {
  value: TicketType;
  label: string;
  labelAr: string;
  icon: React.ElementType;
  description: string;
  descriptionAr: string;
}

const ticketTypes: TicketTypeOption[] = [
  {
    value: "bug",
    label: "Bug Report",
    labelAr: "خطأ",
    icon: Bug,
    description: "Report something that is not working correctly",
    descriptionAr: "الإبلاغ عن خطأ في النظام",
  },
  {
    value: "feature",
    label: "Feature Request",
    labelAr: "ميزة",
    icon: Lightbulb,
    description: "Suggest a new feature or improvement",
    descriptionAr: "اقتراح ميزة جديدة",
  },
  {
    value: "question",
    label: "Question",
    labelAr: "سؤال",
    icon: HelpCircle,
    description: "Ask a question about using the app",
    descriptionAr: "سؤال حول استخدام التطبيق",
  },
];

export default function NewTicketPage() {
  const { locale } = useI18n();
  const router = useRouter();
  const [type, setType] = useState<TicketType | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!type || !subject.trim() || !message.trim()) return;

    try {
      setSubmitting(true);
      const { ticket, error } = await createSupportTicket({
        type,
        subject: subject.trim(),
        message: message.trim(),
        page_url: typeof window !== "undefined" ? window.location.href : undefined,
      });

      if (error) throw error;

      if (ticket) {
        telemetry.ticketCreated(ticket.id, type);
      }

      setSubmitted(true);
      setTimeout(() => {
        router.push(`/${locale}/app/support`);
      }, 2000);
    } catch (error) {
      console.error("Error creating ticket:", error);
      alert(locale === "ar" ? "فشل إنشاء الطلب" : "Failed to create ticket");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {locale === "ar" ? "تم إرسال الطلب" : "Ticket Submitted"}
            </h2>
            <p className="text-gray-500">
              {locale === "ar"
                ? "سنرد عليك في أقرب وقت."
                : "We'll get back to you soon."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <Link
        href={`/${locale}/app/support`}
        className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        {locale === "ar" ? "العودة" : "Back"}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>
            {locale === "ar" ? "طلب دعم جديد" : "New Support Ticket"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Ticket Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                {locale === "ar" ? "نوع الطلب" : "Ticket Type"}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {ticketTypes.map((t) => {
                  const Icon = t.icon;
                  const isSelected = type === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setType(t.value)}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        isSelected
                          ? "border-medical-blue bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <Icon
                        className={`w-6 h-6 mb-2 ${
                          isSelected ? "text-medical-blue" : "text-gray-400"
                        }`}
                      />
                      <div className="font-medium text-sm">
                        {locale === "ar" ? t.labelAr : t.label}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {locale === "ar" ? t.descriptionAr : t.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {locale === "ar" ? "الموضوع" : "Subject"}
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={
                  locale === "ar" ? "وصف مختصر للمشكلة" : "Brief description"
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-medical-blue focus:border-medical-blue"
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {locale === "ar" ? "الرسالة" : "Message"}
              </label>
              <textarea
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  locale === "ar"
                    ? "اشرح المشكلة بالتفصيل..."
                    : "Describe the issue in detail..."
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-medical-blue focus:border-medical-blue resize-none"
              />
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-3">
              <Link href={`/${locale}/app/support`}>
                <Button variant="outline" type="button">
                  {locale === "ar" ? "إلغاء" : "Cancel"}
                </Button>
              </Link>
              <Button
                type="submit"
                disabled={!type || !subject.trim() || !message.trim() || submitting}
                className="gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {locale === "ar" ? "جاري..." : "Sending..."}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {locale === "ar" ? "إرسال" : "Submit"}
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
