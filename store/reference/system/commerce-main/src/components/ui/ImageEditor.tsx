import React from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ImageUpload } from '@/components/ui/image-upload';
import { ProductImage } from '@/modules/images/types/imageTypes';

export interface ImageEditorProps {
  imageUrl: string;
  altText?: string;
  linkUrl?: string;
  onChange: (data: { imageUrl: string; altText?: string; linkUrl?: string }) => void;
}

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageUrl, altText = '', linkUrl = '', onChange }) => {
  const uiImg: ProductImage = {
    id: imageUrl || '0',
    url: imageUrl,
    altText: altText || null,
    sortOrder: 0,
    productId: '',
    variantId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return (
    <Card className="space-y-4 p-4">
      <ImageUpload
        images={imageUrl ? [uiImg] : []}
        onChange={(imgs) => {
          const img = imgs[0];
          onChange({ imageUrl: img.url, altText: img.altText || '', linkUrl });
        }}
        maxImages={1}
      />
      <Input
        value={altText}
        onChange={(e) => onChange({ imageUrl, altText: e.target.value, linkUrl })}
        placeholder="النص البديل (altText)"
      />
      <Input
        value={linkUrl}
        onChange={(e) => onChange({ imageUrl, altText, linkUrl: e.target.value })}
        placeholder="رابط عند النقر"
      />
    </Card>
  );
};
