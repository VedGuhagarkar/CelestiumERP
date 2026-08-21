import React, { forwardRef } from 'react';

export interface AppInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const AppInput = forwardRef<HTMLInputElement, AppInputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className = '', style, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
        {label && (
          <label
            htmlFor={inputId}
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              letterSpacing: '0.01em'
            }}
          >
            {label}
          </label>
        )}

        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(17, 24, 39, 0.6)',
            border: `1px solid ${error ? 'var(--color-danger)' : 'var(--color-border-regular)'}`,
            borderRadius: 'var(--radius-lg)',
            transition: 'border-color var(--duration-fast) ease, box-shadow var(--duration-fast) ease',
            backdropFilter: 'var(--glass-blur)'
          }}
        >
          {leftIcon && (
            <div style={{ paddingLeft: '12px', display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)' }}>
              {leftIcon}
            </div>
          )}

          <input
            id={inputId}
            ref={ref}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              padding: '10px 14px',
              fontSize: '14px',
              color: 'var(--color-text-primary)',
              fontFamily: 'inherit',
              ...style
            }}
            className={className}
            {...props}
          />

          {rightIcon && (
            <div style={{ paddingRight: '12px', display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)' }}>
              {rightIcon}
            </div>
          )}
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
  }
);

AppInput.displayName = 'AppInput';
