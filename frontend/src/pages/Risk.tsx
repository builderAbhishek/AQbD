import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface RiskItem {
  id: number;
  project_id: number;
  parameter: string;
  potential_impact?: string | null;
  severity: number;
  occurrence: number;
  detectability: number;
  risk_score: number;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  justification?: string | null;
}

interface RiskFormData {
  parameter: string;
  potential_impact: string;
  severity: number | '';
  occurrence: number | '';
  detectability: number | '';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  justification: string;
}

const defaultForm: RiskFormData = {
  parameter: '',
  potential_impact: '',
  severity: 5,
  occurrence: 3,
  detectability: 3,
  priority: 'Medium',
  justification: ''
};

export default function Risk() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<RiskFormData>(defaultForm);

  useEffect(() => {
    const savedProjectId = localStorage.getItem('aqbd_project_id');
    if (!savedProjectId) {
      navigate('/');
    } else {
      setProjectId(Number(savedProjectId));
    }
  }, [navigate]);

  // Real-time RPN calculation: RPN = Severity * Occurrence * Detectability
  const liveRPN = useMemo(() => {
    const s = typeof form.severity === 'number' ? form.severity : 0;
    const o = typeof form.occurrence === 'number' ? form.occurrence : 0;
    const d = typeof form.detectability === 'number' ? form.detectability : 0;
    return s * o * d;
  }, [form.severity, form.occurrence, form.detectability]);

  // Auto-calculate suggested priority based on standard FMEA thresholds
  const suggestedPriority = useMemo((): 'Low' | 'Medium' | 'High' | 'Critical' => {
    const s = typeof form.severity === 'number' ? form.severity : 0;
    if (liveRPN >= 200 || s >= 8) return 'Critical';
    if (liveRPN >= 100) return 'High';
    if (liveRPN >= 40) return 'Medium';
    return 'Low';
  }, [liveRPN, form.severity]);

  const { data: risks, isLoading } = useQuery<RiskItem[]>({
    queryKey: ['risk', projectId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/risk/`);
      if (!res.ok) throw new Error('Failed to fetch risk assessments');
      return res.json();
    },
    enabled: !!projectId
  });

  const createRisk = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/risk/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to create risk assessment');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk', projectId] });
      setForm(defaultForm);
      setError(null);
    },
    onError: (err: any) => setError(err.message)
  });

  const updateRisk = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${API_URL}/api/v1/risk/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to update risk assessment');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk', projectId] });
      setForm(defaultForm);
      setEditingId(null);
      setError(null);
    },
    onError: (err: any) => setError(err.message)
  });

  const deleteRisk = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_URL}/api/v1/risk/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete risk assessment');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk', projectId] });
    }
  });

  const handleScoreChange = (field: 'severity' | 'occurrence' | 'detectability', value: string) => {
    const num = value === '' ? '' : parseInt(value, 10);
    setForm(prev => {
      const updated = { ...prev, [field]: isNaN(num as number) ? '' : num };
      // Also update priority to suggested default if user hasn't explicitly customized it wildly
      const s = typeof updated.severity === 'number' ? updated.severity : 0;
      const o = typeof updated.occurrence === 'number' ? updated.occurrence : 0;
      const d = typeof updated.detectability === 'number' ? updated.detectability : 0;
      const rpn = s * o * d;
      let nextPriority: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';
      if (rpn >= 200 || s >= 8) nextPriority = 'Critical';
      else if (rpn >= 100) nextPriority = 'High';
      else if (rpn >= 40) nextPriority = 'Medium';
      updated.priority = nextPriority;
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Form validations matching backend schema
    if (!form.parameter.trim()) {
      setError('Parameter name is required.');
      return;
    }

    const s = Number(form.severity);
    if (!form.severity || isNaN(s) || s < 1 || s > 10) {
      setError('Severity must be an integer between 1 and 10.');
      return;
    }

    const o = Number(form.occurrence);
    if (!form.occurrence || isNaN(o) || o < 1 || o > 10) {
      setError('Occurrence must be an integer between 1 and 10.');
      return;
    }

    const d = Number(form.detectability);
    if (!form.detectability || isNaN(d) || d < 1 || d > 10) {
      setError('Detectability must be an integer between 1 and 10.');
      return;
    }

    if (!['Low', 'Medium', 'High', 'Critical'].includes(form.priority)) {
      setError('Priority must be one of: Low, Medium, High, Critical.');
      return;
    }

    const payload = {
      parameter: form.parameter.trim(),
      potential_impact: form.potential_impact.trim() || null,
      severity: s,
      occurrence: o,
      detectability: d,
      priority: form.priority,
      justification: form.justification.trim() || null
    };

    if (editingId) {
      updateRisk.mutate(payload);
    } else {
      createRisk.mutate(payload);
    }
  };

  const handleEdit = (item: RiskItem) => {
    setEditingId(item.id);
    setForm({
      parameter: item.parameter,
      potential_impact: item.potential_impact || '',
      severity: item.severity,
      occurrence: item.occurrence,
      detectability: item.detectability,
      priority: item.priority,
      justification: item.justification || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(defaultForm);
    setError(null);
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return 'bg-red-100 text-red-800 border border-red-300';
      case 'High':
        return 'bg-orange-100 text-orange-800 border border-orange-300';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
      case 'Low':
      default:
        return 'bg-green-100 text-green-800 border border-green-300';
    }
  };

  const getRPNBadgeClass = (rpn: number) => {
    if (rpn >= 200) return 'text-red-700 bg-red-50 border-red-200';
    if (rpn >= 100) return 'text-orange-700 bg-orange-50 border-orange-200';
    if (rpn >= 40) return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    return 'text-green-700 bg-green-50 border-green-200';
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
            <span className="text-gray-400">ATP</span>
            <span>&rarr;</span>
            <span className="font-semibold text-blue-600">Risk Assessment</span>
            <span>&rarr;</span>
            <span>Factors</span>
            <span>&rarr;</span>
            <span>Responses</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-800">Initial Risk Assessment (FMEA)</h2>
          <p className="text-gray-600 text-sm mt-1">
            Identify potential high-risk parameters and critical process parameters (CPPs) for experimental evaluation.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/atp')}
            className="border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded shadow-sm transition"
          >
            &larr; Back to ATP
          </button>
          <button
            onClick={() => navigate('/factors')}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded shadow transition flex items-center gap-2"
          >
            Save &amp; Continue to Factors &rarr;
          </button>
        </div>
      </div>

      {/* Main Form Card */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8 border border-gray-100">
        <div className="flex items-center justify-between pb-3 border-b mb-5">
          <h3 className="text-xl font-semibold text-gray-800">
            {editingId ? 'Edit Risk Assessment Record' : 'Add Risk Assessment Parameter'}
          </h3>
          <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-medium">
            RPN = S &times; O &times; D (Range: 1 &ndash; 1000)
          </span>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded mb-5 text-sm">
            <span className="font-bold">Error: </span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Risk / Process Parameter Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 p-2.5 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Column Temperature, Mobile Phase pH, Flow Rate"
                value={form.parameter}
                onChange={e => setForm({ ...form, parameter: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">Material attribute, equipment parameter, or environmental factor.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Potential Impact / Failure Mode
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 p-2.5 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Peak tailing, loss of resolution, column fouling"
                value={form.potential_impact}
                onChange={e => setForm({ ...form, potential_impact: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">Direct effect on critical quality attributes or chromatographic performance.</p>
            </div>
          </div>

          {/* Scoring Grid: Severity, Occurrence, Detectability & Live RPN Card */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Severity (S: 1 &ndash; 10) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="10"
                className="w-full border border-gray-300 p-2 rounded bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={form.severity}
                onChange={e => handleScoreChange('severity', e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">1: Minor impact &bull; 10: Critical failure</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Occurrence (O: 1 &ndash; 10) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="10"
                className="w-full border border-gray-300 p-2 rounded bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={form.occurrence}
                onChange={e => handleScoreChange('occurrence', e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">1: Remote / rare &bull; 10: Highly frequent</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Detectability (D: 1 &ndash; 10) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="10"
                className="w-full border border-gray-300 p-2 rounded bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={form.detectability}
                onChange={e => handleScoreChange('detectability', e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">1: Easily detected &bull; 10: Undetectable</p>
            </div>

            {/* Live Calculated RPN Box */}
            <div className={`p-3 rounded border flex flex-col justify-center items-center text-center ${getRPNBadgeClass(liveRPN)}`}>
              <span className="text-xs uppercase font-bold tracking-wider">Calculated RPN</span>
              <span className="text-3xl font-extrabold my-0.5">{liveRPN}</span>
              <span className="text-xs font-medium">
                {form.severity || 0} &times; {form.occurrence || 0} &times; {form.detectability || 0}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Risk Priority Level <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full border border-gray-300 p-2.5 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={form.priority}
                onChange={e => setForm({ ...form, priority: e.target.value as any })}
              >
                <option value="Low">Low (RPN &lt; 40)</option>
                <option value="Medium">Medium (RPN 40 &ndash; 99)</option>
                <option value="High">High (RPN 100 &ndash; 199)</option>
                <option value="Critical">Critical (RPN &ge; 200 or S &ge; 8)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Suggested based on scores: <strong className="text-gray-700">{suggestedPriority}</strong>. You may override as needed.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Justification / Proposed Control Strategy
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 p-2.5 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Include in DOE study / tight procedural control"
                value={form.justification}
                onChange={e => setForm({ ...form, justification: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">Scientific rationale or reason for including/excluding from DOE.</p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded font-medium shadow transition"
            >
              {editingId ? 'Update Risk Assessment' : 'Add Risk Assessment'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-5 py-2.5 rounded font-medium transition"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Existing Risk Assessments Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-100">
        <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Evaluated Risk Parameters</h3>
            <p className="text-xs text-gray-500 mt-0.5">Parameters identified for consideration in DOE factor selection</p>
          </div>
          <span className="text-sm font-medium text-gray-600 bg-white px-3 py-1 rounded border shadow-sm">
            Total: {risks?.length || 0} parameter(s)
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading risk assessment records...</div>
        ) : !risks || risks.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No risk assessment records found. Define your parameters and evaluate S, O, D above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600 text-xs uppercase tracking-wider">
                  <th className="p-4 font-semibold border-b">Parameter</th>
                  <th className="p-4 font-semibold border-b text-center">Severity (S)</th>
                  <th className="p-4 font-semibold border-b text-center">Occurrence (O)</th>
                  <th className="p-4 font-semibold border-b text-center">Detectability (D)</th>
                  <th className="p-4 font-semibold border-b text-center">RPN</th>
                  <th className="p-4 font-semibold border-b text-center">Priority</th>
                  <th className="p-4 font-semibold border-b">Justification / Controls</th>
                  <th className="p-4 font-semibold border-b text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {risks.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition">
                    <td className="p-4">
                      <div className="font-semibold text-gray-900">{item.parameter}</div>
                      {item.potential_impact && (
                        <div className="text-xs text-gray-500 mt-0.5 italic">
                          Impact: {item.potential_impact}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-center font-medium text-gray-700">{item.severity}</td>
                    <td className="p-4 text-center font-medium text-gray-700">{item.occurrence}</td>
                    <td className="p-4 text-center font-medium text-gray-700">{item.detectability}</td>
                    <td className="p-4 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold border ${getRPNBadgeClass(item.risk_score)}`}>
                        {item.risk_score}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${getPriorityBadgeClass(item.priority)}`}>
                        {item.priority}
                      </span>
                    </td>
                    <td className="p-4 text-gray-600 text-xs max-w-xs truncate" title={item.justification || ''}>
                      {item.justification || '-'}
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleEdit(item)}
                        className="text-blue-600 hover:text-blue-800 font-medium text-xs mr-3 px-2 py-1 rounded hover:bg-blue-50 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete risk assessment for "${item.parameter}"?`)) {
                            deleteRisk.mutate(item.id);
                          }
                        }}
                        className="text-red-600 hover:text-red-800 font-medium text-xs px-2 py-1 rounded hover:bg-red-50 transition"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
