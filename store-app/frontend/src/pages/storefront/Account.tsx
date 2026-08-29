import { CheckCircle2, Eye, EyeOff, KeyRound, Lock, User } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { api, ApiError } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { useLogout, useMe } from '@/lib/queries/auth'
import { usePageTitle } from '@/lib/usePageTitle'

export default function AccountPage() {
  usePageTitle('حسابي — نسائم ليبيا', 'إدارة حسابك وأمان كلمة المرور')
  const { data: user } = useMe()
  const logout = useLogout()
  const navigate = useNavigate()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [savingPass, setSavingPass] = useState(false)
  const [passError, setPassError] = useState<string | null>(null)
  const [passSuccess, setPassSuccess] = useState<string | null>(null)

  if (!user) return null

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPassError(null)
    setPassSuccess(null)

    if (newPassword.length < 6) {
      setPassError('كلمة المرور الجديدة يجب أن تكون 6 أحرف أو أرقام على الأقل')
      return
    }

    if (newPassword !== confirmPassword) {
      setPassError('كلمة المرور الجديدة وتأكيدها غير متطابقين')
      return
    }

    setSavingPass(true)
    try {
      const res = await api.post<{ message: string }>('/me/change-password/', {
        current_password: currentPassword,
        new_password: newPassword,
      })
      setPassSuccess(res.data.message || 'تم تحديث كلمة المرور بنجاح')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      if (err instanceof ApiError) {
        setPassError(err.message)
      } else {
        setPassError('تعذّر تغيير كلمة المرور، يرجى التأكد من كلمة المرور الحالية')
      }
    } finally {
      setSavingPass(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 p-4 sm:p-6 animate-fade-rise">
      <div className="flex items-center justify-between border-b border-border/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
            <User className="size-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">الملف الشخصي والحساب</h1>
            <p className="text-xs text-muted-foreground">إدارة بيانات التواصل وتغيير كلمة المرور</p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          loading={logout.isPending}
          onClick={async () => {
            await logout.mutateAsync()
            navigate('/', { replace: true })
          }}
          className="rounded-xl text-xs font-bold"
        >
          تسجيل الخروج
        </Button>
      </div>

      {/* Basic Profile Data */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-foreground">بيانات الحساب الأساسية</h2>
        <dl className="divide-y divide-border rounded-2xl border border-border bg-card shadow-xs">
          {[
            ['الاسم الكريم', user.name || 'عميل نسائم ليبيا'],
            ['رقم الهاتف المسجل', user.phone_number],
            ['تاريخ الانضمام للمتجر', formatDate(user.date_joined)],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 p-4 text-xs sm:text-sm">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-bold text-foreground font-mono">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Account Security & Password Change */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-2.5 border-b border-border/80 pb-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <KeyRound className="size-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-foreground">أمان الحساب وكلمة المرور</h2>
            <p className="text-xs text-muted-foreground">يمكنك تعيين كلمة مرور مخصصة لحسابك في أي وقت</p>
          </div>
        </div>

        {passSuccess && (
          <Alert tone="success">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
              <span>{passSuccess}</span>
            </div>
          </Alert>
        )}

        {passError && <Alert tone="error">{passError}</Alert>}

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <Field label="كلمة المرور الحالية" htmlFor="current_pass" hint="إذا تم إنشاء حسابك تلقائياً عند الشراء، فكلمة مرورك هي 000000">
            <div className="relative">
              <Input
                id="current_pass"
                type={showPass ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="أدخل كلمة المرور الحالية..."
                className="h-11 rounded-xl text-xs pe-11 font-mono"
                required
              />
              <button
                type="button"
                onClick={() => setShowPass((p) => !p)}
                className="absolute end-0 top-0 flex h-full items-center px-3 text-muted-foreground hover:text-foreground"
                aria-label={showPass ? 'إخفاء' : 'إظهار'}
              >
                {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="كلمة المرور الجديدة" htmlFor="new_pass">
              <Input
                id="new_pass"
                type={showPass ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="6 خانات أو أكثر..."
                className="h-11 rounded-xl text-xs font-mono"
                required
              />
            </Field>

            <Field label="تأكيد كلمة المرور الجديدة" htmlFor="confirm_pass">
              <Input
                id="confirm_pass"
                type={showPass ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="أعد كتابة كلمة المرور..."
                className="h-11 rounded-xl text-xs font-mono"
                required
              />
            </Field>
          </div>

          <Button
            type="submit"
            loading={savingPass}
            className="rounded-xl text-xs font-bold h-11 px-6 gap-2"
          >
            <Lock className="size-3.5" />
            <span>حفظ وتحديث كلمة المرور</span>
          </Button>
        </form>
      </section>
    </main>
  )
}
