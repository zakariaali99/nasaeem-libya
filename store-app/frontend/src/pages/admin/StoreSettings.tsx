import { zodResolver } from '@hookform/resolvers/zod'
import {
  Building2,
  CheckCircle2,
  ExternalLink,
  Info,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { PageHeader } from '@/components/layout/AdminLayout'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TBody, TD, TH, THead, TR, TableWrapper } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { formatLibyanPhone, whatsappUrl } from '@/lib/format'
import {
  type BankAccountItem,
  useAdminStoreSettings,
  useBankAccounts,
  useCreateBankAccount,
  useDeleteBankAccount,
  useUpdateBankAccount,
  useUpdateStoreSettings,
} from '@/lib/queries/storeSettings'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'

const settingsSchema = z.object({
  store_name: z.string().min(2, 'اسم المتجر يجب أن يحتوي على حرفين على الأقل'),
  legal_name: z.string().optional(),
  legal_name_en: z.string().optional(),
  cr_number: z.string().optional(),
  address: z.string().optional(),
  site_url: z.string().url('رابط الموقع غير صحيح'),
  phone: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^(09[1-5]\d{7}|(\+?218|00218)?9[1-5]\d{7})$/.test(val.replace(/\s+/g, '')),
      'رقم الهاتف غير صحيح، مثال: 0912345678',
    ),
  whatsapp: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^(09[1-5]\d{7}|(\+?218|00218)?9[1-5]\d{7})$/.test(val.replace(/\s+/g, '')),
      'رقم الواتساب غير صحيح، مثال: 0912345678',
    ),
  email: z.string().email('البريد الإلكتروني غير صحيح').or(z.literal('')),
  bank_transfer_note: z.string().optional(),
})

type SettingsFormValues = z.infer<typeof settingsSchema>

const bankAccountSchema = z.object({
  bank_name: z.string().min(2, 'اسم المصرف مطلوب'),
  branch: z.string().optional(),
  account_holder: z.string().min(2, 'اسم المستفيد مطلوب'),
  account_number: z
    .string()
    .min(4, 'رقم الحساب مطلوب')
    .refine((val) => /^\d+$/.test(val.replace(/\s+/g, '')), 'رقم الحساب يجب أن يحتوي على أرقام فقط'),
  iban: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^LY\d{23}$/i.test(val.replace(/\s+/g, '')),
      'الآيبان يجب أن يبدأ بـ LY ويتكون من 25 خانة (مثال: LY88000100000000012345678)',
    ),
  is_active: z.boolean().default(true),
  sort_order: z.number().default(0),
})

type BankAccountFormValues = z.infer<typeof bankAccountSchema>

export default function AdminStoreSettingsPage() {
  usePageTitle('إعدادات المتجر — لوحة التحكم')
  const { data: settings, isLoading } = useAdminStoreSettings()
  const { data: bankAccounts = [], isLoading: loadingAccounts } = useBankAccounts()
  const updateSettings = useUpdateStoreSettings()
  const createAccount = useCreateBankAccount()
  const updateAccount = useUpdateBankAccount()
  const deleteAccount = useDeleteBankAccount()

  const [savedSuccess, setSavedSuccess] = useState(false)
  const [bankModalOpen, setBankModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<BankAccountItem | null>(null)
  const [pendingDeleteAccount, setPendingDeleteAccount] = useState<BankAccountItem | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    values: settings
      ? {
          store_name: settings.store_name || 'نسائم ليبيا',
          legal_name: settings.legal_name || '',
          legal_name_en: settings.legal_name_en || '',
          cr_number: settings.cr_number || '',
          address: settings.address || '',
          site_url: settings.site_url || 'https://nasaeem.ly',
          phone: settings.phone || '',
          whatsapp: settings.whatsapp || '',
          email: settings.email || '',
          bank_transfer_note: settings.bank_transfer_note || '',
        }
      : undefined,
  })

  const formValues = watch()

  const {
    register: registerBank,
    handleSubmit: handleSubmitBank,
    reset: resetBank,
    formState: { errors: bankErrors },
  } = useForm<BankAccountFormValues>({
    resolver: zodResolver(bankAccountSchema),
  })

  const onSaveSettings = async (values: SettingsFormValues) => {
    setSavedSuccess(false)
    await updateSettings.mutateAsync(values)
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 6000)
  }

  const openAddAccount = () => {
    setEditingAccount(null)
    resetBank({
      bank_name: '',
      branch: '',
      account_holder: settings?.legal_name || 'شركة نسائم ليبيا للتجارة العامة',
      account_number: '',
      iban: '',
      is_active: true,
      sort_order: bankAccounts.length,
    })
    setBankModalOpen(true)
  }

  const openEditAccount = (acc: BankAccountItem) => {
    setEditingAccount(acc)
    resetBank({
      bank_name: acc.bank_name,
      branch: acc.branch || '',
      account_holder: acc.account_holder,
      account_number: acc.account_number,
      iban: acc.iban || '',
      is_active: acc.is_active ?? true,
      sort_order: acc.sort_order ?? 0,
    })
    setBankModalOpen(true)
  }

  const onSaveBankAccount = async (values: BankAccountFormValues) => {
    if (editingAccount) {
      await updateAccount.mutateAsync({ id: editingAccount.id, ...values })
    } else {
      await createAccount.mutateAsync(values)
    }
    setBankModalOpen(false)
    setEditingAccount(null)
  }

  if (isLoading || loadingAccounts) {
    return (
      <div className="space-y-6 animate-fade-rise">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-rise max-w-6xl pb-16">
      <PageHeader
        title="إعدادات المتجر والبيانات المالية"
        description="التحكم الشامل في هوية المتجر، أرقام خدمة العملاء والواتساب، وعناوين الفواتير والحسابات المصرفية المعتمدة."
      />

      {savedSuccess && (
        <Alert tone="success" className="animate-fade-rise">
          <CheckCircle2 className="size-5" />
          <span>تم حفظ الإعدادات بنجاح — سيظهر التغيير في كل المتجر فوراً بدون إعادة نشر.</span>
        </Alert>
      )}

      {updateSettings.error && (
        <Alert tone="error">
          تعذّر حفظ الإعدادات: {String(updateSettings.error.message || 'يرجى مراجعة الحقول المدخلة')}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSaveSettings)} className="space-y-8">
        {/* Identity & Legal Info Card */}
        <section className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="border-b border-border/80 pb-4">
            <h2 className="text-base font-black text-foreground flex items-center gap-2">
              <Building2 className="size-5 text-primary" />
              هوية المتجر والبيانات الرسمية
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              تظهر هذه البيانات في الفواتير الرسمية، التذييل، وروابط التحقق والبريد.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field id="store_name" label="اسم المتجر التجاري *" error={errors.store_name?.message}>
              {(field) => <Input {...field} {...register('store_name')} placeholder="نسائم ليبيا" className="h-11 rounded-xl font-bold" />}
            </Field>

            <Field id="legal_name" label="الاسم القانوني للشركة (عربي)" hint="يظهر في الفواتير الرسمية" error={errors.legal_name?.message}>
              {(field) => (
                <Input
                  {...field}
                  {...register('legal_name')}
                  placeholder="شركة نسائم ليبيا لتجارة العطور ش.م.م"
                  className="h-11 rounded-xl"
                />
              )}
            </Field>

            <Field id="legal_name_en" label="الاسم القانوني (إنجليزي)" error={errors.legal_name_en?.message}>
              {(field) => (
                <Input
                  {...field}
                  {...register('legal_name_en')}
                  dir="ltr"
                  placeholder="NASAEEM LIBYA TRADING CO."
                  className="h-11 rounded-xl font-mono text-xs"
                />
              )}
            </Field>

            <Field id="cr_number" label="رقم السجل التجاري" hint="يظهر في ترويسة الفواتير" error={errors.cr_number?.message}>
              {(field) => (
                <Input
                  {...field}
                  {...register('cr_number')}
                  dir="ltr"
                  placeholder="2024/09812"
                  className="h-11 rounded-xl font-mono text-xs"
                />
              )}
            </Field>

            <Field id="address" label="العنوان والمدينة الرئيسية" error={errors.address?.message}>
              {(field) => (
                <Input
                  {...field}
                  {...register('address')}
                  placeholder="طرابلس — ليبيا"
                  className="h-11 rounded-xl"
                />
              )}
            </Field>

            <Field id="site_url" label="رابط الموقع الإلكتروني *" hint="يُستخدم في روابط التتبع والسلات" error={errors.site_url?.message}>
              {(field) => (
                <Input
                  {...field}
                  {...register('site_url')}
                  dir="ltr"
                  placeholder="https://nasaeem.ly"
                  className="h-11 rounded-xl font-mono text-xs"
                />
              )}
            </Field>
          </div>
        </section>

        {/* Contact & Support Numbers */}
        <section className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="border-b border-border/80 pb-4">
            <h2 className="text-base font-black text-foreground flex items-center gap-2">
              <Phone className="size-5 text-primary" />
              أرقام التواصل وخدمة العملاء
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              مصدر الحقيقة الوحيد لأرقام خدمة العملاء ورابط الواتساب بعد الطلبات.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              id="phone"
              label="هاتف خدمة العملاء"
              hint="صيغة ليبية: 0912345678"
              error={errors.phone?.message}
            >
              {(field) => (
                <Input
                  {...field}
                  {...register('phone')}
                  dir="ltr"
                  placeholder="0910000000"
                  className="h-11 rounded-xl font-mono font-bold text-sm"
                />
              )}
            </Field>

            <div className="space-y-1.5">
              <Field
                id="whatsapp"
                label="رقم واتساب خدمة العملاء والطلبات"
                hint="صيغة ليبية: 0915555555"
                error={errors.whatsapp?.message}
              >
                {(field) => (
                  <Input
                    {...field}
                    {...register('whatsapp')}
                    dir="ltr"
                    placeholder="0915555555"
                    className="h-11 rounded-xl font-mono font-bold text-sm"
                  />
                )}
              </Field>
              {formValues.whatsapp && (
                <div className="pt-1">
                  <a
                    href={whatsappUrl(formValues.whatsapp, 'تجربة رسالة الواتساب من لوحة التحكم')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    <MessageCircle className="size-3.5" />
                    <span>تجربة فتح محادثة الواتساب</span>
                    <ExternalLink className="size-3 rtl:rotate-180" />
                  </a>
                </div>
              )}
            </div>

            <Field id="email" label="البريد الإلكتروني للدعم" error={errors.email?.message}>
              {(field) => (
                <Input
                  {...field}
                  {...register('email')}
                  dir="ltr"
                  placeholder="support@nasaeem.ly"
                  className="h-11 rounded-xl font-mono text-xs"
                />
              )}
            </Field>
          </div>
        </section>

        {/* Bank Transfer Instructions Note */}
        <section className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-2xs space-y-4">
          <div className="border-b border-border/80 pb-3">
            <h2 className="text-base font-black text-foreground flex items-center gap-2">
              <Info className="size-5 text-primary" />
              ملاحظة وتعليمات التحويل المصرفي
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              تظهر هذه التعليمات للعميل في صفحة إتمام الطلب ورسالة الواتساب عند اختيار طريقة الدفع بالتحويل المصرفي.
            </p>
          </div>

          <Field id="bank_transfer_note" label="نص التعليمات (اختياري)" error={errors.bank_transfer_note?.message}>
            {(field) => (
              <Textarea
                {...field}
                {...register('bank_transfer_note')}
                rows={3}
                placeholder="يرجى كتابة رقم الطلب في خانة الغرض/الملاحظة عند إجراء التحويل المصرفي، ثم إرسال صورة الإشعار."
                className="rounded-2xl text-xs leading-relaxed"
              />
            )}
          </Field>
        </section>

        {/* Save Settings Bar */}
        <div className="flex items-center justify-between gap-4 rounded-3xl border border-primary/20 bg-primary/5 p-4 sm:p-6">
          <div>
            <h3 className="text-sm font-black text-foreground">حفظ التعديلات على إعدادات المتجر</h3>
            <p className="text-xs text-muted-foreground">يتم تحديث الكاش ونشر التغييرات على المتجر والواجهات فورياً.</p>
          </div>
          <Button
            type="submit"
            loading={updateSettings.isPending}
            className="rounded-2xl font-black px-8 h-12 gap-2 text-sm shadow-md"
          >
            <Save className="size-4" />
            <span>حفظ الإعدادات</span>
          </Button>
        </div>
      </form>

      {/* Bank Accounts Section */}
      <section className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
          <div>
            <h2 className="text-base font-black text-foreground flex items-center gap-2">
              <Building2 className="size-5 text-primary" />
              الحساب المصرفي
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              الحساب الذي يظهر للعملاء عند اختيار التحويل المصرفي. للمتجر حساب واحد، ويمكنك تعديله في أي وقت.
            </p>
          </div>
        </div>

        {bankAccounts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3">
            <Building2 className="size-10 text-muted-foreground mx-auto opacity-50" />
            <p className="text-sm font-bold text-foreground">لم يُضف حساب مصرفي بعد</p>
            <p className="text-xs text-muted-foreground">أضف الحساب ليتمكن العملاء من تحويل قيمة الطلبات.</p>
            <Button onClick={openAddAccount} variant="outline" className="rounded-xl font-bold mt-2">
              <Plus className="size-4 me-1" />
              إضافة الحساب المصرفي
            </Button>
          </div>
        ) : (
          <TableWrapper>
            <Table>
              <THead>
                <TR>
                  <TH>المصرف والفرع</TH>
                  <TH>اسم المستفيد</TH>
                  <TH>رقم الحساب</TH>
                  <TH>الآيبان الدولي (IBAN)</TH>
                  <TH className="text-center">الحالة</TH>
                  <TH className="text-end">الإجراءات</TH>
                </TR>
              </THead>
              <TBody>
                {bankAccounts.map((acc) => (
                  <TR key={acc.id} className="hover:bg-muted/20">
                    <TD className="font-bold text-foreground">
                      <div className="flex items-center gap-2">
                        <span>{acc.bank_name}</span>
                        {acc.branch && <span className="text-xs font-normal text-muted-foreground">({acc.branch})</span>}
                      </div>
                    </TD>
                    <TD className="text-xs font-medium text-foreground">{acc.account_holder}</TD>
                    <TD className="font-mono font-bold text-primary text-xs" dir="ltr">
                      {acc.account_number}
                    </TD>
                    <TD className="font-mono text-xs text-muted-foreground" dir="ltr">
                      {acc.iban || '—'}
                    </TD>
                    <TD className="text-center">
                      <button
                        type="button"
                        onClick={async () => {
                          await updateAccount.mutateAsync({ id: acc.id, is_active: !acc.is_active })
                        }}
                        className={cn(
                          'px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-colors',
                          acc.is_active
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20'
                            : 'bg-muted text-muted-foreground border-border hover:bg-muted/80',
                        )}
                      >
                        {acc.is_active ? 'مفعّل ويظهر للعميل' : 'معطل مؤقتاً'}
                      </button>
                    </TD>
                    <TD className="text-end">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditAccount(acc)}
                          className="size-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                          title="تعديل الحساب"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setPendingDeleteAccount(acc)}
                          className="size-8 p-0 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="حذف الحساب"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrapper>
        )}
      </section>

      {/* Live Preview Card */}
      <section className="rounded-3xl border border-border bg-muted/20 p-6 sm:p-8 space-y-6">
        <div>
          <h2 className="text-base font-black text-foreground flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            معاينة حية للمتجر وتجربة العميل
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            هكذا ستظهر بياناتك للعميل في صفحة إتمام الطلب وتذييل الموقع فور الحفظ.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Checkout Card Preview */}
          <div className="rounded-2xl border border-primary/20 bg-card p-5 space-y-3 shadow-2xs">
            <span className="text-[11px] font-bold text-primary block">معاينة بطاقة التحويل المصرفي في صفحة الطلب:</span>
            <div className="border-b border-border pb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">
                {bankAccounts.find((a) => a.is_active)?.bank_name || 'اسم المصرف'}
              </span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full font-bold">متاح للتحويل</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>المستفيد:</span>
                <span className="font-bold text-foreground">{bankAccounts.find((a) => a.is_active)?.account_holder || formValues.legal_name || 'اسم الشركة'}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>رقم الحساب:</span>
                <span className="font-mono font-bold text-primary">{bankAccounts.find((a) => a.is_active)?.account_number || '—'}</span>
              </div>
              {bankAccounts.find((a) => a.is_active)?.iban && (
                <div className="flex justify-between text-muted-foreground">
                  <span>الآيبان:</span>
                  <span className="font-mono text-xs font-bold text-primary" dir="ltr">{bankAccounts.find((a) => a.is_active)?.iban}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer Preview */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-2xs text-xs">
            <span className="text-[11px] font-bold text-muted-foreground block">معاينة التذييل:</span>
            <div className="space-y-2 text-muted-foreground">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-primary shrink-0" />
                <span>{formValues.address || '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="size-4 text-primary shrink-0" />
                <span dir="ltr">{formatLibyanPhone(formValues.phone) || '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="size-4 text-primary shrink-0" />
                <span dir="ltr">{formValues.email || '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Add / Edit Bank Account Dialog */}
      <Dialog open={bankModalOpen} onOpenChange={(open) => !open && setBankModalOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogTitle>{editingAccount ? 'تعديل بيانات الحساب المصرفي' : 'إضافة حساب مصرفي جديد'}</DialogTitle>
          <form onSubmit={handleSubmitBank(onSaveBankAccount)} className="space-y-4 mt-4">
            <Field id="bank_name" label="اسم المصرف *" error={bankErrors.bank_name?.message}>
              {(field) => <Input {...field} {...registerBank('bank_name')} placeholder="مثال: مصرف الجمهورية" className="h-10 rounded-xl font-bold text-xs" />}
            </Field>

            <Field id="branch" label="الفرع (اختياري)" error={bankErrors.branch?.message}>
              {(field) => <Input {...field} {...registerBank('branch')} placeholder="مثال: الفرع الرئيسي — طرابلس" className="h-10 rounded-xl text-xs" />}
            </Field>

            <Field id="account_holder" label="اسم المستفيد / الحساب *" error={bankErrors.account_holder?.message}>
              {(field) => <Input {...field} {...registerBank('account_holder')} placeholder="شركة نسائم ليبيا" className="h-10 rounded-xl font-bold text-xs" />}
            </Field>

            <Field id="account_number" label="رقم الحساب المصرفي *" hint="أرقام فقط" error={bankErrors.account_number?.message}>
              {(field) => <Input {...field} {...registerBank('account_number')} dir="ltr" placeholder="0123456789" className="h-10 rounded-xl font-mono font-bold text-xs" />}
            </Field>

            <Field id="iban" label="رقم الآيبان الدولي (IBAN)" hint="يبدأ بـ LY ويتكون من 25 خانة" error={bankErrors.iban?.message}>
              {(field) => <Input {...field} {...registerBank('iban')} dir="ltr" placeholder="LY88000100000000012345678" className="h-10 rounded-xl font-mono text-xs" />}
            </Field>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setBankModalOpen(false)} className="rounded-xl">
                إلغاء
              </Button>
              <Button type="submit" loading={createAccount.isPending || updateAccount.isPending} className="rounded-xl font-bold px-6">
                {editingAccount ? 'حفظ التعديلات' : 'إضافة الحساب'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Bank Account Confirmation Dialog */}
      <ConfirmDialog
        open={pendingDeleteAccount !== null}
        onOpenChange={(open) => !open && setPendingDeleteAccount(null)}
        title="حذف الحساب المصرفي"
        description={`هل أنت متأكد من حذف حساب «${pendingDeleteAccount?.bank_name}» (${pendingDeleteAccount?.account_number}) نهائياً؟`}
        confirmLabel="حذف نهائي"
        loading={deleteAccount.isPending}
        onConfirm={async () => {
          if (!pendingDeleteAccount) return
          await deleteAccount.mutateAsync(pendingDeleteAccount.id)
          setPendingDeleteAccount(null)
        }}
      />
    </div>
  )
}
