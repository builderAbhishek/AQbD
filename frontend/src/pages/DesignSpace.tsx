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

interface ProjectedRange {
  min: number | null;
  max: number | null;
  investigated_min: number;
  investigated_max: number;
  is_full_investigated_range: boolean;
}

interface OptPointCheck {
  has_optimization?: boolean;
  run_id?: number;
  is_inside: boolean;
  violations?: string[];
  factor_values?: Record<string, number>;
  predictions?: Record<string, any>;
  cqa_results?: Record<string, { predicted: number; desirability: number; acceptable: boolean }>;
  setpoints?: Record<string, number>;
  optimization_id?: number;
  overall_desirability?: number;
  reason?: string;
  is_on_active_slice?: boolean;
  slice_diffs?: Record<string, number>;
}

interface SliceData {
  axis_x: string;
  axis_y: string;
  fixed_factors: Record<string, number>;
  slice_label: string;
  acceptable_points: number;
  unacceptable_points: number;
  total_points: number;
  feasible_percentage: number;
  plot_data: GridPoint[];
}

interface DesignSpaceData {
  dimension?: number;
  total_3d_points?: number;
  acceptable_3d_points?: number;
  unacceptable_3d_points?: number;
  feasible_3d_percentage?: number;
  is_entire_3d_range_acceptable?: boolean;
  projected_ranges_3d?: Record<string, ProjectedRange>;

  acceptable_points: number;
  unacceptable_points: number;
  total_points?: number;
  is_entire_range_acceptable?: boolean;
  projected_ranges?: Record<string, ProjectedRange>;
  optimization_point_check?: OptPointCheck | null;
  slice_data?: SliceData;
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
  const [gridResolution3D, setGridResolution3D] = useState<number>(20);
  const [factorXCode, setFactorXCode] = useState<string>('');
  const [factorYCode, setFactorYCode] = useState<string>('');
  const [fixedFactorVals, setFixedFactorVals] = useState<Record<string, number>>({});
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

  // Load past optimization runs to get the scientifically derived optimal setpoints (NOR Target)
  const { data: optRuns = [] } = useQuery<any[]>({
    queryKey: ['optimizations', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/optimization/`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId
  });
  const latestOptRun = optRuns.length > 0 ? optRuns[0] : null;
  const bestCandidate = latestOptRun?.candidates && latestOptRun.candidates.length > 0 ? latestOptRun.candidates[0] : null;

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

  // Setup factor X, Y, and default fixed factors for slice
  useEffect(() => {
    if (factors.length >= 2) {
      if (!factorXCode) setFactorXCode(factors[0].code);
      if (!factorYCode) setFactorYCode(factors[1].code);
    } else if (factors.length === 1) {
      if (!factorXCode) setFactorXCode(factors[0].code);
    }

    // Default fixed factors for slice if 3 factors
    if (factors.length >= 3 && Object.keys(fixedFactorVals).length === 0) {
      const fixedCode = factors[2].code;
      const mid = (factors[2].low_value + factors[2].high_value) / 2.0;
      setFixedFactorVals({ [fixedCode]: mid });
    }
  }, [factors, factorXCode, factorYCode, fixedFactorVals]);

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

  // Calculate design space mutation (computes both full 3D space and 2D slice)
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
        grid_resolution: gridResolution,
        grid_resolution_3d: gridResolution3D,
        slice_axis_x: factorXCode || undefined,
        slice_axis_y: factorYCode || undefined,
        fixed_factors: fixedFactorVals
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
  const optFactors: Record<string, number> = 
    bestCandidate?.factors || 
    latestSpace?.space_data?.optimization_point_check?.setpoints || 
    latestSpace?.space_data?.optimization_point_check?.factor_values || 
    {};

  // Full 3D Multidimensional Design Space Metrics
  const total3D = latestSpace?.space_data?.total_3d_points ?? latestSpace?.space_data?.total_points ?? 0;
  const acc3D = latestSpace?.space_data?.acceptable_3d_points ?? latestSpace?.space_data?.acceptable_points ?? 0;
  const unacc3D = latestSpace?.space_data?.unacceptable_3d_points ?? latestSpace?.space_data?.unacceptable_points ?? 0;
  const feasible3DPct = latestSpace?.space_data?.feasible_3d_percentage !== undefined 
    ? latestSpace.space_data.feasible_3d_percentage.toFixed(1)
    : (total3D > 0 ? ((acc3D / total3D) * 100).toFixed(1) : '0');

  // 2D Cross-Sectional Slice Metrics
  const sliceData = latestSpace?.space_data?.slice_data;
  const sliceAcc = sliceData?.acceptable_points ?? (latestSpace?.space_data?.plot_data ? latestSpace.space_data.plot_data.filter(p => p.acceptable).length : 0);
  const sliceTotal = sliceData?.total_points ?? (latestSpace?.space_data?.plot_data?.length || 0);
  const sliceUnacc = sliceData?.unacceptable_points ?? (sliceTotal - sliceAcc);
  const slicePct = sliceData?.feasible_percentage !== undefined 
    ? sliceData.feasible_percentage.toFixed(1) 
    : (sliceTotal > 0 ? ((sliceAcc / sliceTotal) * 100).toFixed(1) : '0');

  // Active slice factors & fixed factor
  const factorX = factors.find(f => f.code === (sliceData?.axis_x || factorXCode));
  const factorY = factors.find(f => f.code === (sliceData?.axis_y || factorYCode));
  const fixedFactor = factors.find(f => f.code !== factorX?.code && f.code !== factorY?.code);
  const currentFixedVal = fixedFactor 
    ? (sliceData?.fixed_factors?.[fixedFactor.code] ?? fixedFactorVals[fixedFactor.code] ?? (fixedFactor.low_value + fixedFactor.high_value) / 2.0)
    : undefined;

  const sliceLabel = sliceData?.slice_label || (
    fixedFactor && currentFixedVal !== undefined
      ? `2D Slice at Fixed ${fixedFactor.name} (${fixedFactor.code}) = ${currentFixedVal.toFixed(2)}${fixedFactor.unit || ''}`
      : '2D Design Space Slice'
  );

  // True 3D projected ranges (from full 3D grid, NOT 30-30 for C!)
  const projectedRanges = useMemo(() => {
    if (!latestSpace?.space_data) return {};
    if (latestSpace.space_data.projected_ranges_3d) {
      return latestSpace.space_data.projected_ranges_3d;
    }
    if (latestSpace.space_data.projected_ranges) {
      return latestSpace.space_data.projected_ranges;
    }
    return {};
  }, [latestSpace]);

  // Optimal setpoints for 2D plot projection
  const optX = factorX ? optFactors[factorX.code] : undefined;
  const optY = factorY ? optFactors[factorY.code] : undefined;
  const spanX = factorX ? ((factorX.high_value - factorX.low_value) || 1) : 1;
  const spanY = factorY ? ((factorY.high_value - factorY.low_value) || 1) : 1;
  const optCx = factorX && optX !== undefined ? (60 + ((optX - factorX.low_value) / spanX) * 380) : null;
  const optCy = factorY && optY !== undefined ? (390 - ((optY - factorY.low_value) / spanY) * 360) : null;

  const optCheck = latestSpace?.space_data?.optimization_point_check;
  const isOptInside = optCheck ? optCheck.is_inside : true;
  const isOnSlice = optCheck?.is_on_active_slice ?? false;

  const handleFixedFactorChange = (code: string, val: number) => {
    setFixedFactorVals(prev => ({ ...prev, [code]: val }));
  };

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
            Establish the full 3D Proven Acceptable Range (PAR) and multidimensional safe operating boundary satisfying all regulatory criteria.
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
              <h2 className="text-base font-bold text-gray-800">1. Quality Constraints & Multi-Dimensional Grid Resolution</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Evaluates both the complete 3D factor volume ({factors.map(f => f.code).join(' × ')}) and interactive 2D cross-sectional slices.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Response Constraints Checkboxes */}
              <div className="md:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Responses in Safe Operating Window ({selectedResponseIds.length} of {uniqueResponses.length} selected):
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
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Full 3D Volume Discretization: {gridResolution3D}³ ({gridResolution3D * gridResolution3D * gridResolution3D} vertices)
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="25"
                      step="5"
                      value={gridResolution3D}
                      onChange={e => setGridResolution3D(Number(e.target.value))}
                      className="w-full h-2 bg-gray-300 rounded-lg cursor-pointer accent-emerald-600"
                    />
                    <div className="flex justify-between text-2xs text-gray-400 mt-0.5">
                      <span>10³ (1k)</span>
                      <span>15³ (3.4k)</span>
                      <span>20³ (8k standard)</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      2D Slice Mesh: {gridResolution} × {gridResolution} ({gridResolution * gridResolution} vertices)
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="35"
                      step="5"
                      value={gridResolution}
                      onChange={e => setGridResolution(Number(e.target.value))}
                      className="w-full h-2 bg-gray-300 rounded-lg cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between text-2xs text-gray-400 mt-0.5">
                      <span>10 (100)</span>
                      <span>20 (400 standard)</span>
                      <span>35 (1.2k)</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => calculateSpace.mutate()}
                  disabled={calculateSpace.isPending || selectedResponseIds.length === 0}
                  className="w-full py-2.5 bg-emerald-600 text-white font-semibold text-sm rounded-lg hover:bg-emerald-700 shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {calculateSpace.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Simulating 3D Design Space...</span>
                    </>
                  ) : (
                    <>
                      <span>📐 Compute Full 3D Design Space & Slice</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Results Section */}
          {latestSpace ? (
            <div className="space-y-6">
              {/* Target Operating Setpoint (NOR) 3D Verification Card */}
              {(optCheck?.has_optimization || bestCandidate) && (
                <div className={`bg-white p-5 rounded-xl border shadow-sm ${
                  isOptInside 
                    ? 'border-blue-200 bg-blue-50/40' 
                    : 'border-amber-200 bg-amber-50/40'
                }`}>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          isOptInside
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}>
                          {isOptInside
                            ? '✓ TARGET OPERATING SETPOINT IS INSIDE 3D DESIGN SPACE'
                            : '⚠ TARGET OPERATING SETPOINT OUTSIDE 3D ACCEPTABLE REGION'}
                        </span>
                        <span className="text-xs text-gray-500 font-medium">
                          Source: Multi-Response Desirability Run #{optCheck?.optimization_id || optCheck?.run_id || latestOptRun?.id}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700">
                        The optimal setpoint simultaneously satisfies all {selectedResponseIds.length} CQA criteria across the complete 3D factor volume with zero extrapolation.
                      </p>
                      <div className="text-xs font-semibold">
                        {isOnSlice ? (
                          <span className="text-emerald-700 font-medium flex items-center gap-1">
                            <span>✓ Setpoint lies directly on the active 2D cross-section plane ({sliceLabel})</span>
                          </span>
                        ) : (
                          <span className="text-blue-700 font-medium flex items-center gap-1">
                            <span>ℹ Viewing 2D cross-section at a parallel slice. (Optimal setpoint is verified in 3D).</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-bold shrink-0">
                      {factors.map(f => {
                        const val = optFactors[f.code];
                        if (val === undefined) return null;
                        return (
                          <span key={f.code} className="px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg shadow-2xs text-blue-900">
                            {f.code}: {val.toFixed(2)} {f.unit ? f.unit : ''}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Section 1: Full 3D Multidimensional Design Space Summary */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-800">
                        3D VOLUME
                      </span>
                      <h2 className="text-base font-bold text-gray-900">
                        Full 3-Dimensional Design Space (A × B × C)
                      </h2>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Evaluated simultaneously across the full investigated DOE bounds: {factors.map(f => `${f.name} ${f.code}: [${f.low_value} – ${f.high_value}${f.unit || ''}]`).join(', ')}.
                    </p>
                  </div>
                  <span className="text-xs font-medium text-gray-500">
                    Zero extrapolation outside DOE volume
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                    <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block">
                      3D Acceptable Design Space (PAR)
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-3xl font-extrabold text-emerald-900">
                        {acc3D.toLocaleString()}
                      </span>
                      <span className="text-sm font-semibold text-emerald-700">
                        ({feasible3DPct}% of 3D volume)
                      </span>
                    </div>
                    <p className="text-2xs text-emerald-800 mt-1 font-medium">
                      Simultaneously satisfies all CQAs across full 3-factor volume
                    </p>
                  </div>

                  <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl">
                    <span className="text-xs font-semibold text-rose-800 uppercase tracking-wider block">
                      3D Unacceptable / Risk Region
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-3xl font-extrabold text-rose-900">
                        {unacc3D.toLocaleString()}
                      </span>
                      <span className="text-sm font-semibold text-rose-700">
                        ({(100 - Number(feasible3DPct)).toFixed(1)}%)
                      </span>
                    </div>
                    <p className="text-2xs text-rose-800 mt-1 font-medium">
                      Violates at least 1 CQA specification
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
                    <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider block">
                      Total 3D Evaluated Vertices
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-3xl font-extrabold text-blue-900">
                        {total3D.toLocaleString()}
                      </span>
                      <span className="text-sm font-semibold text-blue-700">
                        ({gridResolution3D}³ zero-extrapolation mesh)
                      </span>
                    </div>
                    <p className="text-2xs text-blue-800 mt-1 font-medium">
                      Discrete 3D grid covering entire DOE search bounds
                    </p>
                  </div>
                </div>
              </div>

              {/* Section 2: Interactive 2D Cross-Sectional Slice Viewer */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-gray-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800">
                        2D CROSS-SECTION
                      </span>
                      <h3 className="text-base font-bold text-gray-900">
                        {sliceLabel}
                      </h3>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Visual cross-section showing safe operating combinations ({sliceAcc} of {sliceTotal} points, {slicePct}% acceptable on this slice).
                    </p>
                  </div>

                  {/* Interactive Slice Controls */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div>
                      <label className="block text-2xs font-semibold text-gray-500 uppercase">X-Axis</label>
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
                      <label className="block text-2xs font-semibold text-gray-500 uppercase">Y-Axis</label>
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

                    {/* Fixed Factor Elevation Selector */}
                    {fixedFactor && (
                      <div>
                        <label className="block text-2xs font-semibold text-gray-500 uppercase">
                          Fixed {fixedFactor.name} ({fixedFactor.code})
                        </label>
                        <div className="flex items-center gap-1.5">
                          <select
                            value={currentFixedVal !== undefined ? currentFixedVal : (fixedFactor.low_value + fixedFactor.high_value) / 2.0}
                            onChange={e => handleFixedFactorChange(fixedFactor.code, Number(e.target.value))}
                            className="px-2.5 py-1 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white font-mono"
                          >
                            <option value={fixedFactor.low_value}>
                              {fixedFactor.low_value.toFixed(1)} {fixedFactor.unit || ''} (Low bound)
                            </option>
                            <option value={(fixedFactor.low_value + fixedFactor.high_value) / 2.0}>
                              {((fixedFactor.low_value + fixedFactor.high_value) / 2.0).toFixed(1)} {fixedFactor.unit || ''} (Center)
                            </option>
                            {optFactors[fixedFactor.code] !== undefined && (
                              <option value={optFactors[fixedFactor.code]}>
                                {optFactors[fixedFactor.code].toFixed(2)} {fixedFactor.unit || ''} (NOR Target)
                              </option>
                            )}
                            <option value={fixedFactor.high_value}>
                              {fixedFactor.high_value.toFixed(1)} {fixedFactor.unit || ''} (High bound)
                            </option>
                          </select>

                          <button
                            type="button"
                            onClick={() => calculateSpace.mutate()}
                            disabled={calculateSpace.isPending}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 transition"
                          >
                            Update Slice
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Slice Feasibility Banner */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs">
                  <div className="flex items-center gap-4">
                    <span className="text-gray-600 font-medium">
                      Slice Feasibility: <strong className="text-emerald-700">{sliceAcc} / {sliceTotal} points ({slicePct}%)</strong>
                    </span>
                    <span className="text-gray-400">|</span>
                    <span className="text-gray-600 font-medium">
                      Failure on Slice: <strong className="text-rose-700">{sliceUnacc} points ({(100 - Number(slicePct)).toFixed(1)}%)</strong>
                    </span>
                  </div>
                  <span className="text-gray-500 font-mono text-2xs">
                    Slice Resolution: {latestSpace.grid_resolution} × {latestSpace.grid_resolution}
                  </span>
                </div>

                {/* 2D SVG Map */}
                {factorX && factorY ? (
                  <div className="flex flex-col items-center">
                    <div className="w-full max-w-2xl bg-gray-50 p-6 rounded-xl border border-gray-200">
                      <svg viewBox="0 0 500 460" className="w-full h-auto">
                        <defs>
                          <clipPath id="ds-area">
                            <rect x="60" y="30" width="380" height="360" />
                          </clipPath>
                        </defs>

                        {/* Render Slice Grid Points */}
                        <g clipPath="url(#ds-area)">
                          {(latestSpace.space_data.plot_data || []).map((pt, idx) => {
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
                                <title>{`${factorX.name}: ${xVal.toFixed(2)}, ${factorY.name}: ${yVal.toFixed(2)} → ${pt.acceptable ? 'ACCEPTABLE on this slice' : 'UNACCEPTABLE (Constraint Violated)'}`}</title>
                              </circle>
                            );
                          })}
                        </g>

                        {/* Optimal Operating Setpoint (NOR Target) Overlay */}
                        {optCx !== null && optCy !== null && (
                          <g>
                            <circle
                              cx={optCx}
                              cy={optCy}
                              r={isOnSlice ? 11 : 9}
                              fill="none"
                              stroke={isOnSlice ? "#2563eb" : "#64748b"}
                              strokeWidth={isOnSlice ? "2.5" : "1.5"}
                              strokeDasharray={isOnSlice ? "3,2" : "2,2"}
                            />
                            <circle
                              cx={optCx}
                              cy={optCy}
                              r={isOnSlice ? 5 : 3.5}
                              fill={isOnSlice ? "#2563eb" : "#64748b"}
                              stroke="#ffffff"
                              strokeWidth="1.5"
                            />
                            <text
                              x={optCx + 12}
                              y={optCy + 4}
                              fontSize="11"
                              fontWeight="bold"
                              fill={isOnSlice ? "#1e40af" : "#475569"}
                            >
                              {isOnSlice 
                                ? `NOR Target (${optX?.toFixed(2)}, ${optY?.toFixed(2)})`
                                : `Projected NOR (${optX?.toFixed(2)}, ${optY?.toFixed(2)})`}
                            </text>
                          </g>
                        )}

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
                      <div className="mt-4 pt-3 border-t border-gray-200 flex flex-wrap items-center justify-center gap-6 text-xs font-semibold">
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 inline-block border border-emerald-600"></span>
                          <span className="text-gray-800">Acceptable Region (on this 2D slice)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-full bg-rose-400 inline-block border border-rose-500 opacity-60"></span>
                          <span className="text-gray-500">Unacceptable (CQA Violated)</span>
                        </div>
                        {optCx !== null && optCy !== null && (
                          <div className="flex items-center gap-2">
                            <span className={`w-3.5 h-3.5 rounded-full inline-block border-2 ${
                              isOnSlice ? 'bg-blue-600 border-dashed border-blue-400' : 'bg-gray-400 border-dotted border-gray-600'
                            }`}></span>
                            <span className={isOnSlice ? 'text-blue-900 font-bold' : 'text-gray-600 font-medium'}>
                              {isOnSlice ? 'Optimal Operating Setpoint (NOR Target)' : 'Projected NOR (Different Elevation)'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Section 3: ICH Q8(R2) Proven Acceptable Range (PAR) Table */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-gray-800">
                      ICH Q8(R2) Proven Acceptable Range (PAR) & Control Strategy
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Derived from full 3D multidimensional evaluation ({acc3D.toLocaleString()} of {total3D.toLocaleString()} vertices acceptable).
                    </p>
                  </div>
                </div>

                {/* Regulatory Science Notice on Multidimensional Coupling */}
                <div className="bg-amber-50/80 border-l-4 border-amber-500 p-4 rounded-r-xl space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-900 font-bold text-xs uppercase tracking-wide">
                      ⚠ Regulatory Science Note: Multidimensional Coupling & 1D Projected Spans
                    </span>
                  </div>
                  <p className="text-xs text-amber-900 leading-relaxed">
                    Because {unacc3D.toLocaleString()} of the {total3D.toLocaleString()} evaluated 3D vertices ({(100 - Number(feasible3DPct)).toFixed(1)}%) fail to meet all CQA criteria simultaneously, the full investigated factor bounds do <strong>not</strong> constitute an unconstrained Design Space.
                    The <strong>True 3D Projected Feasible Spans</strong> below represent the extreme single-parameter envelope of all acceptable points across the 3-dimensional volume. <strong>They cannot be treated as an uncoupled Cartesian box</strong>; operating at extreme limits simultaneously may produce out-of-specification results. Operating setpoints must remain within the multidimensional coupled boundary.
                  </p>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-2xs">
                  <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                    <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                      <tr>
                        <th className="px-4 py-3">Parameter / Factor</th>
                        <th className="px-4 py-3">Code</th>
                        <th className="px-4 py-3">Unit</th>
                        <th className="px-4 py-3 bg-gray-100/70 text-gray-800 font-bold">Investigated DOE Range</th>
                        <th className="px-4 py-3 bg-blue-50/70 text-blue-900 font-bold">Target Operating Setpoint (NOR)</th>
                        <th className="px-4 py-3 bg-emerald-50/70 text-emerald-900 font-bold">True 3D Projected Feasible Span</th>
                        <th className="px-4 py-3">Design Space Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {factors.map(f => {
                        const proj = projectedRanges[f.code];
                        const optVal = optFactors[f.code];
                        const hasOpt = optVal !== undefined;

                        return (
                          <tr key={f.code} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{f.name}</td>
                            <td className="px-4 py-3 font-mono font-semibold text-gray-700">{f.code}</td>
                            <td className="px-4 py-3 text-gray-600">{f.unit || '—'}</td>
                            <td className="px-4 py-3 bg-gray-50/50 font-mono text-gray-700">
                              {f.low_value} – {f.high_value}
                              <div className="text-3xs text-gray-400 font-sans font-normal">Investigated boundary</div>
                            </td>
                            <td className="px-4 py-3 bg-blue-50/30">
                              {hasOpt ? (
                                <div>
                                  <span className="font-mono font-bold text-blue-900">
                                    {optVal.toFixed(2)} {f.unit ? f.unit : ''}
                                  </span>
                                  <div className="text-3xs text-blue-700 font-medium">
                                    Optimization Run #{optCheck?.optimization_id || optCheck?.run_id || latestOptRun?.id}
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <span className="font-mono font-medium text-gray-500">
                                    {((f.low_value + f.high_value) / 2).toFixed(2)}
                                  </span>
                                  <div className="text-3xs text-gray-400">Midpoint default</div>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 bg-emerald-50/30">
                              {proj && proj.min !== null && proj.max !== null ? (
                                <div>
                                  <span className="font-mono font-bold text-emerald-900">
                                    {proj.min.toFixed(2)} – {proj.max.toFixed(2)}
                                  </span>
                                  <div className="text-3xs text-emerald-700">
                                    {proj.is_full_investigated_range 
                                      ? 'Full investigated range' 
                                      : 'Envelope of 3D feasible volume'}
                                  </div>
                                </div>
                              ) : (
                                <span className="font-mono text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                                3D Coupled Region ({feasible3DPct}% Feasible)
                              </span>
                              <div className="text-3xs text-gray-500 mt-0.5">Critical Process Parameter (CPP)</div>
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
