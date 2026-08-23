import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/AdminLayout'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useAdminPaymentMethod, useUpdateAdminPaymentMethod } from '@/lib/queries/payments'
import { usePageTitle } from '@/lib/usePageTitle'

export default function PaymentMethodConfigPage() {
  const { methodCode } = useParams<{ methodCode: string }>()
  const navigate = useNavigate()
  usePageTitle('إعدادات طريقة الدفع — لوحة التحكم')

  const { data: method, isLoading, isError } = useAdminPaymentMethod(methodCode)
  const update = useUpdateAdminPaymentMethod()

  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [isEnabled, setIsEnabled] = useState(false)
  const [sortOrder, setSortOrder] = useState('0')

  // Common and gateway-specific fields
  const [merchantId, setMerchantId] = useState('')
  const [terminalId, setTerminalId] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [isTestMode, setIsTestMode] = useState(false)
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [bankName, setBankName] = useState('')
  const [instructions, setInstructions] = useState('')
  const [savedSuccess, setSavedSuccess] = useState(false)

  useEffect(() => {
    if (method) {
      setDisplayName(method.display_name || '')
      setDescription(method.description || '')
      setIsEnabled(method.is_enabled)
      setSortOrder(String(method.sort_order ?? 0))

      const config = method.config_data || {}
      setMerchantId(config.merchantId || config.merchant_id || '')
      setTerminalId(config.terminalId || config.terminal_id || '')
      setSecretKey(config.secureKey || config.secret_key || '')
      setApiKey(config.apiKey || config.api_key || '')
      setIsTestMode(Boolean(config.sandboxMode || config.test_mode))
      setAccountName(config.accountName || '')
      setAccountNumber(config.accountNumber || '')
      setBankName(config.bankName || '')
      setInstructions(config.instructionsAr || '')
    }
  }, [method])

  if (isLoading) {
    return <Skeleton className="h-96 w-full max-w-2xl" />
  }

  if (isError || !method) {
    return (
      <div className="space-y-4">
        <Alert tone="error">طريقة الدفع المطلوبة غير موجودة.</Alert>
        <Button asChild variant="outline">
          <Link to="/admin/payment_methods">العودة لطرق الدفع</Link>
        </Button>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavedSuccess(false)

    /*
     * Key names here are CONTRACT, not style: the gateway providers read
     * camelCase (`MoamalatGateway.initiate` reads `merchantId`, `secureKey`,
     * `sandboxMode`; the manual gateways read `instructionsAr`). Saving
     * snake_case here used to produce a config the gateway could not read —
     * checkout initiation then failed with "إعدادات غير مكتملة".
     */
    const config_data: Record<string, any> = {
      ...(merchantId ? { merchantId } : {}),
      ...(terminalId ? { terminalId } : {}),
      ...(secretKey ? { secureKey: secretKey } : {}),
      ...(apiKey ? { apiKey } : {}),
      sandboxMode: isTestMode,
      ...(accountName ? { accountName } : {}),
      ...(accountNumber ? { accountNumber } : {}),
      ...(bankName ? { bankName } : {}),
      ...(instructions ? { instructionsAr: instructions } : {}),
    }

    try {
      await update.mutateAsync({
        methodCode: method.method_code,
        data: {
          display_name: displayName,
          description,
          is_enabled: isEnabled,
          sort_order: Number(sortOrder) || 0,
          config_data,
        },
      })
      setSavedSuccess(true)
    } catch {
      // Handled by mutation error state
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title={`إعدادات: ${method.display_name}`}
        description={`إدارة المفاتيح السرية وبيانات الربط لطريقة الدفع (${method.method_code}).`}
        actions={
          <Button asChild variant="outline">
            <Link to="/admin/payment_methods">العودة لطرق الدفع</Link>
          </Button>
        }
      />

      {savedSuccess && <Alert tone="success">تم حفظ إعدادات طريقة الدفع بنجاح.</Alert>}
      {update.isError && <Alert tone="error">حدث خطأ أثناء حفظ الإعدادات، يرجى مراجعة الحقول.</Alert>}

      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-border bg-card p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Checkbox
              id="isEnabled"
              checked={isEnabled}
              onCheckedChange={(checked) => setIsEnabled(Boolean(checked))}
            />
            <label htmlFor="isEnabled" className="cursor-pointer text-sm font-medium text-foreground">
              تفعيل هذه الطريقة وإظهارها للعملاء في صفحة إتمام الطلب
            </label>
          </div>

          <Field label="الاسم المعروض للعميل" htmlFor="displayName">
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </Field>

          <Field label="الوصف التوضيحي للعميل" htmlFor="description">
            <Textarea
              id="description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مثال: الدفع الآمن والمباشر عبر بطاقتك المصرفية المحلية"
            />
          </Field>

          <Field label="ترتيب العرض (الأصغر يظهر أولاً)" htmlFor="sortOrder">
            <Input
              id="sortOrder"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </Field>

          {/* Moamalat specific config */}
          {method.method_code === 'moamalat' && (
            <div className="space-y-4 border-t border-border pt-4">
              <h3 className="font-semibold text-foreground">إعدادات بوابة معاملات (Moamalat Gateway)</h3>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="isTestMode"
                  checked={isTestMode}
                  onCheckedChange={(checked) => setIsTestMode(Boolean(checked))}
                />
                <label htmlFor="isTestMode" className="cursor-pointer text-sm font-medium text-foreground">
                  تفعيل البيئة التجريبية (Sandbox / Test Mode)
                </label>
              </div>

              <Field label="معرّف التاجر (Merchant ID)" htmlFor="merchantId">
                <Input
                  id="merchantId"
                  value={merchantId}
                  onChange={(e) => setMerchantId(e.target.value)}
                  placeholder="مثال: 1005432"
                  dir="ltr"
                />
              </Field>

              <Field label="معرّف نقطة البيع (Terminal ID)" htmlFor="terminalId">
                <Input
                  id="terminalId"
                  value={terminalId}
                  onChange={(e) => setTerminalId(e.target.value)}
                  placeholder="مثال: 2005432"
                  dir="ltr"
                />
              </Field>

              <Field label="المفتاح السري (Secret Key / Secure Hash Key)" htmlFor="secretKey">
                <Input
                  id="secretKey"
                  type="password"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  placeholder="••••••••••••••••"
                  dir="ltr"
                />
              </Field>
            </div>
          )}

          {/* Plutu or Sadad or Binance config */}
          {(method.method_code === 'plutu' || method.method_code === 'sadad_pay' || method.method_code === 'binance_pay') && (
            <div className="space-y-4 border-t border-border pt-4">
              <h3 className="font-semibold text-foreground">بيانات اعتماد البوابة الإلكترونية</h3>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="isTestMode"
                  checked={isTestMode}
                  onCheckedChange={(checked) => setIsTestMode(Boolean(checked))}
                />
                <label htmlFor="isTestMode" className="cursor-pointer text-sm font-medium text-foreground">
                  تفعيل وضع الاختبار التجريبي
                </label>
              </div>

              <Field label="مفتاح الـ API (API Key)" htmlFor="apiKey">
                <Input
                  id="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  dir="ltr"
                />
              </Field>

              <Field label="المفتاح السري (Secret Key)" htmlFor="secretKey">
                <Input
                  id="secretKey"
                  type="password"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  dir="ltr"
                />
              </Field>
            </div>
          )}

          {/* Manual Bank Payment config */}
          {method.method_code === 'manual_payment' && (
            <div className="space-y-4 border-t border-border pt-4">
              <h3 className="font-semibold text-foreground">بيانات الحساب المصرفي للتحويلات</h3>

              <Field label="اسم المصرف" htmlFor="bankName">
                <Input
                  id="bankName"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="مثال: مصرف الجمهورية — فرع الأندلس"
                />
              </Field>

              <Field label="اسم صاحب الحساب" htmlFor="accountName">
                <Input
                  id="accountName"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="مثال: شركة نسائم ليبيا للعطور"
                />
              </Field>

              <Field label="رقم الحساب أو الآيبان (IBAN / Account No)" htmlFor="accountNumber">
                <Input
                  id="accountNumber"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="001-XXXX-XXXXXX"
                  dir="ltr"
                />
              </Field>

              <Field label="تعليمات إرسال الإيصال للعميل" htmlFor="instructions">
                <Textarea
                  id="instructions"
                  rows={3}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="يرجى تحويل المبلغ الإجمالي وإرفاق صورة واضحة لإشعار التحويل لتأكيد شحن طلبكم فوراً."
                />
              </Field>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={() => navigate('/admin/payment_methods')}>
            إلغاء
          </Button>
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
          </Button>
        </div>
      </form>
    </div>
  )
}
