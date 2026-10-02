import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface ReportItem {
  id: number;
  project_id: number;
  file_path: string;
  created_at: string;
}

interface ProjectData {
  id: number;
  project_code: string;
  project_name: string;
  description?: string;
  version: string;
  status: string;
}

export default function Reports() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const savedProjectId = localStorage.getItem('aqbd_project_id');
    if (!savedProjectId) {
      navigate('/');
    } else {
      setProjectId(Number(savedProjectId));
    }
  }, [navigate]);

  // Load project metadata
  const { data: project } = useQuery<ProjectData>({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}`);
      if (!res.ok) throw new Error('Failed to load project details');
      return res.json();
    },
    enabled: !!projectId
  });

  // Load ATP items for readiness
  const { data: atpItems = [] } = useQuery({
    queryKey: ['atp', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/atp/`);
      return res.ok ? res.json() : [];
    },
    enabled: !!projectId
  });

  // Load risks
  const { data: riskItems = [] } = useQuery({
    queryKey: ['risk', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/risk/`);
      return res.ok ? res.json() : [];
    },
    enabled: !!projectId
  });

  // Load factors
  const { data: factors = [] } = useQuery({
    queryKey: ['factors', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/factors/`);
      return res.ok ? res.json() : [];
    },
    enabled: !!projectId
  });

  // Load responses
  const { data: responses = [] } = useQuery({
    queryKey: ['responses', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/responses/`);
      return res.ok ? res.json() : [];
    },
    enabled: !!projectId
  });

  // Load analyses
  const { data: analyses = [] } = useQuery({
    queryKey: ['analyses', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/analysis/`);
      return res.ok ? res.json() : [];
    },
    enabled: !!projectId
  });

  // Load reports
  const { data: reports = [], isLoading: reportsLoading } = useQuery<ReportItem[]>({
    queryKey: ['reports', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/reports/`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId
  });

  // Generate Report Mutation
  const generateReport = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('No project selected');
      setError(null);
      setSuccessMessage(null);
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/reports/`, {
        method: 'POST'
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.detail?.error?.message || errData?.detail || 'Report generation failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setSuccessMessage('✓ AQbD Regulatory PDF Report successfully generated!');
      queryClient.invalidateQueries({ queryKey: ['reports', projectId] });
    },
    onError: (err: Error) => {
      setError(err.message);
    }
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link to="/" className="hover:text-blue-600">Dashboard</Link>
            <span>/</span>
            <Link to="/confirmation" className="hover:text-blue-600">Confirmation</Link>
            <span>/</span>
            <span className="text-gray-800 font-medium">Regulatory Reports</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
              Phase 11
            </span>
            <h1 className="text-2xl font-bold text-gray-900">Regulatory AQbD PDF Dossier</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Generate and download formal ICH Q8/Q9/Q14 compliant analytical method development summary reports.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/confirmation"
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
          >
            ← Back to Confirmation
          </Link>
          <Link
            to="/"
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-black shadow-sm transition flex items-center gap-2"
          >
            Return to Dashboard ⌂
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
          <span className="text-red-700 text-sm font-medium">{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-lg">
          <span className="text-emerald-800 text-sm font-medium">{successMessage}</span>
        </div>
      )}

      {/* Dossier Readiness Checklist Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-gray-800">
              AQbD Lifecycle Completion Status & Dossier Summary
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Every phase of analytical quality by design is synthesized into the final regulatory dossier:
            </p>
          </div>

          <button
            onClick={() => generateReport.mutate()}
            disabled={generateReport.isPending}
            className="px-6 py-3 bg-blue-600 text-white font-bold text-sm rounded-lg hover:bg-blue-700 shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {generateReport.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Compiling Comprehensive PDF...</span>
              </>
            ) : (
              <>
                <span>📄 Generate Regulatory PDF Dossier</span>
              </>
            )}
          </button>
        </div>

        {/* Readiness Checklist Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-3 border-t border-gray-100">
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">1. ATP</span>
              <span className={atpItems.length > 0 ? 'text-emerald-600 font-bold' : 'text-gray-400'}>
                {atpItems.length > 0 ? '✓' : '—'}
              </span>
            </div>
            <p className="text-base font-bold text-gray-800 mt-1">{atpItems.length} criteria</p>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">2. FMEA Risk</span>
              <span className={riskItems.length > 0 ? 'text-emerald-600 font-bold' : 'text-gray-400'}>
                {riskItems.length > 0 ? '✓' : '—'}
              </span>
            </div>
            <p className="text-base font-bold text-gray-800 mt-1">{riskItems.length} evaluated</p>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">3. Factors</span>
              <span className={factors.length > 0 ? 'text-emerald-600 font-bold' : 'text-gray-400'}>
                {factors.length > 0 ? '✓' : '—'}
              </span>
            </div>
            <p className="text-base font-bold text-gray-800 mt-1">{factors.length} parameters</p>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">4. Responses</span>
              <span className={responses.length > 0 ? 'text-emerald-600 font-bold' : 'text-gray-400'}>
                {responses.length > 0 ? '✓' : '—'}
              </span>
            </div>
            <p className="text-base font-bold text-gray-800 mt-1">{responses.length} CQAs</p>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">5. Models</span>
              <span className={analyses.length > 0 ? 'text-emerald-600 font-bold' : 'text-gray-400'}>
                {analyses.length > 0 ? '✓' : '—'}
              </span>
            </div>
            <p className="text-base font-bold text-gray-800 mt-1">{analyses.length} fitted</p>
          </div>
        </div>
      </div>

      {/* Generated Reports List */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <h2 className="text-base font-bold text-gray-800">
          Generated Dossier Documents ({reports.length})
        </h2>

        {reportsLoading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <p className="text-gray-500 text-xs mt-2">Loading documents...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="p-8 text-center bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-sm text-gray-600">
              No reports generated yet for this project. Click the button above to produce a complete PDF report.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                <tr>
                  <th className="px-4 py-3">Report ID</th>
                  <th className="px-4 py-3">Generated Date</th>
                  <th className="px-4 py-3">Document Title</th>
                  <th className="px-4 py-3">Regulatory Format</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {reports.map(rep => {
                  const filename = rep.file_path ? rep.file_path.split(/[\\/]/).pop() : `report_${rep.id}.pdf`;
                  const downloadUrl = `${API_URL}/api/v1/reports/download/${rep.id}`;
                  return (
                    <tr key={rep.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-bold text-gray-900">RPT-{rep.id}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(rep.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {project?.project_name ? `${project.project_name} — AQbD Summary` : filename}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        ICH Q8/Q9/Q14 Dossier (PDF)
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          ✓ Ready
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-xs rounded-lg transition"
                        >
                          <span>⬇️ Download PDF</span>
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <Link
          to="/confirmation"
          className="px-5 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
        >
          ← Back to Confirmation
        </Link>

        <Link
          to="/"
          className="px-6 py-2.5 bg-gray-900 text-white font-medium rounded-lg hover:bg-black shadow-md transition flex items-center gap-2"
        >
          <span>Complete AQbD Workflow — Return to Dashboard</span>
          <span>⌂</span>
        </Link>
      </div>
    </div>
  );
}
