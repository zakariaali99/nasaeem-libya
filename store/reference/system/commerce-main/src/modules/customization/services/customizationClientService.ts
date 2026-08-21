import { Widget } from '@/modules/customization/types/customizationTypes';

export async function listWidgets() {
  const res = await fetch('/api/customization');
  if (!res.ok) throw new Error('فشل جلب العناصر');
  return res.json();
}

export async function updateWidgetOrder(updates: { id: string; order: number }[]) {
  const res = await fetch('/api/customization', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('فشل تحديث الترتيب');
  return res.json();
}

// ...other client functions for create, update, delete if needed...
