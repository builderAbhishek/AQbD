import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard from './pages/Dashboard';
import ATP from './pages/ATP';
import Risk from './pages/Risk';
import Factors from './pages/Factors';
import Responses from './pages/Responses';
import DOE from './pages/DOE';
import Experiments from './pages/Experiments';
import Analysis from './pages/Analysis';
import Diagnostics from './pages/Diagnostics';
import Optimization from './pages/Optimization';
import DesignSpace from './pages/DesignSpace';
import Confirmation from './pages/Confirmation';
import Reports from './pages/Reports';

const queryClient = new QueryClient();

interface NavItem {
  path: string;
  label: string;
  step?: number;
  icon: string;
}

const navItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: '⌂' },
  { path: '/atp', label: 'ATP Criteria', step: 1, icon: '🎯' },
  { path: '/risk', label: 'Risk Assessment', step: 2, icon: '⚠️' },
  { path: '/factors', label: 'Factors (CMAs/CPPs)', step: 3, icon: '⚙️' },
  { path: '/responses', label: 'Responses (CQAs)', step: 4, icon: '📊' },
  { path: '/doe', label: 'DOE Engine', step: 5, icon: '🧪' },
  { path: '/experiments', label: 'Experiment Data', step: 6, icon: '📝' },
  { path: '/analysis', label: 'Statistical Fit', step: 7, icon: '📈' },
  { path: '/diagnostics', label: 'Diagnostics & Surface', step: 8, icon: '🔍' },
  { path: '/optimization', label: 'Optimization', step: 9, icon: '✨' },
  { path: '/design-space', label: 'Design Space (PAR)', step: 10, icon: '📐' },
  { path: '/confirmation', label: 'Confirmation Run', step: 11, icon: '✓' },
  { path: '/reports', label: 'Regulatory Dossier', step: 12, icon: '📄' },
];

function AppLayout({ children }: { children: React.ReactNode }) {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    const id = localStorage.getItem('aqbd_project_id');
    setActiveProjectId(id);
  }, [location.pathname]);

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl z-20 border-r border-slate-800">
        {/* Brand */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🧬</span>
              <h1 className="text-lg font-extrabold text-white tracking-wide">AQbD Studio</h1>
            </div>
            <span className="text-2xs font-semibold text-blue-400 uppercase tracking-widest block mt-0.5">
              ICH Q8/Q9/Q14 Platform
            </span>
          </div>
          <span className="px-2 py-0.5 text-2xs font-bold bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded">
            v1.0
          </span>
        </div>

        {/* Active Project Badge */}
        <div className="px-4 py-3 bg-slate-950/60 border-b border-slate-800/80">
          <span className="text-2xs uppercase tracking-wider text-slate-500 font-bold block mb-1">
            Active Project
          </span>
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5 truncate">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {activeProjectId ? `Project #${activeProjectId}` : 'None Selected'}
            </span>
            <NavLink
              to="/"
              className="text-2xs text-slate-400 hover:text-white underline"
            >
              Switch
            </NavLink>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-700">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`
              }
            >
              <div className="flex items-center gap-2.5 truncate">
                <span className="text-sm">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </div>
              {item.step !== undefined && (
                <span className="text-2xs px-1.5 py-0.2 font-mono rounded bg-slate-800 text-slate-400 border border-slate-700">
                  {item.step}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-800 text-2xs text-slate-500 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span>AQbD Studio</span>
            <span className="text-emerald-500 font-semibold">Ready</span>
          </div>
          <span>Analytical Quality by Design V1</span>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/atp" element={<ATP />} />
            <Route path="/risk" element={<Risk />} />
            <Route path="/factors" element={<Factors />} />
            <Route path="/responses" element={<Responses />} />
            <Route path="/doe" element={<DOE />} />
            <Route path="/experiments" element={<Experiments />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/diagnostics" element={<Diagnostics />} />
            <Route path="/optimization" element={<Optimization />} />
            <Route path="/design-space" element={<DesignSpace />} />
            <Route path="/confirmation" element={<Confirmation />} />
            <Route path="/reports" element={<Reports />} />
          </Routes>
        </AppLayout>
      </Router>
    </QueryClientProvider>
  );
}
