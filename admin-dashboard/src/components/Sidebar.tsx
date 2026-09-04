import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Dumbbell, 
  Utensils, 
  Library, 
  Apple, 
  UserCheck, 
  BarChart3,
  Bell,
  Send,
  Settings,
  LogOut,
  Activity,
  X,
  Shield
} from 'lucide-react';
import { useAuth } from '../auth/auth-context';
import { IconButton, NavButton } from './ui';

export type NavTab = 
  | 'dashboard' 
  | 'users' 
  | 'user-detail'
  | 'workout-plans' 
  | 'diet-plans' 
  | 'exercises' 
  | 'foods' 
  | 'assignments' 
  | 'reminders'
  | 'notifications'
  | 'analytics' 
  | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  onSelectTab, 
  mobileOpen = false, 
  onCloseMobile 
}) => {
  const { logout, user } = useAuth();

  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Overview', icon: LayoutDashboard },
    { id: 'users' as NavTab, label: 'Users & Clients', icon: Users },
    { id: 'workout-plans' as NavTab, label: 'Workout Protocols', icon: Dumbbell },
    { id: 'diet-plans' as NavTab, label: 'Diet Protocols', icon: Utensils },
    { id: 'exercises' as NavTab, label: 'Exercise Library', icon: Library },
    { id: 'foods' as NavTab, label: 'Food Database', icon: Apple },
    { id: 'assignments' as NavTab, label: 'Plan Assignments', icon: UserCheck },
    { id: 'reminders' as NavTab, label: 'Reminder Rules', icon: Bell },
    { id: 'notifications' as NavTab, label: 'Push & Dispatch', icon: Send },
    { id: 'analytics' as NavTab, label: 'Analytics & Audit', icon: BarChart3 },
    { id: 'settings' as NavTab, label: 'Platform Settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div 
          onClick={onCloseMobile}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(4, 7, 13, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 1050,
          }}
          aria-hidden="true"
        />
      )}

      <aside 
        className={`sidebar-nav ${mobileOpen ? 'open' : ''}`}
        style={{
          width: '260px',
          backgroundColor: 'var(--bg-primary)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          position: 'sticky',
          top: 0,
          zIndex: 1100,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Brand Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <Activity size={19} color="var(--text-primary)" strokeWidth={2} />
            </div>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                FITNESS OS
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                Operations Console
              </div>
            </div>
          </div>

          {onCloseMobile && (
            <IconButton
              icon={<X size={18} />}
              label="Close Navigation"
              size="sm"
              className="mobile-close-btn"
              onClick={onCloseMobile}
            />
          )}
        </div>

        {/* Navigation Links */}
        <nav 
          aria-label="Main Navigation"
          style={{
            flex: 1,
            padding: '1rem 0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            overflowY: 'auto',
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id || (item.id === 'users' && activeTab === 'user-detail');
            return (
              <NavButton
                key={item.id}
                active={isActive}
                icon={<Icon size={18} />}
                onClick={() => {
                  onSelectTab(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
              >
                {item.label}
              </NavButton>
            );
          })}
        </nav>

        {/* User Footer */}
        <div style={{
          padding: '1rem 1.25rem',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(9, 13, 22, 0.4)',
        }}>
          <div style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: 'var(--accent-primary)',
                flexShrink: 0,
              }}
            >
              {user?.firstName?.[0] || 'A'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {user?.firstName} {user?.lastName}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Shield size={10} color="var(--accent-primary)" />
                <span style={{ textTransform: 'capitalize' }}>
                  {user?.role?.replace('_', ' ') || 'Admin'}
                </span>
              </div>
            </div>
          </div>
          <IconButton
            icon={<LogOut size={16} />}
            label="Sign Out"
            size="sm"
            onClick={logout}
          />
        </div>
      </aside>
    </>
  );
};
