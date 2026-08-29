import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { AuthLayout } from '@/components/layout/AuthLayout'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { useLogin } from '@/lib/queries/auth'
import { type LoginInput, loginSchema } from '@/lib/schemas/auth'
import { usePageTitle } from '@/lib/usePageTitle'
import { isAdminRole } from '@/types/api'

export default function LoginPage() {
  usePageTitle('تسجيل الدخول', 'سجّل الدخول إلى حسابك في نسائم ليبيا')
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const login = useLogin()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  const onSubmit = handleSubmit(async (values) => {
    const user = await login.mutateAsync(values)
    // Only ever redirect to an in-app path — an open redirect here would be a
    // gift to a phisher.
    const next = params.get('next')
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      navigate(next, { replace: true })
    } else if (isAdminRole(user?.role)) {
      navigate('/admin', { replace: true })
    } else {
      navigate('/me', { replace: true })
    }
  })

  const serverMessage = login.error instanceof ApiError ? login.error.message : null

  return (
    <AuthLayout
      title="تسجيل الدخول"
      subtitle="أدخل رقم هاتفك وكلمة المرور للمتابعة"
      footer={
        <>
          ليس لديك حساب؟{' '}
          <Link to="/register" className="-my-3 inline-flex min-h-11 items-center py-3 font-medium text-primary underline-offset-4 hover:underline">
            أنشئ حساباً جديداً
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {serverMessage ? <Alert tone="error">{serverMessage}</Alert> : null}

        <Field id="phone" label="رقم الهاتف" error={errors.phone_number?.message} hint="مثال: 0912345678">
          {(field) => (
            <Input
              {...field}
              {...register('phone_number')}
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              dir="ltr"
              className="text-start font-mono"
              placeholder="0912345678"
            />
          )}
        </Field>

        <Field id="password" label="كلمة المرور" error={errors.password?.message}>
          {(field) => (
            <div className="relative">
              <Input
                {...field}
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="pe-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute end-0 top-0 flex h-full items-center px-3 text-muted-foreground hover:text-foreground focus:outline-hidden transition-colors"
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          )}
        </Field>

        <div className="flex justify-start">
          {/* -my-2 keeps the visual rhythm while the hit area reaches 44px. */}
          <Link
            to="/forgot-password"
            className="-my-2 inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            نسيت كلمة المرور؟
          </Link>
        </div>

        <Button type="submit" block size="lg" loading={isSubmitting || login.isPending}>
          تسجيل الدخول
        </Button>
      </form>
    </AuthLayout>
  )
}
