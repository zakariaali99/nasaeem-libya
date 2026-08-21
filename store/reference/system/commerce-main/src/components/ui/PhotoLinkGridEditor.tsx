import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, ArrowUp, ArrowDown, Upload, Image as ImageIcon } from 'lucide-react';

export type PhotoLinkItem = {
  imageUrl: string;
  name: string;
  linkUrl?: string;
};

interface PhotoLinkGridEditorProps {
  items: PhotoLinkItem[];
  onChange: (items: PhotoLinkItem[]) => void;
}

export const PhotoLinkGridEditor: React.FC<PhotoLinkGridEditorProps> = ({ items, onChange }) => {
  const safeItems = Array.isArray(items) ? items : [];
  const [editingIdx, setEditingIdx] = useState<number | null>(safeItems.length ? 0 : null);

  useEffect(() => {
    if (!safeItems.length) {
      setEditingIdx(null);
    } else if (editingIdx === null || editingIdx >= safeItems.length) {
      setEditingIdx(0);
    }
  }, [safeItems.length, editingIdx]);

  const updateItem = (idx: number, payload: Partial<PhotoLinkItem>) => {
    const next = safeItems.map((item, i) => (i === idx ? { ...item, ...payload } : item));
    onChange(next);
  };

  const handleFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newItems: PhotoLinkItem[] = [];

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch('/api/images', { method: 'POST', body: formData });
      if (!res.ok) continue;
      const result = await res.json();
      newItems.push({ imageUrl: result.data.urls.medium, name: '', linkUrl: '' });
    }

    if (newItems.length) {
      onChange([...safeItems, ...newItems]);
      setEditingIdx(safeItems.length); // focus first of new uploads
    }
    e.target.value = '';
  };

  const replaceImage = async (idx: number, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch('/api/images', { method: 'POST', body: formData });
    if (!res.ok) return;
    const result = await res.json();
    updateItem(idx, { imageUrl: result.data.urls.medium });
  };

  const removeItem = (idx: number) => {
    const next = safeItems.filter((_, i) => i !== idx);
    onChange(next);
    if (editingIdx !== null) {
      if (next.length === 0) setEditingIdx(null);
      else if (idx === editingIdx) setEditingIdx(Math.max(0, idx - 1));
      else if (idx < editingIdx) setEditingIdx(editingIdx - 1);
    }
  };

  const moveItem = (from: number, to: number) => {
    if (to < 0 || to >= safeItems.length) return;
    const arr = [...safeItems];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    onChange(arr);
    setEditingIdx(to);
  };

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex space-x-2 overflow-x-auto">
        {safeItems.map((item, i) => (
          <img
            key={i}
            src={item.imageUrl || '/placeholder.png'}
            alt={item.name || ''}
            className={`w-20 h-20 object-cover rounded cursor-pointer border ${editingIdx === i ? 'border-primary' : 'border-transparent'}`}
            onClick={() => setEditingIdx(i)}
          />
        ))}
        <Card className="relative w-20 h-20 flex items-center justify-center cursor-pointer border border-dashed">
          <label className="w-full h-full flex flex-col items-center justify-center">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              multiple
              onChange={handleFilesUpload}
            />
            <Upload className="w-5 h-5 text-muted-foreground" />
            <p className="text-[10px] text-muted-foreground mt-1">تحميل</p>
          </label>
        </Card>
      </div>

      {editingIdx !== null && safeItems[editingIdx] && (
        <Card className="p-4 space-y-3">
          <div className="flex gap-2">
            <Button variant="destructive" size="icon" onClick={() => removeItem(editingIdx)}>
              <X className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" disabled={editingIdx === 0} onClick={() => moveItem(editingIdx, editingIdx - 1)}>
              <ArrowUp className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" disabled={editingIdx === safeItems.length - 1} onClick={() => moveItem(editingIdx, editingIdx + 1)}>
              <ArrowDown className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">استبدال الصورة</label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer border rounded px-3 py-2 hover:bg-muted">
              <ImageIcon className="w-4 h-4" />
              <span>اختر صورة</span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) replaceImage(editingIdx, file);
                }}
              />
            </label>
          </div>

          <Input
            value={safeItems[editingIdx].name || ''}
            onChange={(e) => updateItem(editingIdx, { name: e.target.value })}
            placeholder="عنوان أو اسم العنصر"
          />
          <Input
            value={safeItems[editingIdx].linkUrl || ''}
            onChange={(e) => updateItem(editingIdx, { linkUrl: e.target.value })}
            placeholder="الرابط عند النقر (اختياري)"
          />
        </Card>
      )}
    </div>
  );
};
