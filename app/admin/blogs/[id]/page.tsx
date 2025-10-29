'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { MediaUpload, MediaItem } from '@/components/admin/media-upload'
import { 
  ArrowLeft, 
  Save, 
  Eye, 
  Calendar,
  User,
  Tag,
  Globe,
  TrendingUp,
  Loader2,
  Image,
  Video,
  Search,
  Plus,
  Trash2
} from 'lucide-react'
import { toast } from 'sonner'

interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt: string
  content: string
  author: string
  category: string
  tags: string[]
  geoTarget: string[]
  featured: boolean
  readTime: number
  seoTitle: string
  seoDescription: string
  seoKeywords: string[]
  isPublished: boolean
  isActive: boolean
  publishedAt: string
  viewCount: number
  shareCount: number
  media?: MediaItem[]
}

export default function EditBlogPage() {
  const router = useRouter()
  const params = useParams()
  const blogId = params.id as string
  
  const [blog, setBlog] = useState<BlogPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    author: '',
    category: '',
    tags: [] as string[],
    geoTarget: [] as string[],
    featured: false,
    readTime: 5,
    seoTitle: '',
    seoDescription: '',
    seoKeywords: [] as string[],
    isPublished: true,
    isActive: true,
    media: [] as MediaItem[]
  })

  const [tagInput, setTagInput] = useState('')
  const [keywordInput, setKeywordInput] = useState('')

  // Team logo management state
  const [teamLogoSearch, setTeamLogoSearch] = useState('')
  const [logoSearchResult, setLogoSearchResult] = useState<any>(null)
  const [logoSearchLoading, setLogoSearchLoading] = useState(false)
  const [blogLogos, setBlogLogos] = useState<any[]>([])
  const [bothTeamsSearch, setBothTeamsSearch] = useState('')
  const [bothTeamsLoading, setBothTeamsLoading] = useState(false)
  const [bothTeamsResults, setBothTeamsResults] = useState<any[]>([])

  useEffect(() => {
    if (blogId) {
      fetchBlog()
    }
  }, [blogId])

  const fetchBlog = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/blogs/${blogId}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Blog post not found')
          return
        }
        throw new Error('Failed to fetch blog post')
      }
      
      const blogData = await response.json()
      setBlog(blogData)
      
      // Update form data with fetched blog data
      setFormData({
        title: blogData.title || '',
        slug: blogData.slug || '',
        excerpt: blogData.excerpt || '',
        content: blogData.content || '',
        author: blogData.author || '',
        category: blogData.category || '',
        tags: blogData.tags || [],
        geoTarget: blogData.geoTarget || [],
        featured: blogData.featured || false,
        readTime: blogData.readTime || 5,
        seoTitle: blogData.seoTitle || '',
        seoDescription: blogData.seoDescription || '',
        seoKeywords: blogData.seoKeywords || [],
        isPublished: blogData.isPublished !== undefined ? blogData.isPublished : true,
        isActive: blogData.isActive !== undefined ? blogData.isActive : true,
        media: blogData.media || []
      })
      
      // Fetch team logos for this blog
      fetchBlogLogos()
    } catch (error) {
      console.error('Error fetching blog:', error)
      setError('Failed to fetch blog post')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setSaving(true)
      
      const response = await fetch(`/api/blogs/${blogId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })
      
      if (!response.ok) {
        throw new Error('Failed to update blog post')
      }
      
      toast.success('Blog post updated successfully!')
      
      // Refresh the blog data
      await fetchBlog()
    } catch (error) {
      console.error('Error updating blog:', error)
      toast.error('Failed to update blog post')
    } finally {
      setSaving(false)
    }
  }

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }))
      setTagInput('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const addKeyword = () => {
    if (keywordInput.trim() && !formData.seoKeywords.includes(keywordInput.trim())) {
      setFormData(prev => ({
        ...prev,
        seoKeywords: [...prev.seoKeywords, keywordInput.trim()]
      }))
      setKeywordInput('')
    }
  }

  const removeKeyword = (keywordToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      seoKeywords: prev.seoKeywords.filter(keyword => keyword !== keywordToRemove)
    }))
  }

  const handleMediaChange = (media: MediaItem[]) => {
    setFormData(prev => ({
      ...prev,
      media
    }))
  }

  // Team logo management functions
  const handleSearchTeamLogo = async () => {
    if (!teamLogoSearch.trim()) return

    try {
      setLogoSearchLoading(true)
      setLogoSearchResult(null)
      
      const response = await fetch(`/api/team-logo?team=${encodeURIComponent(teamLogoSearch.trim())}`)
      const data = await response.json()
      
      if (response.ok) {
        setLogoSearchResult(data)
        toast.success(`Found logo for ${data.name}`)
      } else {
        toast.error(data.error || 'Failed to fetch team logo')
      }
    } catch (error) {
      console.error('Error fetching team logo:', error)
      toast.error('Failed to fetch team logo')
    } finally {
      setLogoSearchLoading(false)
    }
  }

  const handleAddTeamLogo = async (logoData: any) => {
    console.log('Adding team logo:', logoData)
    
    if (!logoData.logo) {
      toast.error('No logo URL available for this team')
      return
    }
    
    try {
      const response = await fetch(`/api/blogs/${blogId}/team-logos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teamId: logoData.id,
          teamName: logoData.name,
          logoUrl: logoData.logo,
          country: logoData.country,
        }),
      })

      const data = await response.json()
      
      if (response.ok) {
        toast.success(`Team logo added for ${logoData.name}`)
        fetchBlogLogos() // Refresh the blog logos list
        setLogoSearchResult(null) // Clear search result
        setTeamLogoSearch('') // Clear search input
      } else {
        toast.error(data.error || 'Failed to add team logo')
      }
    } catch (error) {
      console.error('Error adding team logo:', error)
      toast.error('Failed to add team logo')
    }
  }

  const handleRemoveTeamLogo = async (logoId: string) => {
    if (!confirm('Are you sure you want to remove this team logo?')) return

    try {
      const response = await fetch(`/api/blogs/${blogId}/team-logos/${logoId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success('Team logo removed successfully')
        fetchBlogLogos() // Refresh the blog logos list
      } else {
        toast.error(data.error || 'Failed to remove team logo')
      }
    } catch (error) {
      console.error('Error removing team logo:', error)
      toast.error('Failed to remove team logo')
    }
  }

  const fetchBlogLogos = async () => {
    try {
      const response = await fetch(`/api/blogs/${blogId}/team-logos`)
      const data = await response.json()
      
      if (data.success) {
        setBlogLogos(data.data)
      }
    } catch (error) {
      console.error('Error fetching blog logos:', error)
    }
  }

  // Fetch logos for both teams (e.g., "Arsenal vs Chelsea")
  const handleFetchBothTeams = async () => {
    if (!bothTeamsSearch.trim()) return

    try {
      setBothTeamsLoading(true)
      setBothTeamsResults([])
      
      // Parse team names from input like "Arsenal vs Chelsea" or "Arsenal, Chelsea"
      const teamNames = bothTeamsSearch
        .split(/[vs,]/)
        .map(name => name.trim())
        .filter(name => name.length > 0)
      
      if (teamNames.length < 2) {
        toast.error('Please enter two team names (e.g., "Arsenal vs Chelsea")')
        return
      }

      const response = await fetch(`/api/team-logos?teams=${teamNames.join(',')}`)
      const data = await response.json()
      
      if (data.success) {
        setBothTeamsResults(data.teams)
        const successCount = data.teams.filter((t: any) => t.success).length
        toast.success(`Found logos for ${successCount}/${teamNames.length} teams`)
      } else {
        toast.error(data.error || 'Failed to fetch team logos')
      }
    } catch (error) {
      console.error('Error fetching both team logos:', error)
      toast.error('Failed to fetch team logos')
    } finally {
      setBothTeamsLoading(false)
    }
  }

  // Add multiple team logos at once
  const handleAddMultipleLogos = async (teams: any[]) => {
    const successfulTeams = teams.filter(t => t.success)
    
    if (successfulTeams.length === 0) {
      toast.error('No valid team logos to add')
      return
    }

    try {
      const promises = successfulTeams.map(team => 
        fetch(`/api/blogs/${blogId}/team-logos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            teamId: team.id,
            teamName: team.name,
            logoUrl: team.logo,
            country: team.country,
          }),
        })
      )

      const responses = await Promise.all(promises)
      const results = await Promise.all(responses.map(r => r.json()))
      
      const successCount = results.filter(r => r.success).length
      toast.success(`Added ${successCount}/${successfulTeams.length} team logos`)
      
      fetchBlogLogos() // Refresh the blog logos list
      setBothTeamsResults([]) // Clear results
      setBothTeamsSearch('') // Clear input
    } catch (error) {
      console.error('Error adding multiple team logos:', error)
      toast.error('Failed to add team logos')
    }
  }

  const categories = [
    'predictions',
    'strategy', 
    'analysis',
    'technology',
    'success-stories',
    'tips'
  ]

  const geoOptions = [
    { value: 'worldwide', label: 'Worldwide' },
    { value: 'KE', label: 'Kenya' },
    { value: 'NG', label: 'Nigeria' },
    { value: 'ZA', label: 'South Africa' },
    { value: 'GH', label: 'Ghana' },
    { value: 'UG', label: 'Uganda' }
  ]

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mx-auto mb-4" />
            <p className="text-slate-400">Loading blog post...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Error</h1>
          <p className="text-slate-400 mb-6">{error}</p>
          <Button onClick={() => router.push('/admin/blogs')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Blogs
          </Button>
        </div>
      </div>
    )
  }

  if (!blog) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Blog Post Not Found</h1>
          <p className="text-slate-400 mb-6">The blog post you're looking for doesn't exist.</p>
          <Button onClick={() => router.push('/admin/blogs')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Blogs
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => router.push('/admin/blogs')}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Blogs
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white">Edit Blog Post</h1>
            <p className="text-slate-400">Update your blog post content and settings</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => window.open(`/blog/${blog.slug}`, '_blank')}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Blog Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Views</p>
                <p className="text-2xl font-bold text-white">{blog.viewCount}</p>
              </div>
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <Eye className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Shares</p>
                <p className="text-2xl font-bold text-white">{blog.shareCount}</p>
              </div>
              <div className="p-3 bg-green-500/20 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Published</p>
                <p className="text-2xl font-bold text-white">
                  {new Date(blog.publishedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="p-3 bg-purple-500/20 rounded-lg">
                <Calendar className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Status</p>
                <Badge className={`mt-1 ${
                  blog.isPublished 
                    ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                    : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                }`}>
                  {blog.isPublished ? 'Published' : 'Draft'}
                </Badge>
              </div>
              <div className="p-3 bg-yellow-500/20 rounded-lg">
                <Tag className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="title" className="text-slate-300">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="bg-slate-700 border-slate-600 text-white"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="slug" className="text-slate-300">Slug</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                  className="bg-slate-700 border-slate-600 text-white"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="excerpt" className="text-slate-300">Excerpt</Label>
              <Textarea
                id="excerpt"
                value={formData.excerpt}
                onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
                className="bg-slate-700 border-slate-600 text-white"
                rows={3}
              />
            </div>

            {/* Media Upload Section */}
            <div>
              <Label className="text-slate-300 mb-4 block">
                <div className="flex items-center space-x-2 mb-2">
                  <Image className="w-4 h-4" />
                  <span>Images & Videos</span>
                </div>
                <p className="text-slate-400 text-sm font-normal">
                  Upload images and videos to enhance your blog post. Support for JPG, PNG, GIF, MP4, and WebM formats.
                </p>
              </Label>
              <MediaUpload
                media={formData.media}
                onMediaChange={handleMediaChange}
                maxFiles={20}
                acceptedTypes={['image', 'video']}
              />
            </div>

            {/* Team Logo Management */}
            <div>
              <Label className="text-slate-300 mb-2 block">Team Logos</Label>
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Add Team Logos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Fetch Both Teams */}
                  <div className="p-3 bg-slate-700 rounded-md">
                    <h4 className="text-white font-medium mb-2">Quick Add Both Teams</h4>
                    <div className="flex gap-3 items-end">
                      <div className="flex-1">
                        <Label className="text-slate-300 mb-1">Both Teams</Label>
                        <Input
                          type="text"
                          placeholder="e.g., Arsenal vs Chelsea, Real Madrid vs Barcelona"
                          value={bothTeamsSearch}
                          onChange={(e) => setBothTeamsSearch(e.target.value)}
                          className="bg-slate-600 border-slate-500 text-white"
                        />
                      </div>
                      <Button
                        onClick={handleFetchBothTeams}
                        disabled={!bothTeamsSearch.trim() || bothTeamsLoading}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        {bothTeamsLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Fetching...
                          </>
                        ) : (
                          <>
                            <Search className="w-4 h-4 mr-2" />
                            Fetch Both
                          </>
                        )}
                      </Button>
                    </div>
                    
                    {/* Both teams results */}
                    {bothTeamsResults.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {bothTeamsResults.map((result, index) => (
                          <div key={index} className="flex items-center gap-3 p-2 bg-slate-600 rounded">
                            {result.success ? (
                              <>
                                <img 
                                  src={result.logo} 
                                  alt={`${result.name} logo`}
                                  className="w-8 h-8 object-contain"
                                />
                                <div className="flex-1">
                                  <p className="text-white text-sm font-medium">{result.name}</p>
                                  <p className="text-slate-300 text-xs">{result.country}</p>
                                </div>
                                <span className="text-green-400 text-xs">✓ Found</span>
                              </>
                            ) : (
                              <>
                                <div className="w-8 h-8 bg-slate-500 rounded flex items-center justify-center">
                                  <span className="text-slate-400 text-xs">?</span>
                                </div>
                                <div className="flex-1">
                                  <p className="text-white text-sm font-medium">{result.teamName}</p>
                                  <p className="text-red-400 text-xs">{result.error}</p>
                                </div>
                                <span className="text-red-400 text-xs">✗ Not found</span>
                              </>
                            )}
                          </div>
                        ))}
                        
                        <Button
                          onClick={() => handleAddMultipleLogos(bothTeamsResults)}
                          size="sm"
                          className="w-full bg-green-600 hover:bg-green-700 text-white mt-2"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add All Found Logos
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Search for single team logo */}
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      <Label className="text-slate-300 mb-1">Search Single Team</Label>
                      <Input
                        type="text"
                        placeholder="e.g., Arsenal, Real Madrid"
                        value={teamLogoSearch}
                        onChange={(e) => setTeamLogoSearch(e.target.value)}
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <Button
                      onClick={handleSearchTeamLogo}
                      disabled={!teamLogoSearch.trim() || logoSearchLoading}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {logoSearchLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Searching...
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4 mr-2" />
                          Search
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Search result */}
                  {logoSearchResult && (
                    <div className="p-3 bg-slate-700 rounded-md">
                      <div className="flex items-center gap-3">
                        {logoSearchResult.logo ? (
                          <img 
                            src={logoSearchResult.logo} 
                            alt={`${logoSearchResult.name} logo`}
                            className="w-12 h-12 object-contain"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-slate-600 rounded flex items-center justify-center">
                            <span className="text-slate-400 text-xs">No Logo</span>
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="text-white font-medium">{logoSearchResult.name}</p>
                          <p className="text-slate-300 text-sm">ID: {logoSearchResult.id}</p>
                          <p className="text-slate-300 text-sm">Country: {logoSearchResult.country}</p>
                          {!logoSearchResult.logo && (
                            <p className="text-red-400 text-xs">No logo available for this team</p>
                          )}
                        </div>
                        {logoSearchResult.logo && (
                          <Button
                            onClick={() => handleAddTeamLogo(logoSearchResult)}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add Logo
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Current blog logos */}
                  <div>
                    <h4 className="text-white font-medium mb-2">Current Team Logos</h4>
                    {blogLogos.length === 0 ? (
                      <p className="text-slate-400 text-sm">No team logos added yet.</p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {blogLogos.map((logo) => (
                          <div key={logo.id} className="bg-slate-700 rounded-lg p-3">
                            <div className="flex flex-col items-center text-center">
                              <img 
                                src={logo.url} 
                                alt={logo.alt}
                                className="w-10 h-10 object-contain mb-2"
                              />
                              <p className="text-white text-sm font-medium truncate w-full">{logo.filename}</p>
                              <Button
                                onClick={() => handleRemoveTeamLogo(logo.id)}
                                size="sm"
                                variant="outline"
                                className="mt-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div>
              <Label htmlFor="content" className="text-slate-300">Content</Label>
              <RichTextEditor
                value={formData.content}
                onChange={(value) => setFormData(prev => ({ ...prev, content: value }))}
                placeholder="Start writing your blog post content..."
                className="mt-2"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <Label htmlFor="author" className="text-slate-300">Author</Label>
                <Input
                  id="author"
                  value={formData.author}
                  onChange={(e) => setFormData(prev => ({ ...prev, author: e.target.value }))}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              
              <div>
                <Label htmlFor="category" className="text-slate-300">Category</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="readTime" className="text-slate-300">Read Time (minutes)</Label>
                <Input
                  id="readTime"
                  type="number"
                  value={formData.readTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, readTime: parseInt(e.target.value) || 5 }))}
                  className="bg-slate-700 border-slate-600 text-white"
                  min="1"
                  max="60"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tags and Geo-Targeting */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Tags & Targeting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-slate-300">Tags</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Add a tag..."
                  className="bg-slate-700 border-slate-600 text-white flex-1"
                />
                <Button type="button" onClick={addTag} variant="outline" className="border-slate-600 text-slate-300">
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.tags.map(tag => (
                  <Badge key={tag} className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-2 hover:text-red-400"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-slate-300">Geo-Targeting</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                {geoOptions.map(option => (
                  <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.geoTarget.includes(option.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData(prev => ({
                            ...prev,
                            geoTarget: [...prev.geoTarget, option.value]
                          }))
                        } else {
                          setFormData(prev => ({
                            ...prev,
                            geoTarget: prev.geoTarget.filter(geo => geo !== option.value)
                          }))
                        }
                      }}
                      className="rounded border-slate-600 bg-slate-700 text-emerald-400"
                    />
                    <span className="text-slate-300 text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SEO Settings */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">SEO Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="seoTitle" className="text-slate-300">SEO Title</Label>
              <Input
                id="seoTitle"
                value={formData.seoTitle}
                onChange={(e) => setFormData(prev => ({ ...prev, seoTitle: e.target.value }))}
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="Leave empty to use the main title"
              />
            </div>

            <div>
              <Label htmlFor="seoDescription" className="text-slate-300">SEO Description</Label>
              <Textarea
                id="seoDescription"
                value={formData.seoDescription}
                onChange={(e) => setFormData(prev => ({ ...prev, seoDescription: e.target.value }))}
                className="bg-slate-700 border-slate-600 text-white"
                rows={3}
                placeholder="Leave empty to use the excerpt"
              />
            </div>

            <div>
              <Label className="text-slate-300">SEO Keywords</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                  placeholder="Add a keyword..."
                  className="bg-slate-700 border-slate-600 text-white flex-1"
                />
                <Button type="button" onClick={addKeyword} variant="outline" className="border-slate-600 text-slate-300">
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.seoKeywords.map(keyword => (
                  <Badge key={keyword} className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                    {keyword}
                    <button
                      type="button"
                      onClick={() => removeKeyword(keyword)}
                      className="ml-2 hover:text-red-400"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Publishing Settings */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Publishing Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-slate-300">Featured Post</Label>
                <p className="text-slate-400 text-sm">Show this post prominently on the blog</p>
              </div>
              <Switch
                checked={formData.featured}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, featured: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-slate-300">Published</Label>
                <p className="text-slate-400 text-sm">Make this post visible to visitors</p>
              </div>
              <Switch
                checked={formData.isPublished}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isPublished: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-slate-300">Active</Label>
                <p className="text-slate-400 text-sm">Keep this post in the system</p>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
              />
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
} 