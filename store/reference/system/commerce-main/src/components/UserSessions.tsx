"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import {
  Laptop,
  Smartphone,
  Tablet,
  Globe,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface UserSessionsProps {
  userId?: string; // Only required for admin mode
  initialAdminMode?: boolean;
}

// Define the session type based on the API response
interface Session {
  id: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  userId: string;
  expiresAt: string | Date;
  token: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  current?: boolean;
}

const UserSessions: React.FC<UserSessionsProps> = ({
  userId,
  initialAdminMode = false,
}) => {
  const queryClient = useQueryClient();
  const [isAdminMode, setIsAdminMode] = useState(initialAdminMode);
  const [sessionToRevoke, setSessionToRevoke] = useState<string | null>(null);
  const [isRevokeAllDialogOpen, setIsRevokeAllDialogOpen] = useState(false);

  // Function to get device icon based on user agent
  const getDeviceIcon = (userAgent: string = "") => {
    userAgent = userAgent.toLowerCase();
    if (userAgent.includes("iphone") || userAgent.includes("android") && userAgent.includes("mobile")) {
      return <Smartphone className="ml-2" />;
    } else if (userAgent.includes("ipad") || userAgent.includes("android") && !userAgent.includes("mobile")) {
      return <Tablet className="ml-2" />;
    } else if (userAgent.includes("mac") || userAgent.includes("windows") || userAgent.includes("linux")) {
      return <Laptop className="ml-2" />;
    } else {
      return <Globe className="ml-2" />;
    }
  };

  // Query to fetch sessions
  const {
    data: sessionsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["sessions", userId, isAdminMode],
    queryFn: async () => {
      if (isAdminMode && userId) {
        const result = await authClient.admin.listUserSessions({
          userId,
        });
        // Properly extract the sessions array from the response
        return result.data?.sessions || [];
      } else {
        const result = await authClient.listSessions();
        // Properly extract the sessions array from the response
        return result.data || [];
      }
    },
    enabled: !isAdminMode || !!userId, // Only run if not in admin mode or if userId is provided
  });

  // Extract sessions array safely
  const sessions: Session[] = Array.isArray(sessionsData) ? sessionsData : [];

  // Mutation to revoke a specific session
  const revokeMutation = useMutation({
    mutationFn: async (sessionToken: string) => {
      if (isAdminMode) {
        return await authClient.admin.revokeUserSession({
          sessionToken,
        });
      } else {
        return await authClient.revokeSession({
          token: sessionToken,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      setSessionToRevoke(null);
      refetch();
    },
  });

  // Mutation to revoke all sessions
  const revokeAllMutation = useMutation({
    mutationFn: async () => {
      if (isAdminMode && userId) {
        return await authClient.admin.revokeUserSessions({
          userId,
        });
      } else {
        return await authClient.revokeSessions();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      setIsRevokeAllDialogOpen(false);
      refetch();
    },
  });

  // Mutation to revoke other sessions (user mode only)
  const revokeOthersMutation = useMutation({
    mutationFn: async () => {
      return await authClient.revokeOtherSessions();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      refetch();
    },
  });

  // Check if admin mode is valid
  useEffect(() => {
    if (isAdminMode && !userId) {
      console.error("User ID is required in admin mode");
    }
  }, [isAdminMode, userId]);

  // Handle revoking a session
  const handleRevokeSession = (sessionToken: string) => {
    setSessionToRevoke(sessionToken);
  };

  // Confirm revoke session
  const confirmRevokeSession = () => {
    if (sessionToRevoke) {
      revokeMutation.mutate(sessionToRevoke);
    }
  };

  // Handle revoking all sessions
  const handleRevokeAllSessions = () => {
    setIsRevokeAllDialogOpen(true);
  };

  // Confirm revoke all sessions
  const confirmRevokeAllSessions = () => {
    revokeAllMutation.mutate();
  };

  // Format date
  const formatDate = (dateString: string | Date) => {
    try {
      return format(new Date(dateString), "PPP - HH:mm", { locale: ar });
    } catch (e) {
      return "تاريخ غير صالح";
    }
  };

  return (
    <Card className="w-full" dir="rtl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">الجلسات</CardTitle>
        </div>
        <CardDescription>
          {isAdminMode
            ? "إدارة جلسات المستخدم (صلاحيات المشرف)"
            : "إدارة جلساتك الحالية"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-500">حدث خطأ أثناء تحميل الجلسات</p>
          </div>
        ) : sessions.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الجهاز</TableHead>
                <TableHead className="text-right">آخر استخدام</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center">
                      {getDeviceIcon(session.userAgent || "")}
                      <div>
                        <p className="text-sm">{session.ipAddress || "غير معروف"}</p>
                        <p className="text-xs text-muted-foreground">
                          {session.userAgent
                            ? session.userAgent.substring(0, 30) + "..."
                            : "غير معروف"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {formatDate(session.updatedAt || session.createdAt)}
                  </TableCell>
                  <TableCell>
                    {session.current ? (
                      <Badge className="bg-green-500">الجلسة الحالية</Badge>
                    ) : (
                      <Badge variant="outline">نشطة</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevokeSession(session.id)}
                      disabled={revokeMutation.isPending || session.current}
                    >
                      إنهاء الجلسة
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">لا توجد جلسات نشطة</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <div>
          {sessions.length > 0 && (
            <p className="text-sm text-muted-foreground">
              إجمالي الجلسات النشطة: {sessions.length}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {!isAdminMode && sessions.length > 1 && (
            <Button
              variant="outline"
              onClick={() => revokeOthersMutation.mutate()}
              disabled={revokeOthersMutation.isPending}
            >
              {revokeOthersMutation.isPending && (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              )}
              إنهاء الجلسات الأخرى
            </Button>
          )}
          {sessions.length > 0 && (
            <Button
              variant="destructive"
              onClick={handleRevokeAllSessions}
              disabled={revokeAllMutation.isPending}
            >
              {revokeAllMutation.isPending && (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              )}
              إنهاء جميع الجلسات
            </Button>
          )}
        </div>
      </CardFooter>

      {/* Revoke Session Dialog */}
      <AlertDialog
        open={!!sessionToRevoke}
        onOpenChange={(open) => !open && setSessionToRevoke(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد إنهاء الجلسة</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من رغبتك في إنهاء هذه الجلسة؟ سيتم تسجيل خروج المستخدم من هذا الجهاز.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse justify-start gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRevokeSession}
              className="bg-red-500 hover:bg-red-600"
            >
              {revokeMutation.isPending && (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              )}
              إنهاء الجلسة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke All Sessions Dialog */}
      <AlertDialog
        open={isRevokeAllDialogOpen}
        onOpenChange={setIsRevokeAllDialogOpen}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد إنهاء جميع الجلسات</AlertDialogTitle>
            <AlertDialogDescription>
              {isAdminMode
                ? "هل أنت متأكد من رغبتك في إنهاء جميع جلسات هذا المستخدم؟ سيتم تسجيل خروجه من جميع الأجهزة."
                : "هل أنت متأكد من رغبتك في إنهاء جميع جلساتك؟ سيتم تسجيل خروجك من جميع الأجهزة، بما في ذلك هذا الجهاز."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse justify-start gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRevokeAllSessions}
              className="bg-red-500 hover:bg-red-600"
            >
              {revokeAllMutation.isPending && (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              )}
              إنهاء جميع الجلسات
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default UserSessions;
