import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthGuard } from './components/AuthGuard';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Dashboard } from './pages/Dashboard';
import { Properties } from './pages/Properties';
import { Clients } from './pages/Clients';
import { Contracts } from './pages/Contracts';
import { Payments } from './pages/Payments';
import { Recovery } from './pages/Recovery';
import { Login } from './pages/Login';

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={
            <AuthGuard>
              <Layout>
                <Dashboard />
              </Layout>
            </AuthGuard>
          } />

          <Route path="/properties" element={
            <AuthGuard>
              <Layout>
                <Properties />
              </Layout>
            </AuthGuard>
          } />

          <Route path="/clients" element={
            <AuthGuard>
              <Layout>
                <Clients />
              </Layout>
            </AuthGuard>
          } />

          <Route path="/contracts" element={
            <AuthGuard>
              <Layout>
                <Contracts />
              </Layout>
            </AuthGuard>
          } />

          <Route path="/payments" element={
            <AuthGuard>
              <Layout>
                <Payments />
              </Layout>
            </AuthGuard>
          } />

          <Route path="/recovery" element={
            <AuthGuard>
              <Layout>
                <Recovery />
              </Layout>
            </AuthGuard>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
    </ErrorBoundary>
  );
}
