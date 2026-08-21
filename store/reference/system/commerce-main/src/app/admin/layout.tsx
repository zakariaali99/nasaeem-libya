'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { LoaderIcon, ShieldXIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAppSession } from '@/components/providers/SessionProvider';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, isPending } = useAppSession();
  const router = useRouter();

  useEffect(() => {
    // If not loading and no session, redirect to login
    if (!isPending && !session) {
      router.push('/login?redirect=/admin');
      return;
    }

    // If session exists but user is not admin, redirect to home
    if (!isPending && session && session.user?.role !== 'admin') {
      router.push('/');
      return;
    }
  }, [session, isPending, router]);

  // Show loading state while checking authentication
  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <LoaderIcon className="mx-auto h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-gray-600">جاري التحقق من صلاحية الوصول...</p>
        </div>
      </div>
    );
  }

  // Show unauthorized message if not logged in
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full">
          <Alert variant="destructive">
            <ShieldXIcon className="h-4 w-4" />
            <AlertTitle>غير مصرح لك بالوصول</AlertTitle>
            <AlertDescription>
              يجب تسجيل الدخول للوصول إلى لوحة الإدارة.
            </AlertDescription>
          </Alert>
          <div className="mt-4 text-center">
            <Button onClick={() => router.push('/login?redirect=/admin')}>
              تسجيل الدخول
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show unauthorized message if not admin
  if (session.user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full">
          <Alert variant="destructive">
            <ShieldXIcon className="h-4 w-4" />
            <AlertTitle>غير مصرح لك بالوصول</AlertTitle>
            <AlertDescription>
              هذه الصفحة مخصصة للمديرين فقط. ليس لديك الصلاحيات المطلوبة للوصول إلى لوحة الإدارة.
            </AlertDescription>
          </Alert>
          <div className="mt-4 text-center">
            <Button variant="outline" onClick={() => router.push('/')}>
              العودة إلى الصفحة الرئيسية
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // If user is admin, render the children
  return <>{children}</>;
}
