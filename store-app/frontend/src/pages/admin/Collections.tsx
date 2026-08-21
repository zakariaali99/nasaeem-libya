import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { PageHeader } from '@/components/layout/AdminLayout'
import { Badge } from '@/components/ui/badge'
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
  const query = useCollections()
  const create = useCreateCollection()
  const update = useUpdateCollection()
  const remove = useDeleteCollection()

  const [editing, setEditing] = useState<Collection | null>(null)
  const [creating, setCreating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Collection | null>(null)
  const [form, setForm] = useState({ name: '', description: '' })

  const columns: Column<Collection>[] = [
    { key: 'name', header: 'المجموعة', cell: (row) => <span className="font-medium text-foreground">{row.name}</span> },
    { key: 'slug', header: 'المعرّف', cell: (row) => <span className="text-muted-foreground">{row.slug}</span> },
    { key: 'description', header: 'الوصف', cell: (row) => row.description || '—' },
    {
      key: 'is_active',
      header: 'الحالة',
      cell: (row) => (row.is_active ? <Badge tone="success">مفعّلة</Badge> : <Badge tone="neutral">موقوفة</Badge>),
    },
  ]

  return (
    <>
      <PageHeader
        title="المجموعات"
        description="مجموعات مختارة مثل «الأكثر مبيعاً» أو «عروض الموسم»."
        actions={
          <Button
            onClick={() => {
              setForm({ name: '', description: '' })
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
            <Button
              variant="ghost"
              size="icon"
              aria-label={`تعديل ${row.name}`}
              onClick={() => {
                setForm({ name: row.name, description: row.description })
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
                if (editing) await update.mutateAsync({ lookup: editing.slug, ...form })
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

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="حذف المجموعة"
        description={`سيتم حذف "${pendingDelete?.name}". المنتجات المرتبطة بها لن تُحذف.`}
        confirmLabel="حذف"
        loading={remove.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return
          await remove.mutateAsync(pendingDelete.slug)
          setPendingDelete(null)
        }}
      />
    </>
  )
}
