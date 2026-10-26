import { CheckCircle2, ChevronLeft, Eye, EyeOff, Heart, KeyRound, Lock, MapPin, Package, Pencil, User } from 'lucide-react'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@/lib/i18nRouter'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { api, ApiError } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { authKeys, useLogout, useMe } from '@/lib/queries/auth'
import { usePageTitle } from '@/lib/usePageTitle'
import { t } from '@/lib/i18n'

export default function AccountPage() {
  usePageTitle(t('account.title'), t('account.metaDescription'))
  const { data: user } = useMe()
  const logout = useLogout()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [editingProfile, setEditingProfile] = useState(false)
  const [profileName, setProfileName] = useState(user?.name || '')
  const [profileBirthday, setProfileBirthday] = useState(user?.birthday || '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [savingPass, setSavingPass] = useState(false)
  const [passError, setPassError] = useState<string | null>(null)
  const [passSuccess, setPassSuccess] = useState<string | null>(null)

  if (!user) return null

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      await api.patch('/auth/me/', {
        name: profileName.trim(),
        birthday: profileBirthday || null,
      })
      await queryClient.invalidateQueries({ queryKey: authKeys.me })
      setProfileSuccess(t('account.profileSaved'))
      setEditingProfile(false)
      setTimeout(() => setProfileSuccess(null), 4000)
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPassError(null)
    setPassSuccess(null)

    if (newPassword.length < 6) {
      setPassError(t('account.passTooShort'))
      return
    }

    if (newPassword !== confirmPassword) {
      setPassError(t('account.passMismatch'))
      return
    }

    setSavingPass(true)
    try {
      const res = await api.post<{ message: string }>('/me/change-password/', {
        current_password: currentPassword,
        new_password: newPassword,
      })
      setPassSuccess(res.data.message || t('account.passUpdated'))
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      if (err instanceof ApiError) {
        setPassError(err.message)
      } else {
        setPassError(t('account.passFailed'))
      }
    } finally {
      setSavingPass(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 p-4 sm:p-6 animate-fade-rise">
      <div className="flex items-center justify-between border-b border-border/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
            <User className="size-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">{t('account.heading')}</h1>
            <p className="text-xs text-muted-foreground">{t('account.subheading')}</p>
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
          {t('account.logout')}
        </Button>
      </div>

      {/* Where a customer actually wants to go from here. On a phone this page
          is the only way in: the bottom bar's «حسابي» lands here. */}
      <nav aria-label={t('account.links')} className="grid gap-3 sm:grid-cols-3">
        {[
          { to: '/me/orders', label: t('account.orders'), hint: t('account.ordersHint'), Icon: Package },
          { to: '/me/addresses', label: t('account.addresses'), hint: t('account.addressesHint'), Icon: MapPin },
          { to: '/wishlist', label: t('account.wishlist'), hint: t('account.wishlistHint'), Icon: Heart },
        ].map(({ to, label, hint, Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-foreground">{label}</span>
              <span className="block truncate text-xs text-muted-foreground">{hint}</span>
            </span>
            <ChevronLeft className="size-4 shrink-0 text-muted-foreground ltr:-scale-x-100" aria-hidden="true" />
          </Link>
        ))}
      </nav>

      {/* Basic Profile Data */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">{t('account.basics')}</h2>
          {!editingProfile && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setProfileName(user.name || '')
                setProfileBirthday(user.birthday || '')
                setEditingProfile(true)
              }}
              className="h-8 text-xs font-bold gap-1 text-primary hover:bg-primary/10 rounded-xl"
            >
              <Pencil className="size-3.5" />
              <span>{t('account.editProfile')}</span>
            </Button>
          )}
        </div>

        {profileSuccess && (
          <Alert tone="success">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
              <span>{profileSuccess}</span>
            </div>
          </Alert>
        )}

        {editingProfile ? (
          <form onSubmit={handleProfileSave} className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
            <Field label={t('account.name')} htmlFor="profile_name">
              <Input
                id="profile_name"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="اسمك الكريم..."
                className="h-11 rounded-xl text-xs"
              />
            </Field>

            <Field label={t('account.birthday')} htmlFor="profile_birthday" hint={t('account.birthdayHint')}>
              <Input
                id="profile_birthday"
                type="date"
                value={profileBirthday}
                onChange={(e) => setProfileBirthday(e.target.value)}
                className="h-11 rounded-xl text-xs font-mono"
              />
            </Field>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditingProfile(false)}
                className="h-9 rounded-xl text-xs"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                size="sm"
                loading={savingProfile}
                className="h-9 rounded-xl text-xs font-bold px-4"
              >
                حفظ التعديلات
              </Button>
            </div>
          </form>
        ) : (
          <dl className="divide-y divide-border rounded-2xl border border-border bg-card shadow-xs">
            {[
              [t('account.name'), user.name || t('account.nameFallback')],
              [t('account.phone'), user.phone_number],
              [t('account.birthday'), user.birthday || '—'],
              [t('account.joined'), formatDate(user.date_joined)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 p-4 text-xs sm:text-sm">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-bold text-foreground font-mono">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {/* Account Security & Password Change */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-2.5 border-b border-border/80 pb-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <KeyRound className="size-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-foreground">{t('account.security')}</h2>
            <p className="text-xs text-muted-foreground">{t('account.securityText')}</p>
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
          <Field label={t('account.currentPass')} htmlFor="current_pass" hint={t('account.currentPassHint')}>
            <div className="relative">
              <Input
                id="current_pass"
                type={showPass ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t('account.currentPassPlaceholder')}
                className="h-11 rounded-xl text-xs pe-11 font-mono"
                required
              />
              <button
                type="button"
                onClick={() => setShowPass((p) => !p)}
                className="absolute end-0 top-0 flex h-full items-center px-3 text-muted-foreground hover:text-foreground"
                aria-label={showPass ? t('account.hide') : t('account.show')}
              >
                {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('account.newPass')} htmlFor="new_pass">
              <Input
                id="new_pass"
                type={showPass ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('account.newPassPlaceholder')}
                className="h-11 rounded-xl text-xs font-mono"
                required
              />
            </Field>

            <Field label={t('account.confirmPass')} htmlFor="confirm_pass">
              <Input
                id="confirm_pass"
                type={showPass ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('account.confirmPassPlaceholder')}
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
            <span>{t('account.savePass')}</span>
          </Button>
        </form>
      </section>
    </div>
  )
}
