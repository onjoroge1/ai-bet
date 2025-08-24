"use client"

import { Image, Video } from 'lucide-react'

interface BlogMedia {
  id: string
  type: string
  url: string
  filename: string
  size: number
  alt?: string
  caption?: string
  uploadedAt: string
}

interface BlogMediaDisplayProps {
  media: BlogMedia[]
}

export function BlogMediaDisplay({ media }: BlogMediaDisplayProps) {
  if (!media || media.length === 0) return null

  // Helper function to get the full URL for media
  const getMediaUrl = (url: string) => {
    // For local development, use the current window location
    const baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : (process.env.NEXTAUTH_URL || 'http://localhost:3000')
    
    // If it's already a full URL, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
    // If it's a relative path, construct the full URL
    if (url.startsWith('/')) {
      return `${baseUrl}${url}`
    }
    // If it's just a filename, construct the full URL
    return `${baseUrl}/uploads/image/${url}`
  }

  // Debug logging
  console.log('BlogMediaDisplay - Media items:', media)
  console.log('BlogMediaDisplay - Base URL:', typeof window !== 'undefined' ? window.location.origin : (process.env.NEXTAUTH_URL || 'http://localhost:3000'))

  return (
    <div className="mb-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {media.map((item) => {
          const fullUrl = getMediaUrl(item.url)
          console.log(`Media item ${item.id}:`, { originalUrl: item.url, fullUrl, type: item.type })
          
          return (
            <div key={item.id} className="bg-slate-800/50 rounded-lg overflow-hidden border border-slate-700">
              {item.type === 'image' ? (
                <div className="relative">
                  <img
                    src={fullUrl}
                    alt={item.alt || item.filename}
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      console.error('Image failed to load:', { originalUrl: item.url, fullUrl, error: e })
                      // Fallback to a placeholder or hide the image
                      e.currentTarget.style.display = 'none'
                    }}
                    onLoad={() => {
                      console.log('Image loaded successfully:', { originalUrl: item.url, fullUrl })
                    }}
                  />
                  {item.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-3 text-sm">
                      {item.caption}
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <video
                    src={fullUrl}
                    className="w-full h-48 object-cover"
                    controls
                    preload="metadata"
                    onError={(e) => {
                      console.error('Video failed to load:', { originalUrl: item.url, fullUrl, error: e })
                    }}
                  />
                  {item.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-3 text-sm">
                      {item.caption}
                    </div>
                  )}
                </div>
              )}
              
              {/* Media Info */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  {item.type === 'image' ? (
                    <Image className="w-4 h-4 text-blue-400" />
                  ) : (
                    <Video className="w-4 h-4 text-purple-400" />
                  )}
                  <span className="text-xs text-slate-400 uppercase tracking-wide">
                    {item.type}
                  </span>
                </div>
                
                {item.alt && (
                  <p className="text-sm text-slate-300 mb-2">
                    <span className="text-slate-400">Alt:</span> {item.alt}
                  </p>
                )}
                
                {item.caption && (
                  <p className="text-sm text-slate-300">
                    {item.caption}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
