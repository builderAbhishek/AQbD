import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface DOERun {
  id: number;
  design_id: number;
  standard_order: number;
  run_order: number;
  center_point: boolean;
  block?: string | null;
  factor_values: Record<string, number>;
  coded_values: Record<string, number>;
  response_values?: Record<string, number> | null;
  notes?: string | null;
  failed: boolean;
  missing: boolean;
}

export default function Experiments() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [runValues, setRunValues] = useState<Record<number, Record<string, string>>>({});
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedProjectId = localStorage.getItem('aqbd_project_id');
    if (!savedProjectId) {
      navigate('/');
    } else {
      setProjectId(Number(savedProjectId));
    }
  }, [navigate]);

  // Load DOE designs to pick active design
  const { data: designs } = useQuery({
    queryKey: ['doe_designs', projectId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/doe/`);
      if (!res.ok) throw new Error('Failed to load DOE designs');
      return res.json();
    },
    enabled: !!projectId
  });

  const activeDesign = designs && designs.length > 0 ? designs[designs.length - 1] : null;

  // Load project responses to populate response columns
  const { data: responses } = useQuery({
    queryKey: ['responses', projectId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/responses/`);
      if (!res.ok) throw new Error('Failed to load responses');
      return res.json();
    },
    enabled: !!projectId
  });

  // Load runs for active design
  const { data: runs, isLoading: loadingRuns } = useQuery<DOERun[]>({
    queryKey: ['doe_runs', activeDesign?.id],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/v1/doe/${activeDesign?.id}/runs/`);
      if (!res.ok) throw new Error('Failed to load runs');
      return res.json();
    },
    enabled: !!activeDesign?.id
  });

  // Sync runs data into local state for smooth inline editing
  useEffect(() => {
    if (runs && responses) {
      const stateMap: Record<number, Record<string, string>> = {};
      runs.forEach(r => {
        stateMap[r.id] = {};
        responses.forEach((resp: any) => {
          // Check by name or code
          const val = r.response_values?.[resp.name] ?? r.response_values?.[resp.code];
          stateMap[r.id][resp.name] = val !== undefined && val !== null ? String(val) : '';
        });
      });
      setRunValues(stateMap);
    }
  }, [runs, responses]);

  const updateSingleRun = async (runId: number) => {
    try {
      const currentValues = runValues[runId] || {};
      const numericPayload: Record<string, number> = {};
      Object.entries(currentValues).forEach(([k, v]) => {
        if (v !== '' && !isNaN(Number(v))) {
          numericPayload[k] = Number(v);
        }
      });

      const res = await fetch(`${API_URL}/api/v1/experiments/${runId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response_values: numericPayload })
      });
      if (!res.ok) throw new Error('Save failed');
      setSaveStatus(`Run #${runId} saved successfully!`);
      setTimeout(() => setSaveStatus(null), 2500);
      queryClient.invalidateQueries({ queryKey: ['doe_runs', activeDesign?.id] });
      queryClient.invalidateQueries({ queryKey: ['analyses', projectId] });
      queryClient.invalidateQueries({ queryKey: ['optimizations', projectId] });
    } catch (e: any) {
      setError(`Failed to save run: ${e.message}`);
    }
  };

  const saveAllRuns = async () => {
    if (!runs) return;
    setError(null);
    setSaveStatus('Saving all experimental runs...');
    try {
      for (const r of runs) {
        const currentValues = runValues[r.id] || {};
        const numericPayload: Record<string, number> = {};
        Object.entries(currentValues).forEach(([k, v]) => {
          if (v !== '' && !isNaN(Number(v))) {
            numericPayload[k] = Number(v);
          }
        });
        await fetch(`${API_URL}/api/v1/experiments/${r.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ response_values: numericPayload })
        });
      }
      setSaveStatus('All experimental runs saved successfully!');
      setTimeout(() => setSaveStatus(null), 3000);
      queryClient.invalidateQueries({ queryKey: ['doe_runs', activeDesign?.id] });
      queryClient.invalidateQueries({ queryKey: ['analyses', projectId] });
      queryClient.invalidateQueries({ queryKey: ['optimizations', projectId] });
    } catch (e: any) {
      setError(`Error saving runs: ${e.message}`);
    }
  };

  // Deterministic 32-bit LCG PRNG for reproducible synthetic experimental runs
  const createLcg = (seed: number) => {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  };

  // Synthetic Example Data Generator helper for rapid testing and AQbD workflow demonstration
  const populateSyntheticData = async () => {
    if (!runs || !responses) return;
    setSaveStatus('Generating scientifically coherent HPLC example data...');
    try {
      for (let i = 0; i < runs.length; i++) {
        const r = runs[i];
        const syntheticMap: Record<string, number> = {};

        // Extract normalized coded factor levels A, B, C in [-1, +1]
        const coded = r.coded_values || {};
        const factorKeys = Object.keys(coded);
        const A = typeof coded['A'] === 'number' ? coded['A'] : (factorKeys[0] ? Number(coded[factorKeys[0]]) || 0 : 0);
        const B = typeof coded['B'] === 'number' ? coded['B'] : (factorKeys[1] ? Number(coded[factorKeys[1]]) || 0 : 0);
        const C = typeof coded['C'] === 'number' ? coded['C'] : (factorKeys[2] ? Number(coded[factorKeys[2]]) || 0 : 0);

        // Run-specific deterministic PRNG noise for analytical reproducibility
        const ro = Number(r.run_order) || (i + 1);
        const n1 = (createLcg((ro * 101 + 1) >>> 0)() - 0.5) * 2;
        const n2 = (createLcg((ro * 101 + 2) >>> 0)() - 0.5) * 2;
        const n3 = (createLcg((ro * 101 + 3) >>> 0)() - 0.5) * 2;
        const n4 = (createLcg((ro * 101 + 4) >>> 0)() - 0.5) * 2;

        responses.forEach((resp: any, respIdx: number) => {
          const code = (resp.code || '').toUpperCase();
          const name = (resp.name || '').toLowerCase();

          let val: number;
          // 1. Resolution (Y1): Goal MAXIMIZE >= 2.0 (range ~ 1.5 - 3.5)
          // Higher with lower % organic (-A), lower flow (-B), higher temp (+C)
          if (code === 'Y1' || code === 'R1' || name.includes('resolution') || respIdx === 0) {
            val = 2.45 - 0.38 * A - 0.22 * B + 0.16 * C - 0.10 * A * A - 0.08 * B * B + 0.06 * A * B + n1 * 0.03;
            val = Number(val.toFixed(2));
          }
          // 2. Tailing Factor (Y2): Goal MINIMIZE <= 2.0 (range ~ 1.0 - 2.0)
          // Improved with higher % organic (+A) and higher temp (+C), slightly degrades at higher flow (+B)
          else if (code === 'Y2' || code === 'R2' || name.includes('tailing') || name.includes('asymmetry') || respIdx === 1) {
            val = 1.28 - 0.12 * A + 0.08 * B - 0.14 * C + 0.06 * A * A + 0.04 * C * C - 0.03 * A * C + n2 * 0.02;
            val = Number(val.toFixed(2));
          }
          // 3. Retention Time (Y3): Goal TARGET = 5.0 min (range ~ 4.0 - 6.5 min)
          // Strong chromatographic elution dependence on organic (-A), flow (-B), temp (-C)
          else if (code === 'Y3' || code === 'R3' || name.includes('retention') || respIdx === 2) {
            val = 5.10 - 0.58 * A - 0.44 * B - 0.18 * C + 0.10 * A * A + 0.06 * B * B + 0.04 * A * B + n3 * 0.04;
            val = Number(val.toFixed(2));
          }
          // 4. Theoretical Plates (Y4): Goal MAXIMIZE >= 2000 (range ~ 1800 - 3000 plates)
          // Classical van Deemter peak efficiency: higher temp (+C), lower flow near optimum (-B), organic (+A)
          else if (code === 'Y4' || code === 'R4' || name.includes('plate') || name.includes('efficiency') || respIdx === 3) {
            val = 2480.0 + 80.0 * A - 180.0 * B + 140.0 * C - 70.0 * A * A - 95.0 * B * B + 50.0 * B * C + n4 * 15.0;
            val = Number(val.toFixed(1));
          }
          // Generic fallback for any other response
          else {
            val = 50.0 + 10.0 * A - 5.0 * B + 8.0 * C + n1 * 1.5;
            val = Number(val.toFixed(2));
          }

          // Populate by both name and code to ensure seamless compatibility with backend and frontend lookups
          if (resp.name) syntheticMap[resp.name] = val;
          if (resp.code) syntheticMap[resp.code] = val;
        });

        await fetch(`${API_URL}/api/v1/experiments/${r.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ response_values: syntheticMap })
        });
      }
      setSaveStatus('Scientific HPLC example data generated and saved! You can now proceed directly to Statistical Analysis.');
      queryClient.invalidateQueries({ queryKey: ['doe_runs', activeDesign?.id] });
      queryClient.invalidateQueries({ queryKey: ['analyses', projectId] });
      queryClient.invalidateQueries({ queryKey: ['optimizations', projectId] });
    } catch (e: any) {
      setError(`Failed to populate synthetic example data: ${e.message}`);
    }
  };

  // Completion calculation
  const completedRunsCount = (runs || []).filter(r => {
    if (!r.response_values || Object.keys(r.response_values).length === 0) return false;
    return (responses || []).every((resp: any) => 
      (r.response_values?.[resp.name] !== undefined && r.response_values?.[resp.name] !== null) ||
      (r.response_values?.[resp.code] !== undefined && r.response_values?.[resp.code] !== null)
    );
  }).length;

  if (!projectId) return null;

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {/* Workflow Navigation Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <span>Project</span>
            <span>&rarr;</span>
            <span className="text-gray-400">DOE</span>
            <span>&rarr;</span>
            <span className="font-semibold text-blue-600">Experimental Data</span>
            <span>&rarr;</span>
            <span>Statistical Analysis</span>
            <span>&rarr;</span>
            <span>Diagnostics</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-800">Experimental Data Entry &amp; Results</h2>
          <p className="text-gray-600 text-sm mt-1">
            Record analytical measurement observations for each randomized experimental run in the DOE design.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/doe')}
            className="border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded shadow-sm transition"
          >
            &larr; Back to DOE
          </button>
          <button
            onClick={() => navigate('/analysis')}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded shadow transition flex items-center gap-2"
          >
            Continue to Analysis &rarr;
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded mb-6 text-sm">
          <span className="font-bold">Error: </span> {error}
        </div>
      )}

      {saveStatus && (
        <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-800 p-4 rounded mb-6 text-sm">
          {saveStatus}
        </div>
      )}

      {/* Progress & Actions Card */}
      <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-gray-800 text-base">Execution Progress</h3>
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${completedRunsCount === (runs?.length || 0) && (runs?.length || 0) > 0 ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
              {completedRunsCount} / {runs?.length || 0} Runs Completed
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Active Design: <strong>{activeDesign?.design_type || 'None'}</strong> (ID: #{activeDesign?.id || 'N/A'})
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={populateSyntheticData}
            title="Populate realistic example data to demonstrate the downstream analysis and optimization without manual typing"
            className="text-xs bg-purple-50 text-purple-700 border border-purple-300 hover:bg-purple-100 px-3.5 py-2 rounded font-medium transition"
          >
            ⚡ Populate Example Data
          </button>
          <button
            onClick={saveAllRuns}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold shadow transition"
          >
            Save All Runs
          </button>
        </div>
      </div>

      {/* Experimental Data Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-100">
        <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Experimental Observations Sheet</h3>
            <p className="text-xs text-gray-500 mt-0.5">Enter measured analytical values in actual units</p>
          </div>
          <span className="text-xs text-gray-500 bg-white border px-3 py-1 rounded shadow-sm">
            Ordered by Randomized Run Order
          </span>
        </div>

        {loadingRuns ? (
          <div className="p-8 text-center text-gray-500">Loading experimental runs...</div>
        ) : !runs || runs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No experimental runs found. Please generate a design matrix on the <strong>DOE</strong> page first.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600 text-xs uppercase tracking-wider">
                  <th className="p-3 font-semibold border-b text-center w-16 bg-blue-50 text-blue-900">Run</th>
                  <th className="p-3 font-semibold border-b text-center w-16">Std</th>
                  {/* Factor values */}
                  {Object.keys(runs[0].factor_values || {}).map(fCode => (
                    <th key={fCode} className="p-3 font-semibold border-b text-right bg-gray-50">
                      Factor {fCode}
                    </th>
                  ))}
                  {/* Response inputs */}
                  {responses?.map((r: any) => (
                    <th key={r.code} className="p-3 font-semibold border-b text-right text-purple-900 bg-purple-50">
                      {r.name} ({r.code}) {r.unit ? `[${r.unit}]` : ''} *
                    </th>
                  ))}
                  <th className="p-3 font-semibold border-b text-center w-20">Status</th>
                  <th className="p-3 font-semibold border-b text-right w-20">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {runs.map((r) => {
                  const isCenter = r.center_point;
                  const isFilled = responses?.every((resp: any) => {
                    const val = runValues[r.id]?.[resp.name];
                    return val !== undefined && val !== '';
                  });

                  return (
                    <tr key={r.id} className={`hover:bg-gray-50 transition ${isCenter ? 'bg-amber-50/20' : ''}`}>
                      <td className="p-3 text-center font-mono font-bold text-blue-800 bg-blue-50/30">
                        {r.run_order}
                      </td>
                      <td className="p-3 text-center font-mono text-xs text-gray-500">
                        {r.standard_order}
                      </td>
                      {/* Factor Values */}
                      {Object.entries(r.factor_values || {}).map(([fCode, fVal]) => (
                        <td key={fCode} className="p-3 text-right font-mono text-gray-700 bg-gray-50/30">
                          {typeof fVal === 'number' ? fVal : fVal}
                        </td>
                      ))}
                      {/* Response Editable Input Cells */}
                      {responses?.map((resp: any) => (
                        <td key={resp.code} className="p-2 text-right bg-purple-50/20">
                          <input
                            type="number"
                            step="any"
                            placeholder="0.00"
                            className="w-28 text-right font-mono text-sm border border-gray-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
                            value={runValues[r.id]?.[resp.name] ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRunValues(prev => ({
                                ...prev,
                                [r.id]: {
                                  ...(prev[r.id] || {}),
                                  [resp.name]: val
                                }
                              }));
                            }}
                          />
                        </td>
                      ))}
                      <td className="p-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${isFilled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                          {isFilled ? 'Recorded' : 'Pending'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => updateSingleRun(r.id)}
                          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-2.5 py-1 rounded transition"
                        >
                          Save
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
