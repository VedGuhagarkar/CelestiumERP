import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { AppCard } from '../design-system/surfaces/AppCard.js';
import { AppInput } from '../design-system/forms/AppInput.js';
import { AppButton } from '../design-system/buttons/AppButton.js';
import { AppAlert } from '../design-system/feedback/AppAlert.js';
import { useAuth } from '../hooks/useAuth.js';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('metallurgist@astralis.internal');
  const [password, setPassword] = useState('password123');
  const [tenantId, setTenantId] = useState('tenant_default_001');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // In initial bootstrap mode, simulate authentication if backend API is not yet running
      const fakeUser = {
        id: 'usr_001',
        email,
        firstName: 'Chief',
        lastName: 'Metallurgist',
        roles: ['PLANT_MANAGER', 'METALLURGIST'],
        permissions: ['SYSTEM_ADMIN', 'JOB_VIEW', 'JOB_CREATE', 'QC_APPROVE'],
        tenantId
      };
      const fakeToken = 'mock_jwt_token_header.payload.signature';

      login(fakeUser, fakeToken, undefined, tenantId);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppCard variant="glass" padding="lg">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
            Sign In to Facility
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            Enter your certified operator credentials
          </p>
        </div>

        {error && (
          <AppAlert type="error" onClose={() => setError(null)}>
            {error}
          </AppAlert>
        )}

        <AppInput
          label="Tenant Identifier"
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          leftIcon={<ShieldCheck size={16} />}
          placeholder="tenant_default_001"
          required
        />

        <AppInput
          label="Work Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftIcon={<Mail size={16} />}
          placeholder="operator@astralis.internal"
          required
        />

        <AppInput
          label="Security Key / Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leftIcon={<Lock size={16} />}
          placeholder="••••••••••••"
          required
        />

        <AppButton
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isLoading}
          rightIcon={<ArrowRight size={16} />}
          style={{ width: '100%', marginTop: '8px' }}
        >
          Authenticate & Enter
        </AppButton>
      </form>
    </AppCard>
  );
};
