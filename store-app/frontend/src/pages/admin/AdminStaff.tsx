import {
  CheckCircle2,
  KeyRound,
  Search,
  Shield,
  Trash2,
  UserCog,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react'
import { useState } from 'react'

import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { PageHeader } from '@/components/layout/AdminLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useCreateStaff,
  useDeleteStaff,
  useStaffList,
  useUpdateStaff,
} from '@/lib/queries/staff'
import { usePageTitle } from '@/lib/usePageTitle'
import type { Role, User } from '@/types/api'

const ROLE_CONFIG: Record<
  string,
  { label: string; tone: 'primary' | 'success' | 'warning' | 'neutral' | 'danger'; desc: string }
> = {
  owner: { label: 'مالك النظام 👑', tone: 'primary', desc: 'صلاحيات مطلقة للنظام والإعدادات المالية' },
  admin: { label: 'مدير نظام', tone: 'primary', desc: 'إدارة شاملة للمتجر والنسخ الاحتياطي والموظفين' },
  manager: { label: 'مشرف عمليات', tone: 'neutral', desc: 'إدارة المنتجات والتصنيفات والطلبات والمخزون' },
  staff: { label: 'مسؤول مخزن وعمليات', tone: 'success', desc: 'معالجة وتجهيز الطلبات وبوالص الشحن' },
  support: { label: 'خدمة عملاء ومبيعات', tone: 'warning', desc: 'متابعة المحادثات والطلبات الهاتفية والواتساب' },
}

export default function AdminStaff() {
  usePageTitle('إدارة فريق العمل والموظفين — لوحة التحكم')

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<User | null>(null)
  const [resettingPasswordStaff, setResettingPasswordStaff] = useState<User | null>(null)
  const [pendingDelete, setPendingDelete] = useState<User | null>(null)

  const { data, isPending, refetch } = useStaffList({
    search: search || undefined,
    role: roleFilter || undefined,
  })

  const createStaff = useCreateStaff()
  const deleteStaff = useDeleteStaff()

  // New staff form state
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'manager' | 'staff' | 'support'>('staff')
  const [newPassword, setNewPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!newName.trim() || !newPhone.trim() || !newPassword.trim()) {
      setFormError('الاسم ورقم الهاتف وكلمة المرور مطلوبة.')
      return
    }

    try {
      await createStaff.mutateAsync({
        name: newName.trim(),
        phone_number: newPhone.trim(),
        email: newEmail.trim() || undefined,
        role: newRole,
        password: newPassword.trim(),
      })
      setIsCreateOpen(false)
      setNewName('')
      setNewPhone('')
      setNewEmail('')
      setNewPassword('')
      refetch()
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'حدث خطأ أثناء إنشاء حساب الموظف.'
      setFormError(errorMsg)
    }
  }

  const staffMembers = data?.items ?? []

  return (
    <div className="space-y-6 animate-fade-rise">
      <PageHeader
        title="إدارة فريق العمل والموظفين"
        description="إضافة وتعديل حسابات الموظفين، تعيين الصلاحيات والأدوار الإدارية، وإدارة كلمات المرور."
        action={
          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="h-10 rounded-xl font-bold shadow-xs gap-1.5 px-4"
          >
            <UserPlus className="size-4" />
            <span>إضافة موظف جديد</span>
          </Button>
        }
      />

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-2xs">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute start-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو رقم الهاتف..."
            className="h-9 ps-9 text-xs rounded-xl"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-9 text-xs rounded-xl"
          >
            <option value="">كافة الأدوار الإدارية</option>
            <option value="admin">مدراء النظام (Admin)</option>
            <option value="manager">مشرفو العمليات (Manager)</option>
            <option value="staff">مسؤولو المخزن والشحن (Staff)</option>
            <option value="support">خدمة العملاء والمبيعات (Support)</option>
          </Select>
        </div>
      </div>

      {/* Staff Table */}
      <div className="rounded-3xl border border-border bg-card shadow-xs overflow-hidden">
        {isPending ? (
          <div className="p-6 space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 rounded-2xl" />
            ))}
          </div>
        ) : staffMembers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="flex size-14 mx-auto items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Users className="size-7" />
            </div>
            <h3 className="font-bold text-foreground text-sm">لا يوجد موظفون مطابقون</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              يمكنك إضافة موظفين جدد ومنحهم الصلاحيات المناسبة لإدارة المتجر.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground text-start font-bold">
                  <th className="py-3.5 px-5 text-start">الموظف</th>
                  <th className="py-3.5 px-4 text-start">الدور الإداري والصلاحية</th>
                  <th className="py-3.5 px-4 text-center">حالة الحساب</th>
                  <th className="py-3.5 px-4 text-center">تاريخ الانضمام</th>
                  <th className="py-3.5 px-5 text-end">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {staffMembers.map((member) => {
                  const roleInfo = ROLE_CONFIG[member.role] || {
                    label: member.role,
                    tone: 'neutral',
                    desc: '',
                  }

                  return (
                    <StaffTableRow
                      key={member.id}
                      member={member}
                      roleInfo={roleInfo}
                      onEdit={() => setEditingStaff(member)}
                      onResetPassword={() => setResettingPasswordStaff(member)}
                      onDelete={() => setPendingDelete(member)}
                      onRefresh={refetch}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Staff Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md p-6">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <UserPlus className="size-5 text-primary" />
            <span>إضافة موظف جديد للنظام</span>
          </DialogTitle>

          {formError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive font-semibold">
              {formError}
            </div>
          )}

          <form onSubmit={handleCreateSubmit} className="space-y-4 mt-3">
            <Field label="اسم الموظف الثلاثي *" id="staff-name">
              {(props) => (
                <Input
                  {...props}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="مثال: عمر الصادق الترهوني"
                  required
                  className="rounded-xl h-10 text-xs"
                />
              )}
            </Field>

            <Field label="رقم الهاتف الليبي *" id="staff-phone">
              {(props) => (
                <Input
                  {...props}
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="0912345678"
                  dir="ltr"
                  required
                  className="rounded-xl h-10 text-xs font-mono"
                />
              )}
            </Field>

            <Field label="البريد الإلكتروني (اختياري)" id="staff-email">
              {(props) => (
                <Input
                  {...props}
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="staff@nasaeemlibya.ly"
                  dir="ltr"
                  className="rounded-xl h-10 text-xs font-mono"
                />
              )}
            </Field>

            <Field label="الدور الإداري والصلاحية *" id="staff-role">
              {(props) => (
                <Select
                  {...props}
                  value={newRole}
                  onChange={(e) =>
                    setNewRole(e.target.value as 'admin' | 'manager' | 'staff' | 'support')
                  }
                  className="rounded-xl h-10 text-xs"
                >
                  <option value="admin">مدير نظام (Admin) — وصول كامل</option>
                  <option value="manager">مشرف عمليات (Manager) — إدارة المنتجات والطلبات</option>
                  <option value="staff">مسؤول مخزن وشحن (Staff) — إدارة الطلبات والبوالص</option>
                  <option value="support">خدمة عملاء ومبيعات (Support) — المحادثات والطلبات الهاتفية</option>
                </Select>
              )}
            </Field>

            <Field label="كلمة المرور المؤقتة *" id="staff-password">
              {(props) => (
                <Input
                  {...props}
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="أدخل كلمة مرور آمنة من 8 خانات على الأقل"
                  required
                  className="rounded-xl h-10 text-xs font-mono"
                />
              )}
            </Field>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-xl h-10 text-xs"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                loading={createStaff.isPending}
                className="rounded-xl h-10 font-bold text-xs px-5"
              >
                حفظ وإصدار الحساب
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Staff Dialog */}
      {editingStaff && (
        <EditStaffDialog
          staff={editingStaff}
          onClose={() => setEditingStaff(null)}
          onSuccess={() => {
            setEditingStaff(null)
            refetch()
          }}
        />
      )}

      {/* Reset Password Dialog */}
      {resettingPasswordStaff && (
        <ResetPasswordDialog
          staff={resettingPasswordStaff}
          onClose={() => setResettingPasswordStaff(null)}
          onSuccess={() => {
            setResettingPasswordStaff(null)
            refetch()
          }}
        />
      )}

      {/* Delete / Revoke Confirmation */}
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="سحب الصلاحيات الإدارية"
        description={`هل أنت متأكد من سحب الصلاحيات الإدارية وإيقاف حساب الموظف «${pendingDelete?.name || pendingDelete?.phone_number}»؟`}
        confirmLabel="تأكيد سحب الصلاحية"
        loading={deleteStaff.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return
          await deleteStaff.mutateAsync(pendingDelete.id)
          setPendingDelete(null)
          refetch()
        }}
      />
    </div>
  )
}

function StaffTableRow({
  member,
  roleInfo,
  onEdit,
  onResetPassword,
  onDelete,
  onRefresh,
}: {
  member: User
  roleInfo: { label: string; tone: 'primary' | 'success' | 'warning' | 'neutral' | 'danger'; desc: string }
  onEdit: () => void
  onResetPassword: () => void
  onDelete: () => void
  onRefresh: () => void
}) {
  const update = useUpdateStaff(member.id)

  const toggleActive = async () => {
    await update.mutateAsync({ is_active: !member.is_active })
    onRefresh()
  }

  return (
    <tr className="hover:bg-muted/20 transition-colors">
      <td className="py-4 px-5">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">
            {member.name ? member.name.charAt(0) : <Shield className="size-4" />}
          </div>
          <div className="min-w-0">
            <span className="font-bold text-foreground block truncate">
              {member.name || 'موظف بدون اسم'}
            </span>
            <span className="text-[11px] text-muted-foreground font-mono block">
              {member.phone_number}
            </span>
            {member.email && (
              <span className="text-[10px] text-muted-foreground/80 font-mono block">
                {member.email}
              </span>
            )}
          </div>
        </div>
      </td>

      <td className="py-4 px-4 text-start">
        <div className="space-y-0.5">
          <Badge tone={roleInfo.tone} className="text-xs font-bold">
            {roleInfo.label}
          </Badge>
          <p className="text-[10px] text-muted-foreground">{roleInfo.desc}</p>
        </div>
      </td>

      <td className="py-4 px-4 text-center">
        {member.is_active ? (
          <Badge tone="success" className="text-[11px] font-semibold gap-1">
            <CheckCircle2 className="size-3" />
            <span>نشط ومفعل</span>
          </Badge>
        ) : (
          <Badge tone="danger" className="text-[11px] font-semibold gap-1">
            <UserX className="size-3" />
            <span>مجمّد / معطل</span>
          </Badge>
        )}
      </td>

      <td className="py-4 px-4 text-center font-mono text-muted-foreground">
        {new Date(member.date_joined).toLocaleDateString('ar-LY', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </td>

      <td className="py-4 px-5 text-end">
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={onEdit}
            className="h-8 rounded-xl font-bold text-xs gap-1 border-border"
            title="تعديل بيانات وصلاحية الموظف"
          >
            <UserCog className="size-3.5" />
            <span>تعديل</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onResetPassword}
            className="h-8 rounded-xl font-bold text-xs gap-1 border-border"
            title="إعادة تعيين كلمة المرور"
          >
            <KeyRound className="size-3.5" />
            <span>كلمة المرور</span>
          </Button>

          <Button
            size="sm"
            variant={member.is_active ? 'outline' : 'secondary'}
            onClick={toggleActive}
            loading={update.isPending}
            className="h-8 rounded-xl font-bold text-xs"
            title={member.is_active ? 'تجميد الحساب' : 'تفعيل الحساب'}
          >
            {member.is_active ? 'تجميد' : 'تفعيل'}
          </Button>

          {member.role !== 'owner' && (
            <Button
              variant="outline"
              size="icon"
              className="size-8 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 border-border"
              onClick={onDelete}
              title="سحب الصلاحيات الإدارية"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}

function EditStaffDialog({
  staff,
  onClose,
  onSuccess,
}: {
  staff: User
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState(staff.name || '')
  const [email, setEmail] = useState(staff.email || '')
  const [role, setRole] = useState(staff.role)
  const [isActive, setIsActive] = useState(staff.is_active)
  const [error, setError] = useState<string | null>(null)

  const update = useUpdateStaff(staff.id)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await update.mutateAsync({
        name: name.trim(),
        email: email.trim() || undefined,
        role: role as 'admin' | 'manager' | 'staff' | 'support',
        is_active: isActive,
      })
      onSuccess()
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'فشل تحديث بيانات الموظف.'
      setError(errorMsg)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md p-6">
        <DialogTitle className="text-base font-bold flex items-center gap-2">
          <UserCog className="size-5 text-primary" />
          <span>تعديل بيانات وصلاحية الموظف</span>
        </DialogTitle>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-3">
          <Field label="اسم الموظف" id="edit-name">
            {(props) => (
              <Input
                {...props}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="rounded-xl h-10 text-xs"
              />
            )}
          </Field>

          <Field label="البريد الإلكتروني" id="edit-email">
            {(props) => (
              <Input
                {...props}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                dir="ltr"
                className="rounded-xl h-10 text-xs font-mono"
              />
            )}
          </Field>

          <Field label="الدور الإداري" id="edit-role">
            {(props) => (
              <Select
                {...props}
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="rounded-xl h-10 text-xs"
              >
                <option value="admin">مدير نظام (Admin) — وصول كامل</option>
                <option value="manager">مشرف عمليات (Manager) — إدارة المنتجات والطلبات</option>
                <option value="staff">مسؤول مخزن وشحن (Staff) — إدارة الطلبات والبوالص</option>
                <option value="support">خدمة عملاء ومبيعات (Support) — المحادثات والطلبات</option>
              </Select>
            )}
          </Field>

          <div className="rounded-xl bg-muted/30 p-3 border border-border">
            <label className="flex items-center gap-2.5 text-xs font-bold text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span>حساب الموظف نشط ومفعل</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl h-10 text-xs">
              إلغاء
            </Button>
            <Button type="submit" loading={update.isPending} className="rounded-xl h-10 font-bold text-xs px-5">
              حفظ التعديلات
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordDialog({
  staff,
  onClose,
  onSuccess,
}: {
  staff: User
  onClose: () => void
  onSuccess: () => void
}) {
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const update = useUpdateStaff(staff.id)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (newPassword.trim().length < 6) {
      setError('يجب أن تتكون كلمة المرور من 6 خانات على الأقل.')
      return
    }

    try {
      await update.mutateAsync({
        password: newPassword.trim(),
      })
      onSuccess()
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'فشل تعيين كلمة المرور الجديدة.'
      setError(errorMsg)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md p-6">
        <DialogTitle className="text-base font-bold flex items-center gap-2">
          <KeyRound className="size-5 text-primary" />
          <span>إعادة تعيين كلمة مرور الموظف</span>
        </DialogTitle>

        <p className="text-xs text-muted-foreground mt-1">
          تعيين كلمة مرور جديدة للموظف: <strong className="text-foreground">{staff.name || staff.phone_number}</strong>
        </p>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive font-semibold mt-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-3">
          <Field label="كلمة المرور الجديدة *" id="reset-password">
            {(props) => (
              <Input
                {...props}
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="أدخل كلمة المرور الجديدة..."
                required
                autoFocus
                className="rounded-xl h-10 text-xs font-mono"
              />
            )}
          </Field>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl h-10 text-xs">
              إلغاء
            </Button>
            <Button type="submit" loading={update.isPending} className="rounded-xl h-10 font-bold text-xs px-5">
              تغيير كلمة المرور
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
