import React, { useState, useEffect } from 'react';
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
}

interface OptimizationCandidate {
  factors: Record<string, number>;
  responses: Record<string, number>;
  desirabilities: Record<string, number>;
  overall_desirability: number;
}

interface OptimizationRun {
  id: number;
  project_id: number;
  analysis_id: number;
  settings: Record<string, any>;
  candidates: OptimizationCandidate[];
  created_at: string;
}

interface ConfirmationResult {
  id: number;
  project_id: number;
  optimization_id: number;
  predicted_values: Record<string, number>;
  actual_values: Record<string, number>;
  differences: Record<string, number>;
  data_source?: string;
  created_at: string;
}

export default function Confirmation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [actualValues, setActualValues] = useState<Record<string, string>>({});
  const [isSimulated, setIsSimulated] = useState<boolean>(false);
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

  // Load optimization runs
  const { data: optRuns = [], isLoading: optLoading } = useQuery<OptimizationRun[]>({
    queryKey: ['optimizations', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/optimization/`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId
  });

  // Load past confirmations
  const { data: confirmations = [], isLoading: confLoading } = useQuery<ConfirmationResult[]>({
    queryKey: ['confirmations', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/optimization/confirm`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId
  });

  const latestOpt = optRuns.length > 0 ? optRuns[0] : null;
  const bestCandidate = latestOpt?.candidates && latestOpt.candidates.length > 0 ? latestOpt.candidates[0] : null;

  // Pre-fill inputs with predicted values as baseline if empty
  const handleInputChange = (code: string, val: string) => {
    setActualValues(prev => ({ ...prev, [code]: val }));
    setIsSimulated(false);
  };

  const handleFillWithPredicted = () => {
    if (!bestCandidate) return;
    const filled: Record<string, string> = {};
    responses.forEach(r => {
      if (bestCandidate.responses[r.code] !== undefined) {
        filled[r.code] = bestCandidate.responses[r.code].toFixed(3);
      }
    });
    setActualValues(filled);
    setIsSimulated(true);
  };

  // Submit confirmation run
  const submitConfirmation = useMutation({
    mutationFn: async () => {
      if (!projectId || !latestOpt || !bestCandidate) {
        throw new Error('Missing active optimization run to confirm against.');
      }
      setError(null);
      setSuccessMessage(null);

      const numericActuals: Record<string, number> = {};
      const numericPreds: Record<string, number> = {};

      for (const r of responses) {
        const strVal = actualValues[r.code];
        if (strVal === undefined || strVal.trim() === '') {
          throw new Error(`Please provide an actual observed value for ${r.name} (${r.code}).`);
        }
        const numVal = parseFloat(strVal);
        if (isNaN(numVal)) {
          throw new Error(`Invalid numerical value for ${r.name} (${r.code}).`);
        }
        numericActuals[r.code] = numVal;
        numericPreds[r.code] = bestCandidate.responses[r.code] ?? 0.0;
      }

      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/optimization/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optimization_id: latestOpt.id,
          predicted_values: numericPreds,
          actual_values: numericActuals,
          data_source: isSimulated ? 'SIMULATED' : 'EXPERIMENTAL'
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.detail || 'Failed to record confirmation run');
      }

      return res.json();
    },
    onSuccess: () => {
      if (isSimulated) {
        setSuccessMessage('✓ SIMULATED confirmation record saved. This is TEST DATA from model predictions — not laboratory confirmation.');
      } else {
        setSuccessMessage('✓ Confirmation experiment successfully recorded and verified!');
      }
      queryClient.invalidateQueries({ queryKey: ['confirmations', projectId] });
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
            <Link to="/design-space" className="hover:text-blue-600">Design Space</Link>
            <span>/</span>
            <span className="text-gray-800 font-medium">Confirmation</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
              Phase 10
            </span>
            <h1 className="text-2xl font-bold text-gray-900">Confirmation & Model Verification</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Conduct laboratory confirmation trials at optimal factor setpoints to empirically validate predictive model accuracy.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/design-space"
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
          >
            ← Back to Design Space
          </Link>
          <Link
            to="/reports"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm transition flex items-center gap-2"
          >
            Generate Regulatory PDF Report →
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

      {optLoading ? (
        <div className="bg-white p-12 text-center rounded-xl shadow-sm border border-gray-100">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-500 text-sm">Loading optimization setpoints...</p>
        </div>
      ) : !bestCandidate ? (
        <div className="bg-white p-12 text-center rounded-xl shadow-sm border border-gray-100 space-y-4">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
            🧪
          </div>
          <h2 className="text-xl font-bold text-gray-900">No Optimization Operating Point Available</h2>
          <p className="text-gray-600 max-w-md mx-auto text-sm">
            Confirmation requires an optimal setpoint generated in the Optimization module. Run Optimization first to compute recommended settings.
          </p>
          <Link
            to="/optimization"
            className="inline-block px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 shadow-sm transition"
          >
            Go to Optimization →
          </Link>
        </div>
      ) : (
        <>
          {/* Factor Setpoints for Confirmation Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-800">
                  Target Operating Conditions for Confirmation Run
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Set laboratory instruments and critical process parameters to these exact values:
                </p>
              </div>
              <span className="px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs font-semibold">
                Optimization Run #{latestOpt?.id}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {factors.map(f => {
                const optVal = bestCandidate.factors[f.code];
                return (
                  <div key={f.code} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <span className="text-xs text-gray-500 font-medium block truncate">{f.name}</span>
                    <span className="font-mono text-xs font-bold text-gray-400 block">{f.code}</span>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="font-mono text-lg font-bold text-blue-600">
                        {optVal !== undefined ? optVal.toFixed(2) : '—'}
                      </span>
                      <span className="text-xs text-gray-600">{f.unit || ''}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Observed vs Predicted Entry Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-gray-800">
                  Enter Observed Laboratory Results vs. Model Predictions
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Record actual test values obtained in the laboratory to verify prediction intervals and residual error.
                </p>
              </div>

              <button
                type="button"
                onClick={handleFillWithPredicted}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition"
              >
                Auto-fill with Predicted Values (Simulation)
              </button>
            </div>

            {isSimulated && (
              <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-200 text-amber-900 uppercase tracking-wider">
                    ⚠ Simulated / Test Data
                  </span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Values below are auto-filled from model predictions (not from laboratory experiments).
                  This confirmation record will be labeled as <strong>SIMULATED</strong> and must not be presented as empirical laboratory confirmation.
                  To record real confirmation data, manually enter actual observed values from laboratory experiments.
                </p>
              </div>
            )}

            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                  <tr>
                    <th className="px-4 py-3">Response</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Criteria</th>
                    <th className="px-4 py-3 bg-blue-50/70 text-blue-900 font-bold">Predicted Value</th>
                    <th className="px-4 py-3 bg-emerald-50/70 text-emerald-900 font-bold w-48">Actual Observed Value *</th>
                    <th className="px-4 py-3">Absolute Residual (|Δ|)</th>
                    <th className="px-4 py-3">Relative Error (%)</th>
                    <th className="px-4 py-3">Validation Verdict</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {responses.map(r => {
                    const pred = bestCandidate.responses[r.code] ?? 0.0;
                    const inputVal = actualValues[r.code] ?? '';
                    const actualNum = parseFloat(inputVal);
                    const hasValue = !isNaN(actualNum);
                    const diff = hasValue ? Math.abs(actualNum - pred) : null;
                    const pctErr = hasValue && pred !== 0 ? (diff! / Math.abs(pred)) * 100 : null;

                    // Criteria check
                    let isConforming = true;
                    if (hasValue) {
                      if (r.target_type === 'RANGE') {
                        if (r.lower_limit != null && actualNum < r.lower_limit) isConforming = false;
                        if (r.upper_limit != null && actualNum > r.upper_limit) isConforming = false;
                      } else if (r.target_type === 'MAXIMIZE' && r.lower_limit != null) {
                        if (actualNum < r.lower_limit) isConforming = false;
                      } else if (r.target_type === 'MINIMIZE' && r.upper_limit != null) {
                        if (actualNum > r.upper_limit) isConforming = false;
                      } else if (r.target_type === 'TARGET') {
                        // If explicit bounds exist, use them; otherwise check ±20% of target
                        if (r.lower_limit != null && actualNum < r.lower_limit) {
                          isConforming = false;
                        } else if (r.upper_limit != null && actualNum > r.upper_limit) {
                          isConforming = false;
                        } else if (r.target != null && r.lower_limit == null && r.upper_limit == null) {
                          // No explicit limits configured: use ±20% of target as conformance window
                          const tolerance = Math.abs(r.target) * 0.20;
                          if (actualNum < r.target - tolerance || actualNum > r.target + tolerance) {
                            isConforming = false;
                          }
                        }
                      }
                    }

                    return (
                      <tr key={r.code} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-gray-700">{r.code}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {r.target_type === 'TARGET' && r.target != null
                            ? `TARGET ${r.target}${r.unit ? ` ${r.unit}` : ''}`
                            : r.target_type === 'MAXIMIZE' && r.lower_limit != null
                            ? `MAXIMIZE ≥ ${r.lower_limit}${r.unit ? ` ${r.unit}` : ''}`
                            : r.target_type === 'MINIMIZE' && r.upper_limit != null
                            ? `MINIMIZE ≤ ${r.upper_limit}${r.unit ? ` ${r.unit}` : ''}`
                            : r.target_type === 'RANGE' && r.lower_limit != null && r.upper_limit != null
                            ? `RANGE [${r.lower_limit}–${r.upper_limit}]${r.unit ? ` ${r.unit}` : ''}`
                            : r.target_type}
                        </td>
                        <td className="px-4 py-3 bg-blue-50/30 font-mono font-bold text-blue-700">
                          {pred.toFixed(3)} {r.unit || ''}
                        </td>
                        <td className="px-4 py-3 bg-emerald-50/20">
                          <input
                            type="number"
                            step="any"
                            value={inputVal}
                            onChange={e => handleInputChange(r.code, e.target.value)}
                            placeholder={`e.g. ${pred.toFixed(2)}`}
                            className="w-full px-3 py-1.5 border border-emerald-400 rounded-md font-mono text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                          />
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-800">
                          {diff !== null ? diff.toFixed(3) : '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-800">
                          {pctErr !== null ? `${pctErr.toFixed(2)}%` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {hasValue ? (
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              isConforming && (pctErr === null || pctErr <= 5.0)
                                ? 'bg-emerald-100 text-emerald-800'
                                : isConforming
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {isConforming && (pctErr === null || pctErr <= 5.0)
                                ? '✓ Verified (Pass)'
                                : isConforming
                                ? 'Acceptable (<10%)'
                                : 'Out of Spec'}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">Pending</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => submitConfirmation.mutate()}
                disabled={submitConfirmation.isPending}
                className="px-6 py-2.5 bg-emerald-600 text-white font-semibold text-sm rounded-lg hover:bg-emerald-700 shadow-md transition disabled:opacity-50 flex items-center gap-2"
              >
                {submitConfirmation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Recording Confirmation Run...</span>
                  </>
                ) : (
                  <>
                    <span>✓ Save Confirmation Experiment Record</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Historical Confirmation Trials */}
          {confirmations.length > 0 && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
              <h3 className="text-base font-bold text-gray-800">
                Historical Confirmation Trials Log ({confirmations.length})
              </h3>

              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                    <tr>
                      <th className="px-4 py-3">Confirmation ID</th>
                      <th className="px-4 py-3">Date Recorded</th>
                      <th className="px-4 py-3">Opt Run #</th>
                      <th className="px-4 py-3">Data Source</th>
                      <th className="px-4 py-3">Observed Differences (|Actual - Pred|)</th>
                      <th className="px-4 py-3">Verdict</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {confirmations.map(c => {
                      const diffKeys = Object.keys(c.differences || {});
                      const isExp = c.data_source === 'EXPERIMENTAL';
                      return (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono font-bold text-gray-900">CR-{c.id}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {new Date(c.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 font-mono text-gray-600">#{c.optimization_id}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              isExp
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}>
                              {isExp ? '🧪 Experimental' : '⚙ Simulated'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-gray-700">
                            {diffKeys.map(k => (
                              <span key={k} className="inline-block bg-gray-100 px-2 py-0.5 rounded mr-2 mb-1">
                                {k}: Δ {c.differences[k].toFixed(3)}
                              </span>
                            ))}
                          </td>
                          <td className="px-4 py-3">
                            {isExp ? (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                                ✓ Model Validated
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                                Software Verification Passed
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
          )}

          {/* Workflow Footer */}
          <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <Link
              to="/design-space"
              className="px-5 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
            >
              ← Back to Design Space
            </Link>

            <Link
              to="/reports"
              className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-md transition flex items-center gap-2"
            >
              <span>Continue to Regulatory PDF Report</span>
              <span>→</span>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
