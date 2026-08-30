import React, { useState } from 'react';
import { AuthProvider, useAuth } from './auth/auth-context';
import { Sidebar, NavTab } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { DashboardOverviewPage } from './pages/DashboardOverviewPage';
import { UsersPage } from './pages/UsersPage';
import { UserDetailPage } from './pages/UserDetailPage';
import { WorkoutPlansPage } from './pages/WorkoutPlansPage';
import { WorkoutPlanBuilderPage } from './pages/WorkoutPlanBuilderPage';
import { DietPlansPage } from './pages/DietPlansPage';
import { DietPlanBuilderPage } from './pages/DietPlanBuilderPage';
import { ExercisesPage } from './pages/ExercisesPage';
import { FoodsPage } from './pages/FoodsPage';
import { AssignmentsPage } from './pages/AssignmentsPage';
import { RemindersPage } from './pages/RemindersPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';
import { NotFoundPage } from './pages/NotFound';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Menu, Sparkles } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  
  // Drill-down states
  const [activeWorkoutPlanId, setActiveWorkoutPlanId] = useState<number | null>(null);
  const [activeWorkoutVersionId, setActiveWorkoutVersionId] = useState<number | undefined>(undefined);

  const [activeDietPlanId, setActiveDietPlanId] = useState<number | null>(null);
  const [activeDietVersionId, setActiveDietVersionId] = useState<number | undefined>(undefined);

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary, #0f172a)' }}>
        <div style={{ color: 'var(--accent-primary, #3b82f6)', fontWeight: 600 }}>Loading Fitness Platform...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderContent = () => {
    // If inside Workout Plan Builder
    if (activeWorkoutPlanId !== null) {
      return (
        <WorkoutPlanBuilderPage
          planId={activeWorkoutPlanId}
          initialVersionId={activeWorkoutVersionId}
          onBack={() => {
            setActiveWorkoutPlanId(null);
            setActiveWorkoutVersionId(undefined);
          }}
        />
      );
    }

    // If inside Diet Plan Builder
    if (activeDietPlanId !== null) {
      return (
        <DietPlanBuilderPage
          planId={activeDietPlanId}
          initialVersionId={activeDietVersionId}
          onBack={() => {
            setActiveDietPlanId(null);
            setActiveDietVersionId(undefined);
          }}
        />
      );
    }

    // If inside User Dossier / Monitoring
    if (activeTab === 'user-detail' && selectedUserId !== null) {
      return (
        <UserDetailPage
          userId={selectedUserId}
          onBack={() => {
            setSelectedUserId(null);
            setActiveTab('users');
          }}
        />
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return <DashboardOverviewPage onNavigate={(tab) => setActiveTab(tab)} />;
      case 'users':
        return (
          <UsersPage
            onSelectUser={(uId) => {
              setSelectedUserId(uId);
              setActiveTab('user-detail');
            }}
          />
        );
      case 'workout-plans':
        return (
          <WorkoutPlansPage
            onOpenBuilder={(pId, vId) => {
              setActiveWorkoutPlanId(pId);
              setActiveWorkoutVersionId(vId);
            }}
          />
        );
      case 'diet-plans':
        return (
          <DietPlansPage
            onOpenBuilder={(pId, vId) => {
              setActiveDietPlanId(pId);
              setActiveDietVersionId(vId);
            }}
          />
        );
      case 'exercises':
        return <ExercisesPage />;
      case 'foods':
        return <FoodsPage />;
      case 'assignments':
        return <AssignmentsPage />;
      case 'reminders':
        return <RemindersPage />;
      case 'notifications':
        return <NotificationsPage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <NotFoundPage onNavigate={(tab) => setActiveTab(tab as NavTab)} />;
    }
  };

  return (
    <div className="app-container" style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-primary, #0f172a)' }}>
      <Sidebar
        activeTab={activeTab}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        onSelectTab={(tab) => {
          setActiveWorkoutPlanId(null);
          setActiveDietPlanId(null);
          setSelectedUserId(null);
          setActiveTab(tab);
          setMobileNavOpen(false);
        }}
      />
      <div className="main-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Mobile Header Bar */}
        <header className="mobile-header" style={{
          display: 'none',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <button
            onClick={() => setMobileNavOpen(true)}
            className="btn btn-secondary btn-sm"
            aria-label="Open Navigation Menu"
          >
            <Menu size={18} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={16} color="var(--accent-primary)" />
            <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>FITNESS OS</span>
          </div>
          <div style={{ width: '32px' }} />
        </header>

        <main className="content-main" style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto', maxHeight: '100vh' }}>
          <ErrorBoundary>
            {renderContent()}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
};
export default App;
