import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { StoreVisibilityBadge, useStoreVisibilitySwitch } from '@/components/admin/StoreVisibility'
import { PageHeader } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  useCollections, useCreateCollection, useDeleteCollection, useUpdateCollection,
} from '@/lib/queries/catalog'
import { usePageTitle } from '@/lib/usePageTitle'
import type { Collection } from '@/types/api'

export default function AdminCollectionsPage() {
  usePageTitle('المجموعات — لوحة التحكم')
  const query = useCollections({ admin: true })
  const create = useCreateCollection()
  const update = useUpdateCollection()
  const remove = useDeleteCollection()

  const [editing, setEditing] = useState<Collection | null>(null)
  const [creating, setCreating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Collection | null>(null)
  const [form, setForm] = useState({ name: '', description: '', name_en: '', description_en: '' })
  const visibility = useStoreVisibilitySwitch('collections', (id, isActive) =>
    update.mutateAsync({ id, is_active: isActive }),
  )

  const columns: Column<Collection>[] = [
    { key: 'name', header: 'المجموعة', cell: (row) => <span className="font-medium text-foreground">{row.name}</span> },
    { key: 'slug', header: 'المعرّف', cell: (row) => <span className="text-muted-foreground">{row.slug}</span> },
    { key: 'description', header: 'الوصف', cell: (row) => row.description || '—' },
    {
      key: 'is_active',
      header: 'في المتجر',
      cell: (row) => <StoreVisibilityBadge hidden={!row.is_active} />,
    },
  ]

  return (
    <>
      <PageHeader
        title="المجموعات"
        description="مجموعات مختارة مثل «الأكثر مبيعاً» أو «عروض الموسم». زر العين يخفي المجموعة ومنتجاتها من المتجر دون حذف شيء."
        actions={
          <Button
            onClick={() => {
              setForm({ name: '', description: '', name_en: '', description_en: '' })
              setCreating(true)
            }}
          >
            <Plus aria-hidden="true" />
            مجموعة جديدة
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={query.data ?? []}
        rowKey={(row) => row.id}
        isLoading={query.isLoading}
        error={query.error ? { message: 'تعذّر تحميل المجموعات' } : null}
        onRetry={() => query.refetch()}
        emptyTitle="لا توجد مجموعات"
        emptyDescription="أنشئ مجموعة لتجميع منتجات مختارة وعرضها في الصفحة الرئيسية."
        rowActions={(row) => (
          <div className="flex justify-end">
            {visibility.button(row)}
            <Button
              variant="ghost"
              size="icon"
              aria-label={`تعديل ${row.name}`}
              onClick={() => {
                setForm({ name: row.name, description: row.description, name_en: row.name_en ?? '', description_en: row.description_en ?? '' })
                setEditing(row)
              }}
            >
              <Pencil aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`حذف ${row.name}`}
              onClick={() => setPendingDelete(row)}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        )}
      />

      <Dialog
        open={creating || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false)
            setEditing(null)
          }
        }}
      >
        <DialogContent>
          <DialogTitle>{editing ? 'تعديل المجموعة' : 'مجموعة جديدة'}</DialogTitle>
          <div className="mt-4 space-y-4">
            <Field id="col-name" label="الاسم">
              {(field) => (
                <Input
                  {...field}
                  value={form.name}
                  onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
                />
              )}
            </Field>
            <Field id="col-desc" label="الوصف">
              {(field) => (
                <Textarea
                  {...field}
                  rows={3}
                  value={form.description}
                  onChange={(event) => setForm((f) => ({ ...f, description: event.target.value }))}
                />
              )}
            </Field>
            <div className="space-y-3 rounded-xl border border-dashed border-border p-3">
              <p className="text-xs font-bold text-muted-foreground">للمتجر الإنجليزي (اختياري — الفارغ يظهر بالعربي)</p>
              <Field id="col-name-en" label="الاسم بالإنجليزية">
                {(field) => (
                  <Input
                    {...field}
                    dir="ltr"
                    value={form.name_en}
                    onChange={(event) => setForm((f) => ({ ...f, name_en: event.target.value }))}
                  />
                )}
              </Field>
              <Field id="col-desc-en" label="الوصف بالإنجليزية">
                {(field) => (
                  <Textarea
                    {...field}
                    dir="ltr"
                    rows={2}
                    value={form.description_en}
                    onChange={(event) => setForm((f) => ({ ...f, description_en: event.target.value }))}
                  />
                )}
              </Field>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setCreating(false)
                setEditing(null)
              }}
            >
              إلغاء
            </Button>
            <Button
              loading={create.isPending || update.isPending}
              disabled={form.name.trim().length < 2}
              onClick={async () => {
                if (editing) await update.mutateAsync({ id: editing.id, ...form })
                else await create.mutateAsync(form)
                setEditing(null)
                setCreating(false)
              }}
            >
              حفظ
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {visibility.dialog}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="حذف المجموعة"
        description={`سيتم حذف "${pendingDelete?.name}". المنتجات المرتبطة بها لن تُحذف.`}
        confirmLabel="حذف"
        loading={remove.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return
          await remove.mutateAsync(pendingDelete.id)
          setPendingDelete(null)
        }}
      />
    </>
  )
}
