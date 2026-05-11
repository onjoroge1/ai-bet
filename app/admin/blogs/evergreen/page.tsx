'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import { Sparkles, RefreshCw, FileText, CheckCircle2, Clock, Loader2, ArrowRight, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface EvergreenTopic {
  id: string
  title: string
  slug: string
  bucket: string
  productAnchor: string | null
  targetQuery: string | null
  seoKeywords: string[]
  status: string
  blogPostId: string | null
  lastPublishedAt: string | null
  createdAt: string
  updatedAt: string
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ComponentType<any> }> = {
  queued: { label: 'Queued', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30', icon: Clock },
  drafted: { label: 'Drafted (review needed)', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30', icon: FileText },
  reviewed: { label: 'Reviewed', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', icon: CheckCircle2 },
  published: { label: 'Published', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', icon: CheckCircle2 },
  refresh_due: { label: 'Refresh due', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30', icon: RefreshCw },
}

const BUCKET_LABELS: Record<string, string> = {
  explainer: 'Explainer',
  strategy: 'Strategy',
  concept: 'Concept',
  league: 'League',
  beginner: 'Beginner',
}

export default function EvergreenQueuePage() {
  const router = useRouter()
  const [topics, setTopics] = useState<EvergreenTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [bucketFilter, setBucketFilter] = useState('all')
  const [generatingId, setGeneratingId] = useState<string | null>(null)

  useEffect(() => { fetchTopics() }, [])

  async function fetchTopics() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/blogs/evergreen-topics')
      const data = await res.json()
      if (data.success) setTopics(data.topics)
    } catch (e) {
      console.error(e)
      toast.error('Failed to load topic queue')
    } finally {
      setLoading(false)
    }
  }

  async function handleDraft(topic: EvergreenTopic, regenerate = false) {
    setGeneratingId(topic.id)
    try {
      const res = await fetch('/api/admin/blogs/generate-evergreen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: topic.id, regenerate }),
      })
      const data = await res.json()
      if (data.success && data.blogPost) {
        toast.success(data.cached ? 'Draft loaded from cache' : 'Draft generated')
        await fetchTopics()
        // Navigate to the existing blog edit page for the freshly created draft
        router.push(`/admin/blogs/${data.blogPost.id}`)
      } else {
        toast.error(data.error || 'Generation failed')
      }
    } catch (e) {
      toast.error('Generation failed — see console')
      console.error(e)
    } finally {
      setGeneratingId(null)
    }
  }

  const filtered = useMemo(() => {
    return topics.filter(t => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (bucketFilter !== 'all' && t.bucket !== bucketFilter) return false
      return true
    })
  }, [topics, statusFilter, bucketFilter])

  const counts = useMemo(() => {
    const c: Record<string, number> = { queued: 0, drafted: 0, reviewed: 0, published: 0, refresh_due: 0 }
    for (const t of topics) c[t.status] = (c[t.status] || 0) + 1
    return c
  }, [topics])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdvancedBreadcrumb />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-7 h-7 text-emerald-400" />
              Evergreen Pipeline
            </h1>
            <p className="text-slate-300 mt-1">
              Curated topic queue that drives AI-drafted evergreen blogs.
              Match the shape of our top-performing posts.
            </p>
          </div>
          <Link href="/admin/blogs">
            <Button variant="outline" className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">
              ← Back to blogs
            </Button>
          </Link>
        </div>

        {/* Status counters */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(['queued', 'drafted', 'reviewed', 'published', 'refresh_due'] as const).map(status => {
            const cfg = STATUS_LABELS[status]
            const Icon = cfg.icon
            return (
              <Card key={status} className="bg-slate-800 border-slate-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider">{cfg.label}</p>
                      <p className="text-2xl font-bold text-white mt-1">{counts[status] || 0}</p>
                    </div>
                    <Icon className="w-5 h-5 text-slate-500" />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Filters */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4 flex flex-col md:flex-row gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white w-full md:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.keys(STATUS_LABELS).map(s => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={bucketFilter} onValueChange={setBucketFilter}>
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white w-full md:w-48">
                <SelectValue placeholder="Bucket" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All buckets</SelectItem>
                {Object.keys(BUCKET_LABELS).map(b => (
                  <SelectItem key={b} value={b}>{BUCKET_LABELS[b]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {loading && topics.length === 0 ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-slate-800 rounded animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-12 text-center">
              <AlertCircle className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400">No topics match the current filters.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(topic => {
              const cfg = STATUS_LABELS[topic.status] ?? STATUS_LABELS.queued
              const Icon = cfg.icon
              const isGenerating = generatingId === topic.id
              return (
                <Card key={topic.id} className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <Badge className={`${cfg.color} text-[10px] font-medium`}>
                            <Icon className="w-2.5 h-2.5 mr-1" />{cfg.label}
                          </Badge>
                          <Badge className="bg-slate-700/60 text-slate-300 text-[10px]">{BUCKET_LABELS[topic.bucket] ?? topic.bucket}</Badge>
                          {topic.productAnchor && (
                            <Badge className="bg-blue-500/15 text-blue-300 text-[10px]">→ {topic.productAnchor}</Badge>
                          )}
                        </div>
                        <h3 className="text-white font-semibold leading-snug">{topic.title}</h3>
                        {topic.targetQuery && (
                          <p className="text-xs text-slate-500 mt-1">Target: <span className="font-mono">{topic.targetQuery}</span></p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {topic.blogPostId && (
                          <Link href={`/admin/blogs/${topic.blogPostId}`}>
                            <Button variant="outline" size="sm" className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600">
                              Open editor <ArrowRight className="w-3.5 h-3.5 ml-1" />
                            </Button>
                          </Link>
                        )}
                        <Button
                          size="sm"
                          onClick={() => handleDraft(topic, topic.status !== 'queued')}
                          disabled={isGenerating}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white"
                        >
                          {isGenerating
                            ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />Drafting…</>
                            : topic.status === 'queued'
                            ? <><Sparkles className="w-3.5 h-3.5 mr-1" />Draft</>
                            : <><RefreshCw className="w-3.5 h-3.5 mr-1" />Re-draft</>}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
