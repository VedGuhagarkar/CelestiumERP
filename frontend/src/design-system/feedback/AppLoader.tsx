import React from 'react';
import { Loader2 } from 'lucide-react';

export interface AppLoaderProps {
  size?: number;
  message?: string;
}

export const AppLoader: React.FC<AppLoaderProps> = ({ size = 28, message = 'Loading Astralis...' }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '32px',
        color: 'var(--color-text-secondary)'
      }}
    >
      <Loader2 size={size} color="var(--color-primary)" className="animate-spin" />
      {message && <span style={{ fontSize: '13px', fontWeight: 500 }}>{message}</span>}
    </div>
  );
};
