"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import {
  getAdminUsers,
  suspendUser,
  formatBytes,
  type UserWithStats,
} from "@/lib/db/admin";
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
import { Search, UserX, RefreshCw, Shield } from "lucide-react";

export default function AdminUsersPage() {
  const { locale } = useI18n();
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserWithStats | null>(null);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [suspending, setSuspending] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      setLoading(true);
      const { data } = await getAdminUsers({ limit: 100 });
      if (data) setUsers(data);
    } catch (error) {
      console.error("Failed to load users:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSuspend() {
    if (!selectedUser) return;

    try {
      setSuspending(true);
      const result = await suspendUser(selectedUser.id);
      if (result.success) {
        await loadUsers();
        setSuspendDialogOpen(false);
        setSelectedUser(null);
      } else {
        alert(result.error || "Failed to suspend user");
      }
    } catch (error) {
      console.error("Suspend error:", error);
    } finally {
      setSuspending(false);
    }
  }

  const filteredUsers = users.filter(
    (user) =>
      user.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      user.email?.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      active: "bg-green-100 text-green-800",
      suspended: "bg-red-100 text-red-800",
      inactive: "bg-gray-100 text-gray-800",
      trial: "bg-blue-100 text-blue-800",
    };
    return (
      <Badge className={variants[status] || variants.inactive}>
        {status || "unknown"}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {locale === "ar" ? "إدارة المستخدمين" : "User Management"}
          </h1>
          <p className="text-gray-500 mt-1">
            {locale === "ar"
              ? "عرض وإدارة حسابات المستخدمين"
              : "View and manage user accounts"}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={loadUsers}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {locale === "ar" ? "تحديث" : "Refresh"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder={
                  locale === "ar" ? "البحث في المستخدمين..." : "Search users..."
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{locale === "ar" ? "المستخدم" : "User"}</TableHead>
                <TableHead>{locale === "ar" ? "الدور" : "Role"}</TableHead>
                <TableHead>{locale === "ar" ? "الحالة" : "Status"}</TableHead>
                <TableHead>{locale === "ar" ? "الحالات" : "Cases"}</TableHead>
                <TableHead>{locale === "ar" ? "التحاليل" : "Analyses"}</TableHead>
                <TableHead>{locale === "ar" ? "التخزين" : "Storage"}</TableHead>
                <TableHead className="text-right">
                  {locale === "ar" ? "الإجراءات" : "Actions"}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    {locale === "ar" ? "لا يوجد مستخدمون" : "No users found"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{user.full_name || "-"}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.role === "admin" ? (
                        <Badge className="bg-purple-100 text-purple-800 flex items-center gap-1 w-fit">
                          <Shield className="w-3 h-3" />
                          Admin
                        </Badge>
                      ) : (
                        <Badge variant="outline">User</Badge>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(user.subscription_status)}</TableCell>
                    <TableCell>{user.case_count || 0}</TableCell>
                    <TableCell>{user.analysis_count || 0}</TableCell>
                    <TableCell>{formatBytes(user.storage_bytes || 0)}</TableCell>
                    <TableCell className="text-right">
                      {user.role !== "admin" && user.subscription_status !== "suspended" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setSelectedUser(user);
                            setSuspendDialogOpen(true);
                          }}
                        >
                          <UserX className="w-4 h-4" />
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

      {/* Suspend Dialog */}
      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {locale === "ar" ? "تعليق المستخدم" : "Suspend User"}
            </DialogTitle>
            <DialogDescription>
              {locale === "ar"
                ? `هل أنت متأكد من تعليق المستخدم "${selectedUser?.full_name}"؟ لن يتمكن من الوصول إلى النظام.`
                : `Are you sure you want to suspend "${selectedUser?.full_name}"? They will not be able to access the system.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSuspendDialogOpen(false)}
              disabled={suspending}
            >
              {locale === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              variant="destructive"
              onClick={handleSuspend}
              disabled={suspending}
            >
              {suspending
                ? locale === "ar"
                  ? "جاري التعليق..."
                  : "Suspending..."
                : locale === "ar"
                ? "تعليق المستخدم"
                : "Suspend User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
