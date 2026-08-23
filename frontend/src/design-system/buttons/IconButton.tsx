import React from 'react';
import { Loader2 } from 'lucide-react';
import type { ButtonVariant, ButtonSize } from './AppButton.js';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  'aria-label': string;
  tooltip?: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  variant = 'ghost',
  size = 'md',
  isLoading = false,
  'aria-label': ariaLabel,
  tooltip,
  className = '',
  disabled,
  type = 'button',
  style,
  onClick,
  ...props
}) => {
  const sizeMap: Record<ButtonSize, { width: string; height: string; borderRadius: string }> = {
    sm: { width: '28px', height: '28px', borderRadius: 'var(--radius-md)' },
    md: { width: '36px', height: '36px', borderRadius: 'var(--radius-lg)' },
    lg: { width: '44px', height: '44px', borderRadius: 'var(--radius-xl)' }
  };

  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          background: 'var(--color-primary)',
          color: '#ffffff',
          border: 'none',
          boxShadow: 'var(--shadow-glow)'
        };
      case 'secondary':
        return {
          background: 'var(--material-thin)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border-regular)',
          backdropFilter: 'var(--glass-blur)'
        };
      case 'tinted':
        return {
          background: 'var(--color-primary-subtle)',
          color: 'var(--color-primary)',
          border: '1px solid rgba(249, 115, 22, 0.3)'
        };
      case 'danger':
        return {
          background: 'var(--color-danger)',
          color: '#ffffff',
          border: 'none'
        };
      case 'ghost':
        return {
          background: 'transparent',
          color: 'var(--color-text-secondary)',
          border: 'none'
        };
      case 'pill':
        return {
          background: 'var(--material-thin)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-full)'
        };
    }
  };

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    opacity: disabled || isLoading ? 0.6 : 1,
    transition: 'all var(--duration-fast) var(--ease-spring)',
    outline: 'none',
    userSelect: 'none',
    padding: 0,
    ...sizeMap[size],
    ...getVariantStyles(),
    ...style
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || isLoading) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };

  return (
    <button
      type={type}
      aria-label={ariaLabel}
      title={tooltip || ariaLabel}
      disabled={disabled || isLoading}
      style={baseStyle}
      className={className}
      onClick={handleClick}
      {...props}
    >
      {isLoading ? <Loader2 size={16} className="animate-spin" /> : icon}
    </button>
  );
};
