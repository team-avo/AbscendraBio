"use client";

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Upload, X, Image as ImageIcon, Trash2 } from 'lucide-react';
import logger from '@/lib/logger';

interface ImageUploadProps {
  onImagesUploaded: (imageUrls: string[]) => void;
  existingImages?: string[];
  maxImages?: number;
}

export function ImageUpload({ onImagesUploaded, existingImages = [], maxImages = 10 }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>(existingImages);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (files: FileList) => {
    if (uploadedImages.length + files.length > maxImages) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }

    setUploading(true);
    const formData = new FormData();

    logger.info('Frontend - Files to upload:', { data: files.length });
    Array.from(files).forEach((file, index) => {
      logger.info(`Frontend - File ${index}:`, {
        data: {
          name: file.name,
          type: file.type,
          size: file.size
        }
      });
      if (file.type.startsWith('image/')) {
        formData.append('images', file);
        logger.info(`Frontend - Added file ${index} to FormData`);
      } else {
        logger.info(`Frontend - Skipped file ${index} (not an image)`);
      }
    });

    logger.info('Frontend - FormData entries:');
    for (let [key, value] of formData.entries()) {
      logger.info('FormData:', { key, value });
    }

    try {
      const response = await api.postFormData('/email-templates/upload-images', formData);

      if (response.success) {
        const newImageUrls = response.data.map((img: any) => img.url);
        const updatedImages = [...uploadedImages, ...newImageUrls];
        setUploadedImages(updatedImages);
        onImagesUploaded(updatedImages);
        toast.success(`${files.length} image(s) uploaded successfully`);
      } else {
        toast.error('Failed to upload images');
      }
    } catch (error) {
      logger.error('Upload error:', { error: error });
      toast.error('Failed to upload images');
    } finally {
      setUploading(false);
    }
  }, [uploadedImages, maxImages, onImagesUploaded]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files);
    }
  }, [handleUpload]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleUpload(e.target.files);
    }
  }, [handleUpload]);

  const removeImage = useCallback((index: number) => {
    const updatedImages = uploadedImages.filter((_, i) => i !== index);
    setUploadedImages(updatedImages);
    onImagesUploaded(updatedImages);
  }, [uploadedImages, onImagesUploaded]);

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Background Images</Label>
        <p className="text-sm text-muted-foreground">
          Upload images to use in your email template. Drag and drop or click to select.
        </p>
      </div>

      {/* Upload Area */}
      <Card
        className={`border-2 border-dashed transition-colors ${dragActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
            : 'border-gray-300 dark:border-gray-600'
          }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <CardContent className="p-6">
          <div className="text-center">
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Drag and drop images here, or{' '}
              <button
                type="button"
                onClick={openFileDialog}
                className="text-blue-600 hover:text-blue-500 underline"
                disabled={uploading}
              >
                browse
              </button>
            </p>
            <p className="text-xs text-gray-500">
              PNG, JPG, GIF up to 5MB each. Max {maxImages} images.
            </p>
            {uploading && (
              <p className="text-sm text-blue-600 mt-2">Uploading...</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileInput}
        className="hidden"
      />

      {/* Uploaded Images */}
      {uploadedImages.length > 0 && (
        <div className="space-y-2">
          <Label>Uploaded Images ({uploadedImages.length}/{maxImages})</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {uploadedImages.map((imageUrl, index) => (
              <div key={index} className="relative group">
                <div className="aspect-square rounded-lg border overflow-hidden bg-gray-100 dark:bg-gray-800">
                  <img
                    src={imageUrl}
                    alt={`Uploaded image ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Upload Button */}
      <Button
        type="button"
        variant="outline"
        onClick={openFileDialog}
        disabled={uploading || uploadedImages.length >= maxImages}
        className="w-full"
      >
        <ImageIcon className="h-4 w-4 mr-2" />
        {uploading ? 'Uploading...' : 'Add More Images'}
      </Button>
    </div>
  );
} 