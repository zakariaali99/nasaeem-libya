'use client'

import { useAppSession } from "@/components/providers/SessionProvider";
import React from "react";

const UserInfo: React.FC = () => {
  const { session } = useAppSession();

  return (
    <div className="p-4 bg-gray-50 rounded-md text-right">
      {session && session.user ? (
        <p>مرحباً، {session.user.name} {session.user.role}</p>
      ) : (
        <p>المستخدم غير مسجل الدخول</p>
      )}
    </div>
  );
};

export default UserInfo;
