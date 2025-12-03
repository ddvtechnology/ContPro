import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthProvider from './components/Auth/AuthProvider';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import LoginForm from './components/Auth/LoginForm';
import ResetPasswordForm from './components/Auth/ResetPasswordForm';
import FirstAccessForm from './components/Auth/FirstAccessForm';
import Layout from './components/Layout/Layout';
import ProfilePage from './components/Users/ProfilePage';

// Lazy loading das páginas para melhor performance
const DashboardPage = lazy(() => import('./components/Dashboard/DashboardPage'));
const ContractsPage = lazy(() => import('./components/Contracts/ContractsPage'));
const AddendumsPage = lazy(() => import('./components/Addendums/AddendumsPage'));
const DocumentsPage = lazy(() => import('./components/Documents/DocumentsPage'));
const ReportsPage = lazy(() => import('./components/Reports/ReportsPage'));
const ContractItemsPage = lazy(() => import('./components/ContractItems/ContractItemsPage'));

// Loading component otimizado
const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

function AppContent() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        <Route path="/first-access" element={<FirstAccessForm />} />
        <Route path="/reset-password" element={<ResetPasswordForm />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={
            <Suspense fallback={<PageLoader />}>
              <DashboardPage />
            </Suspense>
          } />
          <Route path="contracts" element={
            <Suspense fallback={<PageLoader />}>
              <ContractsPage />
            </Suspense>
          } />
          <Route path="addendums" element={
            <Suspense fallback={<PageLoader />}>
              <AddendumsPage />
            </Suspense>
          } />
          <Route path="documents" element={
            <Suspense fallback={<PageLoader />}>
              <DocumentsPage />
            </Suspense>
          } />
          <Route path="reports" element={
            <Suspense fallback={<PageLoader />}>
              <ReportsPage />
            </Suspense>
          } />
          <Route path="contract-items" element={
            <Suspense fallback={<PageLoader />}>
              <ContractItemsPage />
            </Suspense>
          } />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;