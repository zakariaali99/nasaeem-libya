import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'

import { AuthLayout } from '@/components/layout/AuthLayout'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { useRegister } from '@/lib/queries/auth'
import { type RegisterInput, registerSchema } from '@/lib/schemas/auth'
import { usePageTitle } from '@/lib/usePageTitle'

export default function RegisterPage() {
  usePageTitle('إنشاء حساب', 'أنشئ حساباً جديداً في متجر نسائم ليبيا')
  const navigate = useNavigate()
  const signUp = useRegister()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) })

  const onSubmit = handleSubmit(async (values) => {
    await signUp.mutateAsync(values)
    navigate('/me', { replace: true })
  })

  const apiError = signUp.error instanceof ApiError ? signUp.error : null
  const fieldErrors = apiError?.errors

  return (
    <AuthLayout
      title="إنشاء حساب"
      subtitle="يكفي رقم هاتف وكلمة مرور للبدء"
      footer={
        <>
          لديك حساب بالفعل؟{' '}
          <Link to="/login" className="-my-3 inline-flex min-h-11 items-center py-3 font-medium text-primary underline-offset-4 hover:underline">
            سجّل الدخول
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {apiError ? <Alert tone="error">{apiError.message}</Alert> : null}

        <Field id="name" label="الاسم" error={errors.name?.message ?? fieldErrors?.name?.[0]}>
          {(field) => <Input {...field} {...register('name')} autoComplete="name" />}
        </Field>

        <Field
          id="phone"
          label="رقم الهاتف"
          error={errors.phone_number?.message ?? fieldErrors?.phone_number?.[0]}
          hint="سنستخدمه لتسجيل الدخول ولتتبّع طلباتك"
        >
          {(field) => (
            <Input
              {...field}
              {...register('phone_number')}
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              dir="ltr"
              className="text-start"
              placeholder="0912345678"
            />
          )}
        </Field>

        <Field
          id="password"
          label="كلمة المرور"
          error={errors.password?.message ?? fieldErrors?.password?.[0]}
          hint="8 أحرف على الأقل، ولا تكون أرقاماً فقط"
        >
          {(field) => <Input {...field} {...register('password')} type="password" autoComplete="new-password" />}
        </Field>

        <Button type="submit" block size="lg" loading={isSubmitting || signUp.isPending}>
          إنشاء الحساب
        </Button>
      </form>
    </AuthLayout>
  )
}
