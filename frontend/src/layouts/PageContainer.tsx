import React from 'react';

export interface PageContainerProps {
  children: React.ReactNode;
  maxWidth?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({ children, maxWidth = '1600px' }) => {
  return (
    <div
      style={{
        maxWidth,
        margin: '0 auto',
        padding: '24px 28px',
        width: '100%'
      }}
      className="animate-page-enter"
    >
      {children}
    </div>
  );
};
