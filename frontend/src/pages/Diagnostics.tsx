import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface FactorItem {
  id: number;
  code: string;
  name: string;
  unit?: string;
  low_value: number;
  high_value: number;
}

interface ResponseItem {
  id: number;
  code: string;
  name: string;
  unit?: string;
  target_type: string;
}

interface Coefficient {
  term: string;
  coef: number;
  se?: number;
  t?: number;
  p?: number;
  ci_low?: number;
  ci_high?: number;
}

interface DiagnosticsData {
  normality?: {
    status: string;
    shapiro_p: number;
  };
  residuals: number[];
  fitted: number[];
  actual: number[];
  studentized_residuals?: number[];
  cooks_distance?: number[];
  leverage?: number[];
}

interface AnalysisItem {
  id: number;
  project_id: number;
  design_id: number;
  response_id: number;
  model_type: string;
  transformation: string;
  coefficients: Coefficient[];
  anova: any[];
  metrics: {
    r_squared?: number;
    adj_r_squared?: number;
    pred_r_squared?: number;
    rmse?: number;
    press?: number;
    lack_of_fit?: {
      status: string;
      sum_sq?: number;
      df?: number;
      mean_sq?: number;
      F?: number;
      p_value?: number;
    };
  };
  diagnostics: DiagnosticsData;
  created_at: string;
}

function formatNum(val: number | null | undefined, decimals = 4, fallback = 'N/A'): string {
  if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return fallback;
  return val.toFixed(decimals);
}

function formatPct(val: number | null | undefined, decimals = 2, fallback = 'N/A'): string {
  if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return fallback;
  return (val * 100).toFixed(decimals) + '%';
}

export default function Diagnostics() {
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'qq' | 'fitted' | 'order' | 'actual' | 'surface'>('qq');
  
  // Surface plot factor selection
  const [factorXCode, setFactorXCode] = useState<string>('');
  const [factorYCode, setFactorYCode] = useState<string>('');

  useEffect(() => {
    const savedProjectId = localStorage.getItem('aqbd_project_id');
    if (!savedProjectId) {
      navigate('/');
    } else {
      setProjectId(Number(savedProjectId));
    }
  }, [navigate]);

  // Load analyses
  const { data: analyses = [], isLoading: analysesLoading } = useQuery<AnalysisItem[]>({
    queryKey: ['analyses', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/analysis/`);
      if (!res.ok) throw new Error('Failed to load analyses');
      return res.json();
    },
    enabled: !!projectId
  });

  // Load factors
  const { data: factors = [] } = useQuery<FactorItem[]>({
    queryKey: ['factors', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/factors/`);
      if (!res.ok) throw new Error('Failed to load factors');
      return res.json();
    },
    enabled: !!projectId
  });

  // Load responses
  const { data: responses = [] } = useQuery<ResponseItem[]>({
    queryKey: ['responses', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/responses/`);
      if (!res.ok) throw new Error('Failed to load responses');
      return res.json();
    },
    enabled: !!projectId
  });

  // Initialize selected analysis and factors for surface
  useEffect(() => {
    if (analyses.length > 0) {
      if (!selectedAnalysisId || !analyses.some(a => a.id === selectedAnalysisId)) {
        setSelectedAnalysisId(analyses[analyses.length - 1].id);
      }
    }
  }, [analyses, selectedAnalysisId]);

  useEffect(() => {
    if (factors.length >= 2) {
      if (!factorXCode) setFactorXCode(factors[0].code);
      if (!factorYCode) setFactorYCode(factors[1].code);
    } else if (factors.length === 1) {
      if (!factorXCode) setFactorXCode(factors[0].code);
    }
  }, [factors, factorXCode, factorYCode]);

  const currentAnalysis = useMemo(() => {
    return analyses.find(a => a.id === selectedAnalysisId) || null;
  }, [analyses, selectedAnalysisId]);

  const currentResponse = useMemo(() => {
    if (!currentAnalysis) return null;
    return responses.find(r => r.id === currentAnalysis.response_id) || null;
  }, [currentAnalysis, responses]);

  // Normal Q-Q plot calculations
  const qqData = useMemo(() => {
    if (!currentAnalysis || !currentAnalysis.diagnostics?.residuals) return null;
    const rawResids = currentAnalysis.diagnostics.residuals;
    const n = rawResids.length;
    if (n === 0) return null;

    // Standardize residuals
    const mean = rawResids.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(rawResids.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1 || 1));
    const sorted = [...rawResids].map(r => (sd > 0 ? (r - mean) / sd : 0)).sort((a, b) => a - b);

    // Approximate inverse standard normal CDF (Beasley-Springer-Moro)
    const normInv = (p: number) => {
      const a = [2.515517, 0.802853, 0.010328];
      const b = [1.432788, 0.189269, 0.001308];
      let t: number;
      let sign = 1;
      if (p < 0.5) {
        t = Math.sqrt(-2 * Math.log(p));
        sign = -1;
      } else {
        t = Math.sqrt(-2 * Math.log(1 - p));
      }
      const num = 2.506628274631 + t * (a[0] + t * (a[1] + t * a[2]));
      const den = 1 + t * (b[0] + t * (b[1] + t * b[2]));
      const val = t - (num / den);
      return sign * val;
    };

    const points = sorted.map((obs, i) => {
      const p = (i + 1 - 0.375) / (n + 0.25);
      const theoretical = normInv(p);
      return { theoretical, observed: obs };
    });

    const minVal = Math.min(-3, ...points.map(p => Math.min(p.theoretical, p.observed)));
    const maxVal = Math.max(3, ...points.map(p => Math.max(p.theoretical, p.observed)));

    return { points, minVal, maxVal };
  }, [currentAnalysis]);

  // Residuals vs Fitted data
  const fittedData = useMemo(() => {
    if (!currentAnalysis || !currentAnalysis.diagnostics?.residuals || !currentAnalysis.diagnostics?.fitted) return null;
    const residuals = currentAnalysis.diagnostics.residuals;
    const fitted = currentAnalysis.diagnostics.fitted;
    const points = residuals.map((r, i) => ({ fitted: fitted[i], residual: r, run: i + 1 }));

    const minFitted = Math.min(...fitted);
    const maxFitted = Math.max(...fitted);
    const maxAbsResid = Math.max(...residuals.map(r => Math.abs(r)), 0.1);

    return { points, minFitted, maxFitted, maxAbsResid };
  }, [currentAnalysis]);

  // Residuals vs Run Order data
  const orderData = useMemo(() => {
    if (!currentAnalysis || !currentAnalysis.diagnostics?.residuals) return null;
    const residuals = currentAnalysis.diagnostics.residuals;
    const points = residuals.map((r, i) => ({ order: i + 1, residual: r }));
    const maxAbsResid = Math.max(...residuals.map(r => Math.abs(r)), 0.1);
    return { points, maxAbsResid, n: residuals.length };
  }, [currentAnalysis]);

  // Actual vs Predicted data
  const actualPredData = useMemo(() => {
    if (!currentAnalysis || !currentAnalysis.diagnostics?.actual || !currentAnalysis.diagnostics?.fitted) return null;
    const actual = currentAnalysis.diagnostics.actual;
    const predicted = currentAnalysis.diagnostics.fitted;
    const points = actual.map((a, i) => ({ actual: a, predicted: predicted[i], run: i + 1 }));

    const allVals = [...actual, ...predicted];
    const minVal = Math.min(...allVals);
    const maxVal = Math.max(...allVals);

    return { points, minVal, maxVal };
  }, [currentAnalysis]);

  // Response Surface 2D Grid calculation with strict coded-coordinate transformation
  const surfaceData = useMemo(() => {
    if (!currentAnalysis || factors.length < 2 || !factorXCode || !factorYCode) return null;
    const factorX = factors.find(f => f.code === factorXCode);
    const factorY = factors.find(f => f.code === factorYCode);
    if (!factorX || !factorY) return null;

    const coefs = currentAnalysis.coefficients;
    const gridSize = 21; // 21x21 grid
    const xStep = (factorX.high_value - factorX.low_value) / (gridSize - 1);
    const yStep = (factorY.high_value - factorY.low_value) / (gridSize - 1);

    const xVals: number[] = [];
    const yVals: number[] = [];
    for (let i = 0; i < gridSize; i++) {
      xVals.push(factorX.low_value + i * xStep);
      yVals.push(factorY.low_value + i * yStep);
    }

    // Fixed values for other factors (center points in actual units)
    const fixedFactors: Record<string, number> = {};
    factors.forEach(f => {
      if (f.code !== factorXCode && f.code !== factorYCode) {
        fixedFactors[f.code] = (f.low_value + f.high_value) / 2.0;
      }
    });

    // Helper: Predict response from actual engineering factor values by converting to coded units [-1, +1]
    const predictFromActual = (actualVals: Record<string, number>): number => {
      // 1. Transform actual factor values into coded coordinates [-1, +1]
      // Formula: coded = (actual - center) / ((high - low) / 2)
      const codedVals: Record<string, number> = {};
      factors.forEach(f => {
        const actual = actualVals[f.code] !== undefined ? actualVals[f.code] : (f.low_value + f.high_value) / 2.0;
        const center = (f.high_value + f.low_value) / 2.0;
        const halfRange = (f.high_value - f.low_value) / 2.0;
        codedVals[f.code] = halfRange > 0 ? (actual - center) / halfRange : 0.0;
      });

      // 2. Evaluate model polynomial equation using coded coordinates
      let z = 0.0;
      for (const c of coefs) {
        if (c.term === 'Intercept') {
          z += c.coef;
        } else if (c.term.startsWith('np.power(')) {
          const match = c.term.match(/np\.power\((.+),\s*2\)/);
          if (match && codedVals[match[1]] !== undefined) {
            z += c.coef * (codedVals[match[1]] ** 2);
          }
        } else if (c.term.includes(':')) {
          const parts = c.term.split(':');
          let termVal = 1.0;
          parts.forEach(p => {
            if (codedVals[p] !== undefined) termVal *= codedVals[p];
          });
          z += c.coef * termVal;
        } else if (codedVals[c.term] !== undefined) {
          z += c.coef * codedVals[c.term];
        }
      }

      // 3. Apply inverse mathematical transformation if fitted with transformation
      if (currentAnalysis.transformation === 'LOG') {
        z = 10 ** z;
      } else if (currentAnalysis.transformation === 'SQRT') {
        z = z ** 2;
      } else if (currentAnalysis.transformation === 'INVERSE') {
        z = z !== 0 ? 1 / z : 0;
      }

      return z;
    };

    // Calculate direct model prediction at exact center point (all coded = 0)
    const centerActualVals: Record<string, number> = {};
    factors.forEach(f => {
      centerActualVals[f.code] = (f.low_value + f.high_value) / 2.0;
    });
    const centerPrediction = predictFromActual(centerActualVals);

    const grid: number[][] = [];
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (let j = 0; j < gridSize; j++) {
      const row: number[] = [];
      const yVal = yVals[j];
      for (let i = 0; i < gridSize; i++) {
        const xVal = xVals[i];
        const pointActualVals: Record<string, number> = {
          ...fixedFactors,
          [factorXCode]: xVal,
          [factorYCode]: yVal
        };
        const z = predictFromActual(pointActualVals);

        row.push(z);
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      }
      grid.push(row);
    }

    return { factorX, factorY, xVals, yVals, grid, minZ, maxZ, fixedFactors, centerPrediction };
  }, [currentAnalysis, factors, factorXCode, factorYCode]);

  // Color generator for heatmap/contour
  const getColor = (val: number, min: number, max: number) => {
    if (max === min) return '#3b82f6';
    const norm = Math.max(0, Math.min(1, (val - min) / (max - min)));
    // Blue (0) -> Cyan (0.33) -> Green (0.66) -> Red/Orange (1)
    if (norm < 0.25) {
      const t = norm / 0.25;
      return `rgb(${Math.round(30 + t * 20)}, ${Math.round(100 + t * 80)}, ${Math.round(230 - t * 40)})`;
    } else if (norm < 0.5) {
      const t = (norm - 0.25) / 0.25;
      return `rgb(${Math.round(50 + t * 40)}, ${Math.round(180 + t * 30)}, ${Math.round(190 - t * 100)})`;
    } else if (norm < 0.75) {
      const t = (norm - 0.5) / 0.25;
      return `rgb(${Math.round(90 + t * 140)}, ${Math.round(210 - t * 50)}, ${Math.round(90 - t * 70)})`;
    } else {
      const t = (norm - 0.75) / 0.25;
      return `rgb(${Math.round(230 + t * 25)}, ${Math.round(160 - t * 120)}, ${Math.round(20 - t * 10)})`;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Breadcrumb Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link to="/" className="hover:text-blue-600">Dashboard</Link>
            <span>/</span>
            <Link to="/analysis" className="hover:text-blue-600">Analysis</Link>
            <span>/</span>
            <span className="text-gray-800 font-medium">Diagnostics</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
              Phase 7
            </span>
            <h1 className="text-2xl font-bold text-gray-900">Model Diagnostics & Surfaces</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Validate statistical assumptions (normality, constant variance, independence) and explore 2D contour response surfaces.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/analysis"
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
          >
            ← Back to Analysis
          </Link>
          <Link
            to="/optimization"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm transition flex items-center gap-2"
          >
            Proceed to Optimization →
          </Link>
        </div>
      </div>

      {analysesLoading ? (
        <div className="bg-white p-12 text-center rounded-xl shadow-sm border border-gray-100">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-500 text-sm">Loading statistical analyses & diagnostic data...</p>
        </div>
      ) : analyses.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl shadow-sm border border-gray-100 space-y-4">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
            📈
          </div>
          <h2 className="text-xl font-bold text-gray-900">No Statistical Models Fitted Yet</h2>
          <p className="text-gray-600 max-w-md mx-auto text-sm">
            To view residual diagnostics, normality plots, and response surfaces, first fit a statistical model in the Analysis module.
          </p>
          <Link
            to="/analysis"
            className="inline-block px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 shadow-sm transition"
          >
            Go to Statistical Analysis →
          </Link>
        </div>
      ) : (
        <>
          {/* Analysis Selection & Model Summary */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Selected Fitted Model / Response
                </label>
                <select
                  value={selectedAnalysisId || ''}
                  onChange={e => setSelectedAnalysisId(Number(e.target.value))}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-800 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {analyses.map(a => {
                    const resp = responses.find(r => r.id === a.response_id);
                    return (
                      <option key={a.id} value={a.id}>
                        {resp ? `${resp.name} (${resp.code})` : `Response ID ${a.response_id}`} — {a.model_type} {a.transformation !== 'NONE' ? `[${a.transformation}]` : ''} (ID #{a.id})
                      </option>
                    );
                  })}
                </select>
              </div>

              {currentAnalysis && (
                <div className="flex flex-wrap gap-2 items-center">
                  <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                    currentAnalysis.diagnostics?.normality?.status === 'PASS' 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    <span>{currentAnalysis.diagnostics?.normality?.status === 'PASS' ? '✓' : '⚠️'}</span>
                    <span>Normality: {currentAnalysis.diagnostics?.normality?.status} (p = {currentAnalysis.diagnostics?.normality?.shapiro_p?.toFixed(4)})</span>
                  </div>

                  {currentAnalysis.metrics?.lack_of_fit?.status === 'TESTABLE' && (
                    <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                      (currentAnalysis.metrics.lack_of_fit.p_value ?? 0) > 0.05
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      <span>{(currentAnalysis.metrics.lack_of_fit.p_value ?? 0) > 0.05 ? '✓' : '⚠️'}</span>
                      <span>LOF p-value: {currentAnalysis.metrics.lack_of_fit.p_value?.toFixed(4)} ({(currentAnalysis.metrics.lack_of_fit.p_value ?? 0) > 0.05 ? 'Non-significant' : 'Significant'})</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Quick Metrics Bar */}
            {currentAnalysis && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-gray-100">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <span className="text-xs text-gray-500 font-medium">R² Goodness of Fit</span>
                  <p className="text-lg font-bold text-gray-800">
                    {formatPct(currentAnalysis.metrics?.r_squared)}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <span className="text-xs text-gray-500 font-medium">Adjusted R²</span>
                  <p className="text-lg font-bold text-gray-800">
                    {formatPct(currentAnalysis.metrics?.adj_r_squared)}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <span className="text-xs text-gray-500 font-medium">Predicted R²</span>
                  <p className="text-lg font-bold text-gray-800">
                    {formatPct(currentAnalysis.metrics?.pred_r_squared)}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <span className="text-xs text-gray-500 font-medium">Residual Std Error (RMSE)</span>
                  <p className="text-lg font-bold text-gray-800">
                    {formatNum(currentAnalysis.metrics?.rmse, 4)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Diagnostics Navigation Tabs */}
          <div className="flex border-b border-gray-200 bg-white px-6 rounded-t-xl overflow-x-auto">
            <button
              onClick={() => setActiveTab('qq')}
              className={`py-4 px-4 font-semibold text-sm border-b-2 whitespace-nowrap transition ${
                activeTab === 'qq'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              1. Normal Probability (Q-Q)
            </button>
            <button
              onClick={() => setActiveTab('fitted')}
              className={`py-4 px-4 font-semibold text-sm border-b-2 whitespace-nowrap transition ${
                activeTab === 'fitted'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              2. Residuals vs. Fitted
            </button>
            <button
              onClick={() => setActiveTab('order')}
              className={`py-4 px-4 font-semibold text-sm border-b-2 whitespace-nowrap transition ${
                activeTab === 'order'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              3. Residuals vs. Run Order
            </button>
            <button
              onClick={() => setActiveTab('actual')}
              className={`py-4 px-4 font-semibold text-sm border-b-2 whitespace-nowrap transition ${
                activeTab === 'actual'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              4. Actual vs. Predicted
            </button>
            <button
              onClick={() => setActiveTab('surface')}
              className={`py-4 px-4 font-semibold text-sm border-b-2 whitespace-nowrap transition ${
                activeTab === 'surface'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              5. Response Surface / Contour
            </button>
          </div>

          {/* Tab 1: Normal Q-Q Plot */}
          {activeTab === 'qq' && (
            <div className="bg-white p-6 rounded-b-xl shadow-sm border border-t-0 border-gray-100 space-y-6">
              <div>
                <h3 className="text-base font-bold text-gray-800">Normal Probability Plot of Residuals</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Points along the diagonal indicate that model residuals are normally distributed with constant mean 0.
                </p>
              </div>

              {qqData ? (
                <div className="flex flex-col items-center">
                  <div className="w-full max-w-2xl bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <svg viewBox="0 0 500 400" className="w-full h-auto">
                      {/* Grid lines */}
                      <line x1="60" y1="40" x2="460" y2="40" stroke="#e5e7eb" strokeDasharray="3 3" />
                      <line x1="60" y1="120" x2="460" y2="120" stroke="#e5e7eb" strokeDasharray="3 3" />
                      <line x1="60" y1="200" x2="460" y2="200" stroke="#cbd5e1" strokeWidth="1.5" />
                      <line x1="60" y1="280" x2="460" y2="280" stroke="#e5e7eb" strokeDasharray="3 3" />
                      <line x1="60" y1="360" x2="460" y2="360" stroke="#94a3b8" strokeWidth="1.5" />

                      <line x1="60" y1="40" x2="60" y2="360" stroke="#94a3b8" strokeWidth="1.5" />
                      <line x1="160" y1="40" x2="160" y2="360" stroke="#e5e7eb" strokeDasharray="3 3" />
                      <line x1="260" y1="40" x2="260" y2="360" stroke="#cbd5e1" strokeWidth="1.5" />
                      <line x1="360" y1="40" x2="360" y2="360" stroke="#e5e7eb" strokeDasharray="3 3" />
                      <line x1="460" y1="40" x2="460" y2="360" stroke="#e5e7eb" strokeDasharray="3 3" />

                      {/* Diagonal Reference Line */}
                      <line x1="80" y1="340" x2="440" y2="60" stroke="#ef4444" strokeWidth="2" strokeDasharray="4 4" />

                      {/* Data Points */}
                      {qqData.points.map((pt, idx) => {
                        // Map theoretical (-3 to +3) to x (80 to 440)
                        const cx = 260 + (pt.theoretical / 3) * 180;
                        // Map observed (-3 to +3) to y (340 to 60)
                        const cy = 200 - (pt.observed / 3) * 140;
                        return (
                          <g key={idx}>
                            <circle
                              cx={Math.max(65, Math.min(455, cx))}
                              cy={Math.max(45, Math.min(355, cy))}
                              r="5"
                              fill="#2563eb"
                              stroke="#ffffff"
                              strokeWidth="1.5"
                              className="hover:r-7 transition-all cursor-pointer"
                            >
                              <title>{`Theoretical: ${pt.theoretical.toFixed(2)}, Observed Std Residual: ${pt.observed.toFixed(2)}`}</title>
                            </circle>
                          </g>
                        );
                      })}

                      {/* Axis Labels */}
                      <text x="260" y="395" textAnchor="middle" fontSize="12" fill="#475569" fontWeight="600">
                        Theoretical Quantiles
                      </text>
                      <text
                        x="-200"
                        y="20"
                        transform="rotate(-90)"
                        textAnchor="middle"
                        fontSize="12"
                        fill="#475569"
                        fontWeight="600"
                      >
                        Internally Studentized Residuals
                      </text>

                      {/* Tick Labels */}
                      <text x="160" y="375" textAnchor="middle" fontSize="10" fill="#64748b">-1.5</text>
                      <text x="260" y="375" textAnchor="middle" fontSize="10" fill="#64748b">0.0</text>
                      <text x="360" y="375" textAnchor="middle" fontSize="10" fill="#64748b">+1.5</text>
                      <text x="50" y="284" textAnchor="end" fontSize="10" fill="#64748b">-1.5</text>
                      <text x="50" y="204" textAnchor="end" fontSize="10" fill="#64748b">0.0</text>
                      <text x="50" y="124" textAnchor="end" fontSize="10" fill="#64748b">+1.5</text>
                    </svg>
                  </div>
                  <div className="mt-3 text-xs text-gray-500 text-center">
                    Shapiro-Wilk test result: <strong className={currentAnalysis?.diagnostics?.normality?.status === 'PASS' ? 'text-emerald-600' : 'text-amber-600'}>{currentAnalysis?.diagnostics?.normality?.status || 'N/A'}</strong> (p = {currentAnalysis?.diagnostics?.normality?.shapiro_p !== undefined ? currentAnalysis.diagnostics.normality.shapiro_p.toFixed(4) : 'N/A'}). Normal distribution assumption is {currentAnalysis?.diagnostics?.normality?.status === 'PASS' ? 'satisfied' : 'suspect'}.
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-8">Insufficient data to construct Q-Q plot.</p>
              )}
            </div>
          )}

          {/* Tab 2: Residuals vs Fitted */}
          {activeTab === 'fitted' && (
            <div className="bg-white p-6 rounded-b-xl shadow-sm border border-t-0 border-gray-100 space-y-6">
              <div>
                <h3 className="text-base font-bold text-gray-800">Residuals vs. Fitted Values</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Points should scatter randomly around the 0 line without any cone shape or curvature (homoscedasticity check).
                </p>
              </div>

              {fittedData ? (
                <div className="flex flex-col items-center">
                  <div className="w-full max-w-2xl bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <svg viewBox="0 0 500 400" className="w-full h-auto">
                      {/* Grid */}
                      <line x1="60" y1="40" x2="460" y2="40" stroke="#e5e7eb" strokeDasharray="3 3" />
                      <line x1="60" y1="120" x2="460" y2="120" stroke="#fecaca" strokeDasharray="3 3" strokeWidth="1" />
                      <line x1="60" y1="200" x2="460" y2="200" stroke="#ef4444" strokeWidth="1.5" />
                      <line x1="60" y1="280" x2="460" y2="280" stroke="#fecaca" strokeDasharray="3 3" strokeWidth="1" />
                      <line x1="60" y1="360" x2="460" y2="360" stroke="#94a3b8" strokeWidth="1.5" />

                      <line x1="60" y1="40" x2="60" y2="360" stroke="#94a3b8" strokeWidth="1.5" />
                      <line x1="160" y1="40" x2="160" y2="360" stroke="#e5e7eb" strokeDasharray="3 3" />
                      <line x1="260" y1="40" x2="260" y2="360" stroke="#e5e7eb" strokeDasharray="3 3" />
                      <line x1="360" y1="40" x2="360" y2="360" stroke="#e5e7eb" strokeDasharray="3 3" />
                      <line x1="460" y1="40" x2="460" y2="360" stroke="#94a3b8" strokeWidth="1.5" />

                      {/* Points */}
                      {fittedData.points.map((pt, idx) => {
                        const rangeFitted = (fittedData.maxFitted - fittedData.minFitted) || 1;
                        const cx = 80 + ((pt.fitted - fittedData.minFitted) / rangeFitted) * 360;
                        const cy = 200 - (pt.residual / (fittedData.maxAbsResid * 1.3)) * 140;
                        return (
                          <circle
                            key={idx}
                            cx={Math.max(65, Math.min(455, cx))}
                            cy={Math.max(45, Math.min(355, cy))}
                            r="5"
                            fill="#0d9488"
                            stroke="#ffffff"
                            strokeWidth="1.5"
                            className="hover:r-7 transition-all cursor-pointer"
                          >
                            <title>{`Run #${pt.run}: Fitted = ${pt.fitted.toFixed(3)}, Residual = ${pt.residual.toFixed(3)}`}</title>
                          </circle>
                        );
                      })}

                      {/* Labels */}
                      <text x="260" y="395" textAnchor="middle" fontSize="12" fill="#475569" fontWeight="600">
                        Predicted / Fitted Value ({currentResponse?.unit || 'Units'})
                      </text>
                      <text
                        x="-200"
                        y="20"
                        transform="rotate(-90)"
                        textAnchor="middle"
                        fontSize="12"
                        fill="#475569"
                        fontWeight="600"
                      >
                        Residual (e = Actual - Fitted)
                      </text>

                      {/* Ticks */}
                      <text x="80" y="375" textAnchor="middle" fontSize="10" fill="#64748b">{fittedData.minFitted.toFixed(1)}</text>
                      <text x="260" y="375" textAnchor="middle" fontSize="10" fill="#64748b">{((fittedData.minFitted + fittedData.maxFitted) / 2).toFixed(1)}</text>
                      <text x="440" y="375" textAnchor="middle" fontSize="10" fill="#64748b">{fittedData.maxFitted.toFixed(1)}</text>
                      <text x="50" y="204" textAnchor="end" fontSize="10" fill="#ef4444" fontWeight="600">0.0</text>
                      <text x="50" y="124" textAnchor="end" fontSize="10" fill="#64748b">+{(fittedData.maxAbsResid * 0.65).toFixed(2)}</text>
                      <text x="50" y="284" textAnchor="end" fontSize="10" fill="#64748b">-{(fittedData.maxAbsResid * 0.65).toFixed(2)}</text>
                    </svg>
                  </div>
                  <div className="mt-3 text-xs text-gray-500 text-center">
                    Zero line indicated in red. Constant variance requires uniform vertical spread across all predicted values.
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-8">Insufficient data to plot Residuals vs Fitted.</p>
              )}
            </div>
          )}

          {/* Tab 3: Residuals vs Order */}
          {activeTab === 'order' && (
            <div className="bg-white p-6 rounded-b-xl shadow-sm border border-t-0 border-gray-100 space-y-6">
              <div>
                <h3 className="text-base font-bold text-gray-800">Residuals vs. Run Order</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Verifies that experiments were free of time-dependent trends or instrumental drift.
                </p>
              </div>

              {orderData ? (
                <div className="flex flex-col items-center">
                  <div className="w-full max-w-2xl bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <svg viewBox="0 0 500 400" className="w-full h-auto">
                      <line x1="60" y1="200" x2="460" y2="200" stroke="#ef4444" strokeWidth="1.5" />
                      <line x1="60" y1="360" x2="460" y2="360" stroke="#94a3b8" strokeWidth="1.5" />
                      <line x1="60" y1="40" x2="60" y2="360" stroke="#94a3b8" strokeWidth="1.5" />

                      {/* Connecting line between runs */}
                      <path
                        d={orderData.points.map((pt, idx) => {
                          const cx = 80 + ((pt.order - 1) / Math.max(1, orderData.n - 1)) * 360;
                          const cy = 200 - (pt.residual / (orderData.maxAbsResid * 1.3)) * 140;
                          return `${idx === 0 ? 'M' : 'L'} ${cx} ${cy}`;
                        }).join(' ')}
                        fill="none"
                        stroke="#93c5fd"
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />

                      {/* Points */}
                      {orderData.points.map((pt, idx) => {
                        const cx = 80 + ((pt.order - 1) / Math.max(1, orderData.n - 1)) * 360;
                        const cy = 200 - (pt.residual / (orderData.maxAbsResid * 1.3)) * 140;
                        return (
                          <circle
                            key={idx}
                            cx={cx}
                            cy={cy}
                            r="5"
                            fill="#6366f1"
                            stroke="#ffffff"
                            strokeWidth="1.5"
                            className="hover:r-7 transition-all cursor-pointer"
                          >
                            <title>{`Run #${pt.order}: Residual = ${pt.residual.toFixed(3)}`}</title>
                          </circle>
                        );
                      })}

                      {/* Labels */}
                      <text x="260" y="395" textAnchor="middle" fontSize="12" fill="#475569" fontWeight="600">
                        Run Order Index
                      </text>
                      <text
                        x="-200"
                        y="20"
                        transform="rotate(-90)"
                        textAnchor="middle"
                        fontSize="12"
                        fill="#475569"
                        fontWeight="600"
                      >
                        Residual
                      </text>

                      {/* Ticks */}
                      <text x="80" y="375" textAnchor="middle" fontSize="10" fill="#64748b">1</text>
                      <text x="260" y="375" textAnchor="middle" fontSize="10" fill="#64748b">{Math.round(orderData.n / 2)}</text>
                      <text x="440" y="375" textAnchor="middle" fontSize="10" fill="#64748b">{orderData.n}</text>
                    </svg>
                  </div>
                  <div className="mt-3 text-xs text-gray-500 text-center">
                    Random fluctuation about 0 indicates lack of correlation between successive experimental runs.
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-8">No run order data available.</p>
              )}
            </div>
          )}

          {/* Tab 4: Actual vs Predicted */}
          {activeTab === 'actual' && (
            <div className="bg-white p-6 rounded-b-xl shadow-sm border border-t-0 border-gray-100 space-y-6">
              <div>
                <h3 className="text-base font-bold text-gray-800">Actual vs. Predicted Response</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Visual representation of model fit. Data points should align closely along the 45° diagonal line.
                </p>
              </div>

              {actualPredData ? (
                <div className="flex flex-col items-center">
                  <div className="w-full max-w-2xl bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <svg viewBox="0 0 500 400" className="w-full h-auto">
                      <line x1="60" y1="40" x2="460" y2="40" stroke="#e5e7eb" strokeDasharray="3 3" />
                      <line x1="60" y1="360" x2="460" y2="360" stroke="#94a3b8" strokeWidth="1.5" />
                      <line x1="60" y1="40" x2="60" y2="360" stroke="#94a3b8" strokeWidth="1.5" />
                      <line x1="460" y1="40" x2="460" y2="360" stroke="#94a3b8" strokeWidth="1.5" />

                      {/* 45 degree line */}
                      <line x1="80" y1="340" x2="440" y2="60" stroke="#10b981" strokeWidth="2" strokeDasharray="4 4" />

                      {/* Points */}
                      {actualPredData.points.map((pt, idx) => {
                        const span = (actualPredData.maxVal - actualPredData.minVal) || 1;
                        const cx = 80 + ((pt.predicted - actualPredData.minVal) / span) * 360;
                        const cy = 340 - ((pt.actual - actualPredData.minVal) / span) * 280;
                        return (
                          <circle
                            key={idx}
                            cx={Math.max(65, Math.min(455, cx))}
                            cy={Math.max(45, Math.min(355, cy))}
                            r="5"
                            fill="#8b5cf6"
                            stroke="#ffffff"
                            strokeWidth="1.5"
                            className="hover:r-7 transition-all cursor-pointer"
                          >
                            <title>{`Run #${pt.run}: Actual = ${pt.actual.toFixed(3)}, Predicted = ${pt.predicted.toFixed(3)}`}</title>
                          </circle>
                        );
                      })}

                      {/* Labels */}
                      <text x="260" y="395" textAnchor="middle" fontSize="12" fill="#475569" fontWeight="600">
                        Predicted Value ({currentResponse?.unit || 'Units'})
                      </text>
                      <text
                        x="-200"
                        y="20"
                        transform="rotate(-90)"
                        textAnchor="middle"
                        fontSize="12"
                        fill="#475569"
                        fontWeight="600"
                      >
                        Actual Experimental Value ({currentResponse?.unit || 'Units'})
                      </text>

                      {/* Ticks */}
                      <text x="80" y="375" textAnchor="middle" fontSize="10" fill="#64748b">{actualPredData.minVal.toFixed(1)}</text>
                      <text x="260" y="375" textAnchor="middle" fontSize="10" fill="#64748b">{((actualPredData.minVal + actualPredData.maxVal) / 2).toFixed(1)}</text>
                      <text x="440" y="375" textAnchor="middle" fontSize="10" fill="#64748b">{actualPredData.maxVal.toFixed(1)}</text>
                      <text x="50" y="340" textAnchor="end" fontSize="10" fill="#64748b">{actualPredData.minVal.toFixed(1)}</text>
                      <text x="50" y="200" textAnchor="end" fontSize="10" fill="#64748b">{((actualPredData.minVal + actualPredData.maxVal) / 2).toFixed(1)}</text>
                      <text x="50" y="65" textAnchor="end" fontSize="10" fill="#64748b">{actualPredData.maxVal.toFixed(1)}</text>
                    </svg>
                  </div>
                  <div className="mt-3 text-xs text-gray-500 text-center">
                    Green dashed line indicates perfect agreement (Actual = Predicted). High R² values correlate with tight clustering around this line.
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-8">Insufficient data to plot Actual vs Predicted.</p>
              )}
            </div>
          )}

          {/* Tab 5: Response Surface & 2D Contour Plot */}
          {activeTab === 'surface' && (
            <div className="bg-white p-6 rounded-b-xl shadow-sm border border-t-0 border-gray-100 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-gray-800">2D Contour & Response Surface</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Explore how changing two critical factors simultaneously impacts the predicted response.
                  </p>
                </div>

                {factors.length >= 2 && (
                  <div className="flex items-center gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">X-Axis Factor</label>
                      <select
                        value={factorXCode}
                        onChange={e => setFactorXCode(e.target.value)}
                        className="px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white"
                      >
                        {factors.map(f => (
                          <option key={f.code} value={f.code} disabled={f.code === factorYCode}>
                            {f.name} ({f.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Y-Axis Factor</label>
                      <select
                        value={factorYCode}
                        onChange={e => setFactorYCode(e.target.value)}
                        className="px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white"
                      >
                        {factors.map(f => (
                          <option key={f.code} value={f.code} disabled={f.code === factorXCode}>
                            {f.name} ({f.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {factors.length < 2 ? (
                <div className="p-8 text-center bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-sm text-gray-600">
                    A minimum of 2 factors is required to generate a 2D contour response surface. Currently defined: {factors.length} factor(s).
                  </p>
                </div>
              ) : surfaceData ? (
                <div className="flex flex-col items-center space-y-4">
                  {/* Scientific Coded Transformation Validation Bar */}
                  <div className="w-full max-w-2xl bg-blue-50/70 border border-blue-200 p-4 rounded-xl text-xs space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-blue-900">Numerical Validation:</span>
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold font-mono">
                          {currentAnalysis?.model_type}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                          Pair: {surfaceData.factorX.code} &ndash; {surfaceData.factorY.code}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center gap-1">
                        <span>✓</span>
                        <span>Coded Coordinates Verified</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 border-t border-blue-200/60 text-blue-950 font-medium">
                      <div>
                        <span className="text-gray-500 block text-2xs uppercase">Direct Center Prediction</span>
                        <strong className="font-mono text-sm text-blue-900">
                          {formatNum(surfaceData.centerPrediction, 3)} {currentResponse?.unit || ''}
                        </strong>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-2xs uppercase">Surface Range (Min &rarr; Max)</span>
                        <strong className="font-mono text-sm text-blue-900">
                          {formatNum(surfaceData.minZ, 2)} &ndash; {formatNum(surfaceData.maxZ, 2)}
                        </strong>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <span className="text-gray-500 block text-2xs uppercase">Center Agreement</span>
                        <span className="text-emerald-700 font-bold block mt-0.5">
                          Exact Match (Coded = 0)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="w-full max-w-2xl bg-gray-50 p-6 rounded-xl border border-gray-200">
                    <div className="relative">
                      {/* SVG Heatmap / Contour Grid */}
                      <svg viewBox="0 0 500 460" className="w-full h-auto">
                        <defs>
                          <clipPath id="chart-area">
                            <rect x="60" y="30" width="380" height="360" />
                          </clipPath>
                        </defs>

                        {/* Cells */}
                        <g clipPath="url(#chart-area)">
                          {surfaceData.grid.map((row, j) => {
                            const cellHeight = 360 / surfaceData.grid.length;
                            const cellWidth = 380 / row.length;
                            const y = 30 + (surfaceData.grid.length - 1 - j) * cellHeight;
                            return row.map((val, i) => {
                              const x = 60 + i * cellWidth;
                              return (
                                <rect
                                  key={`${i}-${j}`}
                                  x={x}
                                  y={y}
                                  width={cellWidth + 0.5}
                                  height={cellHeight + 0.5}
                                  fill={getColor(val, surfaceData.minZ, surfaceData.maxZ)}
                                >
                                  <title>{`${surfaceData.factorX.name}: ${surfaceData.xVals[i].toFixed(2)}, ${surfaceData.factorY.name}: ${surfaceData.yVals[j].toFixed(2)} → Predicted ${currentResponse?.name}: ${val.toFixed(3)}`}</title>
                                </rect>
                              );
                            });
                          })}

                          {/* Center Point Crosshair & Indicator */}
                          <g>
                            <circle cx="250" cy="210" r="7" fill="#ffffff" stroke="#0f172a" strokeWidth="2" />
                            <circle cx="250" cy="210" r="3" fill="#2563eb" />
                            <line x1="240" y1="210" x2="260" y2="210" stroke="#0f172a" strokeWidth="1.5" />
                            <line x1="250" y1="200" x2="250" y2="220" stroke="#0f172a" strokeWidth="1.5" />
                            <title>{`Center Operating Point (All Coded = 0):\n${surfaceData.factorX.name}: ${((surfaceData.factorX.low_value + surfaceData.factorX.high_value) / 2).toFixed(2)}\n${surfaceData.factorY.name}: ${((surfaceData.factorY.low_value + surfaceData.factorY.high_value) / 2).toFixed(2)}\nPredicted ${currentResponse?.name}: ${surfaceData.centerPrediction.toFixed(3)} ${currentResponse?.unit || ''}`}</title>
                          </g>
                        </g>

                        {/* Border around grid */}
                        <rect x="60" y="30" width="380" height="360" fill="none" stroke="#64748b" strokeWidth="1.5" />

                        {/* X-Axis Labels */}
                        <text x="250" y="425" textAnchor="middle" fontSize="12" fill="#334155" fontWeight="600">
                          {surfaceData.factorX.name} ({surfaceData.factorX.code}) {surfaceData.factorX.unit ? `[${surfaceData.factorX.unit}]` : ''}
                        </text>
                        <text x="60" y="405" textAnchor="middle" fontSize="10" fill="#64748b">{surfaceData.factorX.low_value}</text>
                        <text x="250" y="405" textAnchor="middle" fontSize="10" fill="#64748b">{((surfaceData.factorX.low_value + surfaceData.factorX.high_value) / 2).toFixed(1)}</text>
                        <text x="440" y="405" textAnchor="middle" fontSize="10" fill="#64748b">{surfaceData.factorX.high_value}</text>

                        {/* Y-Axis Labels */}
                        <text
                          x="-210"
                          y="20"
                          transform="rotate(-90)"
                          textAnchor="middle"
                          fontSize="12"
                          fill="#334155"
                          fontWeight="600"
                        >
                          {surfaceData.factorY.name} ({surfaceData.factorY.code}) {surfaceData.factorY.unit ? `[${surfaceData.factorY.unit}]` : ''}
                        </text>
                        <text x="50" y="394" textAnchor="end" fontSize="10" fill="#64748b">{surfaceData.factorY.low_value}</text>
                        <text x="50" y="214" textAnchor="end" fontSize="10" fill="#64748b">{((surfaceData.factorY.low_value + surfaceData.factorY.high_value) / 2).toFixed(1)}</text>
                        <text x="50" y="35" textAnchor="end" fontSize="10" fill="#64748b">{surfaceData.factorY.high_value}</text>
                      </svg>
                    </div>

                    {/* Color Scale Legend */}
                    <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800">Response Range:</span>
                        <span>Low: <strong>{formatNum(surfaceData.minZ, 2)}</strong></span>
                      </div>
                      <div className="w-48 h-3 rounded-full overflow-hidden bg-gradient-to-r from-blue-600 via-teal-500 via-green-400 to-amber-500 border border-gray-300"></div>
                      <div>
                        <span>High: <strong>{formatNum(surfaceData.maxZ, 2)}</strong> {currentResponse?.unit || ''}</span>
                      </div>
                    </div>
                  </div>

                  {Object.keys(surfaceData.fixedFactors).length > 0 && (
                    <div className="text-xs text-gray-500 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                      Fixed other factor settings (held at center point):{' '}
                      {Object.entries(surfaceData.fixedFactors).map(([code, val]) => (
                        <span key={code} className="inline-block mx-1 font-mono font-semibold text-gray-700">
                          {code} = {val.toFixed(2)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* Bottom Workflow Actions */}
          <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <Link
              to="/analysis"
              className="px-5 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
            >
              ← Back to Analysis
            </Link>

            <Link
              to="/optimization"
              className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-md transition flex items-center gap-2"
            >
              <span>Continue to Multi-Response Optimization</span>
              <span>→</span>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
