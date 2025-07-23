'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Smartphone, 
  Monitor, 
  Tablet, 
  Eye, 
  RefreshCw, 
  Copy,
  Mail,
  Download
} from 'lucide-react'
import { EmailVariable } from '@/types/email-templates'
import { EmailRenderer } from '@/lib/email-renderer'

interface EmailPreviewProps {
  htmlContent: string
  subject: string
  variables?: EmailVariable[]
  onSendTest?: (email: string) => void
}

type PreviewMode = 'desktop' | 'tablet' | 'mobile'

export function EmailPreview({ 
  htmlContent, 
  subject, 
  variables = [], 
  onSendTest 
}: EmailPreviewProps) {
  const [previewMode, setPreviewMode] = useState<PreviewMode>('desktop')
  const [variableValues, setVariableValues] = useState<Record<string, any>>({})
  const [renderedHtml, setRenderedHtml] = useState(htmlContent)
  const [renderedSubject, setRenderedSubject] = useState(subject)
  const [testEmail, setTestEmail] = useState('')

  // Generate sample data for variables
  useEffect(() => {
    const sampleData = EmailRenderer.generateSampleData(variables)
    setVariableValues(sampleData)
  }, [variables])

  // Render template with variables
  useEffect(() => {
    try {
      const rendered = EmailRenderer.renderTemplate(htmlContent, variableValues)
      setRenderedHtml(rendered)
      
      const renderedSubj = EmailRenderer.renderTemplate(subject, variableValues)
      setRenderedSubject(renderedSubj)
    } catch (error) {
      console.error('Failed to render template:', error)
      setRenderedHtml(htmlContent)
      setRenderedSubject(subject)
    }
  }, [htmlContent, subject, variableValues])

  const handleVariableChange = (variableName: string, value: any) => {
    setVariableValues(prev => ({
      ...prev,
      [variableName]: value
    }))
  }

  const resetToSampleData = () => {
    const sampleData = EmailRenderer.generateSampleData(variables)
    setVariableValues(sampleData)
  }

  const copyHtml = () => {
    navigator.clipboard.writeText(renderedHtml)
  }

  const downloadHtml = () => {
    const blob = new Blob([renderedHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'email-template.html'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getPreviewWidth = () => {
    switch (previewMode) {
      case 'mobile':
        return 'w-80'
      case 'tablet':
        return 'w-96'
      case 'desktop':
      default:
        return 'w-full'
    }
  }

  return (
    <div className="space-y-4">
      {/* Preview Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Email Preview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Preview Mode Selector */}
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Preview Mode:</Label>
            <div className="flex gap-1">
              <Button
                variant={previewMode === 'desktop' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreviewMode('desktop')}
              >
                <Monitor className="w-4 h-4" />
              </Button>
              <Button
                variant={previewMode === 'tablet' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreviewMode('tablet')}
              >
                <Tablet className="w-4 h-4" />
              </Button>
              <Button
                variant={previewMode === 'mobile' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreviewMode('mobile')}
              >
                <Smartphone className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Subject Preview */}
          <div>
            <Label className="text-sm font-medium">Subject:</Label>
            <div className="mt-1 p-2 bg-gray-50 rounded border text-sm">
              {renderedSubject}
            </div>
          </div>

          {/* Variable Controls */}
          {variables.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Variables:</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetToSampleData}
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Reset
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {variables.map((variable) => (
                  <div key={variable.name} className="space-y-1">
                    <Label className="text-xs font-medium">
                      {variable.name}
                      {variable.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    <Input
                      value={variableValues[variable.name] || ''}
                      onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                      placeholder={variable.description}
                      className="text-xs"
                    />
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {variable.type}
                      </Badge>
                      {variable.defaultValue && (
                        <span className="text-xs text-gray-500">
                          Default: {String(variable.defaultValue)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyHtml}
            >
              <Copy className="w-4 h-4 mr-1" />
              Copy HTML
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadHtml}
            >
              <Download className="w-4 h-4 mr-1" />
              Download
            </Button>
            {onSendTest && (
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="test@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="w-48"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSendTest(testEmail)}
                  disabled={!testEmail}
                >
                  <Mail className="w-4 h-4 mr-1" />
                  Send Test
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Email Preview */}
      <Card>
        <CardContent className="p-0">
          <Tabs defaultValue="preview" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="html">HTML Code</TabsTrigger>
            </TabsList>
            <TabsContent value="preview" className="p-4">
              <div className={`mx-auto ${getPreviewWidth()} border rounded-lg overflow-hidden bg-white`}>
                <div 
                  className="email-preview"
                  dangerouslySetInnerHTML={{ __html: renderedHtml }}
                />
              </div>
            </TabsContent>
            <TabsContent value="html" className="p-4">
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96">
                <pre className="text-xs">
                  <code>{renderedHtml}</code>
                </pre>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
} 