'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Bell, Loader2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function TestNotificationButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [type, setType] = useState('info')
  const [category, setCategory] = useState('system')

  const createTestNotification = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/test-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, category }),
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Test notification created:', data)
        // You could show a toast notification here
        alert('Test notification created! Check the notification bell.')
      } else {
        console.error('Failed to create test notification')
        alert('Failed to create test notification')
      }
    } catch (error) {
      console.error('Error creating test notification:', error)
      alert('Error creating test notification')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center space-x-2 p-4 bg-slate-800/50 rounded-lg">
      <span className="text-sm text-slate-300">Test Notifications:</span>
      
      <Select value={type} onValueChange={setType}>
        <SelectTrigger className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="info">Info</SelectItem>
          <SelectItem value="success">Success</SelectItem>
          <SelectItem value="warning">Warning</SelectItem>
          <SelectItem value="error">Error</SelectItem>
          <SelectItem value="prediction">Prediction</SelectItem>
          <SelectItem value="payment">Payment</SelectItem>
          <SelectItem value="achievement">Achievement</SelectItem>
        </SelectContent>
      </Select>

      <Select value={category} onValueChange={setCategory}>
        <SelectTrigger className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="system">System</SelectItem>
          <SelectItem value="prediction">Prediction</SelectItem>
          <SelectItem value="payment">Payment</SelectItem>
          <SelectItem value="achievement">Achievement</SelectItem>
          <SelectItem value="marketing">Marketing</SelectItem>
        </SelectContent>
      </Select>

      <Button
        onClick={createTestNotification}
        disabled={isLoading}
        size="sm"
        variant="outline"
        className="border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Bell className="h-4 w-4" />
        )}
        <span className="ml-2">Create Test</span>
      </Button>
    </div>
  )
} 