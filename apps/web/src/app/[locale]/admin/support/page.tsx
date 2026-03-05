"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { createClient } from "@/lib/supabase/client";
import {
  getAllTickets,
  updateTicketStatus,
  getTicketTypeLabel,
  getTicketStatusLabel,
  getTicketTypeColor,
  getTicketStatusColor,
  type SupportTicket,
  type TicketStatus,
} from "@/lib/services/support";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  RefreshCw,
  MessageSquare,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Send,
  User,
  Calendar,
  ExternalLink,
} from "lucide-react";

interface TicketNote {
  id: string;
  admin_id: string;
  admin_email: string;
  note: string;
  created_at: string;
}

interface TicketDetail extends SupportTicket {
  user_email?: string;
}

export default function AdminSupportPage() {
  const { locale } = useI18n();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TicketStatus | "all">("all");
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [ticketNotes, setTicketNotes] = useState<TicketNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => {
    loadTickets();
  }, []);

  async function loadTickets() {
    try {
      setLoading(true);
      const status = filter === "all" ? undefined : filter;
      const { tickets: data } = await getAllTickets(status);
      if (data) setTickets(data);
    } catch (error) {
      console.error("Error loading tickets:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadTicketDetail(ticketId: string) {
    try {
      const supabase = createClient();
      
      // Get ticket details with user email
      const { data: ticketData } = await supabase
        .rpc("get_ticket_details", { p_ticket_id: ticketId })
        .single();
      
      if (ticketData) {
        setSelectedTicket(ticketData as TicketDetail);
      }

      // Get notes
      const { data: notesData } = await supabase
        .rpc("get_ticket_notes", { p_ticket_id: ticketId });
      
      if (notesData) {
        setTicketNotes(notesData as TicketNote[]);
      }
    } catch (error) {
      console.error("Error loading ticket detail:", error);
    }
  }

  async function handleStatusChange(ticketId: string, newStatus: TicketStatus) {
    try {
      const { success } = await updateTicketStatus(ticketId, newStatus);
      if (success) {
        await loadTickets();
        if (selectedTicket?.id === ticketId) {
          await loadTicketDetail(ticketId);
        }
      }
    } catch (error) {
      console.error("Error updating ticket:", error);
    }
  }

  async function handleAddNote() {
    if (!selectedTicket || !newNote.trim()) return;

    try {
      setAddingNote(true);
      const supabase = createClient();

      const { error } = await supabase.rpc("add_ticket_note", {
        p_ticket_id: selectedTicket.id,
        p_note: newNote.trim(),
      });

      if (error) throw error;

      setNewNote("");
      await loadTicketDetail(selectedTicket.id);
    } catch (error) {
      console.error("Error adding note:", error);
    } finally {
      setAddingNote(false);
    }
  }

  const filteredTickets =
    filter === "all" ? tickets : tickets.filter((t) => t.status === filter);

  const stats = {
    total: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    inProgress: tickets.filter((t) => t.status === "in_progress").length,
    closed: tickets.filter((t) => t.status === "closed").length,
  };

  // Ticket Detail View
  if (selectedTicket) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => setSelectedTicket(null)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {locale === "ar" ? "تفاصيل الطلب" : "Ticket Details"}
            </h1>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Ticket Info */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={getTicketTypeColor(selectedTicket.type)}>
                        {getTicketTypeLabel(selectedTicket.type, locale)}
                      </Badge>
                      <Badge className={getTicketStatusColor(selectedTicket.status)}>
                        {getTicketStatusLabel(selectedTicket.status, locale)}
                      </Badge>
                    </div>
                    <CardTitle className="text-xl">{selectedTicket.subject}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedTicket.status !== "in_progress" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange(selectedTicket.id, "in_progress")}
                      >
                        {locale === "ar" ? "معالجة" : "Start"}
                      </Button>
                    )}
                    {selectedTicket.status !== "closed" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange(selectedTicket.id, "closed")}
                        className="text-green-600"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                    )}
                    {selectedTicket.status !== "open" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange(selectedTicket.id, "open")}
                        className="text-yellow-600"
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* User Info */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <User className="w-4 h-4" />
                    <span>{locale === "ar" ? "المستخدم:" : "User:"}</span>
                    <span className="font-medium">{selectedTicket.user_email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <Calendar className="w-4 h-4" />
                    <span>{locale === "ar" ? "تاريخ الإنشاء:" : "Created:"}</span>
                    <span>{new Date(selectedTicket.created_at).toLocaleString()}</span>
                  </div>
                  {selectedTicket.page_url && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <ExternalLink className="w-4 h-4" />
                      <a
                        href={selectedTicket.page_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-medical-blue hover:underline"
                      >
                        {locale === "ar" ? "الصفحة:" : "Page:"} {selectedTicket.page_url}
                      </a>
                    </div>
                  )}
                </div>

                {/* Message */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">
                    {locale === "ar" ? "الرسالة:" : "Message:"}
                  </h4>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {selectedTicket.message}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {locale === "ar" ? "ملاحظات داخلية" : "Internal Notes"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add Note */}
                <div className="flex gap-2">
                  <Input
                    placeholder={locale === "ar" ? "إضافة ملاحظة..." : "Add a note..."}
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !addingNote && handleAddNote()}
                  />
                  <Button
                    onClick={handleAddNote}
                    disabled={!newNote.trim() || addingNote}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>

                {/* Notes List */}
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {ticketNotes.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">
                      {locale === "ar" ? "لا توجد ملاحظات" : "No notes yet"}
                    </p>
                  ) : (
                    ticketNotes.map((note) => (
                      <div key={note.id} className="bg-yellow-50 p-3 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900">
                            {note.admin_email}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(note.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-gray-700 text-sm">{note.note}</p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>
                  {locale === "ar" ? "معلومات" : "Info"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">{locale === "ar" ? "معرف المستخدم" : "User ID"}</p>
                  <p className="font-mono text-sm">{selectedTicket.user_id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{locale === "ar" ? "معرف الطلب" : "Ticket ID"}</p>
                  <p className="font-mono text-sm">{selectedTicket.id}</p>
                </div>
                {selectedTicket.admin_notes && (
                  <div>
                    <p className="text-sm text-gray-500">{locale === "ar" ? "ملاحظات" : "Notes"}</p>
                    <p className="text-sm">{selectedTicket.admin_notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {locale === "ar" ? "إدارة الدعم" : "Support Management"}
          </h1>
          <p className="text-gray-500 mt-1">
            {locale === "ar"
              ? "إدارة طلبات الدعم والمساعدة"
              : "Manage support tickets and user requests"}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={loadTickets}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {locale === "ar" ? "تحديث" : "Refresh"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-gray-500">
              {locale === "ar" ? "الإجمالي" : "Total"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{stats.open}</div>
            <p className="text-sm text-gray-500">
              {locale === "ar" ? "مفتوح" : "Open"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">
              {stats.inProgress}
            </div>
            <p className="text-sm text-gray-500">
              {locale === "ar" ? "قيد المعالجة" : "In Progress"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-600">{stats.closed}</div>
            <p className="text-sm text-gray-500">
              {locale === "ar" ? "مغلق" : "Closed"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as TicketStatus | "all")}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-medical-blue focus:border-medical-blue"
        >
          <option value="all">{locale === "ar" ? "الكل" : "All"}</option>
          <option value="open">{locale === "ar" ? "مفتوح" : "Open"}</option>
          <option value="in_progress">{locale === "ar" ? "قيد المعالجة" : "In Progress"}</option>
          <option value="closed">{locale === "ar" ? "مغلق" : "Closed"}</option>
        </select>
      </div>

      {/* Tickets List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {locale === "ar" ? "الطلبات" : "Tickets"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>{locale === "ar" ? "لا توجد طلبات" : "No tickets found"}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => loadTicketDetail(ticket.id)}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                >
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
                      <h4 className="font-medium text-gray-900 truncate">
                        {ticket.subject}
                      </h4>
                      <p className="text-gray-600 text-sm mt-1 line-clamp-2">
                        {ticket.message}
                      </p>
                      <p className="text-gray-400 text-xs mt-2">
                        {new Date(ticket.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
