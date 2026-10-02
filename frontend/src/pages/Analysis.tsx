import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface Coefficient {
  term: string;
  coef: number;
  se?: number | null;
  std_err?: number | null;
  t?: number | null;
  t_stat?: number | null;
  p?: number | null;
  p_value?: number | null;
  ci_low?: number | null;
  ci_lower?: number | null;
  ci_high?: number | null;
  ci_upper?: number | null;
}

interface AnovaRow {
  source: string;
  sum_sq?: number | null;
  df?: number | null;
  mean_sq?: number | null;
  F?: number | null;
  p_value?: number | null;
  'PR(>F)'?: number | null;
}

interface LackOfFitData {
  status: string;
  sum_sq?: number | null;
  df?: number | null;
  mean_sq?: number | null;
  F?: number | null;
  p_value?: number | null;
}

interface AnalysisMetrics {
  r_squared?: number | null;
  adj_r_squared?: number | null;
  pred_r_squared?: number | null;
  rmse?: number | null;
  press?: number | null;
  lack_of_fit?: LackOfFitData | null;
}

interface AnalysisItem {
  id: number;
  project_id: number;
  design_id: number;
  response_id: number;
  model_type: string;
  transformation: string;
  coefficients: Coefficient[];
  anova: AnovaRow[];
  metrics: AnalysisMetrics;
  diagnostics?: any;
  is_stale?: boolean;
  data_hash?: string;
  created_at: string;
}

// Safe formatting helpers that never crash on undefined, null, or NaN
function formatNum(val: number | null | undefined, decimals = 4, fallback = 'N/A'): string {
  if (val === null || val === undefined || isNaN(val) || !isFinite(val)) {
    return fallback;
  }
  return val.toFixed(decimals);
}

function formatPVal(val: number | null | undefined, fallback = 'N/A'): string {
  if (val === null || val === undefined || isNaN(val) || !isFinite(val)) {
    return fallback;
  }
  if (val < 0.0001) return '< 0.0001';
  return val.toFixed(4);
}

// React Error Boundary to prevent blank screen if any unexpected rendering issue occurs
interface ErrorBoundaryProps {
  children: ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AnalysisErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Analysis page render error caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-4xl mx-auto p-8 my-8 bg-red-50 border border-red-200 rounded-xl text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
            ⚠️
          </div>
          <h2 className="text-xl font-bold text-red-900">Statistical Analysis Display Notice</h2>
          <p className="text-sm text-red-700 max-w-lg mx-auto">
            {this.state.error?.message || 'A data display error occurred while rendering the statistical analysis.'}
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition"
            >
              Reload Page
            </button>
            <Link
              to="/experiments"
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition"
            >
              Back to Experiments
            </Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AnalysisContent() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [selectedResponseId, setSelectedResponseId] = useState<number | ''>('');
  const [modelType, setModelType] = useState<string>('FIRST_ORDER');
  const [transformation, setTransformation] = useState<string>('NONE');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedProjectId = localStorage.getItem('aqbd_project_id');
    if (!savedProjectId) {
      navigate('/');
    } else {
      setProjectId(Number(savedProjectId));
    }
  }, [navigate]);

  // Load project responses
  const { data: responses = [] } = useQuery({
    queryKey: ['responses', projectId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/responses/`);
      if (!res.ok) throw new Error('Failed to load responses');
      return res.json();
    },
    enabled: !!projectId
  });

  // Set default selected response once loaded
  useEffect(() => {
    if (responses && responses.length > 0 && selectedResponseId === '') {
      setSelectedResponseId(responses[0].id);
    }
  }, [responses, selectedResponseId]);

  // Load latest DOE design
  const { data: designs = [] } = useQuery({
    queryKey: ['doe_designs', projectId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/doe/`);
      if (!res.ok) throw new Error('Failed to load DOE designs');
      return res.json();
    },
    enabled: !!projectId
  });

  const activeDesign = designs && designs.length > 0 ? designs[designs.length - 1] : null;

  // Load project analyses
  const { data: analyses = [], isLoading: loadingAnalyses } = useQuery<AnalysisItem[]>({
    queryKey: ['analyses', projectId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/analysis/`);
      if (!res.ok) throw new Error('Failed to load analyses');
      return res.json();
    },
    enabled: !!projectId
  });

  // Find analysis matching current selected response (preferring current, non-stale model)
  const activeAnalysis = analyses && analyses.length > 0
    ? (analyses.find(a => a.response_id === Number(selectedResponseId) && !a.is_stale)
       || analyses.find(a => a.response_id === Number(selectedResponseId)) 
       || analyses[0])
    : null;

  const runAnalysisMutation = useMutation({
    mutationFn: async () => {
      setError(null);
      if (!activeDesign) {
        throw new Error('No DOE design found. Please generate a DOE and enter experimental data first.');
      }
      if (!selectedResponseId) {
        throw new Error('Please select a response to analyze.');
      }

      const payload = {
        design_id: activeDesign.id,
        response_id: Number(selectedResponseId),
        model_type: modelType,
        transformation: transformation
      };

      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/analysis/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData?.detail?.error?.message || errData?.detail || 'Analysis execution failed';
        throw new Error(msg);
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['analyses', projectId] });
      queryClient.invalidateQueries({ queryKey: ['optimizations', projectId] });
      localStorage.setItem('aqbd_active_analysis_id', String(data.id));
    },
    onError: (err: any) => {
      setError(err.message);
    }
  });

  // Build model equation string from coefficients safely
  const modelEquation = (activeAnalysis?.coefficients || []).map((c, i) => {
    const coef = c.coef ?? 0;
    const sign = coef >= 0 ? (i === 0 ? '' : ' + ') : ' - ';
    const val = formatNum(Math.abs(coef), 4, '0.0000');
    if (c.term === 'Intercept') return `${sign}${val}`;
    return `${sign}${val} · ${c.term}`;
  }).join('');

  if (!projectId) return null;

  return (
    <div className="max-w-6xl mx-auto pb-12 space-y-6">
      {/* Workflow Navigation Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link to="/" className="hover:text-blue-600">Project</Link>
            <span>&rarr;</span>
            <Link to="/doe" className="hover:text-blue-600">DOE</Link>
            <span>&rarr;</span>
            <Link to="/experiments" className="hover:text-blue-600">Data</Link>
            <span>&rarr;</span>
            <span className="font-semibold text-blue-600">Statistical Analysis</span>
            <span>&rarr;</span>
            <Link to="/diagnostics" className="hover:text-blue-600">Diagnostics</Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
              Phase 7
            </span>
            <h2 className="text-2xl font-bold text-gray-900">Statistical Modeling &amp; ANOVA</h2>
          </div>
          <p className="text-gray-500 text-sm mt-1">
            Fit linear, interaction, or second-order quadratic response models using ordinary least squares (OLS) regression.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/experiments"
            className="border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-lg shadow-sm transition text-sm"
          >
            &larr; Back to Experiments
          </Link>
          <Link
            to="/diagnostics"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-5 rounded-lg shadow-sm transition flex items-center gap-2 text-sm"
          >
            Continue to Diagnostics &amp; Plots &rarr;
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-r-lg text-sm">
          <span className="font-bold">Error: </span> {error}
        </div>
      )}

      {activeAnalysis?.is_stale && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg text-xs text-amber-900 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span>
              <strong>Model Outdated:</strong> Experimental data has changed since Model #{activeAnalysis.id} was fitted. Click <em>"Fit Regression Model"</em> below to refit with the current dataset.
            </span>
          </div>
        </div>
      )}

      {/* Control Panel Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-base font-bold text-gray-800 pb-3 border-b border-gray-100 mb-5">
          Model Specification &amp; Regression Controls
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
              Select Response to Model <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-sm bg-white"
              value={selectedResponseId}
              onChange={e => setSelectedResponseId(Number(e.target.value))}
            >
              {responses?.map((r: any) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.code}) [{r.unit || '-'}]
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Dependent variable for regression fitting.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
              Model Order / Polynomial <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-sm bg-white"
              value={modelType}
              onChange={e => setModelType(e.target.value)}
            >
              <option value="FIRST_ORDER">First Order (Main Effects: Y = β₀ + ΣβᵢXᵢ)</option>
              <option value="INTERACTIONS">2-Factor Interactions (2FI: Y = β₀ + ΣβᵢXᵢ + ΣβᵢⱼXᵢXⱼ)</option>
              <option value="QUADRATIC">Full Quadratic (Response Surface: Y = β₀ + ΣβᵢXᵢ + ΣβᵢⱼXᵢXⱼ + ΣβᵢᵢXᵢ²)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Select complexity suitable for your design geometry.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
              Mathematical Transformation
            </label>
            <select
              className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-sm bg-white"
              value={transformation}
              onChange={e => setTransformation(e.target.value)}
            >
              <option value="NONE">None (Raw response values)</option>
              <option value="LOG">Log₁₀ Transformation</option>
              <option value="SQRT">Square Root Transformation</option>
              <option value="INVERSE">Inverse (1 / Y)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Stabilize non-constant residual variance.</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={() => runAnalysisMutation.mutate()}
            disabled={runAnalysisMutation.isPending || !selectedResponseId}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold px-6 py-2.5 rounded-lg shadow-sm transition text-sm flex items-center gap-2"
          >
            {runAnalysisMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Fitting OLS Model &amp; ANOVA...</span>
              </>
            ) : (
              <span>⚡ Fit Model / Run ANOVA</span>
            )}
          </button>
        </div>
      </div>

      {/* Model Results View */}
      {loadingAnalyses ? (
        <div className="bg-white p-12 text-center rounded-xl shadow-sm border border-gray-100">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-500 text-sm">Loading statistical analyses...</p>
        </div>
      ) : activeAnalysis ? (
        <div className="space-y-6">
          {/* Summary Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <span className="text-xs uppercase font-bold text-gray-500">R² (Goodness of Fit)</span>
              <div className="text-2xl font-extrabold text-blue-700 mt-1">
                {activeAnalysis.metrics?.r_squared !== undefined && activeAnalysis.metrics?.r_squared !== null
                  ? `${(activeAnalysis.metrics.r_squared * 100).toFixed(2)}%`
                  : 'N/A'}
              </div>
              <span className="text-xs text-gray-500">
                {formatNum(activeAnalysis.metrics?.r_squared, 4)}
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <span className="text-xs uppercase font-bold text-gray-500">Adjusted R²</span>
              <div className="text-2xl font-extrabold text-indigo-700 mt-1">
                {activeAnalysis.metrics?.adj_r_squared !== undefined && activeAnalysis.metrics?.adj_r_squared !== null
                  ? `${(activeAnalysis.metrics.adj_r_squared * 100).toFixed(2)}%`
                  : 'N/A'}
              </div>
              <span className="text-xs text-gray-500">
                {formatNum(activeAnalysis.metrics?.adj_r_squared, 4)}
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <span className="text-xs uppercase font-bold text-gray-500">Predicted R² (PRESS)</span>
              <div className="text-2xl font-extrabold text-purple-700 mt-1">
                {activeAnalysis.metrics?.pred_r_squared !== undefined && activeAnalysis.metrics?.pred_r_squared !== null
                  ? `${(activeAnalysis.metrics.pred_r_squared * 100).toFixed(2)}%`
                  : 'N/A'}
              </div>
              <span className="text-xs text-gray-500">
                PRESS: {formatNum(activeAnalysis.metrics?.press, 3)}
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <span className="text-xs uppercase font-bold text-gray-500">RMSE (Std Error)</span>
              <div className="text-2xl font-extrabold text-gray-800 mt-1">
                {formatNum(activeAnalysis.metrics?.rmse, 4)}
              </div>
              <span className="text-xs text-gray-500">Root Mean Square Error</span>
            </div>
          </div>

          {/* Model Equation Card */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
              Fitted Empirical Regression Equation (Coded Units)
            </h4>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 font-mono text-sm text-gray-800 break-words leading-relaxed">
              <strong>Y</strong> = {modelEquation || '0'}
            </div>
          </div>

          {/* ANOVA Table Card */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-gray-800">
                  Analysis of Variance (ANOVA Table)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Partition of variance and statistical hypothesis tests</p>
              </div>
              <span className="text-xs bg-blue-100 text-blue-800 font-semibold px-2.5 py-1 rounded-full">
                Model: {activeAnalysis.model_type}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-600 text-xs uppercase tracking-wider">
                    <th className="p-3 font-semibold border-b">Source of Variation</th>
                    <th className="p-3 font-semibold border-b text-right">Sum of Squares (SS)</th>
                    <th className="p-3 font-semibold border-b text-center">DF</th>
                    <th className="p-3 font-semibold border-b text-right">Mean Square (MS)</th>
                    <th className="p-3 font-semibold border-b text-right">F-Value</th>
                    <th className="p-3 font-semibold border-b text-right">p-Value (P &gt; F)</th>
                    <th className="p-3 font-semibold border-b text-center">Significance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm">
                  {(activeAnalysis.anova || []).map((row, idx) => {
                    const pVal = row.p_value !== undefined && row.p_value !== null ? row.p_value : row['PR(>F)'];
                    const isSig = pVal !== undefined && pVal !== null && pVal < 0.05;
                    return (
                      <tr key={idx} className="hover:bg-gray-50 transition">
                        <td className="p-3 font-semibold text-gray-800">{row.source}</td>
                        <td className="p-3 text-right font-mono">{formatNum(row.sum_sq, 4)}</td>
                        <td className="p-3 text-center font-mono">{row.df !== undefined && row.df !== null ? row.df : '—'}</td>
                        <td className="p-3 text-right font-mono">{formatNum(row.mean_sq, 4)}</td>
                        <td className="p-3 text-right font-mono font-bold text-gray-800">
                          {formatNum(row.F, 3)}
                        </td>
                        <td className="p-3 text-right font-mono">
                          {pVal !== undefined && pVal !== null ? (
                            <span className={isSig ? 'font-bold text-green-700' : 'text-gray-600'}>
                              {formatPVal(pVal)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="p-3 text-center">
                          {pVal !== undefined && pVal !== null ? (
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${isSig ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                              {isSig ? 'Significant' : 'Not Sig.'}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Lack of Fit Row if available */}
                  {activeAnalysis.metrics?.lack_of_fit?.status === 'TESTABLE' ? (
                    <tr className="bg-amber-50/40">
                      <td className="p-3 font-semibold text-gray-800">Lack of Fit (Replicated)</td>
                      <td className="p-3 text-right font-mono">{formatNum(activeAnalysis.metrics.lack_of_fit.sum_sq, 4)}</td>
                      <td className="p-3 text-center font-mono">{activeAnalysis.metrics.lack_of_fit.df ?? '—'}</td>
                      <td className="p-3 text-right font-mono">{formatNum(activeAnalysis.metrics.lack_of_fit.mean_sq, 4)}</td>
                      <td className="p-3 text-right font-mono font-bold">{formatNum(activeAnalysis.metrics.lack_of_fit.F, 3)}</td>
                      <td className="p-3 text-right font-mono">
                        {formatPVal(activeAnalysis.metrics.lack_of_fit.p_value)}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${(activeAnalysis.metrics.lack_of_fit.p_value ?? 0) > 0.05 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {(activeAnalysis.metrics.lack_of_fit.p_value ?? 0) > 0.05 ? 'Good (Not Sig)' : 'Significant LOF'}
                        </span>
                      </td>
                    </tr>
                  ) : (
                    <tr className="bg-gray-50 text-xs text-gray-500">
                      <td colSpan={7} className="p-3 italic text-center">
                        Lack of Fit: Not testable &mdash; pure error cannot be estimated without replicated observations (center points).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Model Coefficients Table Card */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-800">Model Parameter Estimates &amp; Significance</h3>
              <p className="text-xs text-gray-500 mt-0.5">Factor coefficient weights, standard errors, and 95% confidence intervals</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-600 text-xs uppercase tracking-wider">
                    <th className="p-3 font-semibold border-b">Factor Term</th>
                    <th className="p-3 font-semibold border-b text-right">Coefficient (β)</th>
                    <th className="p-3 font-semibold border-b text-right">Std Error (SE)</th>
                    <th className="p-3 font-semibold border-b text-right">t-Statistic</th>
                    <th className="p-3 font-semibold border-b text-right">p-Value (P &gt; |t|)</th>
                    <th className="p-3 font-semibold border-b text-right">95% CI Lower</th>
                    <th className="p-3 font-semibold border-b text-right">95% CI Upper</th>
                    <th className="p-3 font-semibold border-b text-center">Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm">
                  {(activeAnalysis.coefficients || []).map((c, idx) => {
                    const se = c.std_err !== undefined && c.std_err !== null ? c.std_err : c.se;
                    const tVal = c.t_stat !== undefined && c.t_stat !== null ? c.t_stat : c.t;
                    const pVal = c.p_value !== undefined && c.p_value !== null ? c.p_value : c.p;
                    const ciLow = c.ci_lower !== undefined && c.ci_lower !== null ? c.ci_lower : c.ci_low;
                    const ciHigh = c.ci_upper !== undefined && c.ci_upper !== null ? c.ci_upper : c.ci_high;
                    const isSig = pVal !== undefined && pVal !== null && pVal < 0.05;

                    return (
                      <tr key={idx} className="hover:bg-gray-50 transition">
                        <td className="p-3 font-mono font-bold text-gray-800">{c.term}</td>
                        <td className="p-3 text-right font-mono font-semibold text-blue-900">
                          {formatNum(c.coef, 4)}
                        </td>
                        <td className="p-3 text-right font-mono text-gray-600">
                          {formatNum(se, 4)}
                        </td>
                        <td className="p-3 text-right font-mono text-gray-700">
                          {formatNum(tVal, 3)}
                        </td>
                        <td className="p-3 text-right font-mono">
                          {pVal !== undefined && pVal !== null ? (
                            <span className={isSig ? 'font-bold text-green-700' : 'text-gray-600'}>
                              {formatPVal(pVal)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="p-3 text-right font-mono text-xs text-gray-500">
                          {formatNum(ciLow, 4, '—')}
                        </td>
                        <td className="p-3 text-right font-mono text-xs text-gray-500">
                          {formatNum(ciHigh, 4, '—')}
                        </td>
                        <td className="p-3 text-center">
                          {pVal !== undefined && pVal !== null ? (
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${isSig ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                              {isSig ? '★ Significant' : 'Insignificant'}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 text-center rounded-xl shadow-sm border border-gray-100 space-y-4">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
            📈
          </div>
          <h3 className="text-lg font-bold text-gray-800">No Regression Models Fitted Yet</h3>
          <p className="text-gray-500 max-w-md mx-auto text-sm">
            Select a response and polynomial model order above, then click &ldquo;Fit Model / Run ANOVA&rdquo; to estimate parameters and evaluate statistical significance.
          </p>
        </div>
      )}
    </div>
  );
}

export default function Analysis() {
  return (
    <AnalysisErrorBoundary>
      <AnalysisContent />
    </AnalysisErrorBoundary>
  );
}
