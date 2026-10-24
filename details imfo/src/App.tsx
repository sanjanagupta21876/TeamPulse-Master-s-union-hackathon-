import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { TeamRoomPage } from './pages/TeamRoomPage';
import { RepositoriesPage } from './pages/RepositoriesPage';
import { RepositoryDetailsPage } from './pages/RepositoryDetailsPage';
import { BugReportsPage } from './pages/BugReportsPage';
import { BugDetailsPage } from './pages/BugDetailsPage';
import { FixHistoryPage } from './pages/FixHistoryPage';

export function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/room" replace />} />

            {/* Team room: Mission Control / Ship Intelligence */}
            <Route path="room" element={<TeamRoomPage />} />
            <Route path="mission-control" element={<Navigate to="/room" replace />} />

            {/* Code checks: real GitHub analysis flow */}
            <Route path="repositories" element={<RepositoriesPage />} />
            <Route path="repositories/:id" element={<RepositoryDetailsPage />} />
            <Route path="bugs" element={<BugReportsPage />} />
            <Route path="bugs/:id" element={<BugDetailsPage />} />
            <Route path="fix-history" element={<FixHistoryPage />} />

            <Route path="*" element={<Navigate to="/room" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
