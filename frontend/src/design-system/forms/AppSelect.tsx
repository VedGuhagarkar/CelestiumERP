import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface AppSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  helperText?: string;
}

export const AppSelect: React.FC<AppSelectProps> = ({
  label,
  options,
  error,
  helperText,
  id,
  className = '',
  disabled,
  style,
  ...props
}) => {
  const selectId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }} className={className}>
      {label && (
        <label
          htmlFor={selectId}
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--color-text-secondary)'
          }}
        >
          {label}
        </label>
      )}

      <div style={{ position: 'relative', width: '100%' }}>
        <select
          id={selectId}
          disabled={disabled}
          style={{
            width: '100%',
            appearance: 'none',
            WebkitAppearance: 'none',
            padding: '10px 36px 10px 14px',
            fontSize: '14px',
            borderRadius: 'var(--radius-lg)',
            border: error
              ? '1px solid var(--color-danger)'
              : '1px solid var(--color-border-regular)',
            backgroundColor: 'var(--material-thin)',
            color: 'var(--color-text-primary)',
            outline: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            transition: 'border-color var(--duration-fast) var(--ease-spring)',
            ...style
          }}
          {...props}
        >
          {options.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              disabled={opt.disabled}
              style={{ backgroundColor: '#111827', color: '#ffffff' }}
            >
              {opt.label}
            </option>
          ))}
        </select>

        <span
          style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: 'var(--color-text-muted)',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <ChevronDown size={16} />
        </span>
      </div>

      {error && (
        <span style={{ fontSize: '12px', color: 'var(--color-danger)', fontWeight: 500 }}>
          {error}
        </span>
      )}
      {!error && helperText && (
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
          {helperText}
        </span>
      )}
    </div>
  );
};
