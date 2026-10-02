import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface FactorItem {
  id: number;
  project_id: number;
  name: string;
  code: string;
  type: string;
  unit?: string | null;
  low_value: number;
  high_value: number;
  center_value?: number | null;
}

interface DOEDesign {
  id: number;
  project_id: number;
  design_type: string;
  factor_mapping: Array<{ id: number; code: string; name: string }>;
  coded_matrix: number[][];
  actual_matrix: number[][];
  random_seed?: number | null;
  randomized_order: number[];
  standard_order: number[];
  center_point_count: number;
  created_at: string;
}

export default function DOE() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form options
  const [designType, setDesignType] = useState<'FULL_FACTORIAL' | 'GENERAL_FACTORIAL' | 'CCD' | 'BBD'>('FULL_FACTORIAL');
  const [centerPoints, setCenterPoints] = useState<number>(3);
  const [seed, setSeed] = useState<string>('42');
  const [randomize, setRandomize] = useState<boolean>(true);
  const [alpha, setAlpha] = useState<'o' | 'r'>('o');
  const [face, setFace] = useState<'ccf' | 'ccc' | 'cci'>('ccf');
  const [viewMode, setViewMode] = useState<'actual' | 'coded'>('actual');

  useEffect(() => {
    const savedProjectId = localStorage.getItem('aqbd_project_id');
    if (!savedProjectId) {
      navigate('/');
    } else {
      setProjectId(Number(savedProjectId));
    }
  }, [navigate]);

  // Load project factors
  const { data: factors, isLoading: loadingFactors } = useQuery<FactorItem[]>({
    queryKey: ['factors', projectId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/factors/`);
      if (!res.ok) throw new Error('Failed to fetch factors');
      return res.json();
    },
    enabled: !!projectId
  });

  // Load existing DOE designs for project
  const { data: designs, isLoading: loadingDesigns } = useQuery<DOEDesign[]>({
    queryKey: ['doe_designs', projectId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/doe/`);
      if (!res.ok) throw new Error('Failed to fetch DOE designs');
      return res.json();
    },
    enabled: !!projectId
  });

  const activeDesign = designs && designs.length > 0 ? designs[designs.length - 1] : null;

  // Expected run count calculation preview
  const expectedRuns = useMemo(() => {
    const k = factors?.length || 0;
    if (k < 2) return 0;
    const cp = Number(centerPoints) || 0;
    if (designType === 'FULL_FACTORIAL') {
      return Math.pow(2, k) + cp;
    } else if (designType === 'CCD') {
      // 2^k + 2k + cp
      return Math.pow(2, k) + 2 * k + cp;
    } else if (designType === 'BBD') {
      // 2*k*(k-1) + cp
      if (k < 3) return 0;
      return 2 * k * (k - 1) + cp;
    } else if (designType === 'GENERAL_FACTORIAL') {
      return Math.pow(2, k) + cp;
    }
    return 0;
  }, [factors, designType, centerPoints]);

  const generateDOE = useMutation({
    mutationFn: async () => {
      setError(null);
      setSuccess(null);

      if (!factors || factors.length < 2) {
        throw new Error('At least 2 factors are required to generate a DOE matrix.');
      }
      if (designType === 'BBD' && factors.length < 3) {
        throw new Error('Box-Behnken Design (BBD) requires at least 3 factors.');
      }

      const payload = {
        design_type: designType,
        center_points: Number(centerPoints) || 0,
        alpha: alpha,
        face: face,
        seed: randomize && seed !== '' ? Number(seed) : null
      };

      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/doe/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        const msg = errData?.detail?.error?.message || errData?.detail || 'Failed to generate DOE design';
        throw new Error(msg);
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['doe_designs', projectId] });
      setSuccess(`DOE Matrix generated successfully! Total runs: ${data.standard_order.length}`);
    },
    onError: (err: any) => {
      setError(err.message);
    }
  });

  const downloadCSV = () => {
    if (!activeDesign) return;
    const factorCodes = activeDesign.factor_mapping.map(f => f.code);
    const headers = ['Std Order', 'Run Order', ...factorCodes, 'Type'];
    const rows = activeDesign.standard_order.map((stdIdx, i) => {
      const rOrder = activeDesign.randomized_order.indexOf(stdIdx) + 1;
      const matrix = viewMode === 'actual' ? activeDesign.actual_matrix : activeDesign.coded_matrix;
      const vals = matrix[stdIdx - 1];
      const isCenter = activeDesign.coded_matrix[stdIdx - 1].every(v => v === 0);
      return [
        stdIdx,
        rOrder,
        ...vals,
        isCenter ? 'Center' : 'Factorial'
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AQbD_DOE_Design_${activeDesign.design_type}_Proj_${projectId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!projectId) return null;

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {/* Workflow Navigation Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <span>Project</span>
            <span>&rarr;</span>
            <span className="text-gray-400">Factors</span>
            <span>&rarr;</span>
            <span className="text-gray-400">Responses</span>
            <span>&rarr;</span>
            <span className="font-semibold text-blue-600">DOE Engine</span>
            <span>&rarr;</span>
            <span>Experimental Data</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-800">Design of Experiments (DOE) Engine</h2>
          <p className="text-gray-600 text-sm mt-1">
            Construct statistically sound, randomized multivariate experimental designs for chromatographic optimization.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/responses')}
            className="border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded shadow-sm transition"
          >
            &larr; Back to Responses
          </button>
          <button
            onClick={() => navigate('/experiments')}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded shadow transition flex items-center gap-2"
          >
            Continue to Experimental Data &rarr;
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded mb-6 text-sm">
          <span className="font-bold">Error: </span> {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 text-green-800 p-4 rounded mb-6 text-sm flex justify-between items-center">
          <div>
            <span className="font-bold">Success: </span> {success}
          </div>
          <button
            onClick={() => navigate('/experiments')}
            className="text-xs bg-green-700 text-white px-3 py-1.5 rounded hover:bg-green-800 transition"
          >
            Enter Experimental Data Now &rarr;
          </button>
        </div>
      )}

      {/* Available Factors Summary Card */}
      <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold text-gray-700 text-base">Investigated Factors in Project</h3>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-gray-100 text-gray-600">
            {factors?.length || 0} Factor(s) Loaded
          </span>
        </div>
        {loadingFactors ? (
          <div className="text-sm text-gray-500 py-2">Loading factors...</div>
        ) : !factors || factors.length === 0 ? (
          <div className="text-sm text-amber-700 bg-amber-50 p-3 rounded">
            No factors found. Please return to the <strong>Factors</strong> page and define at least 2 factors before generating a DOE.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {factors.map(f => (
              <div key={f.id} className="p-3 bg-gray-50 rounded border border-gray-200 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">{f.code}</span>
                  <span className="text-gray-500">{f.unit || '-'}</span>
                </div>
                <div className="font-medium text-gray-800 mt-1 truncate">{f.name}</div>
                <div className="mt-2 text-gray-600 flex justify-between">
                  <span>Low (-1): <strong>{f.low_value}</strong></span>
                  <span>Center (0): <strong>{((f.low_value + f.high_value)/2).toFixed(2)}</strong></span>
                  <span>High (+1): <strong>{f.high_value}</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Design Configuration Panel */}
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100 mb-8">
        <h3 className="text-xl font-semibold text-gray-800 pb-3 border-b mb-5">
          Configure Multivariate Experimental Design
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Design Architecture <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full border border-gray-300 p-2.5 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
              value={designType}
              onChange={e => setDesignType(e.target.value as any)}
            >
              <option value="FULL_FACTORIAL">Full Factorial (2^k Screening / Interaction)</option>
              <option value="CCD">Central Composite Design (CCD - Response Surface)</option>
              <option value="BBD">Box-Behnken Design (BBD - Response Surface, min 3 factors)</option>
              <option value="GENERAL_FACTORIAL">General Factorial Design</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {designType === 'FULL_FACTORIAL' && 'Investigates all combinations of factor levels for main effects and interactions.'}
              {designType === 'CCD' && 'Adds axial (star) points to fit complete second-order quadratic models.'}
              {designType === 'BBD' && 'Efficient spherical design without extreme factor corners; requires ≥ 3 factors.'}
              {designType === 'GENERAL_FACTORIAL' && 'Multi-level design for discrete or non-linear factor levels.'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Center Points (Replicates)
            </label>
            <input
              type="number"
              min="0"
              max="15"
              className="w-full border border-gray-300 p-2.5 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={centerPoints}
              onChange={e => setCenterPoints(Math.max(0, parseInt(e.target.value || '0', 10)))}
            />
            <p className="text-xs text-gray-500 mt-1">
              Center points allow curvature evaluation and pure error estimation for Lack-of-Fit tests.
            </p>
          </div>

          {/* Dynamic Configuration for CCD */}
          {designType === 'CCD' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CCD Face / Axial Placement
              </label>
              <select
                className="w-full border border-gray-300 p-2.5 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={face}
                onChange={e => setFace(e.target.value as any)}
              >
                <option value="ccf">Face-Centered (CCF - within factor limits, alpha = 1)</option>
                <option value="ccc">Circumscribed (CCC - rotatable, spherical)</option>
                <option value="cci">Inscribed (CCI - star points within factor ranges)</option>
              </select>
            </div>
          )}

          {/* Randomization */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">Run Order Randomization</label>
              <input
                type="checkbox"
                checked={randomize}
                onChange={e => setRandomize(e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded"
              />
            </div>
            {randomize ? (
              <div>
                <input
                  type="number"
                  placeholder="Random Seed (e.g. 42)"
                  className="w-full border border-gray-300 p-2 rounded text-sm focus:ring-2 focus:ring-blue-500"
                  value={seed}
                  onChange={e => setSeed(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">Seed guarantees reproducible run order across sessions.</p>
              </div>
            ) : (
              <p className="text-xs text-gray-500 p-2 bg-gray-50 rounded">Runs will execute strictly in standard order.</p>
            )}
          </div>
        </div>

        {/* Expected Run Count Banner */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <span className="text-xs uppercase font-bold text-gray-500 tracking-wider">Design Matrix Projection</span>
            <div className="text-sm text-gray-700 mt-0.5">
              <strong>{factors?.length || 0} Factors</strong> &bull; Design Type: <strong>{designType}</strong> &bull; Center Points: <strong>{centerPoints}</strong>
            </div>
            <div className="text-xs text-blue-700 font-semibold mt-1">
              Expected Total Runs: {expectedRuns} runs
            </div>
          </div>

          <button
            onClick={() => generateDOE.mutate()}
            disabled={generateDOE.isPending || !factors || factors.length < 2}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2.5 rounded font-semibold shadow transition whitespace-nowrap"
          >
            {generateDOE.isPending ? 'Generating Matrix...' : activeDesign ? 'Regenerate DOE Matrix' : 'Generate DOE Matrix'}
          </button>
        </div>
      </div>

      {/* Generated DOE Matrix Results Table */}
      {activeDesign && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-100">
          <div className="bg-gray-50 px-6 py-4 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-800">
                  Generated Experimental Matrix ({activeDesign.design_type})
                </h3>
                <span className="text-xs bg-green-100 text-green-800 font-semibold px-2.5 py-0.5 rounded">
                  Design #{activeDesign.id} &bull; {activeDesign.standard_order.length} Runs
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Seed: {activeDesign.random_seed ?? 'None'} &bull; Center Points: {activeDesign.center_point_count}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Toggle Coded vs Actual */}
              <div className="bg-gray-200 p-0.5 rounded flex text-xs">
                <button
                  onClick={() => setViewMode('actual')}
                  className={`px-3 py-1 rounded font-medium transition ${viewMode === 'actual' ? 'bg-white shadow text-blue-700' : 'text-gray-600'}`}
                >
                  Actual Values
                </button>
                <button
                  onClick={() => setViewMode('coded')}
                  className={`px-3 py-1 rounded font-medium transition ${viewMode === 'coded' ? 'bg-white shadow text-blue-700' : 'text-gray-600'}`}
                >
                  Coded (-1, 0, +1)
                </button>
              </div>

              <button
                onClick={downloadCSV}
                className="text-xs bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium px-3 py-1.5 rounded shadow-sm transition"
              >
                &darr; Download CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600 text-xs uppercase tracking-wider">
                  <th className="p-3 font-semibold border-b text-center w-16">Std Order</th>
                  <th className="p-3 font-semibold border-b text-center w-16 bg-blue-50 text-blue-900">Run Order</th>
                  {activeDesign.factor_mapping.map(f => (
                    <th key={f.code} className="p-3 font-semibold border-b text-right">
                      {f.name} ({f.code})
                    </th>
                  ))}
                  <th className="p-3 font-semibold border-b text-center w-24">Point Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {activeDesign.standard_order.map((stdIdx) => {
                  const rOrder = activeDesign.randomized_order.indexOf(stdIdx) + 1;
                  const matrix = viewMode === 'actual' ? activeDesign.actual_matrix : activeDesign.coded_matrix;
                  const rowValues = matrix[stdIdx - 1];
                  const isCenter = activeDesign.coded_matrix[stdIdx - 1].every(v => v === 0);

                  return (
                    <tr key={stdIdx} className={`hover:bg-gray-50 transition ${isCenter ? 'bg-amber-50/40' : ''}`}>
                      <td className="p-3 text-center text-xs font-mono text-gray-500">{stdIdx}</td>
                      <td className="p-3 text-center text-xs font-mono font-bold bg-blue-50/50 text-blue-800">
                        {rOrder}
                      </td>
                      {rowValues.map((val, colIdx) => (
                        <td key={colIdx} className="p-3 text-right font-mono text-gray-800">
                          {typeof val === 'number' ? (viewMode === 'actual' ? val : val.toFixed(2)) : val}
                        </td>
                      ))}
                      <td className="p-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${isCenter ? 'bg-amber-100 text-amber-800 font-semibold' : 'bg-gray-100 text-gray-600'}`}>
                          {isCenter ? 'Center' : 'Factorial'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
