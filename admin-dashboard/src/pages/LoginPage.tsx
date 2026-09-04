import React, { useState } from 'react';
import { useAuth } from '../auth/auth-context';
import { Shield, ArrowRight, Activity, AlertCircle, Fingerprint } from 'lucide-react';
import { Button, FormField, TextInput, Card } from '../components/ui';

export const LoginPage: React.FC = () => {
  const { login, loginWithPasskey } = useAuth();
  const isDev = import.meta.env.DEV;
  const [email, setEmail] = useState(isDev ? 'admin@fitnessplatform.com' : '');
  const [password, setPassword] = useState(isDev ? 'Admin123!' : '');
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setPasskeyLoading(true);
    setError(null);
    try {
      await loginWithPasskey(email);
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Passkey prompt was cancelled or timed out.');
      } else {
        setError(err.message || 'Passkey authentication failed.');
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 15%, #152238 0%, #090d16 100%)',
      padding: '1.5rem',
    }}>
      <Card style={{
        maxWidth: '420px',
        width: '100%',
        padding: '2.5rem',
        boxShadow: 'var(--shadow-elevated)',
        border: '1px solid var(--border-color)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <Activity size={24} color="var(--text-primary)" strokeWidth={2} />
          </div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Fitness Platform
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
            Administrative Operations & Client Governance
          </p>
        </div>

        {error && (
          <div style={{
            padding: '0.75rem 1rem',
            marginBottom: '1.5rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--accent-rose-muted)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            color: 'var(--accent-rose)',
            fontSize: '0.8125rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <FormField label="Administrator Email" required>
            <TextInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@fitnessplatform.com"
              autoComplete="email"
            />
          </FormField>

          <FormField label="Password" required>
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </FormField>

          <Button
            type="submit"
            variant="primary"
            loading={loading}
            style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem' }}
          >
            <span>Sign In to Console</span>
            <ArrowRight size={16} />
          </Button>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            margin: '0.25rem 0',
          }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              or passwordless
            </span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
          </div>

          <Button
            type="button"
            variant="secondary"
            loading={passkeyLoading}
            onClick={handlePasskeyLogin}
            icon={<Fingerprint size={18} color="var(--accent-primary)" />}
            style={{
              width: '100%',
              padding: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontWeight: 600,
            }}
          >
            <span>Sign In with Passkey</span>
          </Button>
        </form>

        {isDev && (
          <div style={{
            marginTop: '2rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}>
            Demo credentials: <code style={{ color: 'var(--accent-cyan)' }}>admin@fitnessplatform.com</code>
          </div>
        )}
      </Card>
    </div>
  );
};
