import React from 'react';
import { Compass, ArrowLeft } from 'lucide-react';

interface NotFoundProps {
  onNavigate?: (page: string) => void;
}

export const NotFoundPage: React.FC<NotFoundProps> = ({ onNavigate }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      textAlign: 'center',
      padding: '32px',
    }}>
      <div style={{
        display: 'inline-flex',
        padding: '20px',
        borderRadius: '50%',
        background: 'rgba(59, 130, 246, 0.1)',
        color: 'var(--accent-primary, #3b82f6)',
        marginBottom: '20px',
      }}>
        <Compass size={48} />
      </div>
      <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '8px' }}>
        404 - Page Not Found
      </h1>
      <p style={{ fontSize: '15px', color: 'var(--text-secondary, #94a3b8)', maxWidth: '440px', marginBottom: '24px', lineHeight: 1.6 }}>
        The requested administrative surface does not exist or has been relocated.
      </p>
      {onNavigate && (
        <button
          onClick={() => onNavigate('dashboard')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '8px',
            background: 'var(--accent-primary, #3b82f6)',
            color: '#fff',
            fontWeight: 600,
            fontSize: '14px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={16} />
          Return to Dashboard
        </button>
      )}
    </div>
  );
};
