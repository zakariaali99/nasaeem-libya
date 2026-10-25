import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from '@/lib/i18nRouter'

import { AuthLayout } from '@/components/layout/AuthLayout'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { useRegister } from '@/lib/queries/auth'
import { type RegisterInput, registerSchema } from '@/lib/schemas/auth'
import { usePageTitle } from '@/lib/usePageTitle'
import { t } from '@/lib/i18n'

export default function RegisterPage() {
  usePageTitle(t('register.title'), t('register.metaDescription'))
  const navigate = useNavigate()
  const signUp = useRegister()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema()) })

  const onSubmit = handleSubmit(async (values) => {
    await signUp.mutateAsync(values)
    navigate('/me', { replace: true })
  })

  const apiError = signUp.error instanceof ApiError ? signUp.error : null
  const fieldErrors = apiError?.errors

  return (
    <AuthLayout
      title={t('register.title')}
      subtitle={t('register.subtitle')}
      footer={
        <>
          {t('register.haveAccount')}{' '}
          <Link to="/login" className="-my-3 inline-flex min-h-11 items-center py-3 font-medium text-primary underline-offset-4 hover:underline">
            {t('register.signIn')}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {apiError ? <Alert tone="error">{apiError.message}</Alert> : null}

        <Field id="name" label={t('register.name')} error={errors.name?.message ?? fieldErrors?.name?.[0]}>
          {(field) => <Input {...field} {...register('name')} autoComplete="name" />}
        </Field>

        <Field
          id="phone"
          label={t('login.phone')}
          error={errors.phone_number?.message ?? fieldErrors?.phone_number?.[0]}
          hint={t('register.phoneHint')}
        >
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

        <Field
          id="password"
          label={t('login.password')}
          error={errors.password?.message ?? fieldErrors?.password?.[0]}
          hint={t('register.passHint')}
        >
          {(field) => (
            <div className="relative">
              <Input
                {...field}
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className="pe-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute end-0 top-0 flex h-full items-center px-3 text-muted-foreground hover:text-foreground focus:outline-hidden transition-colors"
                aria-label={showPassword ? t('login.hidePass') : t('login.showPass')}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          )}
        </Field>

        <Button type="submit" block size="lg" loading={isSubmitting || signUp.isPending}>
          {t('register.submit')}
        </Button>
      </form>
    </AuthLayout>
  )
}
