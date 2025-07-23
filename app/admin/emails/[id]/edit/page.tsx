'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ArrowLeft, 
  Save, 
  Eye, 
  Edit, 
  Copy, 
  Trash2,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import { EmailTemplate, EmailTemplateCategory, EMAIL_VARIABLES } from '@/types/email-templates'
import { EmailTemplateEditor } from '@/components/admin/email-template-editor'
import { EmailPreview } from '@/components/admin/email-preview'

export default function EditEmailTemplatePage() {
  const params = useParams()
  const router = useRouter()
  const templateId = params.id as string

  const [template, setTemplate] = useState<EmailTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    subject: '',
    htmlContent: '',
    textContent: '',
    category: 'system' as EmailTemplateCategory,
    description: '',
    isActive: true
  })

  // Load template data
  useEffect(() => {
    const loadTemplate = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/admin/email-templates/${templateId}`)
        const data = await response.json()
        
        if (data.success) {
          setTemplate(data.data)
          setFormData({
            name: data.data.name,
            slug: data.data.slug,
            subject: data.data.subject,
            htmlContent: data.data.htmlContent,
            textContent: data.data.textContent || '',
            category: data.data.category,
            description: data.data.description || '',
            isActive: data.data.isActive
          })
        } else {
          setError('Failed to load template')
        }
      } catch (err) {
        setError('Failed to load template')
      } finally {
        setLoading(false)
      }
    }

    if (templateId) {
      loadTemplate()
    }
  }, [templateId])

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const response = await fetch(`/api/admin/email-templates/${templateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('Template updated successfully!')
        setTemplate(data.data)
      } else {
        setError(data.error || 'Failed to update template')
      }
    } catch (err) {
      setError('Failed to update template')
    } finally {
      setSaving(false)
    }
  }

  const handleDuplicate = async () => {
    try {
      setSaving(true)
      const duplicateData = {
        ...formData,
        name: `${formData.name} (Copy)`,
        slug: `${formData.slug}-copy`,
      }

      const response = await fetch('/api/admin/email-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(duplicateData),
      })

      const data = await response.json()

      if (data.success) {
        router.push(`/admin/emails/${data.data.id}/edit`)
      } else {
        setError(data.error || 'Failed to duplicate template')
      }
    } catch (err) {
      setError('Failed to duplicate template')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this template? This action cannot be undone.')) {
      return
    }

    try {
      setSaving(true)
      const response = await fetch(`/api/admin/email-templates/${templateId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        router.push('/admin/emails')
      } else {
        setError(data.error || 'Failed to delete template')
      }
    } catch (err) {
      setError('Failed to delete template')
    } finally {
      setSaving(false)
    }
  }

  const handleSendTest = async (email: string) => {
    try {
      const response = await fetch('/api/admin/email-templates/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateId,
          email,
          variables: {}
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('Test email sent successfully!')
      } else {
        setError(data.error || 'Failed to send test email')
      }
    } catch (err) {
      setError('Failed to send test email')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 text-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div>
              <p className="mt-4 text-slate-300">Loading template...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error && !template) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 text-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Error</h1>
            <p className="text-slate-300 mb-4">{error}</p>
            <Button onClick={() => router.push('/admin/emails')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Templates
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const variables = EMAIL_VARIABLES[formData.category] || []

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push('/admin/emails')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Edit Email Template</h1>
              <p className="text-slate-300">Update your email template content and settings</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleDuplicate}
              disabled={saving}
            >
              <Copy className="w-4 h-4 mr-2" />
              Duplicate
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={saving}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-900/20 border border-red-500 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-red-400">{error}</span>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-900/20 border border-green-500 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-green-400">{success}</span>
            </div>
          </div>
        )}

        {/* Template Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-1 space-y-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle>Template Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Template Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                    className="mt-1"
                    placeholder="template-slug"
                  />
                </div>

                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value: EmailTemplateCategory) => 
                      setFormData(prev => ({ ...prev, category: value }))
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="payment">Payment</SelectItem>
                      <SelectItem value="security">Security</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="subject">Subject Line</Label>
                  <Input
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                    className="mt-1"
                    placeholder="Email subject line"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="mt-1"
                    placeholder="Template description"
                    rows={3}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="rounded"
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>

                {template && (
                  <div className="pt-4 border-t border-slate-700">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Version:</span>
                      <Badge variant="secondary">{template.version}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-slate-400">Created:</span>
                      <span className="text-slate-300">
                        {new Date(template.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-slate-400">Updated:</span>
                      <span className="text-slate-300">
                        {new Date(template.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Tabs defaultValue="editor" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="editor" className="flex items-center gap-2">
                  <Edit className="w-4 h-4" />
                  Editor
                </TabsTrigger>
                <TabsTrigger value="preview" className="flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Preview
                </TabsTrigger>
              </TabsList>

              <TabsContent value="editor" className="mt-6">
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle>HTML Content</CardTitle>
                    <p className="text-sm text-slate-400">
                      Use the rich text editor below to create your email template. 
                      You can insert variables using the Variables dropdown.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <EmailTemplateEditor
                      content={formData.htmlContent}
                      onChange={(content) => setFormData(prev => ({ ...prev, htmlContent: content }))}
                      variables={variables}
                      placeholder="Start writing your email template..."
                    />
                  </CardContent>
                </Card>

                <Card className="bg-slate-800 border-slate-700 mt-6">
                  <CardHeader>
                    <CardTitle>Plain Text Content (Optional)</CardTitle>
                    <p className="text-sm text-slate-400">
                      Plain text version for email clients that don't support HTML
                    </p>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={formData.textContent}
                      onChange={(e) => setFormData(prev => ({ ...prev, textContent: e.target.value }))}
                      placeholder="Plain text version of your email..."
                      rows={6}
                      className="bg-slate-700 border-slate-600 text-slate-100"
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="preview" className="mt-6">
                <EmailPreview
                  htmlContent={formData.htmlContent}
                  subject={formData.subject}
                  variables={variables}
                  onSendTest={handleSendTest}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
} 