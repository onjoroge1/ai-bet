import React from 'react'

interface SupportContactEmailProps {
  name: string
  email: string
  subject: string
  priority: string
  category: string
  message: string
  submittedAt: string
}

export default function SupportContactEmail({
  name,
  email,
  subject,
  priority,
  category,
  message,
  submittedAt
}: SupportContactEmailProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return '#dc2626' // red-600
      case 'high':
        return '#ea580c' // orange-600
      case 'medium':
        return '#d97706' // amber-600
      case 'low':
        return '#059669' // emerald-600
      default:
        return '#6b7280' // gray-500
    }
  }

  const getPriorityLabel = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return '🚨 URGENT'
      case 'high':
        return '🔴 HIGH'
      case 'medium':
        return '🟡 MEDIUM'
      case 'low':
        return '🟢 LOW'
      default:
        return '⚪ MEDIUM'
    }
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ 
        background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
        color: 'white',
        padding: '20px',
        textAlign: 'center',
        borderRadius: '8px 8px 0 0'
      }}>
        <h1 style={{ margin: '0', fontSize: '24px', fontWeight: 'bold' }}>
          🆘 New Support Request
        </h1>
        <p style={{ margin: '8px 0 0 0', opacity: '0.9' }}>
          A user has submitted a support request
        </p>
      </div>

      {/* Content */}
      <div style={{ padding: '24px', backgroundColor: '#f9fafb', borderRadius: '0 0 8px 8px' }}>
        {/* Priority Badge */}
        <div style={{ 
          display: 'inline-block',
          backgroundColor: getPriorityColor(priority),
          color: 'white',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '14px',
          fontWeight: 'bold',
          marginBottom: '20px'
        }}>
          {getPriorityLabel(priority)} Priority
        </div>

        {/* Request Details */}
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
          <h2 style={{ margin: '0 0 16px 0', color: '#1f2937', fontSize: '18px' }}>
            📋 Request Details
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <strong style={{ color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' }}>Name</strong>
              <p style={{ margin: '4px 0 0 0', color: '#1f2937' }}>{name}</p>
            </div>
            <div>
              <strong style={{ color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' }}>Email</strong>
              <p style={{ margin: '4px 0 0 0', color: '#1f2937' }}>{email}</p>
            </div>
            <div>
              <strong style={{ color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' }}>Category</strong>
              <p style={{ margin: '4px 0 0 0', color: '#1f2937' }}>{category || 'Not specified'}</p>
            </div>
            <div>
              <strong style={{ color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' }}>Submitted</strong>
              <p style={{ margin: '4px 0 0 0', color: '#1f2937' }}>{submittedAt}</p>
            </div>
          </div>

          <div>
            <strong style={{ color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' }}>Subject</strong>
            <p style={{ margin: '4px 0 0 0', color: '#1f2937', fontWeight: 'bold' }}>{subject}</p>
          </div>
        </div>

        {/* Message */}
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#1f2937', fontSize: '16px' }}>
            💬 Message
          </h3>
          <div style={{ 
            backgroundColor: '#f3f4f6', 
            padding: '16px', 
            borderRadius: '6px',
            whiteSpace: 'pre-wrap',
            color: '#374151',
            lineHeight: '1.5'
          }}>
            {message}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ textAlign: 'center' }}>
          <a href={`mailto:${email}?subject=Re: ${subject}`} style={{
            display: 'inline-block',
            backgroundColor: '#059669',
            color: 'white',
            padding: '12px 24px',
            textDecoration: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
            marginRight: '12px'
          }}>
            📧 Reply to User
          </a>
          
          <a href={`mailto:${email}?subject=Support Request #${Date.now()}&body=This support request has been assigned to you.`} style={{
            display: 'inline-block',
            backgroundColor: '#6b7280',
            color: 'white',
            padding: '12px 24px',
            textDecoration: 'none',
            borderRadius: '6px',
            fontWeight: 'bold'
          }}>
            📋 Assign to Team
          </a>
        </div>

        {/* Footer */}
        <div style={{ 
          marginTop: '24px', 
          paddingTop: '20px', 
          borderTop: '1px solid #e5e7eb',
          textAlign: 'center',
          color: '#6b7280',
          fontSize: '12px'
        }}>
          <p style={{ margin: '0' }}>
            This email was automatically generated from the SnapBet support system.<br />
            Please respond within 24 hours to maintain our service standards.
          </p>
        </div>
      </div>
    </div>
  )
}

// Export the props interface for use in the API
export type { SupportContactEmailProps } 