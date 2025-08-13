import React from 'react'

interface SupportTicketCreatedEmailProps {
  ticketId: string
  subject: string
  description: string
  category: string
  priority: string
  userName: string
  userEmail: string
  createdAt: string
}

export default function SupportTicketCreatedEmail({
  ticketId,
  subject,
  description,
  category,
  priority,
  userName,
  userEmail,
  createdAt
}: SupportTicketCreatedEmailProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'urgent': return '#dc2626'
      case 'high': return '#ea580c'
      case 'medium': return '#d97706'
      case 'low': return '#059669'
      default: return '#6b7280'
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'urgent': return '🚨'
      case 'high': return '⚠️'
      case 'medium': return '📋'
      case 'low': return '📝'
      default: return '📋'
    }
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ backgroundColor: '#1f2937', color: 'white', padding: '20px', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '24px' }}>🆘 New Support Ticket Created</h1>
        <p style={{ margin: '10px 0 0 0', opacity: 0.8 }}>A new support request requires your attention</p>
      </div>

      <div style={{ padding: '20px', backgroundColor: '#f9fafb' }}>
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
          <h2 style={{ color: '#1f2937', marginTop: 0 }}>Ticket Details</h2>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <div>
              <strong>Ticket ID:</strong> #{ticketId}
            </div>
            <div style={{ 
              backgroundColor: getPriorityColor(priority), 
              color: 'white', 
              padding: '4px 12px', 
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: 'bold'
            }}>
              {getPriorityIcon(priority)} {priority} Priority
            </div>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <strong>Subject:</strong> {subject}
          </div>

          <div style={{ marginBottom: '15px' }}>
            <strong>Category:</strong> {category}
          </div>

          <div style={{ marginBottom: '15px' }}>
            <strong>Description:</strong>
            <div style={{ 
              backgroundColor: '#f3f4f6', 
              padding: '15px', 
              borderRadius: '6px', 
              marginTop: '8px',
              whiteSpace: 'pre-wrap'
            }}>
              {description}
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
          <h3 style={{ color: '#1f2937', marginTop: 0 }}>User Information</h3>
          <div style={{ marginBottom: '10px' }}>
            <strong>Name:</strong> {userName}
          </div>
          <div style={{ marginBottom: '10px' }}>
            <strong>Email:</strong> {userEmail}
          </div>
          <div>
            <strong>Submitted:</strong> {createdAt}
          </div>
        </div>

        <div style={{ backgroundColor: '#dbeafe', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <h3 style={{ color: '#1e40af', marginTop: 0 }}>Next Steps</h3>
          <p style={{ color: '#1e40af', margin: '0' }}>
            Please review this ticket and respond within the next few hours. 
            For urgent tickets, immediate attention is required.
          </p>
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px', padding: '20px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
          <p style={{ margin: '0', color: '#6b7280', fontSize: '14px' }}>
            This is an automated notification from the SnapBet Support System.
            <br />
            Ticket ID: #{ticketId}
          </p>
        </div>
      </div>
    </div>
  )
}

export type { SupportTicketCreatedEmailProps } 