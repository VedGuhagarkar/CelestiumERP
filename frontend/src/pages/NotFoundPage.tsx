import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { PageContainer } from '../layouts/PageContainer.js';
import { AppCard } from '../design-system/surfaces/AppCard.js';
import { AppButton } from '../design-system/buttons/AppButton.js';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <PageContainer>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <AppCard variant="glass" padding="lg" style={{ textAlign: 'center', maxWidth: '440px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: 'var(--color-danger)'
            }}
          >
            <AlertCircle size={32} />
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px', color: 'var(--color-text-primary)' }}>
            404
          </h1>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-secondary)' }}>
            Page Not Found
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '24px' }}>
            The requested plant sector or operational page does not exist or has been relocated.
          </p>
          <AppButton variant="secondary" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate('/')}>
            Return to Command Center
          </AppButton>
        </AppCard>
      </div>
    </PageContainer>
  );
};
