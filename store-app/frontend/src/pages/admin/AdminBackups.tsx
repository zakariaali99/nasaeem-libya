import {
  Archive,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  Download,
  FileArchive,
  HardDrive,
  ImageIcon,
  Plus,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  Terminal,
  Trash2,
  Upload,
} from 'lucide-react'
import { useState } from 'react'

import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { PageHeader } from '@/components/layout/AdminLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '@/lib/format'
import {
  useBackups,
  useCreateBackup,
  useDeleteBackup,
  useRestoreBackup,
} from '@/lib/queries/backups'
import { usePageTitle } from '@/lib/usePageTitle'

export default function AdminBackups() {
  usePageTitle('النسخ الاحتياطي للنظام — لوحة التحكم')

  const { data, isPending, refetch } = useBackups()
  const createBackup = useCreateBackup()
  const deleteBackup = useDeleteBackup()
  const restoreBackup = useRestoreBackup()

  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [pendingRestore, setPendingRestore] = useState<{ filename?: string; file?: File } | null>(null)
  const [restoreSuccessNotice, setRestoreSuccessNotice] = useState<string | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null)

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCmd(id)
    setTimeout(() => setCopiedCmd(null), 2500)
  }

  const handleCreate = async () => {
    try {
      await createBackup.mutateAsync()
      refetch()
    } catch (e) {
      console.error(e)
    }
  }

  const handleConfirmRestore = async () => {
    if (!pendingRestore) return
    try {
      const res = await restoreBackup.mutateAsync(pendingRestore)
      setPendingRestore(null)
      setRestoreSuccessNotice(`تم استرجاع النظام بنجاح! (${res.restored_records_count} سجل مسترجع).`)
      refetch()
    } catch (e) {
      console.error(e)
    }
  }

  const stats = data?.stats
  const backups = data?.backups ?? []

  return (
    <div className="space-y-6 animate-fade-rise">
      <PageHeader
        title="النسخ الاحتياطي واسترجاع النظام"
        description="حفظ نسخة كاملة من قاعدة البيانات، المنتجات، الصور، الطلبات، والتخصيص في ملف ZIP واحد قابل للتنزيل والاسترجاع."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="h-10 rounded-xl text-xs font-bold gap-1.5 border-border"
            >
              <RefreshCw className="size-3.5" />
              <span>تحديث</span>
            </Button>

            <Button
              size="sm"
              onClick={handleCreate}
              loading={createBackup.isPending}
              className="h-10 rounded-xl font-bold shadow-xs gap-1.5 px-4"
            >
              <Plus className="size-4" />
              <span>إنشاء نسخة احتياطية شاملة الآن</span>
            </Button>
          </div>
        }
      />

      {restoreSuccessNotice && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="size-5 shrink-0" />
          <p className="text-xs font-bold">{restoreSuccessNotice}</p>
        </div>
      )}

      {/* System Health & Capacity Overview Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>المنتجات والعطور</span>
            <ShoppingBag className="size-4 text-primary" />
          </div>
          <p className="font-mono text-2xl font-black text-foreground">
            {stats ? formatNumber(stats.products_count) : '—'}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {stats ? `${formatNumber(stats.categories_count)} أقسام عطرية` : ''}
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>الصور والوسائط</span>
            <ImageIcon className="size-4 text-primary" />
          </div>
          <p className="font-mono text-2xl font-black text-foreground">
            {stats ? formatNumber(stats.images_count) : '—'}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {stats ? `حجم المجلد: ${stats.media_size_mb} MB` : ''}
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>الطلبات والعملاء</span>
            <Database className="size-4 text-primary" />
          </div>
          <p className="font-mono text-2xl font-black text-foreground">
            {stats ? formatNumber(stats.orders_count) : '—'}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {stats ? `${formatNumber(stats.users_count)} حساب مسجل` : ''}
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>تخصيص الواجهة</span>
            <HardDrive className="size-4 text-primary" />
          </div>
          <p className="font-mono text-2xl font-black text-foreground">
            {stats ? formatNumber(stats.widgets_count) : '—'}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {stats ? `${formatNumber(stats.layouts_count)} قوالب وتخطيطات` : ''}
          </p>
        </div>
      </div>

      {/* Upload External Backup Section */}
      <div className="rounded-3xl border border-dashed border-border/80 bg-muted/20 p-6 sm:p-7 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0">
              <Upload className="size-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-foreground">
                استرجاع من ملف خارجي (.zip)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                يمكنك رفع ملف نسخة احتياطية تم تنزيله سابقاً لاستعادة المنتجات والصور والإعدادات بالكامل.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              id="restore-upload"
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  setPendingRestore({ file })
                }
              }}
            />
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-10 rounded-xl font-bold text-xs gap-2 cursor-pointer border-border"
            >
              <label htmlFor="restore-upload">
                <FileArchive className="size-4" />
                <span>اختيار ملف النسخة الاحتياطية</span>
              </label>
            </Button>
          </div>
        </div>

        {pendingRestore?.file && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <FileArchive className="size-4 text-primary" />
              <span>الملف المحدد:</span>
              <span className="font-mono text-primary">{pendingRestore.file.name}</span>
              <span className="text-[11px] text-muted-foreground font-mono">
                ({(pendingRestore.file.size / (1024 * 1024)).toFixed(2)} MB)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-xl text-xs font-bold"
                onClick={() => setPendingRestore(null)}
              >
                إلغاء
              </Button>
              <Button
                size="sm"
                className="h-8 rounded-xl font-bold text-xs gap-1.5 shadow-xs"
                onClick={handleConfirmRestore}
                loading={restoreBackup.isPending}
              >
                <RotateCcw className="size-3.5" />
                <span>بدء الاسترجاع الفوري الآن</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Disaster Recovery Cheatsheet Guide (Collapsible) */}
      <div className="rounded-3xl border border-border bg-card shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => setGuideOpen(!guideOpen)}
          className="flex w-full items-center justify-between p-5 text-start hover:bg-muted/20 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Terminal className="size-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">
                دليل الاسترجاع في حال انهيار أو نقل السيرفر بالكامل (Disaster Recovery Guide)
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                خطوات وأوامر سريعة لاسترجاع النظام في استضافة جديدة نظيفة بدون فتح المتصفح
              </p>
            </div>
          </div>
          <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            {guideOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </span>
        </button>

        {guideOpen && (
          <div className="border-t border-border/80 p-5 sm:p-6 bg-muted/10 space-y-4 text-xs">
            <div className="space-y-2">
              <h4 className="font-bold text-foreground flex items-center gap-1.5">
                <span>1. الاسترجاع عبر سطر الأوامر (CLI) — الأسرع والأضمن:</span>
              </h4>
              <p className="text-muted-foreground leading-relaxed">
                في حال قمت بنقل المشروع لسيرفر جديد أو تم حذف كل شيء، ارفع ملف النسخة الاحتياطية (.zip) إلى السيرفر ثم شغّل الأمر التالي:
              </p>
              <div className="relative flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 font-mono text-emerald-400 text-xs shadow-inner">
                <span dir="ltr">python manage.py restore_system_backup /path/to/backup.zip</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard('python manage.py restore_system_backup /path/to/backup.zip', 'restore')}
                  className="flex size-7 items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:text-white transition-colors"
                  title="نسخ الأمر"
                >
                  {copiedCmd === 'restore' ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-foreground flex items-center gap-1.5">
                <span>2. الجدولة التلقائية للنسخ الاحتياطي (Cron Job):</span>
              </h4>
              <p className="text-muted-foreground leading-relaxed">
                لأخذ نسخة احتياطية تلقائية يومياً في منتصف الليل عبر لوحة الاستضافة (cPanel Cron Jobs):
              </p>
              <div className="relative flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 font-mono text-emerald-400 text-xs shadow-inner">
                <span dir="ltr">0 0 * * * cd /path/to/backend && python manage.py create_system_backup</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard('0 0 * * * cd /path/to/backend && python manage.py create_system_backup', 'cron')}
                  className="flex size-7 items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:text-white transition-colors"
                  title="نسخ الأمر"
                >
                  {copiedCmd === 'cron' ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5 pt-1 text-[11px] text-muted-foreground border-t border-border/60">
              <span className="font-bold text-foreground">💡 ملاحظة هامة:</span>
              <p>
                كلا الأمرين يتعاملان مباشرة مع مجلد الوسائط <code className="text-primary font-mono">media/</code> وقاعدة البيانات ذرياً (Atomic)، دون مواجهة قيود أحجام الرفع في المتصفحات.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Backups Table */}
      <div className="rounded-3xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/80 p-5">
          <div className="flex items-center gap-2">
            <Archive className="size-5 text-primary" />
            <h2 className="font-bold text-sm sm:text-base text-foreground">
              سجل النسخ الاحتياطية المحفوظة
            </h2>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {backups.length} ملفات مؤرشفة
          </span>
        </div>

        {isPending ? (
          <div className="p-6 space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 rounded-2xl" />
            ))}
          </div>
        ) : backups.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="flex size-14 mx-auto items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Archive className="size-7" />
            </div>
            <h3 className="font-bold text-foreground text-sm">لا توجد نسخ احتياطية محفوظة حتى الآن</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              اضغط على زر «إنشاء نسخة احتياطية شاملة الآن» لحفظ نسخة آمنة من المتجر.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground text-start font-bold">
                  <th className="py-3.5 px-5 text-start">اسم الأرشيف</th>
                  <th className="py-3.5 px-4 text-center">الحجم</th>
                  <th className="py-3.5 px-4 text-center">تاريخ النسخ</th>
                  <th className="py-3.5 px-4 text-start">المحتويات</th>
                  <th className="py-3.5 px-5 text-end">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {backups.map((backup) => (
                  <tr key={backup.filename} className="hover:bg-muted/20 transition-colors">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-mono">
                          <FileArchive className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-mono font-bold text-foreground block truncate max-w-xs sm:max-w-sm">
                            {backup.filename}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            أرشيف مضغوط ZIP
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4 text-center font-mono font-bold text-foreground">
                      {backup.size_mb} MB
                    </td>

                    <td className="py-4 px-4 text-center font-mono text-muted-foreground">
                      {new Date(backup.created_at).toLocaleDateString('ar-LY', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    <td className="py-4 px-4 text-start text-[11px] text-muted-foreground">
                      {backup.manifest?.stats ? (
                        <div className="flex flex-wrap gap-1.5">
                          <Badge tone="neutral" className="text-[10px]">
                            {backup.manifest.stats.products_count} منتجات
                          </Badge>
                          <Badge tone="neutral" className="text-[10px]">
                            {backup.manifest.stats.orders_count} طلبات
                          </Badge>
                          <Badge tone="neutral" className="text-[10px]">
                            {backup.manifest.stats.images_count} صور
                          </Badge>
                        </div>
                      ) : (
                        <span>قاعدة البيانات + الوسائط</span>
                      )}
                    </td>

                    <td className="py-4 px-5 text-end">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-xl font-bold text-xs gap-1 shadow-2xs border-border"
                          title="تنزيل ملف النسخة الاحتياطية"
                        >
                          <a
                            href={`/api/admin/backups/download/${encodeURIComponent(backup.filename)}/`}
                            download
                          >
                            <Download className="size-3.5" />
                            <span>تنزيل</span>
                          </a>
                        </Button>

                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 rounded-xl font-bold text-xs gap-1"
                          onClick={() => setPendingRestore({ filename: backup.filename })}
                          title="استرجاع النظام من هذه النسخة"
                        >
                          <RotateCcw className="size-3.5" />
                          <span>استرجاع</span>
                        </Button>

                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 border-border"
                          onClick={() => setPendingDelete(backup.filename)}
                          title="حذف الأرشيف"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="حذف النسخة الاحتياطية"
        description={`هل أنت متأكد من حذف ملف النسخة الاحتياطية «${pendingDelete}» نهائياً من السيرفر؟`}
        confirmLabel="تأكيد الحذف"
        loading={deleteBackup.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return
          await deleteBackup.mutateAsync(pendingDelete)
          setPendingDelete(null)
          refetch()
        }}
      />

      {/* Restore Confirmation */}
      <ConfirmDialog
        open={pendingRestore !== null}
        onOpenChange={(open) => !open && setPendingRestore(null)}
        title="تأكيد استرجاع النظام بالكامل"
        description={`تنبيه أمني: سيؤدي الاسترجاع إلى استبدال وتحديث قاعدة البيانات والصور الحالية بما يحتويه هذا الملف (${pendingRestore?.filename || pendingRestore?.file?.name}). هل ترغب في المتابعة؟`}
        confirmLabel="نعم، ابدأ الاسترجاع الآن"
        loading={restoreBackup.isPending}
        onConfirm={handleConfirmRestore}
      />
    </div>
  )
}
