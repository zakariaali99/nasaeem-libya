"use client";

import React, { useState } from "react";
import { useQuery, QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ArrowRight, UserCog, Shield, Phone, Calendar, Ban, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { BanUserDialog, DeleteUserDialog, ChangeRoleDialog, UnbanUserDialog } from "../user-dialogs";
import UserSessions from "@/components/UserSessions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminUserWallet from "./AdminUserWallet";

// Function to fetch user data
async function getUserData(userId: string) {
  const response = await fetch(`/api/admin/users/${userId}`);
  if (!response.ok) throw new Error("خطأ في جلب بيانات المستخدم");
  return response.json();
}

// Create a client once - outside the component
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false,
    },
  },
});

// Create a wrapper component to handle the query
function UserDetails() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;
  const queryClient = useQueryClient();

  // Dialog states
  const [deleteDialog, setDeleteDialog] = useState({ open: false });
  const [banDialog, setBanDialog] = useState({ open: false });
  const [unbanDialog, setUnbanDialog] = useState({ open: false });
  const [roleDialog, setRoleDialog] = useState({ open: false });

  // Loading states
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBanning, setIsBanning] = useState(false);
  const [isUnbanning, setIsUnbanning] = useState(false);
  const [isChangingRole, setIsChangingRole] = useState(false);

  // Fetch user data
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["user", userId],
    queryFn: () => getUserData(userId),
  });

  // Handle action events
  const handleDeleteUser = async () => {
    try {
      setIsDeleting(true);
      await authClient.admin.removeUser({
        userId,
      });
      router.push("/admin/users");
    } catch (error) {
      console.error("Error deleting user:", error);
    } finally {
      setIsDeleting(false);
      setDeleteDialog({ open: false });
    }
  };

  const handleBanUser = async (userId: string, reason: string, duration: number | null) => {
    try {
      setIsBanning(true);
      await authClient.admin.banUser({
        userId,
        banReason: reason,
        banExpiresIn: duration || undefined,
      });

      // Invalidate the query to refetch user data
      await queryClient.invalidateQueries({
        queryKey: ["user", userId],
      });
    } catch (error) {
      console.error("Error banning user:", error);
    } finally {
      setIsBanning(false);
      setBanDialog({ open: false });
    }
  };

  const handleUnbanUser = async () => {
    try {
      setIsUnbanning(true);
      await authClient.admin.unbanUser({
        userId,
      });

      // Invalidate the query to refetch user data
      await queryClient.invalidateQueries({
        queryKey: ["user", userId],
      });
    } catch (error) {
      console.error("Error unbanning user:", error);
    } finally {
      setIsUnbanning(false);
      setUnbanDialog({ open: false });
    }
  };

  const handleChangeRole = async (userIdParam: string, newRole: string) => {
    try {
      setIsChangingRole(true);
      await authClient.admin.setRole({
        userId: userIdParam, // Use the userId from params, not the first parameter
        role: newRole,
      });

      // Invalidate the query to refetch user data
      await queryClient.invalidateQueries({
        queryKey: ["user", userId],
      });
    } catch (error) {
      console.error("Error changing user role:", error);
    } finally {
      setIsChangingRole(false);
      setRoleDialog({ open: false });
    }
  };

  if (error) {
    return (
      <div className="container mx-auto py-10 text-right">
        <div className="flex items-center justify-end mb-4">
          <Button variant="outline" onClick={() => router.push("/admin/users")} className="flex items-center">
            <ArrowRight className="ml-2 rtl:rotate-180" size={16} />
            العودة للقائمة
          </Button>
        </div>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl text-red-600">حدث خطأ</CardTitle>
            <CardDescription>تعذر تحميل بيانات المستخدم</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <AlertCircle className="text-red-600" size={48} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div dir="rtl" className="container mx-auto py-10">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">تفاصيل المستخدم</h1>
        <Button variant="outline" onClick={() => router.push("/admin/users")} className="flex items-center">
          العودة للقائمة
          <ArrowRight className="ml-2 rtl:rotate-180" size={16} />
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/3 mb-2" />
            <Skeleton className="h-4 w-1/4" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
          <CardFooter>
            <Skeleton className="h-10 w-24 mr-2" />
            <Skeleton className="h-10 w-24 mr-2" />
            <Skeleton className="h-10 w-24 mr-2" />
          </CardFooter>
        </Card>
      ) : (
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="details">معلومات</TabsTrigger>
            <TabsTrigger value="wallet">المحفظة المالية</TabsTrigger>
            <TabsTrigger value="sessions">جلسات</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center">
                    <UserCog className="ml-2" size={20} />
                    المعلومات
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">الاسم</p>
                    <p className="font-medium">{user?.name || "غير متوفر"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">رقم الهاتف</p>
                    <div className="flex items-center">
                      <Phone className="ml-2" size={16} />
                      <p className="font-medium">{user?.phoneNumber || "غير متوفر"}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">الصلاحية</p>
                    <div className="flex items-center">
                      <Shield className="ml-2" size={16} />
                      <p className="font-medium">{user?.role || "مستخدم"}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">حالة الحساب</p>
                    {user?.banned ? (
                      <div>
                        <Badge className="bg-red-500">محظور</Badge>
                        {user.banReason && (
                          <p className="mt-2 text-sm text-red-500">سبب الحظر: {user.banReason}</p>
                        )}
                      </div>
                    ) : (
                      <Badge className="bg-green-500">نشط</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center">
                    <Calendar className="ml-2" size={20} />
                    التواريخ والنشاط
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">تاريخ الإنشاء</p>
                    <p className="font-medium">
                      {user?.createdAt ? format(new Date(user.createdAt), "PPP - HH:mm", { locale: ar }) : "غير متوفر"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">آخر تسجيل دخول</p>
                    <p className="font-medium">
                      {user?.lastLoginAt ? format(new Date(user.lastLoginAt), "PPP - HH:mm", { locale: ar }) : "لم يسجل الدخول"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2" dir="rtl">
                <CardHeader>
                  <CardTitle className="text-xl">إدارة الحساب</CardTitle>
                </CardHeader>
                <CardFooter className="flex flex-wrap gap-2">
                  {user?.banned ? (
                    <Button variant="outline" onClick={() => setUnbanDialog({ open: true })} className="flex items-center">
                      <CheckCircle className="ml-2" size={16} />
                      إلغاء الحظر
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => setBanDialog({ open: true })} className="flex items-center">
                      <Ban className="ml-2" size={16} />
                      حظر المستخدم
                    </Button>
                  )}

                  <Button variant="outline" onClick={() => setRoleDialog({ open: true })} className="flex items-center">
                    <Shield className="ml-2" size={16} />
                    تغيير الصلاحية
                  </Button>

                  <Button variant="destructive" onClick={() => setDeleteDialog({ open: true })} className="flex items-center">
                    <AlertCircle className="ml-2" size={16} />
                    حذف المستخدم
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="wallet">
            <AdminUserWallet userId={userId} />
          </TabsContent>

          <TabsContent value="sessions">
            <UserSessions userId={userId} initialAdminMode={true} />
          </TabsContent>
        </Tabs>
      )}

      {/* Dialog components - we're reusing the existing dialogs */}
      {user && (
        <>
          <DeleteUserDialog
            isOpen={deleteDialog.open}
            user={{ id: userId, name: user.name, role: user.role ?? 'user', createdAt: user.createdAt }}
            isDeleting={isDeleting}
            onClose={() => setDeleteDialog({ open: false })}
            onConfirm={() => handleDeleteUser()}
          />

          <BanUserDialog
            isOpen={banDialog.open}
            user={{ id: userId, name: user.name, role: user.role ?? 'user', createdAt: user.createdAt }}
            isBanning={isBanning}
            onClose={() => setBanDialog({ open: false })}
            onConfirm={handleBanUser}
          />

          <UnbanUserDialog
            isOpen={unbanDialog.open}
            user={{ id: userId, name: user.name, role: user.role ?? 'user', createdAt: user.createdAt }}
            isUnbanning={isUnbanning}
            onClose={() => setUnbanDialog({ open: false })}
            onConfirm={() => handleUnbanUser()}
          />

          <ChangeRoleDialog
            isOpen={roleDialog.open}
            user={{ id: userId, name: user.name, role: user.role ?? 'user', createdAt: user.createdAt }}
            isChanging={isChangingRole}
            onClose={() => setRoleDialog({ open: false })}
            onConfirm={handleChangeRole}
          />
        </>
      )}
    </div>
  );
}

// Main component that wraps the UserDetails with QueryClientProvider
export default function UserDetailsPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserDetails />
    </QueryClientProvider>
  );
}
