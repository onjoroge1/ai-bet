'use client'

import { useState } from 'react'
import { Resend } from 'resend'

export default function TestResendPage() {
  const [email, setEmail] = useState('kim.njo@gmail.com')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const testResendDirect = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // Test direct Resend API call
      const resend = new Resend('re_5tw8bhnj_MB9BbJBoq5nv31BRkty92A91')
      
      const data = await resend.emails.send({
        from: 'notifications@notifications.snapbet.bet',
        to: [email],
        subject: 'Test Email from SnapBet',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="margin: 0; font-size: 28px;">Test Email from SnapBet</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">This is a test email to verify Resend configuration</p>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <h2 style="color: #374151; margin-top: 0;">Hello!</h2>
              
              <p style="color: #6b7280; line-height: 1.6;">
                This is a test email sent directly through the Resend API to verify that our email configuration is working correctly.
              </p>
              
              <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #374151; margin-top: 0;">Test Details:</h3>
                <ul style="color: #6b7280;">
                  <li>API Key: re_5tw8bhnj_MB9BbJBoq5nv31BRkty92A91</li>
                  <li>From: notifications@snapbet.bet</li>
                  <li>To: ${email}</li>
                  <li>Timestamp: ${new Date().toISOString()}</li>
                </ul>
              </div>
              
              <p style="color: #6b7280; line-height: 1.6;">
                If you received this email, it means our Resend configuration is working properly!
              </p>
            </div>
          </div>
        `
      })

      setResult(data)
      console.log('Resend API Response:', data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      console.error('Resend API Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const testEmailService = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          type: 'payment-confirmation'
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send test email')
      }

      setResult(data)
      console.log('Email Service Response:', data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      console.error('Email Service Error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Resend Email Test Page</h1>
          
          <div className="mb-8">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Test Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Enter email address"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <button
              onClick={testResendDirect}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Test Direct Resend API'}
            </button>

            <button
              onClick={testEmailService}
              disabled={loading}
              className="bg-purple-600 text-white px-6 py-3 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Test Email Service'}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
              <h3 className="text-red-800 font-medium">Error</h3>
              <p className="text-red-600 mt-1">{error}</p>
            </div>
          )}

          {result && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <h3 className="text-green-800 font-medium">Success</h3>
              <pre className="text-green-600 mt-2 text-sm overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}

          <div className="mt-8 p-4 bg-gray-50 rounded-md">
            <h3 className="font-medium text-gray-900 mb-2">Debug Information</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• API Key: re_5tw8bhnj_MB9BbJBoq5nv31BRkty92A91</li>
              <li>• From Domain: notifications@notifications.snapbet.bet</li>
              <li>• Environment: {process.env.NODE_ENV}</li>
              <li>• Check browser console for detailed logs</li>
              <li>• Note: notifications.snapbet.bet subdomain should be verified in Resend dashboard</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
} 