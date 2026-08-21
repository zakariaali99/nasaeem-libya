import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, ArrowUp, ArrowDown, Upload } from 'lucide-react';
import { ProductImage } from '@/modules/images/types/imageTypes';
import { CarouselWidget } from '@/modules/customization/types/customizationTypes';

// Slide type derived from CarouselWidget data
type Slide = CarouselWidget['data']['slides'][number];

interface CarouselEditorProps {
  slides: Slide[];
  onChange: (slides: Slide[]) => void;
}

export const CarouselEditor: React.FC<CarouselEditorProps> = ({ slides, onChange }) => {
  // Handler to upload files via API and append slides
  const handleFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newSlides: Slide[] = [];
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch('/api/images', { method: 'POST', body: formData });
      if (!res.ok) continue;
      const result = await res.json();
      newSlides.push({
        imageUrl: result.data.urls.medium,
        linkUrl: '',
        title: '',
        subtitle: '',
      });
    }
    onChange([...slides, ...newSlides]);
    // reset input
    e.target.value = '';
  };

  // track which slide is selected for editing
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const updateSlide = (idx: number, key: keyof Slide, value: any) => {
    const updated = slides.map((s, i) => i === idx ? { ...s, [key]: value } : s);
    onChange(updated);
  };

  const removeSlide = (idx: number) => {
    const updated = slides.filter((_, i) => i !== idx);
    onChange(updated);
  };

  const moveSlide = (from: number, to: number) => {
    const arr = [...slides];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    onChange(arr);
  };

  return (
    <div className="space-y-4">
      {/* thumbnails with upload at end */}
      <div className="flex space-x-2 overflow-x-auto">
        {slides.map((s, i) => (
          <img
            key={i}
            src={s.imageUrl}
            alt={s.title || ''}
            className={`w-24 h-24 object-cover rounded cursor-pointer border ${editingIdx === i ? 'border-primary' : 'border-transparent'}`}
            onClick={() => setEditingIdx(i)}
          />
        ))}
        { /* upload slot follows */ }
        <Card className="relative w-24 h-24 flex items-center justify-center cursor-pointer border border-dashed">
          <label className="w-full h-full flex flex-col items-center justify-center">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              multiple
              onChange={handleFilesUpload}
            />
            <Upload className="w-6 h-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground mt-1">تحميل</p>
          </label>
        </Card>
      </div>

      {/* editing form for selected slide */}
      {editingIdx !== null && slides[editingIdx] && (
        <Card key={editingIdx} className="p-4 space-y-2">
          <div className="flex space-x-2">
            <Button variant="destructive" size="icon" onClick={() => { removeSlide(editingIdx); setEditingIdx(null); }}>
              <X className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" disabled={editingIdx === 0} onClick={() => moveSlide(editingIdx, editingIdx - 1)}>
              <ArrowUp className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" disabled={editingIdx === slides.length - 1} onClick={() => moveSlide(editingIdx, editingIdx + 1)}>
              <ArrowDown className="w-4 h-4" />
            </Button>
          </div>
          <Input
            value={slides[editingIdx].title}
            placeholder="عنوان الشريحة"
            onChange={e => updateSlide(editingIdx, 'title', e.target.value)}
          />
          <Input
            value={slides[editingIdx].subtitle}
            placeholder="وصف الشريحة"
            onChange={e => updateSlide(editingIdx, 'subtitle', e.target.value)}
          />
          <Input
            value={slides[editingIdx].linkUrl}
            placeholder="رابط عند النقر"
            onChange={e => updateSlide(editingIdx, 'linkUrl', e.target.value)}
          />
        </Card>
      )}
    </div>
  );
};
