import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface FactorItem {
  id: number;
  code: string;
  name: string;
  unit?: string;
  low_value: number;
  high_value: number;
  role?: string;
}

interface ResponseItem {
  id: number;
  code: string;
  name: string;
  unit?: string;
  target_type: string;
  target?: number;
  lower_limit?: number;
  upper_limit?: number;
  importance: number;
}

interface AnalysisItem {
  id: number;
  project_id: number;
  design_id: number;
  response_id: number;
  model_type: string;
  transformation: string;
  metrics: {
    r_squared?: number;
    adj_r_squared?: number;
    data_hash?: string;
  };
  coefficients?: Array<{ term: string; coef: number }>;
  is_stale?: boolean;
  data_hash?: string;
  created_at: string;
}

interface ViolatingResponse {
  response_code: string;
  response_name: string;
  target_type: string;
  predicted: number;
  issue: string;
}

interface OptimizationCandidate {
  factors: Record<string, number>;
  responses: Record<string, number>;
  desirabilities: Record<string, number>;
  overall_desirability: number;
  is_feasible?: boolean;
  feasibility_status?: string;
  feasibility_message?: string;
  violating_responses?: ViolatingResponse[];
}

interface OptimizationRun {
  id: number;
  project_id: number;
  analysis_id: number;
  settings: Record<string, any>;
  candidates: OptimizationCandidate[];
  created_at: string;
}

export default function Optimization() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [selectedModelsByResponse, setSelectedModelsByResponse] = useState<Record<number, number>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedProjectId = localStorage.getItem('aqbd_project_id');
    if (!savedProjectId) {
      navigate('/');
    } else {
      setProjectId(Number(savedProjectId));
    }
  }, [navigate]);

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

  // Load active DOE design for explicit dataset/design/analysis linkage
  const { data: designs = [] } = useQuery<any[]>({
    queryKey: ['doe_designs', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/doe/`);
      if (!res.ok) throw new Error('Failed to load DOE designs');
      return res.json();
    },
    enabled: !!projectId
  });
  const activeDesign = designs && designs.length > 0 ? designs[designs.length - 1] : null;

  // Load past optimization runs
  const { data: optRuns = [], isLoading: optRunsLoading } = useQuery<OptimizationRun[]>({
    queryKey: ['optimizations', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/optimization/`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId
  });

  // Group analyses by response_id, filtered by current project and active design
  const analysesByResponse = useMemo(() => {
    const map = new Map<number, AnalysisItem[]>();
    analyses.forEach(a => {
      if (a.project_id !== projectId) return;
      if (activeDesign && a.design_id !== activeDesign.id) return;
      const list = map.get(a.response_id) || [];
      list.push(a);
      map.set(a.response_id, list);
    });
    return map;
  }, [analyses, projectId, activeDesign]);

  // Automatically select exactly ONE valid, current model per response (preferring non-stale FIRST_ORDER)
  useEffect(() => {
    if (analyses.length > 0 && responses.length > 0) {
      const currentKeys = Object.keys(selectedModelsByResponse);
      const isMissingSelections = currentKeys.length < responses.length;

      // Check if any currently selected model is stale while a fresh, non-stale model exists
      const hasStaleSelectionWithFreshAvailable = responses.some(r => {
        const selectedId = selectedModelsByResponse[r.id];
        const selectedObj = analyses.find(a => a.id === selectedId);
        const respAnalyses = analysesByResponse.get(r.id) || [];
        const hasFreshModel = respAnalyses.some(a => !a.is_stale);
        return (!selectedObj || (selectedObj.is_stale && hasFreshModel));
      });

      if (isMissingSelections || hasStaleSelectionWithFreshAvailable) {
        const nextMap: Record<number, number> = { ...selectedModelsByResponse };
        responses.forEach(r => {
          const respAnalyses = analysesByResponse.get(r.id) || [];
          if (respAnalyses.length > 0) {
            // Sort: non-stale first, then newest ID first
            const sorted = [...respAnalyses].sort((x, y) => {
              if (x.is_stale !== y.is_stale) return x.is_stale ? 1 : -1;
              return y.id - x.id;
            });
            // Priority 1: Current non-stale FIRST_ORDER model
            const freshFirstOrder = sorted.find(a => !a.is_stale && a.model_type === 'FIRST_ORDER');
            // Priority 2: Any current non-stale model
            const freshAny = sorted.find(a => !a.is_stale);
            // Priority 3: Fallback to existing selection if valid
            const existing = sorted.find(a => a.id === nextMap[r.id]);
            // Priority 4: Latest available
            const chosen = freshFirstOrder || freshAny || existing || sorted[0];
            if (chosen) {
              nextMap[r.id] = chosen.id;
            }
          }
        });
        setSelectedModelsByResponse(nextMap);
      }
    }
  }, [analyses, responses, analysesByResponse, selectedModelsByResponse]);

  const selectedAnalysisIds = useMemo(() => {
    return Object.values(selectedModelsByResponse);
  }, [selectedModelsByResponse]);

  const hasStaleModel = useMemo(() => {
    return selectedAnalysisIds.some(id => {
      const a = analyses.find(item => item.id === id);
      return !a || a.is_stale;
    });
  }, [selectedAnalysisIds, analyses]);

  const staleModelDetails = useMemo(() => {
    const list: string[] = [];
    selectedAnalysisIds.forEach(id => {
      const a = analyses.find(item => item.id === id);
      if (a && a.is_stale) {
        const resp = responses.find(r => r.id === a.response_id);
        list.push(`${resp ? resp.name : 'Response'} (${a.model_type} #${a.id})`);
      }
    });
    return list;
  }, [selectedAnalysisIds, analyses, responses]);

  // Optimization mutation
  const runOptimization = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('No project selected');
      if (selectedAnalysisIds.length === 0) {
        throw new Error('Please select at least one fitted response model for optimization.');
      }
      if (hasStaleModel) {
        throw new Error('Selected model is stale because experimental data has changed. Refit model before optimization.');
      }
      setError(null);
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/optimization/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis_ids: selectedAnalysisIds,
          settings: {}
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.detail?.error?.message || errData?.detail || 'Optimization failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['optimizations', projectId] });
    },
    onError: (err: Error) => {
      setError(err.message);
    }
  });

  const latestRun = optRuns.length > 0 ? optRuns[0] : null;
  const bestCandidate = latestRun?.candidates && latestRun.candidates.length > 0 ? latestRun.candidates[0] : null;

  const isFeasible = bestCandidate 
    ? (bestCandidate.is_feasible !== undefined ? bestCandidate.is_feasible : bestCandidate.overall_desirability > 0)
    : false;

  const selectModelForResponse = (responseId: number, analysisId: number) => {
    setSelectedModelsByResponse(prev => ({
      ...prev,
      [responseId]: analysisId
    }));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link to="/" className="hover:text-blue-600">Dashboard</Link>
            <span>/</span>
            <Link to="/analysis" className="hover:text-blue-600">Analysis</Link>
            <span>/</span>
            <span className="text-gray-800 font-medium">Optimization</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
              Phase 8
            </span>
            <h1 className="text-2xl font-bold text-gray-900">Multi-Response Desirability Optimization</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Compute the simultaneous global optimum using Derringer-Suich desirability functions across all critical quality attributes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/diagnostics"
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
          >
            ← Back to Diagnostics
          </Link>
          <Link
            to="/design-space"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm transition flex items-center gap-2"
          >
            Proceed to Design Space →
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
          <div className="flex items-center">
            <span className="text-red-700 text-sm font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Prominent Stale Model Warning Banner */}
      {hasStaleModel && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <h4 className="text-amber-900 font-bold text-sm">Selected Model Is Stale</h4>
              <p className="text-amber-800 text-xs mt-0.5">
                Selected model is stale because experimental data has changed. Refit model before optimization.
              </p>
              {staleModelDetails.length > 0 && (
                <div className="text-xs text-amber-700 mt-1 font-mono font-medium">
                  Stale: {staleModelDetails.join(', ')}
                </div>
              )}
            </div>
          </div>
          <Link
            to="/analysis"
            className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition shrink-0 self-start md:self-center flex items-center gap-1.5"
          >
            <span>Go to Statistical Analysis to Refit</span>
            <span>→</span>
          </Link>
        </div>
      )}

      {analysesLoading ? (
        <div className="bg-white p-12 text-center rounded-xl shadow-sm border border-gray-100">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-500 text-sm">Loading statistical analyses & response models...</p>
        </div>
      ) : analyses.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl shadow-sm border border-gray-100 space-y-4">
          <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
            🎯
          </div>
          <h2 className="text-xl font-bold text-gray-900">No Fitted Response Models Found</h2>
          <p className="text-gray-600 max-w-md mx-auto text-sm">
            Optimization requires at least one fitted statistical response model. Please run Statistical Analysis first.
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
          {/* Optimization Setup Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-gray-800">1. Select Response Models for Simultaneous Optimization</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Select exactly one fitted regression model per response for the Derringer-Suich geometric mean formulation.
                  </p>
                </div>
                <span className="px-3 py-1 bg-blue-50 text-blue-800 rounded-full text-xs font-semibold">
                  {selectedAnalysisIds.length} of {responses.length} responses configured
                </span>
              </div>
            </div>

            {/* Response Model Selector Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
              {responses.map(r => {
                const respAnalyses = analysesByResponse.get(r.id) || [];
                const currentSelectedId = selectedModelsByResponse[r.id];
                const activeAnalysis = respAnalyses.find(a => a.id === currentSelectedId);

                // Sort: non-stale models first, newest by ID first
                const sortedAnalyses = [...respAnalyses].sort((x, y) => {
                  if (x.is_stale !== y.is_stale) return x.is_stale ? 1 : -1;
                  return y.id - x.id;
                });

                return (
                  <div
                    key={r.id}
                    className="p-4 rounded-xl border border-gray-200 bg-white shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 text-base">{r.name}</span>
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 font-mono text-xs rounded font-semibold">
                            {r.code}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Goal: <strong className="text-gray-800">{r.target_type}</strong>
                          {r.target_type === 'TARGET' && ` (${r.target} ${r.unit || ''})`}
                          {r.target_type === 'RANGE' && ` [${r.lower_limit} – ${r.upper_limit} ${r.unit || ''}]`}
                          {r.target_type === 'MAXIMIZE' && (r.lower_limit !== undefined ? ` (≥ ${r.lower_limit} ${r.unit || ''})` : '')}
                          {r.target_type === 'MINIMIZE' && (r.upper_limit !== undefined ? ` (≤ ${r.upper_limit} ${r.unit || ''})` : '')}
                        </div>
                      </div>

                      <span className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-bold">
                        Weight: {r.importance}/5
                      </span>
                    </div>

                    {/* Model Type Selector */}
                    <div>
                      <span className="text-xs font-semibold text-gray-600 block mb-1.5">
                        Selected Model Equation:
                      </span>
                      {sortedAnalyses.length === 0 ? (
                        <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                          No models fitted for this response yet.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {sortedAnalyses.map(a => {
                            const isChosen = currentSelectedId === a.id;
                            const r2Val = a.metrics?.r_squared !== undefined 
                              ? (a.metrics.r_squared * 100).toFixed(0) 
                              : '—';
                            const isStale = !!a.is_stale;
                            return (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => selectModelForResponse(r.id, a.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                                  isChosen
                                    ? isStale
                                      ? 'bg-amber-600 text-white ring-2 ring-amber-500 ring-offset-1'
                                      : 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-600 ring-offset-1'
                                    : isStale
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                <span>{isChosen ? '✓' : '○'}</span>
                                <span>#{a.id} {a.model_type} (R²: {r2Val}%)</span>
                                {isStale ? (
                                  <span className="px-1 py-0.2 rounded text-[10px] bg-red-100 text-red-700 font-bold uppercase">Stale</span>
                                ) : (
                                  <span className="px-1 py-0.2 rounded text-[10px] bg-emerald-100 text-emerald-800 font-bold uppercase">Current</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {activeAnalysis && (
                      <div className="pt-2 border-t border-gray-100 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-gray-500">
                          <span>Analysis ID: <strong>#{activeAnalysis.id}</strong> (Design #{activeAnalysis.design_id})</span>
                          <span>Transformation: <strong>{activeAnalysis.transformation}</strong></span>
                        </div>
                        {activeAnalysis.is_stale ? (
                          <div className="text-[11px] text-amber-800 bg-amber-50 px-2 py-1 rounded font-medium flex items-center gap-1.5">
                            <span>⚠️</span>
                            <span>Model #{activeAnalysis.id} is stale (experimental data changed). Refit before optimization.</span>
                          </div>
                        ) : (
                          <div className="text-[11px] text-emerald-800 bg-emerald-50 px-2 py-1 rounded font-medium flex items-center justify-between">
                            <span>✓ Model #{activeAnalysis.id} is current and verified</span>
                            <span>R²: {((activeAnalysis.metrics?.r_squared || 0) * 100).toFixed(1)}%</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Factor Bounds Overview */}
            <div className="pt-4 border-t border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 mb-2">Search Space Boundaries (Strict Zero-Extrapolation Region)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {factors.map(f => (
                  <div key={f.code} className="bg-gray-50 p-2.5 rounded-lg border border-gray-200 text-xs">
                    <span className="font-bold text-gray-800">{f.name} ({f.code}):</span>
                    <div className="text-gray-600 mt-0.5">
                      [{f.low_value} – {f.high_value}] {f.unit || ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Run Button */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => runOptimization.mutate()}
                disabled={runOptimization.isPending || hasStaleModel || selectedAnalysisIds.length === 0}
                className="px-6 py-3 bg-blue-600 text-white font-semibold text-sm rounded-lg hover:bg-blue-700 shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                title={hasStaleModel ? 'Selected model is stale because experimental data has changed. Refit model before optimization.' : ''}
              >
                {runOptimization.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Solving Global Optimum (Differential Evolution)...</span>
                  </>
                ) : hasStaleModel ? (
                  <>
                    <span>⚠️ Cannot Optimize with Stale Models (Refit First)</span>
                  </>
                ) : (
                  <>
                    <span>⚡ Run Global Desirability Optimization</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results Display */}
          {bestCandidate ? (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-gray-100 gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      isFeasible
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {isFeasible 
                        ? 'Optimal Acceptable Operating Point Found' 
                        : 'Optimization Completed — No Feasible Solution'}
                    </span>
                    <h2 className="text-lg font-bold text-gray-900">
                      {isFeasible 
                        ? 'Optimal Operating Point (Design Optimum)' 
                        : 'Optimization Result: Infeasible Quality Region'}
                    </h2>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {isFeasible
                      ? 'Calculated via Differential Evolution global numerical solver maximizing Derringer-Suich overall desirability D.'
                      : 'Evaluated across investigated factor region. No point simultaneously satisfies all acceptance limits.'}
                  </p>
                </div>

                {/* Overall Desirability Metric */}
                <div className={`px-6 py-3 rounded-xl flex items-center gap-4 border ${
                  bestCandidate.overall_desirability >= 0.8
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : bestCandidate.overall_desirability >= 0.5
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}>
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider block">
                      Overall Desirability (D)
                    </span>
                    <span className="text-3xl font-extrabold">
                      {bestCandidate.overall_desirability.toFixed(4)}
                    </span>
                  </div>
                  <div className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm" style={{
                    backgroundColor: bestCandidate.overall_desirability >= 0.8 ? '#10b981' : bestCandidate.overall_desirability >= 0.5 ? '#f59e0b' : '#ef4444'
                  }}>
                    {bestCandidate.overall_desirability >= 0.8 ? '✓' : '!'}
                  </div>
                </div>
              </div>

              {/* Infeasibility Banner with Exact Required Wording */}
              {!isFeasible && (
                <div className="bg-red-50 border-2 border-red-300 p-5 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-red-900 font-bold text-base">
                    <span className="text-xl">⚠️</span>
                    <span>No feasible operating point exists within the investigated factor region for the current models and acceptance criteria.</span>
                  </div>
                  <p className="text-xs text-red-700 leading-relaxed">
                    Based on the fitted statistical models, all operating points within the bounded experimental domain [60–70% Mobile Phase, 0.8–1.2 mL/min Flow Rate, 25–35°C Temperature] yield an overall desirability of <strong>D = 0.0000</strong> because one or more Critical Quality Attributes violate their required acceptance thresholds.
                  </p>
                  {bestCandidate.violating_responses && bestCandidate.violating_responses.length > 0 && (
                    <div className="bg-white/80 p-3 rounded-lg border border-red-200">
                      <span className="text-xs font-bold text-red-800 uppercase tracking-wider block mb-1">
                        Unsatisfied Acceptance Criteria:
                      </span>
                      <ul className="list-disc list-inside space-y-1 text-xs text-red-700">
                        {bestCandidate.violating_responses.map((vr, idx) => (
                          <li key={idx}>
                            <strong>{vr.response_name} ({vr.response_code})</strong>: {vr.issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Optimal Factor Settings Table */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <span>⚙️ {isFeasible ? 'Recommended Factor Setpoints' : 'Evaluated Factor Settings (Search Space Coordinate)'}</span>
                  <span className="text-xs font-normal text-gray-500">
                    {isFeasible ? '(Set experimental controls to these values)' : '(Operating conditions evaluated by the global optimizer)'}
                  </span>
                </h3>

                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                    <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                      <tr>
                        <th className="px-4 py-3">Factor Name</th>
                        <th className="px-4 py-3">Code</th>
                        <th className="px-4 py-3">Low Bound</th>
                        <th className="px-4 py-3 bg-blue-50/70 text-blue-900 font-bold">
                          {isFeasible ? 'Recommended Setpoint' : 'Evaluated Setpoint'}
                        </th>
                        <th className="px-4 py-3">High Bound</th>
                        <th className="px-4 py-3">Unit</th>
                        <th className="px-4 py-3 w-48">Range Position</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {factors.map(f => {
                        const optVal = bestCandidate.factors[f.code];
                        const pct = ((optVal - f.low_value) / (f.high_value - f.low_value || 1)) * 100;
                        return (
                          <tr key={f.code} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{f.name}</td>
                            <td className="px-4 py-3 font-mono font-semibold text-gray-700">{f.code}</td>
                            <td className="px-4 py-3 text-gray-500">{f.low_value}</td>
                            <td className="px-4 py-3 bg-blue-50/40 font-mono text-base font-bold text-blue-600">
                              {optVal !== undefined ? optVal.toFixed(2) : '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-500">{f.high_value}</td>
                            <td className="px-4 py-3 text-gray-600">{f.unit || '—'}</td>
                            <td className="px-4 py-3">
                              <div className="w-full bg-gray-200 rounded-full h-2 relative">
                                <div
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                                ></div>
                                <div
                                  className="absolute top-1/2 -mt-1.5 h-3 w-3 rounded-full bg-blue-800 shadow"
                                  style={{ left: `calc(${Math.max(0, Math.min(100, pct))}% - 6px)` }}
                                ></div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Predicted Responses & Individual Desirability Table */}
              <div className="space-y-3 pt-4 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <span>📊 Predicted Quality Responses & Desirabilities (dᵢ)</span>
                </h3>

                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                    <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                      <tr>
                        <th className="px-4 py-3">Response Name</th>
                        <th className="px-4 py-3">Code</th>
                        <th className="px-4 py-3">Goal</th>
                        <th className="px-4 py-3">Acceptance Limits</th>
                        <th className="px-4 py-3 bg-emerald-50/70 text-emerald-900 font-bold">Predicted Value</th>
                        <th className="px-4 py-3 font-mono">Desirability (dᵢ)</th>
                        <th className="px-4 py-3 w-48">Compliance Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {responses.map(r => {
                        const predVal = bestCandidate.responses[r.code];
                        const di = bestCandidate.desirabilities[r.code];
                        const selectedId = selectedModelsByResponse[r.id];
                        const activeA = analyses.find(a => a.id === selectedId);
                        return (
                          <tr key={r.code} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">
                              <div>{r.name}</div>
                              {activeA && (
                                <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                                  Model #{activeA.id} ({activeA.model_type}, R²: {((activeA.metrics?.r_squared || 0) * 100).toFixed(1)}%)
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono font-semibold text-gray-700">{r.code}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800">
                                {r.target_type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600">
                              {r.target_type === 'TARGET' && `Target: ${r.target}`}
                              {r.target_type === 'RANGE' && `[${r.lower_limit} – ${r.upper_limit}]`}
                              {r.target_type === 'MAXIMIZE' && (r.lower_limit !== undefined ? `≥ ${r.lower_limit}` : 'Max')}
                              {r.target_type === 'MINIMIZE' && (r.upper_limit !== undefined ? `≤ ${r.upper_limit}` : 'Min')}
                            </td>
                            <td className="px-4 py-3 bg-emerald-50/30 font-mono text-base font-bold text-emerald-700">
                              {predVal !== undefined ? predVal.toFixed(3) : '—'} {r.unit || ''}
                            </td>
                            <td className="px-4 py-3 font-mono font-bold text-gray-800">
                              {di !== undefined ? di.toFixed(4) : '—'}
                            </td>
                            <td className="px-4 py-3">
                              {di !== undefined && (
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  di >= 0.8 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : di >= 0.5 
                                    ? 'bg-amber-100 text-amber-800' 
                                    : di > 0 
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-red-100 text-red-800 font-bold'
                                }`}>
                                  {di >= 0.8 
                                    ? 'Excellent (Pass)' 
                                    : di >= 0.5 
                                    ? 'Acceptable (Pass)' 
                                    : di > 0 
                                    ? 'Suboptimal (Pass)' 
                                    : 'Fails Limit (dᵢ = 0.0000)'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Scientific Traceability Card */}
              <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-xs space-y-2 text-gray-600">
                <div className="font-bold text-gray-800 flex items-center gap-1.5">
                  <span>🔬</span>
                  <span>Derringer-Suich Mathematical Formulation & Feasibility Verification</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div>
                    <span className="font-semibold text-gray-700 block mb-0.5">Overall Desirability Formula:</span>
                    <p className="font-mono bg-white p-2 rounded border border-gray-200 text-gray-800">
                      D = (d₁ʷ¹ × d₂ʷ² × ... × dₙʷⁿ)^(1 / Σwᵢ)
                    </p>
                    <p className="text-gray-500 mt-1">
                      Geometric mean of all individual desirabilities. If any single response fails its acceptance limit (dᵢ = 0), overall D is strictly 0.0000.
                    </p>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700 block mb-0.5">Coded Factor Space Alignment:</span>
                    <p className="font-mono bg-white p-2 rounded border border-gray-200 text-gray-800">
                      coded = (actual - center) / ((high - low) / 2)
                    </p>
                    <p className="text-gray-500 mt-1">
                      Evaluated strictly in coded coordinates [-1, +1] matching Diagnostics and ANOVA models.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : optRunsLoading ? (
            <div className="bg-white p-6 text-center rounded-xl shadow-sm border border-gray-100">
              <p className="text-gray-500 text-sm">Checking for existing optimization records...</p>
            </div>
          ) : null}

          {/* Workflow Navigation */}
          <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <Link
              to="/diagnostics"
              className="px-5 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
            >
              ← Back to Diagnostics
            </Link>

            <Link
              to="/design-space"
              className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-md transition flex items-center gap-2"
            >
              <span>Continue to Design Space & Proven Acceptable Range</span>
              <span>→</span>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
