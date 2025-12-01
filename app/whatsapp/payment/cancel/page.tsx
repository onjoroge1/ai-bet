export default function WhatsAppPaymentCancel() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: '#f5f5f5',
      textAlign: 'center'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        maxWidth: '400px',
        width: '100%'
      }}>
        <div style={{
          fontSize: '64px',
          marginBottom: '20px'
        }}>
          ❌
        </div>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          marginBottom: '12px',
          color: '#1a1a1a'
        }}>
          Payment Cancelled
        </h1>
        <p style={{
          fontSize: '16px',
          color: '#666',
          marginBottom: '24px',
          lineHeight: '1.5'
        }}>
          Your payment was cancelled. No charges were made.
        </p>
        <p style={{
          fontSize: '14px',
          color: '#999',
          marginTop: '24px'
        }}>
          You can close this window and return to WhatsApp to try again.
        </p>
      </div>
    </div>
  );
}

