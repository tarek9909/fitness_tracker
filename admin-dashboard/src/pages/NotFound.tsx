import React from 'react';
import { Compass, ArrowLeft } from 'lucide-react';
import { Button, Card } from '../components/ui';

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
      minHeight: '65vh',
      textAlign: 'center',
      padding: '2rem',
    }}>
      <Card style={{
        maxWidth: '480px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '3rem 2rem',
        gap: '1.25rem',
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: 'var(--radius-full)',
          background: 'var(--accent-primary-muted)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent-primary)',
        }}>
          <Compass size={32} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            404 — Page Not Found
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: 1.5 }}>
            The requested administrative surface or navigation route does not exist or has been relocated.
          </p>
        </div>
        {onNavigate && (
          <Button
            variant="primary"
            onClick={() => onNavigate('dashboard')}
            icon={<ArrowLeft size={16} />}
            style={{ marginTop: '0.5rem' }}
          >
            Return to Dashboard
          </Button>
        )}
      </Card>
    </div>
  );
};
