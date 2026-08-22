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
import { useAdminDeliveryMethod, useUpdateAdminDeliveryMethod } from '@/lib/queries/delivery'
import { usePageTitle } from '@/lib/usePageTitle'

export default function DeliveryMethodConfigPage() {
  const { courierCode } = useParams<{ courierCode: string }>()
  const navigate = useNavigate()
  usePageTitle('إعدادات شركة التوصيل — لوحة التحكم')

  const { data: method, isLoading, isError } = useAdminDeliveryMethod(courierCode)
  const update = useUpdateAdminDeliveryMethod()

  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [branchId, setBranchId] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [savedSuccess, setSavedSuccess] = useState(false)

  useEffect(() => {
    if (method) {
      setDescription(method.description || '')
      setIsActive(method.is_active)
      const config = method.configuration || {}
      setApiKey(config.apiKey || config.api_key || '')
      setApiSecret(config.apiSecret || config.api_secret || '')
      setEmail(config.email || '')
      setPassword(config.password || '')
      setBranchId(config.branchId || config.branch_id || '')
      setBaseUrl(config.baseUrl || config.base_url || '')
    }
  }, [method])

  if (isLoading) {
    return <Skeleton className="h-96 w-full max-w-2xl" />
  }

  if (isError || !method) {
    return (
      <div className="space-y-4">
        <Alert tone="error">شركة التوصيل المطلوبة غير موجودة.</Alert>
        <Button asChild variant="outline">
          <Link to="/admin/delivery">العودة لشركات التوصيل</Link>
        </Button>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavedSuccess(false)

    const configuration: Record<string, any> = {
      ...(baseUrl ? { baseUrl } : {}),
      ...(email ? { email } : {}),
      ...(password ? { password } : {}),
      ...(apiKey ? { apiKey } : {}),
      ...(apiSecret ? { apiSecret } : {}),
      ...(branchId ? { branchId } : {}),
    }

    try {
      await update.mutateAsync({
        code: method.code,
        data: {
          description,
          is_active: isActive,
          configuration,
        },
      })
      setSavedSuccess(true)
    } catch {
      // Error handled by mutation state
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title={`إعدادات: ${method.name}`}
        description={`تكوين الاتصال وواجهة برمجة التطبيقات لشركة ${method.name}.`}
        actions={
          <Button asChild variant="outline">
            <Link to="/admin/delivery">العودة للشركات</Link>
          </Button>
        }
      />

      {savedSuccess && <Alert tone="success">تم حفظ إعدادات شركة التوصيل بنجاح.</Alert>}
      {update.isError && <Alert tone="error">حدث خطأ أثناء حفظ الإعدادات، يرجى التحقق من البيانات.</Alert>}

      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-border bg-card p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Checkbox
              id="isActive"
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(Boolean(checked))}
            />
            <label htmlFor="isActive" className="cursor-pointer text-sm font-medium text-foreground">
              تفعيل هذه الشركة في خيارات الشحن عند إتمام الطلب
            </label>
          </div>

          <Field label="وصف شركة التوصيل وملاحظات التغطية" htmlFor="description">
            <Textarea
              id="description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مثال: توصيل سريع داخل طرابلس وبنغازي وكافة المدن الليبية"
            />
          </Field>

          {/* Vanex / Nawres credentials */}
          {(method.code === 'vanex' || method.code === 'nawres' || method.code === 'darb_sabeel') && (
            <>
              <div className="border-t border-border pt-4">
                <h3 className="mb-3 font-semibold text-foreground">بيانات اعتماد الربط المباشر (API Credentials)</h3>
              </div>

              {method.code === 'vanex' && (
                <>
                  <Field label="البريد الإلكتروني لحساب الشركة (Vanex Login Email)" htmlFor="email">
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ops@yourstore.ly"
                      dir="ltr"
                    />
                  </Field>

                  <Field label="كلمة المرور (Vanex Password)" htmlFor="password">
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      dir="ltr"
                    />
                  </Field>
                </>
              )}

              {(method.code === 'nawres' || method.code === 'darb_sabeel') && (
                <>
                  <Field label="مفتاح الـ API (API Key / Token)" htmlFor="apiKey">
                    <Input
                      id="apiKey"
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="nw_live_..."
                      dir="ltr"
                    />
                  </Field>

                  <Field label="المفتاح السري (Secret Key)" htmlFor="apiSecret">
                    <Input
                      id="apiSecret"
                      type="password"
                      value={apiSecret}
                      onChange={(e) => setApiSecret(e.target.value)}
                      placeholder="••••••••"
                      dir="ltr"
                    />
                  </Field>
                </>
              )}

              <Field label="معرّف الفرع أو المستودع الافتراضي (Branch ID)" htmlFor="branchId">
                <Input
                  id="branchId"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  placeholder="مثال: TRIPOLI_MAIN_01"
                  dir="ltr"
                />
              </Field>

              <Field label="عنوان خادم الـ API (Base URL - اختياري)" htmlFor="baseUrl">
                <Input
                  id="baseUrl"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://app.vanex.ly/api/v1/"
                  dir="ltr"
                />
              </Field>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={() => navigate('/admin/delivery')}>
            إلغاء
          </Button>
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}
          </Button>
        </div>
      </form>
    </div>
  )
}
