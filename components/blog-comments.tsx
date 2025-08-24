'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { 
  MessageCircle, 
  Reply, 
  Send, 
  User, 
  Calendar,
  Loader2,
  AlertCircle,
  CheckCircle,
  Trash
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Comment {
  id: string
  content: string
  userName: string
  userEmail?: string
  createdAt: string
  userId?: string
  user?: {
    id: string
    fullName?: string
    email: string
  }
  replies: Comment[]
}

interface CommentFormData {
  content: string
  userName: string
  userEmail: string
}

interface BlogCommentsProps {
  blogPostId: string
  blogPostSlug: string
}

export function BlogComments({ blogPostId, blogPostSlug }: BlogCommentsProps) {
  const { data: session } = useSession()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showCommentForm, setShowCommentForm] = useState(false)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form data
  const [commentForm, setCommentForm] = useState<CommentFormData>({
    content: '',
    userName: '',
    userEmail: ''
  })

  const [replyForm, setReplyForm] = useState({
    content: '',
    userName: '',
    userEmail: ''
  })

  // Load comments
  const loadComments = async (page: number = 1) => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/blogs/${blogPostId}/comments?page=${page}&limit=10`)
      const data = await response.json()
      
      if (data.success) {
        setComments(data.data.comments)
        setTotalPages(data.data.pagination.pages)
        setCurrentPage(page)
      } else {
        setError('Failed to load comments')
      }
    } catch (error) {
      setError('Failed to load comments')
    } finally {
      setLoading(false)
    }
  }

  // Load comments on mount
  useEffect(() => {
    loadComments()
  }, [blogPostId])

  // Pre-fill form with user data when session changes
  useEffect(() => {
    if (session?.user?.name) {
      // Extract first name only (first word before space)
      const firstName = session.user.name.split(' ')[0]
      setCommentForm(prev => ({ ...prev, userName: firstName }))
      setReplyForm(prev => ({ ...prev, userName: firstName }))
    }
  }, [session])

  // Submit comment
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!commentForm.content.trim()) return
    
    try {
      setSubmitting(true)
      setError(null)
      
      // Use session user's first name if logged in, otherwise use form input
      const userName = session?.user?.name ? session.user.name.split(' ')[0] : commentForm.userName
      const userEmail = session?.user?.email || commentForm.userEmail
      
      const response = await fetch(`/api/blogs/${blogPostId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: commentForm.content,
          userName: userName,
          userEmail: userEmail,
        }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        setSuccess('Comment posted successfully!')
        setCommentForm({ content: '', userName: '', userEmail: '' })
        setShowCommentForm(false)
        loadComments() // Reload comments
      } else {
        setError(data.message || 'Failed to post comment')
      }
    } catch (error) {
      setError('Failed to post comment')
    } finally {
      setSubmitting(false)
    }
  }

  // Delete comment
  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment? This action cannot be undone.')) {
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      
      const response = await fetch(`/api/blogs/${blogPostId}/comments?commentId=${commentId}`, {
        method: 'DELETE',
      })
      
      const data = await response.json()
      
      if (data.success) {
        setSuccess('Comment deleted successfully!')
        loadComments() // Reload comments
      } else {
        setError(data.message || 'Failed to delete comment')
      }
    } catch (error) {
      setError('Failed to delete comment')
    } finally {
      setSubmitting(false)
    }
  }

  // Submit reply
  const handleReplySubmit = async (e: React.FormEvent, parentId: string) => {
    e.preventDefault()
    
    if (!replyForm.content.trim()) return
    
    try {
      setSubmitting(true)
      setError(null)
      
      // Use session user's first name if logged in, otherwise use form input
      const userName = session?.user?.name ? session.user.name.split(' ')[0] : replyForm.userName
      const userEmail = session?.user?.email || replyForm.userEmail
      
      const response = await fetch(`/api/blogs/${blogPostId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: replyForm.content,
          userName: userName,
          userEmail: userEmail,
          parentId: parentId,
        }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        setSuccess('Reply posted successfully!')
        setReplyForm({ content: '', userName: '', userEmail: '' })
        setReplyingTo(null)
        loadComments() // Reload comments
      } else {
        setError(data.message || 'Failed to post reply')
      }
    } catch (error) {
      setError('Failed to post reply')
    } finally {
      setSubmitting(false)
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

  return (
    <div className="space-y-6">
      {/* Comments Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <MessageCircle className="w-5 h-5 text-blue-400" />
          <h3 className="text-xl font-semibold text-white">Comments</h3>
          <Badge variant="secondary" className="bg-slate-700 text-slate-200">{comments.length}</Badge>
        </div>
        
        <Button
          onClick={() => setShowCommentForm(!showCommentForm)}
          variant="outline"
          size="sm"
          className="border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white"
        >
          {showCommentForm ? 'Cancel' : 'Add Comment'}
        </Button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="flex items-center space-x-2 p-3 bg-green-900/50 border border-green-700 rounded-md">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <span className="text-green-200">{success}</span>
        </div>
      )}
      
      {error && (
        <div className="flex items-center space-x-2 p-3 bg-red-900/50 border border-red-700 rounded-md">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span className="text-red-200">{error}</span>
        </div>
      )}

      {/* Comment Form */}
      {showCommentForm && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
                         <CardTitle className="text-lg text-white">
               {session ? `Add a Comment as ${session.user?.name ? session.user.name.split(' ')[0] : 'User'}` : 'Add a Comment (Guest)'}
             </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCommentSubmit} className="space-y-4">
              {!session && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="userName" className="block text-sm font-medium mb-1 text-slate-200">
                      Name *
                    </label>
                    <Input
                      id="userName"
                      value={commentForm.userName}
                      onChange={(e) => setCommentForm(prev => ({ ...prev, userName: e.target.value }))}
                      placeholder="Your name"
                      required
                      className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                    />
                  </div>
                  <div>
                    <label htmlFor="userEmail" className="block text-sm font-medium mb-1 text-slate-200">
                      Email *
                    </label>
                    <Input
                      id="userEmail"
                      type="email"
                      value={commentForm.userEmail}
                      onChange={(e) => setCommentForm(prev => ({ ...prev, userEmail: e.target.value }))}
                      placeholder="your@email.com"
                      required
                      className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                    />
                  </div>
                </div>
              )}
              
              <div>
                <label htmlFor="content" className="block text-sm font-medium mb-1 text-slate-200">
                  Comment *
                </label>
                <Textarea
                  id="content"
                  value={commentForm.content}
                  onChange={(e) => setCommentForm(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Share your thoughts..."
                  rows={4}
                  maxLength={1000}
                  required
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                />
                <div className="text-xs text-slate-400 mt-1">
                  {commentForm.content.length}/1000 characters
                </div>
              </div>
              
              <Button type="submit" disabled={submitting || !commentForm.content.trim()} className="bg-blue-600 hover:bg-blue-700 text-white">
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Post Comment
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Comments List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <MessageCircle className="w-12 h-12 mx-auto mb-4 text-slate-600" />
          <p>No comments yet. Be the first to share your thoughts!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="space-y-3">
              {/* Main Comment */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-6">
                  <div className="flex items-start space-x-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src="" />
                      <AvatarFallback className="bg-blue-900 text-blue-200">
                        {getUserInitials(comment.userName)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="font-medium text-slate-100">
                          {comment.userName}
                        </span>
                        {comment.userId && (
                          <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">
                            <User className="w-3 h-3 mr-1" />
                            Member
                          </Badge>
                        )}
                        <span className="text-sm text-slate-400">
                          {formatDate(comment.createdAt)}
                        </span>
                      </div>
                      
                      <p className="text-slate-200 whitespace-pre-wrap">{comment.content}</p>
                      
                      <div className="mt-3 flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                          className="text-blue-400 hover:text-blue-300 hover:bg-slate-700"
                        >
                          <Reply className="w-4 h-4 mr-1" />
                          Reply
                        </Button>
                        
                        {/* Delete button - only show for comment author */}
                        {session?.user?.id === comment.userId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteComment(comment.id)}
                            disabled={submitting}
                            className="text-red-400 hover:text-red-300 hover:bg-slate-700"
                          >
                            <Trash className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Reply Form */}
              {replyingTo === comment.id && (
                <Card className="ml-8 border-l-2 border-blue-600 bg-slate-800/50 border-slate-700">
                  <CardContent className="pt-6">
                                         <div className="mb-4">
                       <h4 className="text-md font-medium text-white">
                         {session ? `Reply as ${session.user?.name ? session.user.name.split(' ')[0] : 'User'}` : 'Reply (Guest)'}
                       </h4>
                     </div>
                    <form onSubmit={(e) => handleReplySubmit(e, comment.id)} className="space-y-4">
                      {!session && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label htmlFor={`replyName-${comment.id}`} className="block text-sm font-medium mb-1 text-slate-200">
                              Name *
                            </label>
                            <Input
                              id={`replyName-${comment.id}`}
                              value={replyForm.userName}
                              onChange={(e) => setReplyForm(prev => ({ ...prev, userName: e.target.value }))}
                              placeholder="Your name"
                              required
                              className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                            />
                          </div>
                          <div>
                            <label htmlFor={`replyEmail-${comment.id}`} className="block text-sm font-medium mb-1 text-slate-200">
                              Email *
                            </label>
                            <Input
                              id={`replyEmail-${comment.id}`}
                              type="email"
                              value={replyForm.userEmail}
                              onChange={(e) => setReplyForm(prev => ({ ...prev, userEmail: e.target.value }))}
                              placeholder="your@email.com"
                              required
                              className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                            />
                          </div>
                        </div>
                      )}
                      
                      <div>
                        <label htmlFor={`replyContent-${comment.id}`} className="block text-sm font-medium mb-1 text-slate-200">
                          Reply *
                        </label>
                        <Textarea
                          id={`replyContent-${comment.id}`}
                          value={replyForm.content}
                          onChange={(e) => setReplyForm(prev => ({ ...prev, content: e.target.value }))}
                          placeholder="Write your reply..."
                          rows={3}
                          maxLength={1000}
                          required
                          className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                        />
                        <div className="text-xs text-slate-400 mt-1">
                          {replyForm.content.length}/1000 characters
                        </div>
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button type="submit" disabled={submitting || !replyForm.content.trim()} className="bg-blue-600 hover:bg-blue-700 text-white">
                          {submitting ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Posting...
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-2" />
                              Post Reply
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setReplyingTo(null)
                            setReplyForm({ content: '', userName: '', userEmail: '' })
                          }}
                          className="border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white"
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* Replies */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="ml-8 space-y-3">
                  {comment.replies.map((reply) => (
                    <Card key={reply.id} className="border-l-2 border-slate-600 bg-slate-800/50 border-slate-700">
                      <CardContent className="pt-6">
                        <div className="flex items-start space-x-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src="" />
                            <AvatarFallback className="bg-slate-700 text-slate-300 text-sm">
                              {getUserInitials(reply.userName)}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="font-medium text-slate-100">
                                {reply.userName}
                              </span>
                              {reply.userId && (
                                <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">
                                  <User className="w-3 h-3 mr-1" />
                                  Member
                                </Badge>
                              )}
                              <span className="text-sm text-slate-400">
                                {formatDate(reply.createdAt)}
                              </span>
                            </div>
                            
                            <p className="text-slate-200 whitespace-pre-wrap">{reply.content}</p>
                            
                            {/* Delete button for replies - only show for reply author */}
                            {session?.user?.id === reply.userId && (
                              <div className="mt-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteComment(reply.id)}
                                  disabled={submitting}
                                  className="text-red-400 hover:text-red-300 hover:bg-slate-700 text-xs"
                                >
                                  <Trash className="w-3 h-3 mr-1" />
                                  Delete
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadComments(currentPage - 1)}
            disabled={currentPage === 1}
            className="border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white"
          >
            Previous
          </Button>
          
          <span className="text-sm text-slate-300">
            Page {currentPage} of {totalPages}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadComments(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
