import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  History,
  Loader2,
  Search,
  Upload,
  Wallet,
} from 'lucide-react'
import * as React from 'react'

import { PageHeader } from '@/components/layout/AdminLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateTime, formatPrice } from '@/lib/format'
import {
  type CODReconciliationStatementData,
  useCODStatements,
  useCommitCODStatement,
  useUploadCODStatement,
} from '@/lib/queries/cod-reconciliation'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'

const COURIER_OPTIONS = [
  { code: 'vanex', name: 'شركة فانكس إكسبريس (Vanex)' },
  { code: 'nawres', name: 'شركة النورس للتوصيل (Nawres)' },
  { code: 'darb_sabeel', name: 'شركة درب السبيل (Darb Sabeel)' },
  { code: 'local', name: 'مندوب التوصيل المباشر (Local)' },
]

const SAMPLE_CSV = `tracking_number,order_number,collected_amount,delivery_fee,recipient_name
VNX-LY-1001,202608MAN7701,420.00,20.00,أحمد الترهوني
VNX-LY-1002,202608MOA7702,300.00,20.00,فاطمة الزهراء
VNX-LY-1003,202608MOA7703,150.00,15.00,طارق بن يوسف
`

export default function AdminCODReconciliationPage() {
  usePageTitle('مطابقة كشوفات التحصيل المالي (COD) — لوحة التحكم')

  const { data: statements, isLoading: isStatementsLoading, refetch: refetchStatements } = useCODStatements()
  const uploadMutation = useUploadCODStatement()
  const commitMutation = useCommitCODStatement()

  const [activeTab, setActiveTab] = React.useState<'upload' | 'history'>('upload')
  const [courierCode, setCourierCode] = React.useState('vanex')
  const [rawCsvText, setRawCsvText] = React.useState('')
  const [currentStatement, setCurrentStatement] = React.useState<CODReconciliationStatementData | null>(null)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null)

  const selectedCourier = COURIER_OPTIONS.find((c) => c.code === courierCode) || COURIER_OPTIONS[0]!

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    if (!rawCsvText.trim()) {
      setErrorMsg('يرجى لصق بيانات الكشف بتنسيق CSV أو استخدام النموذج التجريبي')
      return
    }

    try {
      const res = await uploadMutation.mutateAsync({
        courier_code: courierCode,
        courier_name: selectedCourier.name,
        raw_csv_text: rawCsvText,
      })
      setCurrentStatement(res)
      setSuccessMsg(`تم فحص وتحليل ${res.total_orders_count} شحنة بالكشف بنجاح`)
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || 'تعذر معالجة كشف المطابقة'
      setErrorMsg(msg)
    }
  }

  const handleCommit = async () => {
    if (!currentStatement) return
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const res = await commitMutation.mutateAsync(currentStatement.statement_id)
      setCurrentStatement(res)
      setSuccessMsg(`تم اعتماد المطابقة وإيداع ${formatPrice(res.net_bank_deposit)} بدفتر الأستاذ المالي بنجاح!`)
      refetchStatements()
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || 'تعذر اعتماد الكشف'
      setErrorMsg(msg)
    }
  }

  const handleLoadSample = () => {
    setRawCsvText(SAMPLE_CSV)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="مطابقة كشوفات التحصيل المالي للمندوبين (COD Reconciliation)"
        description="تدقيق ملفات إكسل شركات الشحن، كشف الفروقات المالية، وترحيل المبالغ لدفتر الأستاذ بضغطة واحدة"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={cn(
                'rounded-xl px-3.5 py-2 text-xs font-bold transition-all',
                activeTab === 'upload'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/70 text-muted-foreground hover:text-foreground',
              )}
            >
              <Upload className="size-3.5 inline-block me-1.5" />
              كشف جديد
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={cn(
                'rounded-xl px-3.5 py-2 text-xs font-bold transition-all',
                activeTab === 'history'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/70 text-muted-foreground hover:text-foreground',
              )}
            >
              <History className="size-3.5 inline-block me-1.5" />
              أرشيف الكشوفات ({statements?.length || 0})
            </button>
          </div>
        }
      />

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs font-bold text-destructive animate-in fade-in">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 p-3.5 text-xs font-bold text-primary animate-in fade-in">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {activeTab === 'upload' ? (
        <div className="space-y-6">
          {/* Upload Form Card */}
          <div className="rounded-3xl border border-border bg-card p-6 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-black text-foreground">رفع وتدقيق كشف الحساب</h3>
                <p className="text-xs text-muted-foreground">اختر شركة الشحن والصق بيانات ملف الـ Excel / CSV</p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLoadSample}
                className="h-8 text-xs font-bold rounded-xl gap-1.5"
              >
                <FileSpreadsheet className="size-3.5 text-primary" />
                <span>نموذج تجريبي (Sample)</span>
              </Button>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1.5">شركة الشحن أو المندوب:</label>
                  <select
                    value={courierCode}
                    onChange={(e) => setCourierCode(e.target.value)}
                    className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {COURIER_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1.5">
                  بيانات الكشف (CSV Content):
                </label>
                <textarea
                  value={rawCsvText}
                  onChange={(e) => setRawCsvText(e.target.value)}
                  placeholder="tracking_number,order_number,collected_amount,delivery_fee,recipient_name..."
                  rows={5}
                  className="w-full rounded-2xl border border-border bg-background p-3 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div className="flex items-center justify-end">
                <Button
                  type="submit"
                  disabled={uploadMutation.isPending}
                  className="h-10 px-5 text-xs font-bold rounded-xl gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
                >
                  {uploadMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                  <span>بدء الفحص والتدقيق الآلي</span>
                </Button>
              </div>
            </form>
          </div>

          {/* Statement Analysis Results */}
          {currentStatement && (
            <div className="space-y-4 animate-in fade-in">
              {/* Metric Counters Bar */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
                  <span className="text-[11px] font-bold text-muted-foreground">إجمالي الشحنات</span>
                  <p className="text-lg font-black font-mono text-foreground">
                    {currentStatement.total_orders_count}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
                  <span className="text-[11px] font-bold text-muted-foreground">مطابق 100%</span>
                  <p className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {currentStatement.matched_orders_count}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
                  <span className="text-[11px] font-bold text-muted-foreground">فروقات تحتاج تدقيق</span>
                  <p className="text-lg font-black font-mono text-amber-600 dark:text-amber-400">
                    {currentStatement.discrepancies_count}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
                  <span className="text-[11px] font-bold text-muted-foreground">المحصل الفعلي</span>
                  <p className="text-lg font-black font-mono text-foreground">
                    {formatPrice(currentStatement.total_collected_actual)}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
                  <span className="text-[11px] font-bold text-muted-foreground">عمولات التوصيل</span>
                  <p className="text-lg font-black font-mono text-destructive">
                    {formatPrice(currentStatement.total_delivery_fees)}
                  </p>
                </div>

                <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4 shadow-2xs space-y-1">
                  <span className="text-[11px] font-black text-primary">صافي الإيداع البنكي</span>
                  <p className="text-lg font-black font-mono text-primary">
                    {formatPrice(currentStatement.net_bank_deposit)}
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <div className="rounded-3xl border border-border bg-card p-6 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                  <div>
                    <h3 className="text-sm font-black text-foreground">
                      بنود الشحنات والتحليل المقارن ({currentStatement.statement_id})
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      حالة الكشف: <strong className="text-foreground">{currentStatement.status === 'committed' ? 'معتمد ومرحل مالياً' : 'مسودة قيد المراجعة'}</strong>
                    </p>
                  </div>

                  {currentStatement.status === 'draft' && (
                    <Button
                      onClick={handleCommit}
                      disabled={commitMutation.isPending}
                      className="h-10 px-5 text-xs font-bold rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                    >
                      {commitMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Wallet className="size-4" />
                      )}
                      <span>اعتماد المطابقة وإيداع الأموال بدفتر الأستاذ</span>
                    </Button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-start text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="py-2.5 px-3 text-start font-bold">رقم الشحنة / التتبع</th>
                        <th className="py-2.5 px-3 text-start font-bold">المستلم</th>
                        <th className="py-2.5 px-3 text-end font-bold">المسجل بالنظام</th>
                        <th className="py-2.5 px-3 text-end font-bold">المحصل بالكشف</th>
                        <th className="py-2.5 px-3 text-end font-bold">عمولة الشحن</th>
                        <th className="py-2.5 px-3 text-center font-bold">حالة المطابقة</th>
                        <th className="py-2.5 px-3 text-start font-bold">ملاحظات التدقيق</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {currentStatement.items?.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-3 font-mono font-bold text-foreground">
                            {item.tracking_number || item.order_number}
                          </td>
                          <td className="py-3 px-3 font-bold text-foreground">
                            {item.recipient_name || '—'}
                          </td>
                          <td className="py-3 px-3 text-end font-mono text-muted-foreground">
                            {formatPrice(item.expected_amount)}
                          </td>
                          <td className="py-3 px-3 text-end font-mono font-bold text-foreground">
                            {formatPrice(item.collected_amount)}
                          </td>
                          <td className="py-3 px-3 text-end font-mono text-muted-foreground">
                            {formatPrice(item.delivery_fee)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={cn(
                                'inline-block rounded-lg px-2 py-0.5 text-[10px] font-black',
                                item.match_status === 'matched'
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                  : item.match_status === 'amount_mismatch'
                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                                  : 'bg-destructive/15 text-destructive',
                              )}
                            >
                              {item.match_status === 'matched'
                                ? 'مطابق 100%'
                                : item.match_status === 'amount_mismatch'
                                ? 'فارق بالمبلغ'
                                : item.match_status === 'already_settled'
                                ? 'مسدد مسبقاً'
                                : 'طلب غير موجود'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-muted-foreground text-[11px]">
                            {item.status_note}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* History Statements Archive */
        <div className="rounded-3xl border border-border bg-card p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="text-sm font-black text-foreground">أرشيف كشوفات التحصيل المعتمدة</h3>
              <p className="text-xs text-muted-foreground">سجل الكشوفات ومطابقات المندوبين السابقة</p>
            </div>
          </div>

          {isStatementsLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : !statements || statements.length === 0 ? (
            <div className="py-12 text-center text-xs font-bold text-muted-foreground">
              لا توجد كشوفات مطابقة سابقة في الأرشيف
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {statements.map((stmt) => (
                <div
                  key={stmt.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4 hover:bg-muted/30 px-3 rounded-2xl transition-colors cursor-pointer"
                  onClick={() => {
                    setCurrentStatement(stmt)
                    setActiveTab('upload')
                  }}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-foreground">
                        {stmt.statement_id}
                      </span>
                      <Badge tone={stmt.status === 'committed' ? 'success' : 'neutral'} className="text-[10px]">
                        {stmt.status === 'committed' ? 'معتمد' : 'مسودة'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {stmt.courier_name} — {stmt.total_orders_count} شحنة
                    </p>
                  </div>

                  <div className="text-end space-y-0.5">
                    <span className="font-mono text-xs font-black text-primary block">
                      {formatPrice(stmt.net_bank_deposit)}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {formatDateTime(stmt.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
