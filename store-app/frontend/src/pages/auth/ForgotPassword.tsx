import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'

import { AuthLayout } from '@/components/layout/AuthLayout'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { useConfirmPasswordReset, useRequestPasswordReset } from '@/lib/queries/auth'
import {
  type ResetConfirmInput,
  type ResetRequestInput,
  resetConfirmSchema,
  resetRequestSchema,
} from '@/lib/schemas/auth'
import { usePageTitle } from '@/lib/usePageTitle'

/**
 * Two steps on one route: ask for the code, then set the new password.
 *
 * The server answers the first step identically whether or not the number is
 * registered, so this screen must not imply otherwise — it always advances to
 * step two and always shows the same sentence.
 */
export default function ForgotPasswordPage() {
  usePageTitle('استعادة كلمة المرور', 'أعد تعيين كلمة مرور حسابك في نسائم ليبيا')
  const navigate = useNavigate()
  const [step, setStep] = useState<'request' | 'confirm'>('request')
  const [requestId, setRequestId] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const requestReset = useRequestPasswordReset()
  const confirmReset = useConfirmPasswordReset()

  const requestForm = useForm<ResetRequestInput>({ resolver: zodResolver(resetRequestSchema) })
  const confirmForm = useForm<ResetConfirmInput>({ resolver: zodResolver(resetConfirmSchema) })

  const onRequest = requestForm.handleSubmit(async (values) => {
    const data = await requestReset.mutateAsync(values)
    setRequestId(data.request_id)
    setStep('confirm')
  })

  const onConfirm = confirmForm.handleSubmit(async (values) => {
    if (!requestId) return
    await confirmReset.mutateAsync({ ...values, request_id: requestId })
    setDone(true)
    setTimeout(() => navigate('/login', { replace: true }), 1500)
  })

  const error =
    requestReset.error instanceof ApiError
      ? requestReset.error.message
      : confirmReset.error instanceof ApiError
        ? confirmReset.error.message
        : null

  return (
    <AuthLayout
      title="استعادة كلمة المرور"
      subtitle={
        step === 'request'
          ? 'أدخل رقم هاتفك وسنرسل لك رمز تحقق'
          : 'أدخل الرمز الذي وصلك واختر كلمة مرور جديدة'
      }
      footer={
        <Link to="/login" className="-my-3 inline-flex min-h-11 items-center py-3 font-medium text-primary underline-offset-4 hover:underline">
          العودة إلى تسجيل الدخول
        </Link>
      }
    >
      {done ? (
        <Alert tone="success">تم تغيير كلمة المرور. سيتم تحويلك إلى صفحة تسجيل الدخول…</Alert>
      ) : step === 'request' ? (
        <form onSubmit={onRequest} noValidate className="space-y-5">
          {error ? <Alert tone="error">{error}</Alert> : null}

          <Field
            id="reset-phone"
            label="رقم الهاتف"
            error={requestForm.formState.errors.phone_number?.message}
            hint="مثال: 0912345678"
          >
            {(field) => (
              <Input
                {...field}
                {...requestForm.register('phone_number')}
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                dir="ltr"
                className="text-start"
                placeholder="0912345678"
              />
            )}
          </Field>

          <Button type="submit" block size="lg" loading={requestReset.isPending}>
            إرسال رمز التحقق
          </Button>
        </form>
      ) : (
        <form onSubmit={onConfirm} noValidate className="space-y-5">
          <Alert tone="info">إذا كان الرقم مسجّلاً لدينا فسيصلك رمز التحقق برسالة نصية</Alert>
          {error ? <Alert tone="error">{error}</Alert> : null}

          <Field id="reset-code" label="رمز التحقق" error={confirmForm.formState.errors.code?.message}>
            {(field) => (
              <Input
                {...field}
                {...confirmForm.register('code')}
                inputMode="numeric"
                autoComplete="one-time-code"
                dir="ltr"
                className="text-start tracking-widest"
                placeholder="------"
              />
            )}
          </Field>

          <Field
            id="reset-password"
            label="كلمة المرور الجديدة"
            error={confirmForm.formState.errors.password?.message}
            hint="8 أحرف على الأقل، ولا تكون أرقاماً فقط"
          >
            {(field) => (
              <Input {...field} {...confirmForm.register('password')} type="password" autoComplete="new-password" />
            )}
          </Field>

          <Button type="submit" block size="lg" loading={confirmReset.isPending} disabled={!requestId}>
            تعيين كلمة المرور
          </Button>

          {!requestId ? (
            <p className="text-sm text-muted-foreground">
              لم نتمكّن من إرسال رمز إلى هذا الرقم. تأكّد من الرقم أو تواصل معنا.
            </p>
          ) : null}
        </form>
      )}
    </AuthLayout>
  )
}
