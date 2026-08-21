import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, X, Upload, Image as ImageIcon } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

// Define a generic image shape for uploading
interface UploadedImage {
  id: string;
  url: string;
  altText?: string | null;
  [key: string]: any;
}

interface ImageUploadProps {
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  maxImages?: number;
  disabled?: boolean;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  images = [],
  onChange,
  maxImages = 10,
  disabled = false,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Check if adding these files would exceed the maximum
    if (images.length + files.length > maxImages) {
      setUploadError(`لا يمكن تحميل أكثر من ${maxImages} صور`);
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const uploadedImages: UploadedImage[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch('/api/images', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'فشل في تحميل الصورة');
        }

        const result = await response.json();
        
        // Convert the uploaded image to a generic UploadedImage
        uploadedImages.push({
          id: result.data.id || crypto.randomUUID(),
          url: result.data.urls.medium,
          altText: file.name.split('.')[0] || null,
        });
      }

      // Update with both existing images and newly uploaded ones
      const newImages = [...images, ...uploadedImages];
      onChange(newImages);
    } catch (error: any) {
      console.error('Image upload error:', error);
      setUploadError(error.message || 'فشل في تحميل الصورة');
    } finally {
      setIsUploading(false);
      // Clear the input value to allow uploading the same file again
      e.target.value = '';
    }
  };

  const handleRemove = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    onChange(newImages);
  };

  const handleReorder = (currentIndex: number, newIndex: number) => {
    if (newIndex < 0 || newIndex >= images.length) return;
    
    const newImages = [...images];
    const [movedItem] = newImages.splice(currentIndex, 1);
    newImages.splice(newIndex, 0, movedItem);

    onChange(newImages);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        {images.map((image, index) => (
          <Card key={image.id || index} className="relative group overflow-hidden w-[150px] h-[150px]">
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => handleRemove(index)}
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </Button>
              {index > 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 rounded-full mr-1"
                  onClick={() => handleReorder(index, index - 1)}
                  disabled={disabled}
                >
                  <span className="rotate-90">←</span>
                </Button>
              )}
              {index < images.length - 1 && (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 rounded-full ml-1"
                  onClick={() => handleReorder(index, index + 1)}
                  disabled={disabled}
                >
                  <span className="rotate-90">→</span>
                </Button>
              )}
            </div>
            <Image
              src={image.url}
              alt={image.altText || 'صورة المنتج'}
              className="object-cover"
              fill
              sizes="150px"
            />
            {index === 0 && (
              <div className="absolute bottom-1 right-1 bg-primary text-primary-foreground text-xs px-1 rounded">
                رئيسية
              </div>
            )}
          </Card>
        ))}

        {images.length < maxImages && (
          <Card 
            className={cn(
              "relative w-[150px] h-[150px] flex flex-col items-center justify-center cursor-pointer hover:bg-muted transition-colors",
              isUploading && "pointer-events-none opacity-70"
            )}
          >
            <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                multiple
                onChange={handleUpload}
                disabled={disabled || isUploading}
              />
              {isUploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <ImageIcon className="h-6 w-6 mb-1 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground text-center px-2">
                    انقر لاختيار صورة
                  </p>
                </>
              )}
            </label>
          </Card>
        )}
      </div>
      
      {uploadError && (
        <p className="text-destructive text-sm">{uploadError}</p>
      )}
      
      <p className="text-muted-foreground text-xs">
        {images.length} من {maxImages} صور. يفضل صور بأبعاد مربعة (1:1).
      </p>
    </div>
  );
};