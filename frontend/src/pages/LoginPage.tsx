import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, Mail, ArrowRight, ShieldCheck, UserCheck, Sparkles } from 'lucide-react';
import { AppCard } from '../design-system/surfaces/AppCard.js';
import { AppInput } from '../design-system/forms/AppInput.js';
import { AppButton } from '../design-system/buttons/AppButton.js';
import { AppAlert } from '../design-system/feedback/AppAlert.js';
import { useAuth } from '../hooks/useAuth.js';
import { env } from '../config/env.config.js';

interface DemoPersona {
  roleName: string;
  email: string;
  roleBadge: string;
  color: string;
}

const DEMO_PERSONAS: DemoPersona[] = [
  { roleName: 'System Admin', email: 'admin@astralis.internal', roleBadge: 'Full Superadmin Control', color: '#f59e0b' },
  { roleName: 'Plant Manager', email: 'manager@astralis.internal', roleBadge: 'Operations & Approvals', color: '#38bdf8' },
  { roleName: 'Quality Manager', email: 'qc@astralis.internal', roleBadge: 'AMS / CQI-9 Signoff', color: '#34d399' },
  { roleName: 'Production Supervisor', email: 'supervisor@astralis.internal', roleBadge: 'Batch Scheduling', color: '#a855f7' },
  { roleName: 'Furnace Operator', email: 'operator@astralis.internal', roleBadge: 'Live Thermal Soaks', color: '#f97316' },
  { roleName: 'Metallurgical Lab', email: 'lab@astralis.internal', roleBadge: 'Traverse Hardness', color: '#06b6d4' }
];

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('admin@astralis.internal');
  const [password, setPassword] = useState('Password123!');
  const [tenantId, setTenantId] = useState('tenant_default_001');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/';

  const handlePersonaSelect = (personaEmail: string) => {
    setEmail(personaEmail);
    setPassword('Password123!');
    setTenantId('tenant_default_001');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${env.API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId
        },
        body: JSON.stringify({
          identifier: email.trim().toLowerCase(),
          password
        })
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.message || 'Authentication failed. Please verify your credentials.');
      }

      const { user, tokens } = json.data;

      login(
        {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roles: user.roles || [],
          permissions: user.permissions || [],
          tenantId: user.tenantId,
          status: user.status
        },
        tokens.accessToken,
        tokens.refreshToken,
        user.tenantId
      );

      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify that the backend server is running.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <AppCard variant="glass" padding="lg">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', marginBottom: '4px' }}>
              Sign In to Facility
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Enter your certified operator credentials to access the thermal command center
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
            label="Work Email / Username"
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail size={16} />}
            placeholder="admin@astralis.internal"
            required
          />

          <AppInput
            label="Security Key / Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock size={16} />}
            placeholder="Password123!"
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

      {/* Quick Test Demo Personas */}
      <AppCard variant="glass" padding="md">
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
          <Sparkles size={14} /> 1-CLICK TEST PERSONAS (SAMPLE DATABASE)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {DEMO_PERSONAS.map((p) => {
            const isSelected = email === p.email;
            return (
              <button
                key={p.email}
                type="button"
                onClick={() => handlePersonaSelect(p.email)}
                style={{
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  background: isSelected ? 'rgba(249, 115, 22, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-border-subtle)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: isSelected ? 'var(--color-primary)' : '#ffffff' }}>
                    {p.roleName}
                  </span>
                  {isSelected && <UserCheck size={12} style={{ color: 'var(--color-primary)' }} />}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                  {p.email}
                </div>
              </button>
            );
          })}
        </div>
      </AppCard>
    </div>
  );
};
