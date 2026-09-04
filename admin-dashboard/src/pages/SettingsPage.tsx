import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import {
  Settings as SettingsIcon,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldAlert,
  Fingerprint,
  Trash2,
  ShieldCheck,
  KeyRound,
} from 'lucide-react';
import {
  Card,
  Button,
  Select,
  FormField,
  TextInput,
  NumberInput,
  Skeleton,
  AlertBanner,
} from '../components/ui';
import {
  isPasskeySupported,
  executePasskeyRegistration,
  WebAuthnRegistrationOptions,
} from '../lib/webauthn';

interface SystemSetting {
  id: number;
  setting_key: string;
  setting_value: string;
  description?: string | null;
  updated_by?: number | null;
  updated_at: string;
}

interface PasskeyItem {
  id: number;
  credentialId: string;
  deviceName: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Passkey state
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [passkeysLoading, setPasskeysLoading] = useState<boolean>(true);
  const [registeringPasskey, setRegisteringPasskey] = useState<boolean>(false);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [passkeySupported, setPasskeySupported] = useState<boolean>(true);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ systemSettings: SystemSetting[] }>('/admin/settings');
      const list = res.systemSettings || [];
      setSettings(list);

      const initialForm: Record<string, string> = {};
      list.forEach((s) => {
        initialForm[s.setting_key] = s.setting_value;
      });

      // Default baseline keys if not yet stored
      const defaults: Record<string, string> = {
        'platform_maintenance_mode': '0',
        'min_app_version': '1.0.0',
        'default_water_target_ml': '3000',
        'allow_client_registration': '1',
        'session_timeout_minutes': '60',
        'app_name': 'Fitness Platform',
      };
      Object.keys(defaults).forEach((k) => {
        if (initialForm[k] === undefined) initialForm[k] = defaults[k];
      });

      setFormData(initialForm);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load system settings' });
    } finally {
      setLoading(false);
    }
  };

  const fetchPasskeys = async () => {
    try {
      setPasskeysLoading(true);
      const res = await api.get<{ passkeys: PasskeyItem[] }>('/me/passkeys');
      setPasskeys(res.passkeys || []);
    } catch {
      // Non-critical if checking settings
    } finally {
      setPasskeysLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchPasskeys();
    isPasskeySupported().then((supported) => setPasskeySupported(supported));
  }, []);

  const handleRegisterPasskey = async () => {
    try {
      setRegisteringPasskey(true);
      setFeedback(null);
      // 1. Fetch registration challenge options
      const options = await api.post<WebAuthnRegistrationOptions>('/auth/passkey/register-options', {});

      // Determine friendly device name
      const deviceName = navigator.userAgent.includes('Mac')
        ? 'Mac Platform Authenticator (Touch ID)'
        : navigator.userAgent.includes('Windows')
        ? 'Windows Hello / Workstation'
        : 'Web Authenticator';

      // 2. Perform authenticator ceremony
      const registrationPayload = await executePasskeyRegistration(options, deviceName);

      // 3. Complete verification on server
      await api.post('/auth/passkey/register-verify', registrationPayload);

      setFeedback({ type: 'success', message: 'Passkey registered successfully! You can now use it to sign in.' });
      await fetchPasskeys();
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setFeedback({ type: 'error', message: 'Passkey registration was cancelled or timed out.' });
      } else {
        setFeedback({ type: 'error', message: err.message || 'Failed to register passkey' });
      }
    } finally {
      setRegisteringPasskey(false);
    }
  };

  const handleRevokePasskey = async (passkeyId: number) => {
    if (!window.confirm('Are you sure you want to revoke this passkey?')) return;
    try {
      setRevokingId(passkeyId);
      await api.delete(`/me/passkeys/${passkeyId}`);
      setFeedback({ type: 'success', message: 'Passkey revoked successfully.' });
      await fetchPasskeys();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to revoke passkey' });
    } finally {
      setRevokingId(null);
    }
  };

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        settings: Object.entries(formData).map(([key, value]) => ({
          key,
          value,
        })),
      };

      await api.put('/admin/settings', payload);
      setFeedback({ type: 'success', message: 'Platform settings updated successfully' });
      await fetchSettings();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update settings' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <SettingsIcon size={22} color="var(--accent-primary)" />
            <span>Platform & System Settings</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Configure global platform parameters, compliance rules, and mobile application constraints.
          </p>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <AlertBanner
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <Card style={{ height: '180px' }}>
            <Skeleton width="40%" height="24px" style={{ marginBottom: '1rem' }} />
            <Skeleton width="100%" height="40px" />
          </Card>
          <Card style={{ height: '180px' }}>
            <Skeleton width="40%" height="24px" style={{ marginBottom: '1rem' }} />
            <Skeleton width="100%" height="40px" />
          </Card>
        </div>
      ) : (
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Section: Platform Control */}
          <Card style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Platform Maintenance & Mobile Release Gates
              </h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Control mobile client traffic access and enforce minimum mobile build requirements.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <FormField
                label="Platform Maintenance Mode"
                helperText="When enabled, mobile client APIs return 503 Maintenance Mode status."
              >
                <Select
                  options={[
                    { value: '0', label: 'Disabled (Normal Operations)' },
                    { value: '1', label: 'Enabled (Block Non-Admin Traffic)' },
                  ]}
                  value={formData['platform_maintenance_mode'] || '0'}
                  onChange={(val) => handleChange('platform_maintenance_mode', val)}
                />
              </FormField>

              <FormField
                label="Minimum Supported Mobile App Version"
                helperText="Outdated app versions below this semver threshold are prompted to upgrade."
              >
                <TextInput
                  value={formData['min_app_version'] || '1.0.0'}
                  onChange={(e) => handleChange('min_app_version', e.target.value)}
                  placeholder="1.0.0"
                />
              </FormField>
            </div>
          </Card>

          {/* Section: Defaults & Policies */}
          <Card style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Default Client Targets & Policies
              </h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Baseline thresholds automatically assigned to newly onboarded athlete profiles.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <FormField label="Default Daily Water Target (ml)">
                <TextInput
                  type="number"
                  value={formData['default_water_target_ml'] || '3000'}
                  onChange={(e) => handleChange('default_water_target_ml', e.target.value)}
                />
              </FormField>

              <FormField label="Session Inactivity Timeout (Minutes)">
                <TextInput
                  type="number"
                  value={formData['session_timeout_minutes'] || '60'}
                  onChange={(e) => handleChange('session_timeout_minutes', e.target.value)}
                />
              </FormField>
            </div>
          </Card>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              icon={<Save size={16} />}
            >
              {saving ? 'Saving Changes...' : 'Save Platform Settings'}
            </Button>
          </div>
        </form>
      )}

      {/* Section: Passkey & Hardware Security Keys */}
      <Card style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '0.75rem',
        }}>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Fingerprint size={18} color="var(--accent-primary)" />
              <span>Passkey & Biometric Credentials</span>
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              FIDO2 / WebAuthn cryptographic keys (Touch ID, Windows Hello, YubiKey). Sign in instantly without passwords.
            </p>
          </div>

          <Button
            type="button"
            variant="secondary"
            loading={registeringPasskey}
            disabled={!passkeySupported}
            onClick={handleRegisterPasskey}
            icon={<ShieldCheck size={16} color="var(--accent-primary)" />}
          >
            {registeringPasskey ? 'Prompting Authenticator...' : 'Register Passkey for this Device'}
          </Button>
        </div>

        {!passkeySupported && (
          <div style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--accent-amber-muted)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: 'var(--accent-amber)',
            fontSize: '0.8125rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <AlertCircle size={16} />
            <span>WebAuthn / Passkeys are not supported in this browser environment. Ensure you are accessing via HTTPS or localhost.</span>
          </div>
        )}

        {passkeysLoading ? (
          <Skeleton width="100%" height="56px" />
        ) : passkeys.length === 0 ? (
          <div style={{
            padding: '1.5rem',
            textAlign: 'center',
            backgroundColor: 'var(--surface-subtle)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-secondary)',
            fontSize: '0.875rem',
          }}>
            No Passkey registered yet on this account. Click "Register Passkey for this Device" above to enable biometric 1-tap sign in.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <div style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Registered Passkeys ({passkeys.length})
            </div>
            {passkeys.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.875rem 1rem',
                  backgroundColor: 'var(--surface-subtle)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <KeyRound size={16} color="var(--accent-primary)" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {p.deviceName || 'Passkey Device'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Enrolled: {new Date(p.createdAt).toLocaleDateString()}
                      {p.lastUsedAt ? ` • Last used: ${new Date(p.lastUsedAt).toLocaleDateString()}` : ' • Never used'}
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  loading={revokingId === p.id}
                  onClick={() => handleRevokePasskey(p.id)}
                  icon={<Trash2 size={15} color="var(--accent-rose)" />}
                  style={{ padding: '0.4rem 0.6rem', color: 'var(--accent-rose)' }}
                  title="Revoke passkey"
                >
                  <span>Revoke</span>
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
