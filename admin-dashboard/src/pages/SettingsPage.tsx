import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Settings as SettingsIcon, Save, RefreshCw, CheckCircle2, AlertCircle, X, ShieldAlert } from 'lucide-react';
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

interface SystemSetting {
  id: number;
  setting_key: string;
  setting_value: string;
  description?: string | null;
  updated_by?: number | null;
  updated_at: string;
}

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  useEffect(() => {
    fetchSettings();
  }, []);

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
    </div>
  );
};
