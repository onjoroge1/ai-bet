'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowRight, CheckCircle, AlertCircle } from 'lucide-react'

export function NewsletterSignup() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !email.includes('@')) {
      setStatus('error')
      setMessage('Please enter a valid email address')
      return
    }

    setStatus('loading')
    
    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        setStatus('success')
        setMessage('Successfully subscribed! Check your email for confirmation.')
        setEmail('')
      } else {
        setStatus('error')
        setMessage(data.error || 'Failed to subscribe. Please try again.')
      }
    } catch (error) {
      setStatus('error')
      setMessage('Network error. Please try again.')
    }
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 w-full">
        <Input
          type="email"
          placeholder="Enter your email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-slate-700 border-slate-600 text-white text-lg h-12"
          disabled={status === 'loading'}
        />
        <Button 
          type="submit" 
          className="bg-emerald-600 hover:bg-emerald-700 text-lg h-12 px-8"
          disabled={status === 'loading'}
        >
          {status === 'loading' ? 'Subscribing...' : 'Subscribe'}
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </form>
      
      {/* Status Messages */}
      {status === 'success' && (
        <div className="flex items-center gap-2 text-green-400 text-sm mt-2">
          <CheckCircle className="w-4 h-4" />
          {message}
        </div>
      )}
      
      {status === 'error' && (
        <div className="flex items-center gap-2 text-red-400 text-sm mt-2">
          <AlertCircle className="w-4 h-4" />
          {message}
        </div>
      )}
    </div>
  )
}
