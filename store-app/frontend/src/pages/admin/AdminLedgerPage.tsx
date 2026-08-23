import {
  Banknote,
  Building2,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Loader2,
  RefreshCw,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react'
import * as React from 'react'

import { CourierSettlementModal } from '@/components/admin/CourierSettlementModal'
import { PageHeader } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/button'
import { formatDateTime, formatPrice } from '@/lib/format'
import {
  useLedgerSummary,
  useLedgerTransactions,
  useReconcilePayments,
} from '@/lib/queries/ledger'
import { usePageTitle } from '@/lib/usePageTitle'

export default function AdminLedgerPage() {
  usePageTitle('دفتر الأستاذ المالي والتسويات — لوحة التحكم')

  const { data: summary, isLoading: isSummaryLoading, refetch: refetchSummary } = useLedgerSummary()
  const { data: transactions, isLoading: isTxnsLoading, refetch: refetchTxns } = useLedgerTransactions()
  const reconcileMutation = useReconcilePayments()

  const [settleModalOpen, setSettleModalOpen] = React.useState(false)
  const [reconcileMessage, setReconcileMessage] = React.useState<string | null>(null)

  const handleReconcile = async () => {
    try {
      const res = await reconcileMutation.mutateAsync({ min_age: 0, max_age: 1440 })
      setReconcileMessage(res.message)
      refetchSummary()
      refetchTxns()
      setTimeout(() => setReconcileMessage(null), 5000)
    } catch (err: unknown) {
      setReconcileMessage('تعذر إكمال المطابقة الآلية')
      setTimeout(() => setReconcileMessage(null), 5000)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="دفتر الأستاذ المالي ومطابقة المدفوعات"
        description="المحاسبة المزدوجة ومتابعة كاش المندوبين وأرصدة بوابات الدفع وصافي الأرباح"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleReconcile}
              disabled={reconcileMutation.isPending}
              variant="outline"
              size="sm"
              className="h-9 px-3.5 text-xs font-bold gap-2 rounded-xl border-primary/30 text-primary hover:bg-primary/10 shadow-2xs"
            >
              {reconcileMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              <span>تشغيل المطابقة الآلية للبوابات</span>
            </Button>

            <Button
              onClick={() => setSettleModalOpen(true)}
              size="sm"
              className="h-9 px-3.5 text-xs font-bold gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
            >
              <Banknote className="size-4" />
              <span>تسوية نقدية مندوب</span>
            </Button>
          </div>
        }
      />

      {reconcileMessage && (
        <div className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 p-3.5 text-xs font-bold text-primary animate-in fade-in">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{reconcileMessage}</span>
        </div>
      )}

      {/* 1. Executive Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Pending COD Courier */}
        <div className="rounded-3xl border border-border bg-card p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">كاش معلق عند شركات الشحن (COD)</span>
            <div className="flex size-9 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Truck className="size-4" />
            </div>
          </div>
          <p className="text-xl font-black font-mono text-foreground">
            {isSummaryLoading ? '...' : formatPrice(summary?.pending_cod_courier || '0')}
          </p>
          <p className="text-[11px] text-muted-foreground">مبالغ طلبات مستلمة بانتظار توريد المندوبين</p>
        </div>

        {/* Pending Gateway Receivables */}
        <div className="rounded-3xl border border-border bg-card p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">مستحقات بوابات الدفع الإلكتروني</span>
            <div className="flex size-9 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <CreditCard className="size-4" />
            </div>
          </div>
          <p className="text-xl font-black font-mono text-foreground">
            {isSummaryLoading ? '...' : formatPrice(summary?.pending_gateway_receivables || '0')}
          </p>
          <p className="text-[11px] text-muted-foreground">معاملات بطاقات وسداد بانتظار التحويل المصرفي</p>
        </div>

        {/* Main Bank Account Balance */}
        <div className="rounded-3xl border border-border bg-card p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">رصيد الحساب المصرفي الرئيسي</span>
            <div className="flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Building2 className="size-4" />
            </div>
          </div>
          <p className="text-xl font-black font-mono text-foreground">
            {isSummaryLoading ? '...' : formatPrice(summary?.bank_account_balance || '0')}
          </p>
          <p className="text-[11px] text-muted-foreground">النقدية الفعلية المودعة بالحساب البنكي</p>
        </div>

        {/* Total Sales Revenue */}
        <div className="rounded-3xl border border-border bg-card p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">إجمالي مبيعات العطور</span>
            <div className="flex size-9 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="size-4" />
            </div>
          </div>
          <p className="text-xl font-black font-mono text-foreground">
            {isSummaryLoading ? '...' : formatPrice(summary?.total_sales_revenue || '0')}
          </p>
          <p className="text-[11px] text-muted-foreground">إجمالي الإيرادات المسجلة بدفتر الأستاذ</p>
        </div>

        {/* Total Expenses & Fees */}
        <div className="rounded-3xl border border-border bg-card p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">إجمالي مصاريف الشحن والعمولات</span>
            <div className="flex size-9 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <DollarSign className="size-4" />
            </div>
          </div>
          <p className="text-xl font-black font-mono text-foreground">
            {isSummaryLoading ? '...' : formatPrice(summary?.total_expenses || '0')}
          </p>
          <p className="text-[11px] text-muted-foreground">عمولات التوصيل وبوابات الدفع المخصومة</p>
        </div>

        {/* Net Profit */}
        <div className="rounded-3xl border border-primary/40 bg-primary/5 p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-primary">صافي الأرباح المحققة</span>
            <div className="flex size-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Wallet className="size-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-primary">
            {isSummaryLoading ? '...' : formatPrice(summary?.net_profit || '0')}
          </p>
          <p className="text-[11px] text-muted-foreground font-bold">الإيرادات بعد خصم كامل المصاريف والعمولات</p>
        </div>
      </div>

      {/* 2. Double-Entry Transactions Ledger */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div>
            <h3 className="text-sm font-black text-foreground">سجل القيود المحاسبية المزدوجة (Double-Entry Ledger)</h3>
            <p className="text-xs text-muted-foreground">قيود المبيعات، الاستردادات، وتوريدات النقدية المتوازنة محاسبياً</p>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            {transactions?.length || 0} قيد مسجل
          </span>
        </div>

        {isTxnsLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : !transactions || transactions.length === 0 ? (
          <div className="py-12 text-center text-xs font-bold text-muted-foreground">
            لا توجد حركات مالية مسجلة حتى الآن
          </div>
        ) : (
          <div className="divide-y divide-border/60 space-y-3">
            {transactions.map((txn) => (
              <div key={txn.id} className="pt-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-muted px-2 py-0.5 font-mono text-[11px] font-bold text-foreground">
                      {txn.reference_type}
                    </span>
                    <span className="text-xs font-bold text-foreground">{txn.description}</span>
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {formatDateTime(txn.created_at)}
                  </span>
                </div>

                {/* Individual Debit/Credit Legs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-2xl bg-muted/40 p-3 text-xs">
                  {txn.entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-xl bg-card p-2 border border-border/70 shadow-2xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${
                            entry.entry_type === 'debit'
                              ? 'bg-sky-500/15 text-sky-700 dark:text-sky-400'
                              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {entry.entry_type === 'debit' ? 'مدين (Debit)' : 'دائن (Credit)'}
                        </span>
                        <span className="font-bold text-foreground truncate max-w-[180px]">
                          {entry.account_name}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-foreground">
                        {formatPrice(entry.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Courier Settlement Dialog */}
      <CourierSettlementModal
        open={settleModalOpen}
        onClose={() => {
          setSettleModalOpen(false)
          refetchSummary()
          refetchTxns()
        }}
      />
    </div>
  )
}
