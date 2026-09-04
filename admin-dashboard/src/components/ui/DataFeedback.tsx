import React from 'react';
import { ChevronLeft, ChevronRight, Inbox, AlertCircle, RefreshCw, CheckCircle2, X } from 'lucide-react';
import { Button, IconButton } from './Primitives';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  onPageChange: (page: number) => void;
  style?: React.CSSProperties;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
  style,
}) => {
  if (totalPages <= 1 && (totalItems === undefined || totalItems === 0)) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        padding: '0.75rem 0',
        ...style,
      }}
    >
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        Page <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{currentPage}</span> of{' '}
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{totalPages || 1}</span>
        {totalItems !== undefined && (
          <span> • ({totalItems} total records)</span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Button
          variant="secondary"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          icon={<ChevronLeft size={14} />}
          aria-label="Previous Page"
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next Page"
        >
          <span>Next</span>
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
};

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  style?: React.CSSProperties;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = <Inbox size={36} color="var(--text-muted)" />,
  title,
  description,
  action,
  style,
}) => {
  return (
    <div
      style={{
        padding: '3rem 1.5rem',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        border: '1px dashed var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        background: 'rgba(15, 23, 42, 0.3)',
        ...style,
      }}
    >
      <div style={{ opacity: 0.7, marginBottom: '0.25rem' }}>{icon}</div>
      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h3>
      {description && (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: '420px', lineHeight: 1.5 }}>
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: '0.5rem' }}>{action}</div>}
    </div>
  );
};

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  style?: React.CSSProperties;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Failed to load content',
  message,
  onRetry,
  style,
}) => {
  return (
    <div
      style={{
        padding: '2.5rem 1.5rem',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--accent-rose-muted)',
        border: '1px solid rgba(244, 63, 94, 0.25)',
        ...style,
      }}
    >
      <AlertCircle size={32} color="var(--accent-rose)" />
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '420px' }}>{message}</p>
      {onRetry && (
        <Button variant="primary" size="sm" onClick={onRetry} icon={<RefreshCw size={14} />}>
          Retry
        </Button>
      )}
    </div>
  );
};

export const ErrorView = ErrorState;

export interface AlertBannerProps {
  type?: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onClose?: () => void;
  style?: React.CSSProperties;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  type = 'info',
  message,
  onClose,
  style,
}) => {
  const isSuccess = type === 'success';
  const isError = type === 'error';
  const isWarning = type === 'warning';

  let bg = 'rgba(255, 255, 255, 0.06)';
  let border = 'rgba(255, 255, 255, 0.18)';
  let color = '#f4f4f5';
  let Icon = CheckCircle2;

  if (isError) {
    bg = 'var(--accent-rose-muted)';
    border = 'rgba(239, 68, 68, 0.25)';
    color = '#f87171';
    Icon = AlertCircle;
  } else if (isWarning) {
    bg = 'rgba(212, 212, 216, 0.08)';
    border = 'rgba(212, 212, 216, 0.2)';
    color = '#d4d4d8';
    Icon = AlertCircle;
  }

  return (
    <div
      style={{
        padding: '0.75rem 1rem',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: bg,
        border: `1px solid ${border}`,
        color,
        fontSize: '0.875rem',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Icon size={16} />
        <span>{message}</span>
      </div>
      {onClose && (
        <IconButton
          icon={<X size={14} />}
          label="Dismiss alert"
          size="sm"
          onClick={onClose}
          style={{ width: '24px', height: '24px', color: 'inherit' }}
        />
      )}
    </div>
  );
};

export const Skeleton: React.FC<{
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  style?: React.CSSProperties;
}> = ({ width = '100%', height = '20px', borderRadius = 'var(--radius-md)', style }) => {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-tertiary) 50%, var(--bg-secondary) 75%)',
        backgroundSize: '200% 100%',
        animation: 'pulseGlow 1.5s ease-in-out infinite',
        ...style,
      }}
    />
  );
};
