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
}

interface ResponseItem {
  id: number;
  code: string;
  name: string;
  unit?: string;
  target_type: string;
  target?: number | null;
  lower_limit?: number | null;
  upper_limit?: number | null;
  importance?: number | null;
}

interface AnalysisItem {
  id: number;
  project_id: number;
  design_id?: number;
  response_id: number;
  model_type: string;
  transformation: string;
  is_stale?: boolean;
  data_hash?: string;
  metrics?: Record<string, any>;
}

function formatCriteria(resp: ResponseItem): string {
  const unitStr = resp.unit && resp.unit !== '-' ? ` ${resp.unit}` : '';
  if (resp.target_type === 'MAXIMIZE') {
    if (resp.lower_limit !== null && resp.lower_limit !== undefined) {
      return `MAXIMIZE ≥ ${resp.lower_limit}${unitStr}`;
    }
    return `MAXIMIZE`;
  }
  if (resp.target_type === 'MINIMIZE') {
    if (resp.upper_limit !== null && resp.upper_limit !== undefined) {
      return `MINIMIZE ≤ ${resp.upper_limit}${unitStr}`;
    }
    return `MINIMIZE`;
  }
  if (resp.target_type === 'TARGET') {
    if (resp.target !== null && resp.target !== undefined) {
      return `TARGET ${resp.target}${unitStr}`;
    }
    if (resp.lower_limit !== null && resp.upper_limit !== null && resp.lower_limit !== undefined && resp.upper_limit !== undefined) {
      return `TARGET [${resp.lower_limit} – ${resp.upper_limit}]${unitStr}`;
    }
    return `TARGET`;
  }
  if (resp.target_type === 'RANGE') {
    return `RANGE [${resp.lower_limit ?? '—'} to ${resp.upper_limit ?? '—'}]${unitStr}`;
  }
  return resp.target_type || 'Standard';
}

interface GridPoint {
  factors: Record<string, number>;
  acceptable: boolean;
}

interface DesignSpaceData {
  acceptable_points: number;
  unacceptable_points: number;
  plot_data: GridPoint[];
}

interface DesignSpaceItem {
  id: number;
  project_id: number;
  analysis_ids: number[];
  grid_resolution: number;
  space_data: DesignSpaceData;
  created_at: string;
}

export default function DesignSpace() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [selectedResponseIds, setSelectedResponseIds] = useState<number[]>([]);
  const [gridResolution, setGridResolution] = useState<number>(20);
  const [factorXCode, setFactorXCode] = useState<string>('');
  const [factorYCode, setFactorYCode] = useState<string>('');
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

  // Load existing design spaces
  const { data: designSpaces = [], isLoading: spacesLoading } = useQuery<DesignSpaceItem[]>({
    queryKey: ['designSpaces', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/design-space/`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId
  });

  // Deduplicate responses strictly by ID and Code (Resolution Y1, Tailing Factor Y2, Retention Time Y3, Theoretical Plates Y4)
  const uniqueResponses = useMemo(() => {
    const seenIds = new Set<number>();
    const seenCodes = new Set<string>();
    const result: ResponseItem[] = [];

    for (const r of responses) {
      if (!seenIds.has(r.id) && !seenCodes.has(r.code)) {
        seenIds.add(r.id);
        seenCodes.add(r.code);
        result.push(r);
      }
    }

    return result.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }, [responses]);

  // Associate each response with the best active model (non-stale preferred, matching active design if available)
  const getModelForResponse = (responseId: number): AnalysisItem | null => {
    const respAnalyses = analyses.filter(a => a.response_id === responseId);
    if (respAnalyses.length === 0) return null;

    const designAnalyses = activeDesign
      ? respAnalyses.filter(a => a.design_id === activeDesign.id)
      : respAnalyses;
    const pool = designAnalyses.length > 0 ? designAnalyses : respAnalyses;

    const nonStaleFirstOrder = pool.find(a => !a.is_stale && a.model_type === 'FIRST_ORDER');
    if (nonStaleFirstOrder) return nonStaleFirstOrder;

    const nonStale = pool.find(a => !a.is_stale);
    if (nonStale) return nonStale;

    const firstOrder = pool.find(a => a.model_type === 'FIRST_ORDER');
    if (firstOrder) return firstOrder;

    return pool[0];
  };

  // Auto-select all unique responses by default
  useEffect(() => {
    if (uniqueResponses.length > 0 && selectedResponseIds.length === 0) {
      setSelectedResponseIds(uniqueResponses.map(r => r.id));
    }
  }, [uniqueResponses, selectedResponseIds.length]);

  // Setup factor X and Y
  useEffect(() => {
    if (factors.length >= 2) {
      if (!factorXCode) setFactorXCode(factors[0].code);
      if (!factorYCode) setFactorYCode(factors[1].code);
    } else if (factors.length === 1) {
      if (!factorXCode) setFactorXCode(factors[0].code);
    }
  }, [factors, factorXCode, factorYCode]);

  const toggleResponse = (id: number) => {
    setSelectedResponseIds(prev => {
      const set = new Set(prev);
      if (set.has(id)) {
        set.delete(id);
      } else {
        set.add(id);
      }
      return Array.from(set);
    });
  };

  const selectAll = () => {
    setSelectedResponseIds(uniqueResponses.map(r => r.id));
  };

  const deselectAll = () => {
    setSelectedResponseIds([]);
  };

  // Calculate design space mutation
  const calculateSpace = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('No project selected');
      if (selectedResponseIds.length === 0) {
        throw new Error('Please select at least one response constraint to define quality criteria.');
      }
      setError(null);

      // Deduplicate selected response IDs strictly
      const dedupedResponseIds = Array.from(new Set(selectedResponseIds));
      const resolvedAnalysisIds: number[] = [];

      for (const respId of dedupedResponseIds) {
        const model = getModelForResponse(respId);
        if (model) {
          resolvedAnalysisIds.push(model.id);
        } else {
          const resp = uniqueResponses.find(r => r.id === respId);
          throw new Error(`No statistical model found for response ${resp ? resp.name : respId}. Please complete Statistical Analysis first.`);
        }
      }

      // Deduplicate analysis IDs strictly
      const dedupedAnalysisIds = Array.from(new Set(resolvedAnalysisIds));

      const payload = {
        response_ids: dedupedResponseIds,
        analysis_ids: dedupedAnalysisIds,
        constraints: {},
        grid_resolution: gridResolution
      };

      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/design-space/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.detail?.error?.message || errData?.detail || 'Calculation failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['designSpaces', projectId] });
    },
    onError: (err: Error) => {
      setError(err.message);
    }
  });

  const latestSpace = designSpaces.length > 0 ? designSpaces[0] : null;

  const factorX = factors.find(f => f.code === factorXCode);
  const factorY = factors.find(f => f.code === factorYCode);

  const totalPoints = latestSpace ? latestSpace.space_data.acceptable_points + latestSpace.space_data.unacceptable_points : 0;
  const acceptablePct = totalPoints > 0 && latestSpace ? ((latestSpace.space_data.acceptable_points / totalPoints) * 100).toFixed(1) : '0';

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link to="/" className="hover:text-blue-600">Dashboard</Link>
            <span>/</span>
            <Link to="/optimization" className="hover:text-blue-600">Optimization</Link>
            <span>/</span>
            <span className="text-gray-800 font-medium">Design Space</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              Phase 9
            </span>
            <h1 className="text-2xl font-bold text-gray-900">ICH Q8 Design Space & PAR</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Establish the Proven Acceptable Range (PAR) and multidimensional safe operating boundary satisfying all regulatory criteria.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/optimization"
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
          >
            ← Back to Optimization
          </Link>
          <Link
            to="/confirmation"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm transition flex items-center gap-2"
          >
            Proceed to Confirmation Run →
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
          <span className="text-red-700 text-sm font-medium">{error}</span>
        </div>
      )}

      {analysesLoading ? (
        <div className="bg-white p-12 text-center rounded-xl shadow-sm border border-gray-100">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-500 text-sm">Loading model data...</p>
        </div>
      ) : analyses.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl shadow-sm border border-gray-100 space-y-4">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
            📐
          </div>
          <h2 className="text-xl font-bold text-gray-900">No Response Models Available</h2>
          <p className="text-gray-600 max-w-md mx-auto text-sm">
            Design Space calculation relies on response surface models to map acceptable quality regions. Please complete Statistical Analysis first.
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
          {/* Controls & Configuration */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
            <div>
              <h2 className="text-base font-bold text-gray-800">1. Define Quality Constraints & Grid Resolution</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Points inside the design space must simultaneously satisfy the specification criteria for all selected responses.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Response Constraints Checkboxes */}
              <div className="md:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Responses to Include in Safe Operating Window ({selectedResponseIds.length} of {uniqueResponses.length} selected):
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={selectAll}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Select All
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={deselectAll}
                      className="text-gray-500 hover:text-gray-700 font-medium"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {uniqueResponses.map(resp => {
                    const isChecked = selectedResponseIds.includes(resp.id);
                    const model = getModelForResponse(resp.id);
                    const criteriaText = formatCriteria(resp);
                    const r2 = model?.metrics?.r_squared !== undefined 
                      ? `${(model.metrics.r_squared * 100).toFixed(1)}%` 
                      : null;

                    return (
                      <div
                        key={resp.id}
                        onClick={() => toggleResponse(resp.id)}
                        className={`p-3.5 rounded-xl border transition cursor-pointer flex items-start justify-between gap-3 ${
                          isChecked 
                            ? 'border-emerald-500 bg-emerald-50/50 shadow-xs' 
                            : 'border-gray-200 bg-white hover:bg-gray-50 opacity-75'
                        }`}
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded text-xs font-mono font-bold bg-gray-100 text-gray-800 border border-gray-200 shrink-0">
                              {resp.code}
                            </span>
                            <p className="text-sm font-bold text-gray-900 truncate">
                              {resp.name}
                            </p>
                          </div>

                          <div className="text-xs font-semibold text-emerald-800">
                            {criteriaText}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-2xs text-gray-500">
                            {resp.unit && resp.unit !== '-' && <span>Unit: {resp.unit}</span>}
                            <span>Importance: {resp.importance ?? 3}/5</span>
                            {model && (
                              <span className={`px-1.5 py-0.5 rounded font-mono ${
                                model.is_stale ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
                              }`}>
                                Model #{model.id} {r2 ? `(R² ${r2})` : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleResponse(resp.id)}
                          onClick={e => e.stopPropagation()}
                          className="h-4 w-4 mt-1 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer shrink-0"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Grid Resolution & Action */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col justify-between">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Grid Discretization: {gridResolution} × {gridResolution} ({gridResolution * gridResolution} points)
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="35"
                    step="5"
                    value={gridResolution}
                    onChange={e => setGridResolution(Number(e.target.value))}
                    className="w-full h-2 bg-gray-300 rounded-lg cursor-pointer accent-emerald-600"
                  />
                  <div className="flex justify-between text-2xs text-gray-400 mt-1">
                    <span>10 (Fast)</span>
                    <span>20 (Standard)</span>
                    <span>35 (Ultra-fine)</span>
                  </div>
                </div>

                <button
                  onClick={() => calculateSpace.mutate()}
                  disabled={calculateSpace.isPending || selectedResponseIds.length === 0}
                  className="mt-4 w-full py-2.5 bg-emerald-600 text-white font-semibold text-sm rounded-lg hover:bg-emerald-700 shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {calculateSpace.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Simulating Safe Operating Space...</span>
                    </>
                  ) : (
                    <>
                      <span>📐 Compute Design Space Boundary</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Results Card */}
          {latestSpace ? (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
              {/* Metrics Header */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                  <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block">
                    Acceptable Design Space (PAR)
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-extrabold text-emerald-900">
                      {latestSpace.space_data.acceptable_points}
                    </span>
                    <span className="text-sm font-semibold text-emerald-700">
                      ({acceptablePct}% of tested volume)
                    </span>
                  </div>
                </div>

                <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl">
                  <span className="text-xs font-semibold text-rose-800 uppercase tracking-wider block">
                    Unacceptable / Failure Region
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-extrabold text-rose-900">
                      {latestSpace.space_data.unacceptable_points}
                    </span>
                    <span className="text-sm font-semibold text-rose-700">
                      ({(100 - Number(acceptablePct)).toFixed(1)}%)
                    </span>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
                  <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider block">
                    Total Evaluated Grid Vertices
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-extrabold text-blue-900">
                      {totalPoints}
                    </span>
                    <span className="text-sm font-semibold text-blue-700">
                      ({latestSpace.grid_resolution}×{latestSpace.grid_resolution} grid)
                    </span>
                  </div>
                </div>
              </div>

              {/* 2D Design Space Overlay Plot */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-gray-800">
                      Multi-Dimensional Design Space Overlay Map
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Green indicates safe operating combinations meeting all CQA requirements simultaneously. Red marks risk of failure.
                    </p>
                  </div>

                  {factors.length >= 2 && (
                    <div className="flex items-center gap-3">
                      <div>
                        <label className="block text-2xs font-semibold text-gray-500 uppercase">X-Axis Factor</label>
                        <select
                          value={factorXCode}
                          onChange={e => setFactorXCode(e.target.value)}
                          className="px-2.5 py-1 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white"
                        >
                          {factors.map(f => (
                            <option key={f.code} value={f.code} disabled={f.code === factorYCode}>
                              {f.name} ({f.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-2xs font-semibold text-gray-500 uppercase">Y-Axis Factor</label>
                        <select
                          value={factorYCode}
                          onChange={e => setFactorYCode(e.target.value)}
                          className="px-2.5 py-1 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white"
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

                {factorX && factorY ? (
                  <div className="flex flex-col items-center">
                    <div className="w-full max-w-2xl bg-gray-50 p-6 rounded-xl border border-gray-200">
                      <svg viewBox="0 0 500 460" className="w-full h-auto">
                        <defs>
                          <clipPath id="ds-area">
                            <rect x="60" y="30" width="380" height="360" />
                          </clipPath>
                        </defs>

                        {/* Render Grid Points */}
                        <g clipPath="url(#ds-area)">
                          {latestSpace.space_data.plot_data.map((pt, idx) => {
                            const xVal = pt.factors[factorX.code];
                            const yVal = pt.factors[factorY.code];
                            if (xVal === undefined || yVal === undefined) return null;

                            const spanX = (factorX.high_value - factorX.low_value) || 1;
                            const spanY = (factorY.high_value - factorY.low_value) || 1;

                            const cx = 60 + ((xVal - factorX.low_value) / spanX) * 380;
                            const cy = 390 - ((yVal - factorY.low_value) / spanY) * 360;

                            return (
                              <circle
                                key={idx}
                                cx={cx}
                                cy={cy}
                                r={latestSpace.grid_resolution > 20 ? 4 : 6}
                                fill={pt.acceptable ? '#10b981' : '#f87171'}
                                fillOpacity={pt.acceptable ? 0.85 : 0.4}
                                stroke={pt.acceptable ? '#059669' : '#ef4444'}
                                strokeWidth="0.75"
                                className="cursor-pointer hover:r-8 transition-all"
                              >
                                <title>{`${factorX.name}: ${xVal.toFixed(2)}, ${factorY.name}: ${yVal.toFixed(2)} → ${pt.acceptable ? 'ACCEPTABLE (Inside Design Space)' : 'UNACCEPTABLE (Constraint Violated)'}`}</title>
                              </circle>
                            );
                          })}
                        </g>

                        {/* Chart Outline */}
                        <rect x="60" y="30" width="380" height="360" fill="none" stroke="#64748b" strokeWidth="1.5" />

                        {/* X-Axis */}
                        <text x="250" y="425" textAnchor="middle" fontSize="12" fill="#334155" fontWeight="600">
                          {factorX.name} ({factorX.code}) {factorX.unit ? `[${factorX.unit}]` : ''}
                        </text>
                        <text x="60" y="405" textAnchor="middle" fontSize="10" fill="#64748b">{factorX.low_value}</text>
                        <text x="250" y="405" textAnchor="middle" fontSize="10" fill="#64748b">{((factorX.low_value + factorX.high_value) / 2).toFixed(1)}</text>
                        <text x="440" y="405" textAnchor="middle" fontSize="10" fill="#64748b">{factorX.high_value}</text>

                        {/* Y-Axis */}
                        <text
                          x="-210"
                          y="20"
                          transform="rotate(-90)"
                          textAnchor="middle"
                          fontSize="12"
                          fill="#334155"
                          fontWeight="600"
                        >
                          {factorY.name} ({factorY.code}) {factorY.unit ? `[${factorY.unit}]` : ''}
                        </text>
                        <text x="50" y="394" textAnchor="end" fontSize="10" fill="#64748b">{factorY.low_value}</text>
                        <text x="50" y="214" textAnchor="end" fontSize="10" fill="#64748b">{((factorY.low_value + factorY.high_value) / 2).toFixed(1)}</text>
                        <text x="50" y="35" textAnchor="end" fontSize="10" fill="#64748b">{factorY.high_value}</text>
                      </svg>

                      {/* Legend */}
                      <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-center gap-8 text-xs font-semibold">
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 inline-block border border-emerald-600"></span>
                          <span className="text-gray-800">Acceptable Region (Inside Design Space / PAR)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-full bg-rose-400 inline-block border border-rose-500 opacity-60"></span>
                          <span className="text-gray-500">Unacceptable Region (Failure to meet CQA)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Proven Acceptable Range (PAR) & Control Strategy Summary */}
              <div className="space-y-3 pt-4 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-800">
                  Regulatory Proven Acceptable Range (PAR) Table
                </h3>
                <p className="text-xs text-gray-500">
                  Per ICH Q8(R2), movement within the design space does not constitute a post-approval regulatory change.
                </p>

                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                    <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                      <tr>
                        <th className="px-4 py-3">Parameter / Factor</th>
                        <th className="px-4 py-3">Code</th>
                        <th className="px-4 py-3">Unit</th>
                        <th className="px-4 py-3 bg-emerald-50/70 text-emerald-900 font-bold">Proven Acceptable Range (PAR)</th>
                        <th className="px-4 py-3 bg-blue-50/70 text-blue-900 font-bold">Target Operating Setpoint (NOR)</th>
                        <th className="px-4 py-3">ICH Q8 Classification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {factors.map(f => {
                        const mid = (f.low_value + f.high_value) / 2.0;
                        const norSpan = (f.high_value - f.low_value) * 0.1;
                        return (
                          <tr key={f.code} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{f.name}</td>
                            <td className="px-4 py-3 font-mono font-semibold text-gray-700">{f.code}</td>
                            <td className="px-4 py-3 text-gray-600">{f.unit || '—'}</td>
                            <td className="px-4 py-3 bg-emerald-50/30 font-mono font-bold text-emerald-800">
                              {f.low_value} – {f.high_value}
                            </td>
                            <td className="px-4 py-3 bg-blue-50/30 font-mono font-bold text-blue-800">
                              {mid.toFixed(2)} ± {norSpan.toFixed(2)}
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                                Critical Process Parameter (CPP)
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : spacesLoading ? (
            <div className="bg-white p-6 text-center rounded-xl shadow-sm border border-gray-100">
              <p className="text-gray-500 text-sm">Checking for existing design space...</p>
            </div>
          ) : null}

          {/* Workflow Footer */}
          <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <Link
              to="/optimization"
              className="px-5 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
            >
              ← Back to Optimization
            </Link>

            <Link
              to="/confirmation"
              className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-md transition flex items-center gap-2"
            >
              <span>Continue to Confirmation Run</span>
              <span>→</span>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
