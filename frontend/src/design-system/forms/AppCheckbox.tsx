import React from 'react';
import { Check } from 'lucide-react';

export interface AppCheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  error?: string;
}

export const AppCheckbox: React.FC<AppCheckboxProps> = ({
  label,
  error,
  checked,
  disabled,
  id,
  className = '',
  onChange,
  style,
  ...props
}) => {
  const checkboxId = id || (typeof label === 'string' ? `chk-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '4px' }} className={className}>
      <label
        htmlFor={checkboxId}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '10px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          userSelect: 'none',
          fontSize: '14px',
          color: 'var(--color-text-primary)',
          ...style
        }}
      >
        <div style={{ position: 'relative', width: '18px', height: '18px' }}>
          <input
            id={checkboxId}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={onChange}
            style={{
              position: 'absolute',
              opacity: 0,
              width: '100%',
              height: '100%',
              margin: 0,
              cursor: disabled ? 'not-allowed' : 'pointer'
            }}
            {...props}
          />
          <div
            style={{
              width: '18px',
              height: '18px',
              borderRadius: 'var(--radius-sm)',
              border: checked
                ? '1px solid var(--color-primary)'
                : error
                ? '1px solid var(--color-danger)'
                : '1px solid var(--color-border-regular)',
              backgroundColor: checked ? 'var(--color-primary)' : 'var(--material-thin)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all var(--duration-fast) var(--ease-spring)',
              boxShadow: checked ? 'var(--shadow-glow)' : 'none'
            }}
          >
            {checked && <Check size={13} color="#ffffff" strokeWidth={3} />}
          </div>
        </div>
        {label && <span>{label}</span>}
      </label>
      {error && (
        <span style={{ fontSize: '12px', color: 'var(--color-danger)', fontWeight: 500, paddingLeft: '28px' }}>
          {error}
        </span>
      )}
    </div>
  );
};
