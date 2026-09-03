import React from 'react';
import { Search } from 'lucide-react';

export interface FormFieldProps {
  label?: string;
  error?: string | null;
  helperText?: string;
  required?: boolean;
  children: React.ReactNode;
  id?: string;
  style?: React.CSSProperties;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  helperText,
  required,
  children,
  id,
  style,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', ...style }}>
      {label && (
        <label
          htmlFor={id}
          style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          <span>{label}</span>
          {required && <span style={{ color: 'var(--accent-rose)' }}>*</span>}
        </label>
      )}
      {children}
      {error && (
        <span style={{ fontSize: '0.75rem', color: 'var(--accent-rose)', marginTop: '0.125rem' }}>
          {error}
        </span>
      )}
      {!error && helperText && (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
          {helperText}
        </span>
      )}
    </div>
  );
};

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const TextInput: React.FC<TextInputProps> = ({ error, className = '', style, ...props }) => {
  return (
    <input
      className={`input ${className}`}
      style={{
        ...(error ? { borderColor: 'var(--accent-rose)', boxShadow: '0 0 0 1px var(--accent-rose)' } : {}),
        ...style,
      }}
      {...props}
    />
  );
};

export interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: number | '';
  onChange: (val: number | '') => void;
  error?: boolean;
  min?: number;
  max?: number;
  step?: number | string;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  error,
  min,
  max,
  step = 'any',
  style,
  ...props
}) => {
  return (
    <input
      type="number"
      className="input"
      value={value === '' ? '' : value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const v = e.target.value;
        if (v === '') {
          onChange('');
        } else {
          const parsed = parseFloat(v);
          onChange(isNaN(parsed) ? '' : parsed);
        }
      }}
      style={{
        ...(error ? { borderColor: 'var(--accent-rose)', boxShadow: '0 0 0 1px var(--accent-rose)' } : {}),
        ...style,
      }}
      {...props}
    />
  );
};

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onClear?: () => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  placeholder = 'Search...',
  style,
  ...props
}) => {
  return (
    <div style={{ position: 'relative', width: '100%', minWidth: '220px', ...style }}>
      <Search
        size={16}
        style={{
          position: 'absolute',
          left: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-muted)',
          pointerEvents: 'none',
        }}
      />
      <input
        type="text"
        className="input"
        placeholder={placeholder}
        style={{ paddingLeft: '2.25rem', width: '100%' }}
        {...props}
      />
    </div>
  );
};

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const TextArea: React.FC<TextAreaProps> = ({ error, className = '', style, ...props }) => {
  return (
    <textarea
      className={`textarea ${className}`}
      style={{
        ...(error ? { borderColor: 'var(--accent-rose)', boxShadow: '0 0 0 1px var(--accent-rose)' } : {}),
        ...style,
      }}
      {...props}
    />
  );
};

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
}

export const Checkbox: React.FC<CheckboxProps> = ({ label, className = '', style, ...props }) => {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', ...style }}>
      <input
        type="checkbox"
        className={`checkbox ${className}`}
        style={{
          width: '16px',
          height: '16px',
          accentColor: 'var(--accent-primary)',
          cursor: 'pointer',
        }}
        {...props}
      />
      {label && <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{label}</span>}
    </label>
  );
};

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export const Switch: React.FC<SwitchProps> = ({ checked, onChange, label, disabled = false, style }) => {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.625rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        style={{
          position: 'relative',
          width: '38px',
          height: '22px',
          borderRadius: '9999px',
          background: checked ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'background var(--transition-fast)',
          padding: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: '2px',
            left: checked ? '18px' : '2px',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            background: '#ffffff',
            transition: 'left var(--transition-fast)',
          }}
        />
      </button>
      {label && <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{label}</span>}
    </label>
  );
};
