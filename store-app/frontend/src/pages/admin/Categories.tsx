import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { ImageUploadField } from '@/components/admin/ImageUploadField'
import { PageHeader } from '@/components/layout/AdminLayout'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory,
} from '@/lib/queries/catalog'
import { usePageTitle } from '@/lib/usePageTitle'
import type { Category } from '@/types/api'

export default function AdminCategoriesPage() {
  usePageTitle('التصنيفات — لوحة التحكم')
  const query = useCategories()
  const create = useCreateCategory()
  const update = useUpdateCategory()
  const remove = useDeleteCategory()

  const [editing, setEditing] = useState<Category | null>(null)
  const [creating, setCreating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null)
  const [form, setForm] = useState({ name: '', description: '', image_url: '' })

  const openCreate = () => {
    setForm({ name: '', description: '', image_url: '' })
    setCreating(true)
  }
  const openEdit = (category: Category) => {
    setForm({ name: category.name, description: category.description, image_url: category.image_url })
    setEditing(category)
  }

  const save = async () => {
    if (editing) await update.mutateAsync({ lookup: editing.slug, ...form })
    else await create.mutateAsync(form)
    setEditing(null)
    setCreating(false)
  }

  return (
    <>
      <PageHeader
        title="التصنيفات"
        description="التصنيفات هي الطريقة التي يتصفّح بها العميل المتجر — كل علامة تجارية تصنيف."
        actions={
          <Button onClick={openCreate}>
            <Plus aria-hidden="true" />
            تصنيف جديد
          </Button>
        }
      />

      {query.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
      ) : query.error ? (
        <Alert tone="error">تعذّر تحميل التصنيفات.</Alert>
      ) : (query.data ?? []).length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <h2 className="text-lg font-semibold text-foreground">لا توجد تصنيفات</h2>
          <p className="mt-2 text-sm text-muted-foreground">أنشئ أول تصنيف لتنظيم المنتجات.</p>
          <Button className="mt-4" onClick={openCreate}>
            <Plus aria-hidden="true" />
            تصنيف جديد
          </Button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(query.data ?? []).map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              onEdit={openEdit}
              onDelete={setPendingDelete}
            />
          ))}
        </ul>
      )}

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
          <DialogTitle>{editing ? 'تعديل التصنيف' : 'تصنيف جديد'}</DialogTitle>
          <div className="mt-4 space-y-4">
            <Field id="cat-name" label="الاسم">
              {(field) => (
                <Input
                  {...field}
                  value={form.name}
                  onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
                />
              )}
            </Field>
            <Field id="cat-desc" label="الوصف">
              {(field) => (
                <Textarea
                  {...field}
                  rows={3}
                  value={form.description}
                  onChange={(event) => setForm((f) => ({ ...f, description: event.target.value }))}
                />
              )}
            </Field>
            <ImageUploadField
              label="شعار أو صورة التصنيف"
              hint="اختر ملف الصورة من جهازك (PNG, SVG, JPG, WebP)"
              value={form.image_url}
              onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
              aspectRatio="square"
            />
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
              onClick={save}
            >
              حفظ
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="حذف التصنيف"
        description={`سيتم حذف "${pendingDelete?.name}". المنتجات المرتبطة به لن تُحذف.`}
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

function CategoryCard({
  category, onEdit, onDelete, depth = 0,
}: {
  category: Category
  onEdit: (category: Category) => void
  onDelete: (category: Category) => void
  depth?: number
}) {
  return (
    <li className="rounded-lg border border-border bg-card p-4" style={{ marginInlineStart: depth * 16 }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {category.image_url ? (
            <img
              src={category.image_url}
              alt=""
              width={40}
              height={40}
              loading="lazy"
              className="size-10 shrink-0 object-contain"
            />
          ) : null}
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{category.name}</p>
            <p className="truncate text-xs text-muted-foreground">{category.slug}</p>
          </div>
        </div>
        <div className="flex shrink-0">
          <Button variant="ghost" size="icon" aria-label={`تعديل ${category.name}`} onClick={() => onEdit(category)}>
            <Pencil aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`حذف ${category.name}`}
            disabled={category.is_system}
            onClick={() => onDelete(category)}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {category.is_active ? <Badge tone="success">مفعّل</Badge> : <Badge tone="neutral">موقوف</Badge>}
        {category.is_system ? <Badge tone="primary">نظامي</Badge> : null}
      </div>
      {category.children.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {category.children.map((child) => (
            <CategoryCard key={child.id} category={child} onEdit={onEdit} onDelete={onDelete} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}
