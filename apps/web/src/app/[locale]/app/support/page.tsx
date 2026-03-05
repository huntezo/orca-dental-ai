"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import Link from "next/link";
import {
  getUserTickets,
  getTicketTypeLabel,
  getTicketStatusLabel,
  getTicketTypeColor,
  getTicketStatusColor,
  type SupportTicket,
} from "@/lib/services/support";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Plus, RefreshCw, ExternalLink } from "lucide-react";

export default function SupportPage() {
  const { locale } = useI18n();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTickets();
  }, []);

  async function loadTickets() {
    try {
      setLoading(true);
      const { tickets: data } = await getUserTickets();
      if (data) setTickets(data);
    } catch (error) {
      console.error("Error loading tickets:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {locale === "ar" ? "الدعم" : "Support"}
          </h1>
          <p className="text-gray-500 mt-1">
            {locale === "ar"
              ? "إدارة طلبات الدعم والمساعدة"
              : "Manage your support requests"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={loadTickets}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Link href={`/${locale}/app/support/new`}>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              {locale === "ar" ? "طلب جديد" : "New Ticket"}
            </Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {locale === "ar" ? "لا توجد طلبات" : "No tickets yet"}
            </h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              {locale === "ar"
                ? "هل تحتاج مساعدة؟ قم بإنشاء طلب دعم وسنرد عليك في أقرب وقت."
                : "Need help? Create a support ticket and we'll get back to you soon."}
            </p>
            <Link href={`/${locale}/app/support/new`}>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                {locale === "ar" ? "إنشاء طلب" : "Create Ticket"}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <Card key={ticket.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={getTicketTypeColor(ticket.type)}>
                        {getTicketTypeLabel(ticket.type, locale)}
                      </Badge>
                      <Badge className={getTicketStatusColor(ticket.status)}>
                        {getTicketStatusLabel(ticket.status, locale)}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {ticket.subject}
                    </h3>
                    <p className="text-gray-600 text-sm line-clamp-2">
                      {ticket.message}
                    </p>
                    <p className="text-gray-400 text-xs mt-3">
                      {new Date(ticket.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {ticket.page_url && (
                      <a
                        href={ticket.page_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
