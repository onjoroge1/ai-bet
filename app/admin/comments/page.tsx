'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  MessageCircle, 
  CheckCircle, 
  XCircle, 
  Flag, 
  Trash2, 
  Eye,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  AlertCircle,
  User,
  Calendar
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Comment {
  id: string
  content: string
  userName: string
  userEmail?: string
  createdAt: string
  userId?: string
  isApproved: boolean
  isSpam: boolean
  blogPost: {
    id: string
    title: string
    slug: string
  }
  user?: {
    id: string
    fullName?: string
    email: string
  }
  replies: Comment[]
}

export default function AdminCommentsPage() {
  const { data: session } = useSession()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('all') // all, pending, approved, spam
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedComments, setSelectedComments] = useState<string[]>([])
  const [actionLoading, setActionLoading] = useState(false)

  // Load comments
  const loadComments = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/comments')
      const data = await response.json()
      
      if (data.success) {
        setComments(data.data.comments)
      }
    } catch (error) {
      console.error('Failed to load comments:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load comments on mount
  useEffect(() => {
    if (session?.user?.role === 'admin') {
      loadComments()
    }
  }, [session])

  // Filter comments based on current filter and search
  const filteredComments = comments.filter(comment => {
    const matchesFilter = filter === 'all' || 
      (filter === 'pending' && !comment.isApproved && !comment.isSpam) ||
      (filter === 'approved' && comment.isApproved) ||
      (filter === 'spam' && comment.isSpam)
    
    const matchesSearch = searchTerm === '' || 
      comment.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      comment.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      comment.blogPost.title.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesFilter && matchesSearch
  })

  // Handle bulk actions
  const handleBulkAction = async (action: 'approve' | 'reject' | 'spam' | 'delete') => {
    if (selectedComments.length === 0) return
    
    try {
      setActionLoading(true)
      
      const response = await fetch('/api/admin/comments/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          commentIds: selectedComments,
          action
        }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Reload comments
        await loadComments()
        setSelectedComments([])
      }
    } catch (error) {
      console.error('Failed to perform bulk action:', error)
    } finally {
      setActionLoading(false)
    }
  }

  // Handle individual comment actions
  const handleCommentAction = async (commentId: string, action: 'approve' | 'reject' | 'spam' | 'delete') => {
    try {
      const response = await fetch(`/api/admin/comments/${commentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Reload comments
        await loadComments()
      }
    } catch (error) {
      console.error('Failed to perform comment action:', error)
    }
  }

  // Get user initials for avatar
  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Format date
  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true })
    } catch {
      return 'recently'
    }
  }

  // Check if user is admin
  if (session?.user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
              <p className="text-gray-600">You don't have permission to access this page.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Comment Management</h1>
          <p className="text-gray-600 mt-2">Manage and moderate blog comments</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <MessageCircle className="w-8 h-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Comments</p>
                  <p className="text-2xl font-bold text-gray-900">{comments.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <AlertCircle className="w-8 h-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {comments.filter(c => !c.isApproved && !c.isSpam).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Approved</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {comments.filter(c => c.isApproved).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Flag className="w-8 h-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Spam</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {comments.filter(c => c.isSpam).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-4 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search comments..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Comments</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="spam">Spam</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={loadComments}
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {selectedComments.length > 0 && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-blue-800">
                  {selectedComments.length} comment(s) selected
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleBulkAction('approve')}
                    disabled={actionLoading}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkAction('reject')}
                    disabled={actionLoading}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkAction('spam')}
                    disabled={actionLoading}
                  >
                    <Flag className="w-4 h-4 mr-2" />
                    Mark Spam
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleBulkAction('delete')}
                    disabled={actionLoading}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete All
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Comments List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredComments.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No comments found matching your criteria.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredComments.map((comment) => (
              <Card key={comment.id} className={`
                ${comment.isSpam ? 'border-red-200 bg-red-50' : ''}
                ${!comment.isApproved && !comment.isSpam ? 'border-yellow-200 bg-yellow-50' : ''}
              `}>
                <CardContent className="pt-6">
                  <div className="flex items-start space-x-4">
                    {/* Checkbox for bulk selection */}
                    <input
                      type="checkbox"
                      checked={selectedComments.includes(comment.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedComments(prev => [...prev, comment.id])
                        } else {
                          setSelectedComments(prev => prev.filter(id => id !== comment.id))
                        }
                      }}
                      className="mt-2"
                    />
                    
                    {/* Avatar */}
                    <Avatar className="w-10 h-10">
                      <AvatarImage src="" />
                      <AvatarFallback className="bg-blue-100 text-blue-600">
                        {getUserInitials(comment.userName)}
                      </AvatarFallback>
                    </Avatar>
                    
                    {/* Comment Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="font-medium text-gray-900">
                          {comment.userName}
                        </span>
                        {comment.userId && (
                          <Badge variant="outline" className="text-xs">
                            <User className="w-3 h-3 mr-1" />
                            Member
                          </Badge>
                        )}
                        <span className="text-sm text-gray-500">
                          {formatDate(comment.createdAt)}
                        </span>
                        {comment.isSpam && (
                          <Badge variant="destructive" className="text-xs">
                            <Flag className="w-3 h-3 mr-1" />
                            Spam
                          </Badge>
                        )}
                        {!comment.isApproved && !comment.isSpam && (
                          <Badge variant="secondary" className="text-xs">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-gray-700 whitespace-pre-wrap mb-3">{comment.content}</p>
                      
                      {/* Blog Post Link */}
                      <div className="mb-3">
                        <span className="text-sm text-gray-500">On: </span>
                        <a
                          href={`/blog/${comment.blogPost.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 underline"
                        >
                          {comment.blogPost.title}
                        </a>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2">
                        {!comment.isApproved && !comment.isSpam && (
                          <Button
                            size="sm"
                            onClick={() => handleCommentAction(comment.id, 'approve')}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Approve
                          </Button>
                        )}
                        
                        {comment.isApproved && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCommentAction(comment.id, 'reject')}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Reject
                          </Button>
                        )}
                        
                        {!comment.isSpam && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCommentAction(comment.id, 'spam')}
                          >
                            <Flag className="w-4 h-4 mr-2" />
                            Mark Spam
                          </Button>
                        )}
                        
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleCommentAction(comment.id, 'delete')}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
