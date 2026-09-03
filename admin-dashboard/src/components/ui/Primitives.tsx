import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  className = '',
  disabled,
  style,
  ...props
}) => {
  let variantClass = 'btn-secondary';
  if (variant === 'primary') variantClass = 'btn-primary';
  else if (variant === 'danger') variantClass = 'btn-danger';
  else if (variant === 'ghost') variantClass = 'btn-ghost';
  else if (variant === 'link') variantClass = 'btn-ghost';

  const sizeStyle: React.CSSProperties = {
    ...(size === 'sm' ? { padding: '0.375rem 0.75rem', fontSize: '0.8rem' } : {}),
    ...(size === 'lg' ? { padding: '0.75rem 1.5rem', fontSize: '0.95rem' } : {}),
    ...(variant === 'link' ? { padding: 0, textDecoration: 'underline', color: 'var(--accent-primary)' } : {}),
    ...style,
  };

  return (
    <button
      className={`btn ${variantClass} ${className}`}
      disabled={disabled || loading}
      style={sizeStyle}
      {...props}
    >
      {loading ? (
        <Loader2 size={size === 'sm' ? 14 : 16} className="spin" aria-hidden="true" />
      ) : (
        icon
      )}
      {children && <span>{children}</span>}
    </button>
  );
};

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'secondary' | 'ghost' | 'danger' | 'primary';
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  label,
  size = 'md',
  variant = 'ghost',
  className = '',
  style,
  ...props
}) => {
  const dim = size === 'sm' ? '30px' : size === 'lg' ? '42px' : '36px';
  let bg = 'transparent';
  let color = 'var(--text-secondary)';
  if (variant === 'secondary') {
    bg = 'var(--bg-tertiary)';
  } else if (variant === 'primary') {
    bg = 'var(--accent-primary-muted)';
    color = 'var(--accent-primary)';
  } else if (variant === 'danger') {
    bg = 'var(--accent-rose-muted)';
    color = 'var(--accent-rose)';
  }

  return (
    <button
      type="button"
      className={`btn ${className}`}
      aria-label={label}
      title={label}
      style={{
        width: dim,
        height: dim,
        padding: 0,
        borderRadius: 'var(--radius-md)',
        background: bg,
        color,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
      {...props}
    >
      {icon}
    </button>
  );
};

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  icon?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  icon,
  className = '',
  style,
}) => {
  return (
    <span className={`badge badge-${variant} ${className}`} style={style}>
      {icon}
      <span>{children}</span>
    </span>
  );
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  hover = false,
  className = '',
  style,
  ...props
}) => {
  return (
    <div
      className={`card ${hover ? 'card-hover' : ''} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
};

export interface TabsProps {
  tabs: { id: string; label: string; count?: number; icon?: React.ReactNode }[];
  activeTab: string;
  onChange: (tabId: string) => void;
  style?: React.CSSProperties;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, style }) => {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
        borderBottom: '1px solid var(--border-color)',
        marginBottom: '1rem',
        ...style,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            style={{
              padding: '0.625rem 1rem',
              fontSize: '0.875rem',
              fontWeight: isActive ? 700 : 500,
              color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
              borderBottom: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
              marginBottom: '-1px',
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'var(--transition-fast)',
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.125rem 0.375rem',
                  borderRadius: '9999px',
                  background: isActive ? 'var(--accent-primary-muted)' : 'var(--bg-tertiary)',
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export interface TableProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const Table: React.FC<TableProps> = ({ children, className = '', style }) => {
  return (
    <div className="table-container" style={style}>
      <table className={`table ${className}`}>
        {children}
      </table>
    </div>
  );
};

export interface NavButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export const NavButton: React.FC<NavButtonProps> = ({
  children,
  active = false,
  icon,
  badge,
  className = '',
  style,
  ...props
}) => {
  return (
    <button
      type="button"
      className={`nav-btn ${active ? 'active' : ''} ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        width: '100%',
        padding: '0.625rem 0.875rem',
        borderRadius: 'var(--radius-md)',
        border: 'none',
        background: active ? 'var(--accent-primary-muted)' : 'transparent',
        color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
        fontWeight: active ? 700 : 500,
        fontSize: '0.875rem',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'var(--transition-fast)',
        ...style,
      }}
      {...props}
    >
      {icon}
      <span style={{ flex: 1 }}>{children}</span>
      {badge}
    </button>
  );
};
