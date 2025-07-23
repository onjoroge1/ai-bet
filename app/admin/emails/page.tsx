'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Mail, 
  Plus, 
  Edit, 
  Eye, 
  Trash2, 
  Copy, 
  Search,
  Filter,
  FileText,
  Shield,
  CreditCard,
  Settings
} from 'lucide-react'
import { EmailTemplate, EmailTemplateCategory, EMAIL_TEMPLATE_CATEGORIES } from '@/types/email-templates'

export default function EmailTemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [previewHtml, setPreviewHtml] = useState('')

  // Load templates on component mount
  useEffect(() => {
    loadTemplates()
  }, [])

  // Load preview when template is selected
  useEffect(() => {
    if (selectedTemplate) {
      setPreviewHtml(selectedTemplate.htmlContent)
    }
  }, [selectedTemplate])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/email-templates')
      const data = await response.json()
      
      if (data.success) {
        setTemplates(data.data || [])
        
        // Select first template by default
        if ((data.data || []).length > 0 && !selectedTemplate) {
          setSelectedTemplate(data.data[0])
        }
      } else {
        console.error('Failed to load templates:', data.error)
      }
    } catch (error) {
      console.error('Failed to load templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTemplateSelect = (template: EmailTemplate) => {
    setSelectedTemplate(template)
  }

  const handleEditTemplate = (template: EmailTemplate) => {
    router.push(`/admin/emails/${template.id}/edit`)
  }

  const handleSearch = (value: string) => {
    setSearchTerm(value)
  }

  const handleCategoryFilter = (category: string) => {
    setSelectedCategory(category)
  }

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.subject.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory
    
    return matchesSearch && matchesCategory
  })

  const groupedTemplates = filteredTemplates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = []
    }
    acc[template.category].push(template)
    return acc
  }, {} as Record<string, EmailTemplate[]>)

  const getCategoryIcon = (category: EmailTemplateCategory) => {
    switch (category) {
      case 'payment':
        return <CreditCard className="w-4 h-4" />
      case 'security':
        return <Shield className="w-4 h-4" />
      case 'marketing':
        return <Mail className="w-4 h-4" />
      case 'system':
        return <Settings className="w-4 h-4" />
      default:
        return <FileText className="w-4 h-4" />
    }
  }

  const getCategoryColor = (category: EmailTemplateCategory) => {
    switch (category) {
      case 'payment':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'security':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'marketing':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'system':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 text-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div>
              <p className="mt-4 text-slate-300">Loading email templates...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Email Template Previewer</h1>
              <p className="text-slate-300 mt-2">Select an email template to preview its design and content.</p>
            </div>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Create Template
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Templates */}
          <div className="lg:col-span-1">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Mail className="w-5 h-5 mr-2" />
                  Templates
                </CardTitle>
                
                {/* Search and Filter */}
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                      placeholder="Search templates..."
                      value={searchTerm}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="pl-10 bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                    />
                  </div>
                  
                  <Select value={selectedCategory} onValueChange={handleCategoryFilter}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                      <SelectValue placeholder="Filter by category" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      <SelectItem value="all">All Categories</SelectItem>
                      {Object.entries(EMAIL_TEMPLATE_CATEGORIES).map(([key, category]) => (
                        <SelectItem key={key} value={key}>
                          <span className="flex items-center">
                            <span className="mr-2">{category.icon}</span>
                            {category.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-slate-400">
                        {EMAIL_TEMPLATE_CATEGORIES[category as EmailTemplateCategory]?.icon} {EMAIL_TEMPLATE_CATEGORIES[category as EmailTemplateCategory]?.name}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {categoryTemplates.length}
                      </Badge>
                    </div>
                    
                    {categoryTemplates.map((template) => (
                      <div
                        key={template.id}
                        onClick={() => handleTemplateSelect(template)}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedTemplate?.id === template.id
                            ? 'bg-emerald-600 border-emerald-500 text-white'
                            : 'bg-slate-700 border-slate-600 hover:bg-slate-600 text-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              {getCategoryIcon(template.category)}
                              <h3 className="font-medium text-sm">{template.name}</h3>
                              {!template.isActive && (
                                <Badge variant="destructive" className="text-xs">Inactive</Badge>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 line-clamp-2">
                              {template.description || 'No description available'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                
                {filteredTemplates.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No templates found</p>
                    <p className="text-sm">Try adjusting your search or filters</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Preview */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <span>Preview</span>
                  {selectedTemplate && (
                    <div className="flex items-center space-x-2">
                      <Badge className={getCategoryColor(selectedTemplate.category)}>
                        {EMAIL_TEMPLATE_CATEGORIES[selectedTemplate.category]?.name}
                      </Badge>
                      <div className="flex space-x-1">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="border-slate-600 text-slate-300"
                          onClick={() => handleEditTemplate(selectedTemplate)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" className="border-slate-600 text-slate-300">
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" className="border-slate-600 text-slate-300">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              
              <CardContent>
                {selectedTemplate ? (
                  <div className="space-y-4">
                    {/* Template Info */}
                    <div className="bg-slate-700 rounded-lg p-4">
                      <h3 className="font-semibold text-white mb-2">{selectedTemplate.name}</h3>
                      <p className="text-slate-300 text-sm mb-2">{selectedTemplate.description}</p>
                      <div className="flex items-center space-x-4 text-xs text-slate-400">
                        <span>Version: {selectedTemplate.version}</span>
                        <span>Category: {EMAIL_TEMPLATE_CATEGORIES[selectedTemplate.category]?.name}</span>
                        <span>Status: {selectedTemplate.isActive ? 'Active' : 'Inactive'}</span>
                      </div>
                    </div>

                    {/* Subject Line */}
                    <div className="bg-slate-700 rounded-lg p-4">
                      <h4 className="font-medium text-white mb-2">Subject Line</h4>
                      <p className="text-slate-300 text-sm">{selectedTemplate.subject}</p>
                    </div>

                    {/* Email Preview */}
                    <div className="bg-slate-700 rounded-lg p-4">
                      <h4 className="font-medium text-white mb-2">Email Content</h4>
                      <div className="bg-white rounded-lg p-4 max-h-96 overflow-y-auto">
                        <div 
                          dangerouslySetInnerHTML={{ __html: previewHtml }}
                          className="email-preview"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    <Eye className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">Select a template to preview</p>
                    <p className="text-sm">Choose a template from the list to see its design and content</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <style jsx>{`
        .email-preview {
          font-family: Arial, sans-serif;
        }
        
        .email-preview * {
          max-width: 100% !important;
        }
      `}</style>
    </div>
  )
} 