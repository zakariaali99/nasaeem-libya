"use client"

import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ROLES, getRoleLabel } from "@/lib/rbac"
import { User } from "./columns"
import { Loader2 } from "lucide-react"

type DialogState = {
  open: boolean;
  user: User | null;
}

interface BanUserDialogProps {
  isOpen: boolean;
  user: User | null;
  isBanning: boolean;
  onClose: () => void;
  onConfirm: (userId: string, reason: string, duration: number | null) => void;
}

export function BanUserDialog({ isOpen, user, isBanning, onClose, onConfirm }: BanUserDialogProps) {
  const [reason, setReason] = useState<string>("سلوك غير مناسب");
  const [duration, setDuration] = useState<string>("7"); // in days

  const banDurations = [
    { value: "1", label: "يوم واحد" },
    { value: "3", label: "3 أيام" },
    { value: "7", label: "أسبوع" },
    { value: "30", label: "شهر" },
    { value: "0", label: "إلى الأبد" },
  ];

  const handleConfirm = () => {
    if (!user) return;

    // Convert days to seconds or null for permanent ban
    const durationInSeconds = duration === "0" ? null : parseInt(duration) * 24 * 60 * 60;
    onConfirm(user.id, reason, durationInSeconds);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent dir="rtl" className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>حظر المستخدم</DialogTitle>
          <DialogDescription>
            {user?.name ? `هل أنت متأكد أنك تريد حظر المستخدم "${user.name}"؟` : "هل أنت متأكد أنك تريد حظر هذا المستخدم؟"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="reason" className="text-right col-span-1">
              السبب
            </label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="col-span-3 w-full"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="duration" className="text-right col-span-1">
              المدة
            </label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger id="duration" className="col-span-3 w-full">
                <SelectValue placeholder="اختر مدة الحظر" />
              </SelectTrigger>
              <SelectContent>
                {banDurations.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="button" variant="destructive" onClick={handleConfirm} disabled={isBanning}>
            {isBanning ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                جاري التنفيذ...
              </>
            ) : (
              "حظر المستخدم"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteUserDialogProps {
  isOpen: boolean;
  user: User | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: (userId: string) => void;
}

export function DeleteUserDialog({ isOpen, user, isDeleting, onClose, onConfirm }: DeleteUserDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent dir="rtl" className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>حذف المستخدم</DialogTitle>
          <DialogDescription>
            {user?.name ? `هل أنت متأكد أنك تريد حذف المستخدم "${user.name}"؟ هذا الإجراء لا يمكن التراجع عنه.` : "هل أنت متأكد أنك تريد حذف هذا المستخدم؟ هذا الإجراء لا يمكن التراجع عنه."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="button" variant="destructive" onClick={() => user && onConfirm(user.id)} disabled={isDeleting}>
            {isDeleting ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                جاري التنفيذ...
              </>
            ) : (
              "حذف المستخدم"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ChangeRoleDialogProps {
  isOpen: boolean;
  user: User | null;
  isChanging: boolean;
  onClose: () => void;
  onConfirm: (userId: string, newRole: string) => void;
}

export function ChangeRoleDialog({ isOpen, user, isChanging, onClose, onConfirm }: ChangeRoleDialogProps) {
  const [selectedRole, setSelectedRole] = useState<string>("");

  // Initialize selected role when the dialog opens with a new user
  useEffect(() => {
    if (user) {
      setSelectedRole(user.role);
    }
  }, [user]);



  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent dir="rtl" className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>تغيير دور المستخدم</DialogTitle>
          <DialogDescription>
            {user?.name ? `تغيير دور المستخدم "${user.name}"` : "تغيير دور المستخدم"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="role" className="text-right col-span-1">
              الدور
            </label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger id="role" className="col-span-3 w-full">
                <SelectValue placeholder="اختر الدور" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(ROLES).map((role) => (
                  <SelectItem key={role} value={role}>
                    {getRoleLabel(role)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            type="button"
            onClick={() => user && onConfirm(user.id, selectedRole)}
            disabled={isChanging || !selectedRole || selectedRole === user?.role}
          >
            {isChanging ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                جاري التنفيذ...
              </>
            ) : (
              "تأكيد"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface UnbanUserDialogProps {
  isOpen: boolean;
  user: User | null;
  isUnbanning: boolean;
  onClose: () => void;
  onConfirm: (userId: string) => void;
}

export function UnbanUserDialog({ isOpen, user, isUnbanning, onClose, onConfirm }: UnbanUserDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent dir="rtl" className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>إلغاء حظر المستخدم</DialogTitle>
          <DialogDescription>
            {user?.name ? `هل أنت متأكد أنك تريد إلغاء حظر المستخدم "${user.name}"؟` : "هل أنت متأكد أنك تريد إلغاء حظر هذا المستخدم؟"}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="button" variant="destructive" onClick={() => user && onConfirm(user.id)} disabled={isUnbanning}>
            {isUnbanning ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                جاري التنفيذ...
              </>
            ) : (
              "إلغاء الحظر"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
