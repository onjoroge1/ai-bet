"use client"

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  Upload, 
  Image, 
  Video, 
  X, 
  Eye, 
  Download,
  Trash2,
  Plus,
  FileImage,
  FileVideo
} from 'lucide-react'
import { toast } from 'sonner'

export interface MediaItem {
  id: string
  type: 'image' | 'video'
  url: string
  filename: string
  size: number
  alt?: string
  caption?: string
  uploadedAt: Date
}

interface MediaUploadProps {
  media: MediaItem[]
  onMediaChange: (media: MediaItem[]) => void
  maxFiles?: number
  acceptedTypes?: ('image' | 'video')[]
  className?: string
}

export function MediaUpload({ 
  media, 
  onMediaChange, 
  maxFiles = 10, 
  acceptedTypes = ['image', 'video'],
  className = '' 
}: MediaUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    handleFiles(files)
  }

  const handleFiles = async (files: File[]) => {
    if (media.length + files.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`)
      return
    }

    setUploading(true)
    
    try {
      const newMediaItems: MediaItem[] = []
      
      for (const file of files) {
        // Validate file type
        const fileType = file.type.startsWith('image/') ? 'image' : 
                        file.type.startsWith('video/') ? 'video' : null
        
        if (!fileType || !acceptedTypes.includes(fileType)) {
          toast.error(`${file.name} is not a supported file type`)
          continue
        }

        // Validate file size (10MB for images, 100MB for videos)
        const maxSize = fileType === 'image' ? 10 * 1024 * 1024 : 100 * 1024 * 1024
        if (file.size > maxSize) {
          toast.error(`${file.name} is too large. Max size: ${fileType === 'image' ? '10MB' : '100MB'}`)
          continue
        }

        // Upload file to server
        const formData = new FormData()
        formData.append('file', file)
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          toast.error(`Failed to upload ${file.name}: ${errorData.error || 'Upload failed'}`)
          continue
        }
        
        const uploadResult = await response.json()
        
        const mediaItem: MediaItem = {
          id: `temp-${Date.now()}-${Math.random()}`,
          type: fileType,
          url: uploadResult.data.url,
          filename: uploadResult.data.filename,
          size: file.size,
          uploadedAt: new Date()
        }
        
        newMediaItems.push(mediaItem)
      }

      if (newMediaItems.length > 0) {
        onMediaChange([...media, ...newMediaItems])
        toast.success(`Added ${newMediaItems.length} file(s)`)
      }
    } catch (error) {
      console.error('Error handling files:', error)
      toast.error('Error uploading files')
    } finally {
      setUploading(false)
    }
  }

  const removeMedia = (id: string) => {
    const updatedMedia = media.filter(item => item.id !== id)
    onMediaChange(updatedMedia)
    toast.success('Media removed')
  }

  const updateMedia = (id: string, updates: Partial<MediaItem>) => {
    const updatedMedia = media.map(item => 
      item.id === id ? { ...item, ...updates } : item
    )
    onMediaChange(updatedMedia)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (type: 'image' | 'video') => {
    return type === 'image' ? <FileImage className="w-5 h-5" /> : <FileVideo className="w-5 h-5" />
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      <Card className={`border-2 border-dashed transition-colors ${
        isDragOver 
          ? 'border-emerald-400 bg-emerald-400/10' 
          : 'border-slate-600 bg-slate-800/50'
      }`}>
        <CardContent className="p-6">
          <div
            className="text-center"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="p-4 bg-slate-700/50 rounded-full">
                <Upload className="w-8 h-8 text-slate-400" />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Drop files here or click to upload
                </h3>
                <p className="text-slate-400 text-sm mb-4">
                  Support for {acceptedTypes.join(' and ')} files
                </p>
                
                <div className="flex items-center justify-center space-x-2 mb-4">
                  {acceptedTypes.includes('image') && (
                    <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">
                      <Image className="w-3 h-3 mr-1" />
                      Images
                    </Badge>
                  )}
                  {acceptedTypes.includes('video') && (
                    <Badge variant="secondary" className="bg-purple-500/20 text-purple-400">
                      <Video className="w-3 h-3 mr-1" />
                      Videos
                    </Badge>
                  )}
                </div>
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('file-upload')?.click()}
                  disabled={uploading}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Choose Files'}
                </Button>
                
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  accept={acceptedTypes.map(type => 
                    type === 'image' ? 'image/*' : 'video/*'
                  ).join(',')}
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Media List */}
      {media.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <span>Media Files ({media.length}/{maxFiles})</span>
              <Badge variant="secondary" className="bg-slate-600 text-slate-300">
                {media.filter(m => m.type === 'image').length} images, {media.filter(m => m.type === 'video').length} videos
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {media.map((item) => (
                <div key={item.id} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                  {/* Preview */}
                  <div className="relative mb-3">
                    {item.type === 'image' ? (
                      <img
                        src={item.url}
                        alt={item.alt || item.filename}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                    ) : (
                      <video
                        src={item.url}
                        className="w-full h-32 object-cover rounded-lg"
                        controls
                      />
                    )}
                    
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMedia(item.id)}
                      className="absolute top-2 right-2 p-1 h-8 w-8 bg-red-500/80 hover:bg-red-500 text-white"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* File Info */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      {getFileIcon(item.type)}
                      <span className="text-sm font-medium text-white truncate">
                        {item.filename}
                      </span>
                    </div>
                    
                    <div className="text-xs text-slate-400">
                      {formatFileSize(item.size)}
                    </div>

                    {/* Alt Text */}
                    <div>
                      <Label htmlFor={`alt-${item.id}`} className="text-xs text-slate-300">
                        Alt Text
                      </Label>
                      <Input
                        id={`alt-${item.id}`}
                        value={item.alt || ''}
                        onChange={(e) => updateMedia(item.id, { alt: e.target.value })}
                        placeholder="Describe the media for accessibility"
                        className="h-8 text-xs bg-slate-600 border-slate-500 text-white"
                      />
                    </div>

                    {/* Caption */}
                    <div>
                      <Label htmlFor={`caption-${item.id}`} className="text-xs text-slate-300">
                        Caption
                      </Label>
                      <Input
                        id={`caption-${item.id}`}
                        value={item.caption || ''}
                        onChange={(e) => updateMedia(item.id, { caption: e.target.value })}
                        placeholder="Optional caption text"
                        className="h-8 text-xs bg-slate-600 border-slate-500 text-white"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2 pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(item.url, '_blank')}
                        className="h-7 px-2 text-xs bg-slate-600 hover:bg-slate-500 text-slate-300"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Preview
                      </Button>
                      
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const link = document.createElement('a')
                          link.href = item.url
                          link.download = item.filename
                          link.click()
                        }}
                        className="h-7 px-2 text-xs bg-slate-600 hover:bg-slate-500 text-slate-300"
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Download
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
