'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import { 
  Twitter,
  RefreshCw,
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Loader2,
  Plus,
  Eye,
  Calendar,
  TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface MatchItem {
  id: string
  matchId: string
  homeTeam: string
  awayTeam: string
  league: string
  kickoffDate: string
  confidenceScore: number | null
  hasBlog: boolean
  hasExistingPost: boolean
  matchUrl: string
  blogUrl?: string
  availableTemplates: Array<{
    id: string
    name: string
    category: string
  }>
}

interface ParlayItem {
  id: string
  parlayId: string
  legCount: number
  earliestKickoff: string
  firstLeg?: {
    homeTeam: string
    awayTeam: string
  }
  hasExistingPost: boolean
  parlayBuilderUrl: string
  availableTemplates: Array<{
    id: string
    name: string
    category: string
  }>
}

interface ScheduledPost {
  id: string
  platform: string
  postType: string
  templateId: string
  content: string
  url?: string
  matchId?: string
  parlayId?: string
  scheduledAt: string
  postedAt?: string
  status: string
  postId?: string
  errorMessage?: string
}

export default function SocialAutomationPage() {
  const [matches, setMatches] = useState<MatchItem[]>([])
  const [parlays, setParlays] = useState<ParlayItem[]>([])
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [previewPost, setPreviewPost] = useState<{ content: string; url?: string; templateId: string; templateName: string; matchId?: string; parlayId?: string; postType: string } | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [selectedTemplates, setSelectedTemplates] = useState<Record<string, string>>({}) // matchId/parlayId -> templateId

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch eligible matches and parlays
      const response = await fetch('/api/admin/social/twitter?type=both')
      if (!response.ok) throw new Error('Failed to fetch data')
      
      const data = await response.json()
      if (data.success) {
        setMatches(data.data.matches || [])
        setParlays(data.data.parlays || [])
      }

      // Fetch scheduled posts
      await fetchScheduledPosts()
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const fetchScheduledPosts = async () => {
    try {
      // This would need a new endpoint to fetch scheduled posts
      // For now, we'll skip it or create a simple query
      const response = await fetch('/api/admin/social/twitter/posts?status=scheduled,posted&limit=50')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setScheduledPosts(data.data || [])
        }
      }
    } catch (error) {
      console.error('Error fetching scheduled posts:', error)
    }
  }

  const handlePreviewMatchPost = async (matchId: string, templateId: string) => {
    if (!templateId) {
      toast.error('Please select a template first')
      return
    }

    try {
      // Get preview from API (generate but don't save)
      const response = await fetch('/api/admin/social/twitter/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_match',
          matchId,
          templateId,
        }),
      })

      if (!response.ok) throw new Error('Failed to generate preview')

      const data = await response.json()
      if (data.success) {
        setPreviewPost({
          content: data.data.content,
          url: data.data.url,
          templateId: data.data.templateId,
          templateName: data.data.templateName || '',
          matchId: matchId,
          postType: 'match',
        })
        setPreviewOpen(true)
      } else {
        toast.error(data.error || 'Failed to generate preview')
      }
    } catch (error) {
      console.error('Error generating preview:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to generate preview')
    }
  }

  const handlePreviewParlayPost = async (parlayId: string, templateId: string) => {
    if (!templateId) {
      toast.error('Please select a template first')
      return
    }

    try {
      const response = await fetch('/api/admin/social/twitter/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_parlay',
          parlayId,
          templateId,
        }),
      })

      if (!response.ok) throw new Error('Failed to generate preview')

      const data = await response.json()
      if (data.success) {
        setPreviewPost({
          content: data.data.content,
          url: data.data.url,
          templateId: data.data.templateId,
          templateName: data.data.templateName || '',
          parlayId: parlayId,
          postType: 'parlay',
        })
        setPreviewOpen(true)
      } else {
        toast.error(data.error || 'Failed to generate preview')
      }
    } catch (error) {
      console.error('Error generating preview:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to generate preview')
    }
  }

  const handleScheduleFromPreview = async () => {
    if (!previewPost) return
    
    try {
      setGenerating(true)
      const response = await fetch('/api/admin/social/twitter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: previewPost.postType === 'match' ? 'generate_match' : 'generate_parlay',
          matchId: previewPost.matchId,
          parlayId: previewPost.parlayId,
          templateId: previewPost.templateId,
          postNow: false,
        }),
      })

      if (!response.ok) throw new Error('Failed to schedule post')

      const data = await response.json()
      if (data.success) {
        toast.success('Twitter post scheduled successfully')
        setPreviewOpen(false)
        setPreviewPost(null)
        await fetchData()
      } else {
        toast.error(data.error || 'Failed to schedule post')
      }
    } catch (error) {
      console.error('Error scheduling post:', error)
      toast.error('Failed to schedule post')
    } finally {
      setGenerating(false)
    }
  }


  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
    toast.success('Data refreshed')
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'posted':
        return <Badge className="bg-emerald-600"><CheckCircle className="w-3 h-3 mr-1" />Posted</Badge>
      case 'scheduled':
        return <Badge className="bg-blue-600"><Clock className="w-3 h-3 mr-1" />Scheduled</Badge>
      case 'failed':
        return <Badge className="bg-red-600"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AdvancedBreadcrumb
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'Social Automation', href: '/admin/social-automation' },
          ]}
        />

        <div className="mt-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Twitter className="w-8 h-8 text-blue-400" />
                Twitter / X Automation
              </h1>
              <p className="text-slate-400 mt-2">
                Generate and manage Twitter posts for matches and parlays
              </p>
            </div>
            <Button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              variant="outline"
              className="border-slate-600"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        <Tabs defaultValue="matches" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-slate-800 border-slate-700">
            <TabsTrigger value="matches" className="data-[state=active]:bg-emerald-600">
              <TrendingUp className="w-4 h-4 mr-2" />
              Matches
            </TabsTrigger>
            <TabsTrigger value="parlays" className="data-[state=active]:bg-emerald-600">
              <Calendar className="w-4 h-4 mr-2" />
              Parlays
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="data-[state=active]:bg-emerald-600">
              <Clock className="w-4 h-4 mr-2" />
              Scheduled Posts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="matches" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Eligible Matches for Twitter Posts</CardTitle>
                <p className="text-slate-400 text-sm mt-2">
                  Matches with prediction data that can be posted to Twitter
                </p>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                  </div>
                ) : matches.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">No eligible matches found</p>
                ) : (
                  <div className="space-y-3">
                    {matches.map((match) => (
                      <div
                        key={match.matchId}
                        className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-white">
                              {match.homeTeam} vs {match.awayTeam}
                            </h3>
                            <Badge variant="outline" className="border-slate-600">
                              {match.league}
                            </Badge>
                            {match.confidenceScore && (
                              <Badge className="bg-purple-600">
                                {match.confidenceScore}% confidence
                              </Badge>
                            )}
                            {match.hasBlog && (
                              <Badge className="bg-blue-600">Has Blog</Badge>
                            )}
                            {match.hasExistingPost && (
                              <Badge className="bg-emerald-600">Posted</Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-400 mt-1">
                            Kickoff: {new Date(match.kickoffDate).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!match.hasExistingPost && (
                            <>
                              <Select
                                value={selectedTemplates[match.matchId] || ''}
                                onValueChange={(value) => {
                                  setSelectedTemplates(prev => ({ ...prev, [match.matchId]: value }))
                                }}
                              >
                                <SelectTrigger className="w-[200px] bg-slate-700 border-slate-600 text-white">
                                  <SelectValue placeholder="Select template" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-700 border-slate-600">
                                  {match.availableTemplates && match.availableTemplates.length > 0 ? (
                                    match.availableTemplates.map((template) => (
                                      <SelectItem key={template.id} value={template.id} className="text-white">
                                        {template.name} ({template.category})
                                      </SelectItem>
                                    ))
                                  ) : (
                                    <SelectItem value="" disabled className="text-slate-400">
                                      No templates available
                                    </SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                              <Button
                                onClick={() => handlePreviewMatchPost(match.matchId, selectedTemplates[match.matchId])}
                                disabled={generating || !selectedTemplates[match.matchId]}
                                size="sm"
                                variant="outline"
                                className="border-slate-600"
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                Preview
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="parlays" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Eligible Parlays for Twitter Posts</CardTitle>
                <p className="text-slate-400 text-sm mt-2">
                  Active parlays that can be posted to Twitter (limited selection)
                </p>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                  </div>
                ) : parlays.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">No eligible parlays found</p>
                ) : (
                  <div className="space-y-3">
                    {parlays.map((parlay) => (
                      <div
                        key={parlay.parlayId}
                        className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            {parlay.firstLeg && (
                              <h3 className="font-semibold text-white">
                                {parlay.firstLeg.homeTeam} vs {parlay.firstLeg.awayTeam}
                              </h3>
                            )}
                            <Badge variant="outline" className="border-slate-600">
                              {parlay.legCount} legs
                            </Badge>
                            {parlay.hasExistingPost && (
                              <Badge className="bg-emerald-600">Posted</Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-400 mt-1">
                            Kickoff: {new Date(parlay.earliestKickoff).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!parlay.hasExistingPost && (
                            <>
                              <Select
                                value={selectedTemplates[parlay.parlayId] || ''}
                                onValueChange={(value) => {
                                  setSelectedTemplates(prev => ({ ...prev, [parlay.parlayId]: value }))
                                }}
                              >
                                <SelectTrigger className="w-[200px] bg-slate-700 border-slate-600 text-white">
                                  <SelectValue placeholder="Select template" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-700 border-slate-600">
                                  {parlay.availableTemplates.map((template) => (
                                    <SelectItem key={template.id} value={template.id} className="text-white">
                                      {template.name} ({template.category})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                onClick={() => handlePreviewParlayPost(parlay.parlayId, selectedTemplates[parlay.parlayId])}
                                disabled={generating || !selectedTemplates[parlay.parlayId]}
                                size="sm"
                                variant="outline"
                                className="border-slate-600"
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                Preview
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scheduled" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Scheduled & Posted</CardTitle>
                <p className="text-slate-400 text-sm mt-2">
                  View all scheduled and posted Twitter posts
                </p>
              </CardHeader>
              <CardContent>
                {scheduledPosts.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">No scheduled posts yet</p>
                ) : (
                  <div className="space-y-3">
                    {scheduledPosts.map((post) => (
                      <div
                        key={post.id}
                        className="p-4 bg-slate-900/50 rounded-lg border border-slate-700"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getStatusBadge(post.status)}
                            <Badge variant="outline" className="border-slate-600">
                              {post.postType}
                            </Badge>
                            <Badge variant="outline" className="border-slate-600">
                              Template {post.templateId}
                            </Badge>
                          </div>
                          <div className="text-sm text-slate-400">
                            {post.scheduledAt && (
                              <div>Scheduled: {new Date(post.scheduledAt).toLocaleString()}</div>
                            )}
                            {post.postedAt && (
                              <div>Posted: {new Date(post.postedAt).toLocaleString()}</div>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 p-3 bg-slate-950 rounded border border-slate-700">
                          <p className="text-white whitespace-pre-wrap">{post.content}</p>
                          {post.url && (
                            <a
                              href={post.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-400 hover:text-emerald-300 text-sm mt-2 inline-block"
                            >
                              {post.url}
                            </a>
                          )}
                        </div>
                        {post.errorMessage && (
                          <div className="mt-2 text-sm text-red-400">
                            Error: {post.errorMessage}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-white">Preview Twitter Post</DialogTitle>
              <DialogDescription className="text-slate-400">
                Review the generated post before scheduling. Template #{previewPost?.templateId} was randomly selected.
              </DialogDescription>
            </DialogHeader>
            {previewPost && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-900 rounded-lg border border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="border-slate-600">
                      {previewPost.templateName || `Template ${previewPost.templateId}`}
                    </Badge>
                    <Badge className="bg-blue-600">
                      {previewPost.content.length + (previewPost.url ? 23 : 0)} / 280 chars
                    </Badge>
                  </div>
                  <div className="mt-3">
                    <p className="text-white whitespace-pre-wrap font-mono text-sm">{previewPost.content}</p>
                    {previewPost.url && (
                      <a
                        href={previewPost.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:text-emerald-300 text-sm mt-2 inline-block"
                      >
                        {previewPost.url}
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPreviewOpen(false)
                      setPreviewPost(null)
                    }}
                    className="border-slate-600"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleScheduleFromPreview}
                    disabled={generating}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Scheduling...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Schedule Post
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

