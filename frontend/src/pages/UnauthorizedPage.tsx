import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { PageContainer } from '../layouts/PageContainer.js';
import { AppCard } from '../design-system/surfaces/AppCard.js';
import { AppButton } from '../design-system/buttons/AppButton.js';

export const UnauthorizedPage: React.FC = () => {
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
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: 'var(--color-warning)'
            }}
          >
            <ShieldAlert size={32} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px', color: 'var(--color-text-primary)' }}>
            Access Restricted
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '24px' }}>
            Your current user profile or certification tier lacks the required permissions to access this metallurgical or administrative module.
          </p>
          <AppButton variant="secondary" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate('/')}>
            Back to Safety
          </AppButton>
        </AppCard>
      </div>
    </PageContainer>
  );
};
