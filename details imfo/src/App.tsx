import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { DashboardPage } from './pages/DashboardPage';
import { RepositoriesPage } from './pages/RepositoriesPage';
import { RepositoryDetailsPage } from './pages/RepositoryDetailsPage';
import { BugReportsPage } from './pages/BugReportsPage';
import { BugDetailsPage } from './pages/BugDetailsPage';
import { FixHistoryPage } from './pages/FixHistoryPage';
import { FrontendAnalysisPage } from './pages/FrontendAnalysisPage';
import { BackendAnalysisPage } from './pages/BackendAnalysisPage';
import { SecurityAnalysisPage } from './pages/SecurityAnalysisPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DashboardLayout />}>
            {/* Root redirects to dashboard */}
            <Route index element={<Navigate to="/dashboard" replace />} />

            {/* Dashboard Overview */}
            <Route path="dashboard" element={<DashboardPage />} />

            {/* Repositories */}
            <Route path="repositories" element={<RepositoriesPage />} />
            <Route path="repositories/:id" element={<RepositoryDetailsPage />} />

            {/* Bug Reports & Details */}
            <Route path="bugs" element={<BugReportsPage />} />
            <Route path="bugs/:id" element={<BugDetailsPage />} />

            {/* Fix History */}
            <Route path="fix-history" element={<FixHistoryPage />} />

            {/* Analysis Views */}
            <Route path="analysis/frontend" element={<FrontendAnalysisPage />} />
            <Route path="analysis/backend" element={<BackendAnalysisPage />} />
            <Route path="analysis/security" element={<SecurityAnalysisPage />} />

            {/* Settings & Integrations */}
            <Route path="integrations" element={<IntegrationsPage />} />
            <Route path="settings" element={<SettingsPage />} />

            {/* Catch-all fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
