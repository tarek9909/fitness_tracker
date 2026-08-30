import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Settings as SettingsIcon, Save, RefreshCw, CheckCircle2, AlertCircle, X } from 'lucide-react';

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
      list.forEach(s => {
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
      Object.keys(defaults).forEach(k => {
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
    setFormData(prev => ({ ...prev, [key]: value }));
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
    <div style={{ padding: '24px', maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <SettingsIcon size={24} color="var(--accent-primary, #3b82f6)" />
            Platform & System Settings
          </h1>
          <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '14px', marginTop: '4px' }}>
            Configure global platform parameters, compliance rules, and mobile application constraints.
          </p>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          background: feedback.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: `1px solid ${feedback.type === 'success' ? '#22c55e' : '#ef4444'}`,
          color: feedback.type === 'success' ? '#4ade80' : '#f87171',
          fontSize: '14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary, #94a3b8)' }}>
          <RefreshCw size={24} className="spin" style={{ marginBottom: '12px' }} />
          <p>Loading configuration parameters...</p>
        </div>
      ) : (
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Section: Platform Control */}
          <div style={{
            background: 'var(--bg-secondary, #1e293b)',
            borderRadius: '16px',
            padding: '24px',
            border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
          }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: '#f8fafc' }}>
              Platform Maintenance & Mobile Release Gates
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Platform Maintenance Mode
                </label>
                <select
                  value={formData['platform_maintenance_mode'] || '0'}
                  onChange={e => handleChange('platform_maintenance_mode', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                    color: '#fff',
                    fontSize: '14px',
                  }}
                >
                  <option value="0">Disabled (Normal Operations)</option>
                  <option value="1">Enabled (Block Non-Admin Traffic)</option>
                </select>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', marginTop: '4px' }}>
                  When enabled, mobile client APIs return 503 Maintenance Mode status.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Minimum Supported Mobile App Version
                </label>
                <input
                  type="text"
                  value={formData['min_app_version'] || '1.0.0'}
                  onChange={e => handleChange('min_app_version', e.target.value)}
                  placeholder="1.0.0"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                    color: '#fff',
                    fontSize: '14px',
                  }}
                />
                <p style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', marginTop: '4px' }}>
                  Outdated app versions below this semver threshold are prompted to upgrade.
                </p>
              </div>
            </div>
          </div>

          {/* Section: Defaults & Policies */}
          <div style={{
            background: 'var(--bg-secondary, #1e293b)',
            borderRadius: '16px',
            padding: '24px',
            border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
          }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: '#f8fafc' }}>
              Default Client Targets & Policies
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Default Daily Water Target (ml)
                </label>
                <input
                  type="number"
                  value={formData['default_water_target_ml'] || '3000'}
                  onChange={e => handleChange('default_water_target_ml', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                    color: '#fff',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Session Inactivity Timeout (Minutes)
                </label>
                <input
                  type="number"
                  value={formData['session_timeout_minutes'] || '60'}
                  onChange={e => handleChange('session_timeout_minutes', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                    color: '#fff',
                    fontSize: '14px',
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                borderRadius: '8px',
                background: 'var(--accent-primary, #3b82f6)',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                fontSize: '14px',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? <RefreshCw size={16} className="spin" /> : <Save size={16} />}
              {saving ? 'Saving Changes...' : 'Save Platform Settings'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
