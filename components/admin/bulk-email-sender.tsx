'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { 
  Users, 
  Mail, 
  Send, 
  Eye, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react'
import { EmailVariable } from '@/types/email-templates'

interface BulkEmailSenderProps {
  templateId: string
  templateSlug: string
  variables?: EmailVariable[]
  onClose?: () => void
}

interface User {
  id: string
  email: string
  fullName?: string
  role: string
  subscriptionPlan?: string
  emailNotifications: boolean
  country?: {
    name: string
    code: string
  }
}

interface SendResult {
  total: number
  sent: number
  failed: number
  errors: string[]
}

export function BulkEmailSender({ 
  templateId, 
  templateSlug, 
  variables = [], 
  onClose 
}: BulkEmailSenderProps) {
  const [recipientType, setRecipientType] = useState<'all' | 'specific' | 'filtered'>('all')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [sendResult, setSendResult] = useState<SendResult | null>(null)
  
  // Variable values for the email
  const [variableValues, setVariableValues] = useState<Record<string, any>>({})
  
  // Filters for filtered sending
  const [filters, setFilters] = useState({
    countryId: '',
    subscriptionPlan: '',
    role: '',
    emailNotifications: true
  })

  // Load users when component mounts
  useEffect(() => {
    loadUsers()
  }, [])

  // Generate sample data for variables
  useEffect(() => {
    const sampleData: Record<string, any> = {}
    variables.forEach(variable => {
      if (variable.defaultValue !== undefined) {
        sampleData[variable.name] = variable.defaultValue
      } else {
        // Generate sample data based on type
        switch (variable.type) {
          case 'string':
            sampleData[variable.name] = `Sample ${variable.name}`
            break
          case 'number':
            sampleData[variable.name] = 5
            break
          case 'boolean':
            sampleData[variable.name] = true
            break
          case 'array':
            sampleData[variable.name] = ['Item 1', 'Item 2']
            break
          default:
            sampleData[variable.name] = `Sample ${variable.name}`
        }
      }
    })
    setVariableValues(sampleData)
  }, [variables])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/users?limit=100')
      const data = await response.json()
      
      if (data.success) {
        setUsers(data.data.users)
      } else {
        setError('Failed to load users')
      }
    } catch (err) {
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const handleUserToggle = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleSelectAll = () => {
    const activeUsers = users.filter(user => user.emailNotifications)
    setSelectedUsers(activeUsers.map(user => user.id))
  }

  const handleDeselectAll = () => {
    setSelectedUsers([])
  }

  const handleSend = async (dryRun = false) => {
    try {
      setSending(true)
      setError(null)
      setSuccess(null)
      setSendResult(null)

      let requestData: any = {
        templateId,
        recipientType,
        variables: variableValues,
        dryRun
      }

      switch (recipientType) {
        case 'all':
          // No additional data needed
          break
        case 'specific':
          const selectedUserEmails = users
            .filter(user => selectedUsers.includes(user.id))
            .map(user => user.email)
          requestData.recipientEmails = selectedUserEmails
          break
        case 'filtered':
          requestData.filters = filters
          break
      }

      const response = await fetch('/api/admin/email-templates/bulk-send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      const data = await response.json()

      if (data.success) {
        if (dryRun) {
          setSuccess(`Dry run: Would send to ${data.data.recipientCount} recipients`)
        } else {
          setSuccess(`Bulk email send completed: ${data.data.sent} sent, ${data.data.failed} failed`)
          setSendResult(data.data)
        }
      } else {
        setError(data.error || 'Failed to send bulk emails')
      }
    } catch (err) {
      setError('Failed to send bulk emails')
    } finally {
      setSending(false)
    }
  }

  const getRecipientCount = () => {
    switch (recipientType) {
      case 'all':
        return users.filter(user => user.emailNotifications).length
      case 'specific':
        return selectedUsers.length
      case 'filtered':
        return users.filter(user => 
          user.emailNotifications &&
          (filters.countryId === 'all' || !filters.countryId || user.country?.code === filters.countryId) &&
          (filters.subscriptionPlan === 'all' || !filters.subscriptionPlan || user.subscriptionPlan === filters.subscriptionPlan) &&
          (!filters.role || user.role === filters.role)
        ).length
      default:
        return 0
    }
  }

  const recipientCount = getRecipientCount()

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Bulk Email Sender
        </CardTitle>
        <p className="text-sm text-slate-400">
          Send this template to multiple users
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Messages */}
        {error && (
          <div className="p-4 bg-red-900/20 border border-red-500 rounded-lg">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-400" />
              <span className="text-red-400">{error}</span>
            </div>
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-900/20 border border-green-500 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-green-400">{success}</span>
            </div>
          </div>
        )}

        {/* Send Results */}
        {sendResult && (
          <div className="p-4 bg-blue-900/20 border border-blue-500 rounded-lg">
            <h4 className="font-medium text-blue-400 mb-2">Send Results:</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-blue-300">Total:</span>
                <span className="ml-2 text-white">{sendResult.total}</span>
              </div>
              <div>
                <span className="text-green-300">Sent:</span>
                <span className="ml-2 text-white">{sendResult.sent}</span>
              </div>
              <div>
                <span className="text-red-300">Failed:</span>
                <span className="ml-2 text-white">{sendResult.failed}</span>
              </div>
            </div>
            {sendResult.errors.length > 0 && (
              <div className="mt-2">
                <span className="text-red-300 text-sm">Errors:</span>
                <ul className="text-xs text-red-200 mt-1 space-y-1">
                  {sendResult.errors.slice(0, 3).map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                  {sendResult.errors.length > 3 && (
                    <li>• ... and {sendResult.errors.length - 3} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Recipient Type Selection */}
        <div>
          <Label className="text-sm font-medium">Recipient Type:</Label>
          <Select value={recipientType} onValueChange={(value: any) => setRecipientType(value)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users (with email notifications enabled)</SelectItem>
              <SelectItem value="specific">Specific Users</SelectItem>
              <SelectItem value="filtered">Filtered Users</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filtered Users Options */}
        {recipientType === 'filtered' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Country:</Label>
              <Select 
                value={filters.countryId} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, countryId: value }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All countries</SelectItem>
                  <SelectItem value="us">United States</SelectItem>
                  <SelectItem value="uk">United Kingdom</SelectItem>
                  <SelectItem value="ng">Nigeria</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">Subscription:</Label>
              <Select 
                value={filters.subscriptionPlan} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, subscriptionPlan: value }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All plans" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All plans</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Specific Users Selection */}
        {recipientType === 'specific' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">Select Users:</Label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={handleDeselectAll}>
                  Deselect All
                </Button>
              </div>
            </div>
            <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Loading users...
                </div>
              ) : (
                users
                  .filter(user => user.emailNotifications)
                  .map(user => (
                    <div key={user.id} className="flex items-center space-x-2">
                      <Checkbox
                        checked={selectedUsers.includes(user.id)}
                        onCheckedChange={() => handleUserToggle(user.id)}
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium">{user.fullName || 'No name'}</span>
                        <span className="text-xs text-slate-400 ml-2">{user.email}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {user.subscriptionPlan || 'free'}
                      </Badge>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {/* Variable Inputs */}
        {variables.length > 0 && (
          <div>
            <Label className="text-sm font-medium">Template Variables:</Label>
            <div className="grid grid-cols-2 gap-4 mt-2">
              {variables.map((variable) => (
                <div key={variable.name}>
                  <Label className="text-xs font-medium">
                    {variable.name}
                    {variable.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  {variable.type === 'string' && variable.description?.includes('textarea') ? (
                    <Textarea
                      value={variableValues[variable.name] || ''}
                      onChange={(e) => setVariableValues(prev => ({
                        ...prev,
                        [variable.name]: e.target.value
                      }))}
                      placeholder={variable.description}
                      className="text-xs mt-1"
                      rows={3}
                    />
                  ) : (
                    <Input
                      value={variableValues[variable.name] || ''}
                      onChange={(e) => setVariableValues(prev => ({
                        ...prev,
                        [variable.name]: e.target.value
                      }))}
                      placeholder={variable.description}
                      className="text-xs mt-1"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recipient Count */}
        <div className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-300">Recipients:</span>
            <Badge variant="secondary">{recipientCount}</Badge>
          </div>
          {recipientCount === 0 && (
            <div className="flex items-center gap-1 text-yellow-400 text-xs">
              <AlertTriangle className="w-3 h-3" />
              No recipients selected
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleSend(true)}
            disabled={sending || recipientCount === 0}
          >
            <Eye className="w-4 h-4 mr-2" />
            Dry Run
          </Button>
          <Button
            onClick={() => handleSend(false)}
            disabled={sending || recipientCount === 0}
          >
            {sending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Send to {recipientCount} Recipients
          </Button>
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
} 