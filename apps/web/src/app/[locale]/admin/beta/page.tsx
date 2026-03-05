"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Plus, Trash2, RefreshCw, Users, CheckCircle, Clock } from "lucide-react";

interface BetaAllowlistEntry {
  id: string;
  email: string;
  invited_by: string | null;
  created_at: string;
  note: string | null;
  registered_at: string | null;
  registered_user_id: string | null;
}

interface BetaStats {
  total_invited: number;
  total_registered: number;
  remaining_slots: number;
}

export default function BetaAllowlistPage() {
  const { locale } = useI18n();
  const [entries, setEntries] = useState<BetaAllowlistEntry[]>([]);
  const [stats, setStats] = useState<BetaStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newNote, setNewNote] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<BetaAllowlistEntry | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const supabase = createClient();

      // Load allowlist entries
      const { data: entriesData, error: entriesError } = await supabase
        .from("beta_allowlist")
        .select("*")
        .order("created_at", { ascending: false });

      if (entriesError) throw entriesError;
      setEntries(entriesData || []);

      // Load stats
      const { data: statsData, error: statsError } = await supabase
        .rpc("get_beta_stats")
        .single();

      if (statsError) throw statsError;
      setStats(statsData as BetaStats);
    } catch (error) {
      console.error("Failed to load beta allowlist:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!newEmail.trim()) return;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      alert(locale === "ar" ? "يرجى إدخال بريد إلكتروني صالح" : "Please enter a valid email");
      return;
    }

    try {
      setIsAdding(true);
      const supabase = createClient();

      const { error } = await supabase.rpc("add_to_beta_allowlist", {
        p_email: newEmail.trim().toLowerCase(),
        p_note: newNote.trim() || null,
      });

      if (error) {
        if (error.message.includes("unique constraint")) {
          alert(locale === "ar" ? "هذا البريد الإلكتروني موجود بالفعل" : "This email is already on the allowlist");
        } else {
          throw error;
        }
        return;
      }

      setNewEmail("");
      setNewNote("");
      setAddDialogOpen(false);
      await loadData();
    } catch (error) {
      console.error("Failed to add email:", error);
      alert(locale === "ar" ? "فشل إضافة البريد الإلكتروني" : "Failed to add email");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleDelete() {
    if (!selectedEntry) return;

    try {
      setIsDeleting(true);
      const supabase = createClient();

      const { error } = await supabase.rpc("remove_from_beta_allowlist", {
        p_email: selectedEntry.email,
      });

      if (error) throw error;

      setDeleteDialogOpen(false);
      setSelectedEntry(null);
      await loadData();
    } catch (error) {
      console.error("Failed to remove email:", error);
      alert(locale === "ar" ? "فشل إزالة البريد الإلكتروني" : "Failed to remove email");
    } finally {
      setIsDeleting(false);
    }
  }

  const filteredEntries = entries.filter(
    (entry) =>
      entry.email.toLowerCase().includes(search.toLowerCase()) ||
      (entry.note && entry.note.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {locale === "ar" ? "قائمة البيتا" : "Beta Allowlist"}
          </h1>
          <p className="text-gray-500 mt-1">
            {locale === "ar"
              ? "إدارة الوصول للنسخة التجريبية"
              : "Manage private beta access"}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={loadData}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {locale === "ar" ? "تحديث" : "Refresh"}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {locale === "ar" ? "إجمالي المدعوين" : "Total Invited"}
            </CardTitle>
            <Users className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_invited ?? "-"}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {locale === "ar" ? "مسجل" : "Registered"}
            </CardTitle>
            <CheckCircle className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_registered ?? "-"}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {locale === "ar" ? "متبقي" : "Remaining"}
            </CardTitle>
            <Clock className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.remaining_slots ?? "-"}</div>
            <p className="text-xs text-gray-500 mt-1">
              {locale === "ar" ? "من 30" : "of 30 slots"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder={
              locale === "ar" ? "البحث في البريد الإلكتروني..." : "Search emails..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          onClick={() => setAddDialogOpen(true)}
          className="gap-2"
          disabled={!!stats && stats.total_invited >= 30}
        >
          <Plus className="w-4 h-4" />
          {locale === "ar" ? "إضافة بريد" : "Add Email"}
        </Button>
      </div>

      {/* Allowlist Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {locale === "ar" ? "قائمة البريد الإلكتروني" : "Email List"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{locale === "ar" ? "البريد الإلكتروني" : "Email"}</TableHead>
                <TableHead>{locale === "ar" ? "الحالة" : "Status"}</TableHead>
                <TableHead>{locale === "ar" ? "ملاحظة" : "Note"}</TableHead>
                <TableHead>{locale === "ar" ? "تاريخ الإضافة" : "Added"}</TableHead>
                <TableHead className="text-right">
                  {locale === "ar" ? "إجراءات" : "Actions"}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                  </TableCell>
                </TableRow>
              ) : filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    {locale === "ar" ? "لا توجد إدخالات" : "No entries found"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.email}</TableCell>
                    <TableCell>
                      {entry.registered_user_id ? (
                        <Badge className="bg-green-100 text-green-800 flex items-center gap-1 w-fit">
                          <CheckCircle className="w-3 h-3" />
                          {locale === "ar" ? "مسجل" : "Registered"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          <Clock className="w-3 h-3" />
                          {locale === "ar" ? "في الانتظار" : "Pending"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-500 max-w-xs truncate">
                      {entry.note || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {!entry.registered_user_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setSelectedEntry(entry);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {locale === "ar" ? "إضافة بريد إلكتروني" : "Add Email"}
            </DialogTitle>
            <DialogDescription>
              {locale === "ar"
                ? "أضف بريدًا إلكترونيًا للسماح بالتسجيل في النسخة التجريبية"
                : "Add an email to allow beta registration"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">
                {locale === "ar" ? "البريد الإلكتروني" : "Email"}
              </label>
              <Input
                type="email"
                placeholder="doctor@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                {locale === "ar" ? "ملاحظة (اختياري)" : "Note (optional)"}
              </label>
              <Input
                placeholder={
                  locale === "ar" ? "مثال: د. أحمد من عيادة ..." : "e.g., Dr. Smith from..."
                }
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
              disabled={isAdding}
            >
              {locale === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleAdd} disabled={isAdding || !newEmail.trim()}>
              {isAdding
                ? locale === "ar"
                  ? "جاري الإضافة..."
                  : "Adding..."
                : locale === "ar"
                ? "إضافة"
                : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {locale === "ar" ? "إزالة بريد إلكتروني" : "Remove Email"}
            </DialogTitle>
            <DialogDescription>
              {locale === "ar"
                ? `هل أنت متأكد من إزالة "${selectedEntry?.email}"؟ لن يتمكن من التسجيل.`
                : `Are you sure you want to remove "${selectedEntry?.email}"? They won't be able to register.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              {locale === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting
                ? locale === "ar"
                  ? "جاري الإزالة..."
                  : "Removing..."
                : locale === "ar"
                ? "إزالة"
                : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
