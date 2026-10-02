import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface ResponseItem {
  id: number;
  project_id: number;
  name: string;
  code: string;
  unit?: string | null;
  target_type: 'MAXIMIZE' | 'MINIMIZE' | 'TARGET' | 'RANGE';
  target?: number | null;
  lower_limit?: number | null;
  upper_limit?: number | null;
  importance: number;
  description?: string | null;
}

interface ResponseFormData {
  name: string;
  code: string;
  unit: string;
  target_type: 'MAXIMIZE' | 'MINIMIZE' | 'TARGET' | 'RANGE';
  target: string;
  lower_limit: string;
  upper_limit: string;
  importance: number;
  description: string;
}

const defaultForm: ResponseFormData = {
  name: '',
  code: '',
  unit: '',
  target_type: 'TARGET',
  target: '',
  lower_limit: '',
  upper_limit: '',
  importance: 3,
  description: ''
};

export default function Responses() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ResponseFormData>(defaultForm);

  useEffect(() => {
    const savedProjectId = localStorage.getItem('aqbd_project_id');
    if (!savedProjectId) {
      navigate('/');
    } else {
      setProjectId(Number(savedProjectId));
    }
  }, [navigate]);

  const { data: responses, isLoading } = useQuery<ResponseItem[]>({
    queryKey: ['responses', projectId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/responses/`);
      if (!res.ok) throw new Error('Failed to fetch responses');
      return res.json();
    },
    enabled: !!projectId
  });

  const createResponse = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/responses/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to create response');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['responses', projectId] });
      setForm(defaultForm);
      setError(null);
    },
    onError: (err: any) => setError(err.message)
  });

  const updateResponse = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${API_URL}/api/v1/responses/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to update response');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['responses', projectId] });
      setForm(defaultForm);
      setEditingId(null);
      setError(null);
    },
    onError: (err: any) => setError(err.message)
  });

  const deleteResponse = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_URL}/api/v1/responses/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete response');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['responses', projectId] });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setError('Response Name is required.');
      return;
    }

    const trimmedCode = form.code.trim().toUpperCase();
    if (!trimmedCode) {
      setError('Response Code is required.');
      return;
    }

    // Code uniqueness check
    if (responses) {
      const codeExists = responses.some(
        r => r.code.toUpperCase() === trimmedCode && r.id !== editingId
      );
      if (codeExists) {
        setError(`Response code "${trimmedCode}" already exists. Each response must have a unique code.`);
        return;
      }
    }

    let payload: any = {
      name: trimmedName,
      code: trimmedCode,
      unit: form.unit.trim() || null,
      target_type: form.target_type,
      importance: Number(form.importance) || 3,
      description: form.description.trim() || null,
      target: null,
      lower_limit: null,
      upper_limit: null
    };

    if (form.target_type === 'TARGET') {
      if (form.target === '' || form.target === null) {
        setError('Target value is required when goal is TARGET.');
        return;
      }
      payload.target = Number(form.target);
    } else if (form.target_type === 'RANGE') {
      if (form.lower_limit === '' || form.upper_limit === '') {
        setError('Both Lower Limit and Upper Limit are required when goal is RANGE.');
        return;
      }
      const low = Number(form.lower_limit);
      const high = Number(form.upper_limit);
      if (high <= low) {
        setError(`Upper Limit (${high}) must be strictly greater than Lower Limit (${low}).`);
        return;
      }
      payload.lower_limit = low;
      payload.upper_limit = high;
    } else if (form.target_type === 'MAXIMIZE') {
      if (form.lower_limit !== '') {
        payload.lower_limit = Number(form.lower_limit);
      }
    } else if (form.target_type === 'MINIMIZE') {
      if (form.upper_limit !== '') {
        payload.upper_limit = Number(form.upper_limit);
      }
    }

    if (editingId) {
      updateResponse.mutate(payload);
    } else {
      createResponse.mutate(payload);
    }
  };

  const handleEdit = (item: ResponseItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      code: item.code,
      unit: item.unit || '',
      target_type: item.target_type,
      target: item.target !== null && item.target !== undefined ? item.target.toString() : '',
      lower_limit: item.lower_limit !== null && item.lower_limit !== undefined ? item.lower_limit.toString() : '',
      upper_limit: item.upper_limit !== null && item.upper_limit !== undefined ? item.upper_limit.toString() : '',
      importance: item.importance || 3,
      description: item.description || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(defaultForm);
    setError(null);
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
            <span className="text-gray-400">Risk Assessment</span>
            <span>&rarr;</span>
            <span className="text-gray-400">Factors</span>
            <span>&rarr;</span>
            <span className="font-semibold text-blue-600">Responses</span>
            <span>&rarr;</span>
            <span>DOE</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-800">Critical Quality Attributes &amp; Responses</h2>
          <p className="text-gray-600 text-sm mt-1">
            Define analytical responses (CQAs), optimization directions, and acceptance criteria for experimental studies.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/factors')}
            className="border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded shadow-sm transition"
          >
            &larr; Back to Factors
          </button>
          <button
            onClick={() => navigate('/doe')}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded shadow transition flex items-center gap-2"
          >
            Save &amp; Continue to DOE &rarr;
          </button>
        </div>
      </div>

      {/* Main Response Form */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8 border border-gray-100">
        <div className="flex items-center justify-between pb-3 border-b mb-5">
          <h3 className="text-xl font-semibold text-gray-800">
            {editingId ? 'Edit Experimental Response' : 'Define New Experimental Response'}
          </h3>
          <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium border border-blue-200">
            Multi-Response Optimization Ready
          </span>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded mb-5 text-sm">
            <span className="font-bold">Validation Error: </span> {error}
          </div>
        )}

        {/* Educational Helper Banner */}
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-md mb-6 text-sm flex items-start gap-2">
          <span className="text-base font-bold">&#9432;</span>
          <div>
            <strong>Guidance:</strong> Responses are measured outputs from experiments. Their goals are later used for 
            statistical modeling, Derringer-Suich desirability optimization, and Design Space boundary calculations.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Response Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 p-2.5 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Example: Retention Time, Resolution, Tailing Factor, Theoretical Plates"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">Full analytical performance indicator.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Response Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                maxLength={6}
                className="w-full border border-gray-300 p-2.5 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono uppercase"
                placeholder="Example: Y1, R1, RT"
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
              <p className="text-xs text-gray-500 mt-1">Unique variable symbol in models (Y1, Y2, R1...).</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 p-2.5 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Example: min, AU, plates, %"
                value={form.unit}
                onChange={e => setForm({ ...form, unit: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Goal / Optimization Direction <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full border border-gray-300 p-2.5 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={form.target_type}
                onChange={e => setForm({ ...form, target_type: e.target.value as any })}
              >
                <option value="TARGET">TARGET (Hit specific target value)</option>
                <option value="MAXIMIZE">MAXIMIZE (Higher is better, e.g., Resolution)</option>
                <option value="MINIMIZE">MINIMIZE (Lower is better, e.g., Tailing, Impurity)</option>
                <option value="RANGE">RANGE (Acceptable interval [Lower - Upper])</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Importance / Weight (1 &ndash; 5)
              </label>
              <select
                className="w-full border border-gray-300 p-2.5 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={form.importance}
                onChange={e => setForm({ ...form, importance: Number(e.target.value) })}
              >
                <option value={1}>1 - Low Priority</option>
                <option value={2}>2 - Moderate</option>
                <option value={3}>3 - Standard (Default)</option>
                <option value={4}>4 - High Priority</option>
                <option value={5}>5 - Critical / Mandatory</option>
              </select>
            </div>
          </div>

          {/* Conditional Goal & Limits Fields */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            {form.target_type === 'TARGET' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Target Value <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  className="w-full md:w-1/3 border border-gray-300 p-2 rounded bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 5.0"
                  value={form.target}
                  onChange={e => setForm({ ...form, target: e.target.value })}
                />
                <p className="text-xs text-gray-500 mt-1">Exact desirable experimental target value.</p>
              </div>
            )}

            {form.target_type === 'RANGE' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Lower Limit <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    className="w-full border border-gray-300 p-2 rounded bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., 4.0"
                    value={form.lower_limit}
                    onChange={e => setForm({ ...form, lower_limit: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Upper Limit <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    className="w-full border border-gray-300 p-2 rounded bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., 6.0"
                    value={form.upper_limit}
                    onChange={e => setForm({ ...form, upper_limit: e.target.value })}
                  />
                </div>
              </div>
            )}

            {form.target_type === 'MAXIMIZE' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Acceptable Minimum Threshold (Optional)
                </label>
                <input
                  type="number"
                  step="any"
                  className="w-full md:w-1/3 border border-gray-300 p-2 rounded bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 2000"
                  value={form.lower_limit}
                  onChange={e => setForm({ ...form, lower_limit: e.target.value })}
                />
                <p className="text-xs text-gray-500 mt-1">Values below this limit will receive 0 desirability.</p>
              </div>
            )}

            {form.target_type === 'MINIMIZE' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Acceptable Maximum Threshold (Optional)
                </label>
                <input
                  type="number"
                  step="any"
                  className="w-full md:w-1/3 border border-gray-300 p-2 rounded bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 2.0"
                  value={form.upper_limit}
                  onChange={e => setForm({ ...form, upper_limit: e.target.value })}
                />
                <p className="text-xs text-gray-500 mt-1">Values above this limit will receive 0 desirability.</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description / Scientific Notes (Optional)
            </label>
            <input
              type="text"
              className="w-full border border-gray-300 p-2.5 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Baseline separation from adjacent degradation impurity"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded font-medium shadow transition"
            >
              {editingId ? 'Update Response' : 'Add Response'}
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

      {/* Responses Table Card */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-100">
        <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Configured Responses</h3>
            <p className="text-xs text-gray-500 mt-0.5">Parameters tracked in experimental runs and optimization models</p>
          </div>
          <span className="text-sm font-medium text-gray-600 bg-white px-3 py-1 rounded border shadow-sm">
            Total: {responses?.length || 0} response(s)
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading experimental responses...</div>
        ) : !responses || responses.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No responses defined yet. Add measured analytical parameters using the form above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600 text-xs uppercase tracking-wider">
                  <th className="p-4 font-semibold border-b text-center w-20">Code</th>
                  <th className="p-4 font-semibold border-b">Response</th>
                  <th className="p-4 font-semibold border-b">Unit</th>
                  <th className="p-4 font-semibold border-b">Goal</th>
                  <th className="p-4 font-semibold border-b">Target / Acceptance</th>
                  <th className="p-4 font-semibold border-b text-center">Weight</th>
                  <th className="p-4 font-semibold border-b text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {responses.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition">
                    <td className="p-4 text-center">
                      <span className="inline-block px-2.5 py-1 bg-purple-100 text-purple-800 rounded font-mono font-bold text-sm">
                        {item.code}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-gray-900">{item.name}</div>
                      {item.description && (
                        <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>
                      )}
                    </td>
                    <td className="p-4 text-gray-600">{item.unit || '-'}</td>
                    <td className="p-4">
                      <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                        {item.target_type}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-gray-700 text-xs">
                      {item.target_type === 'TARGET' && `= ${item.target}`}
                      {item.target_type === 'RANGE' && `[${item.lower_limit} - ${item.upper_limit}]`}
                      {item.target_type === 'MAXIMIZE' && (item.lower_limit !== null ? `>= ${item.lower_limit}` : 'Max')}
                      {item.target_type === 'MINIMIZE' && (item.upper_limit !== null ? `<= ${item.upper_limit}` : 'Min')}
                    </td>
                    <td className="p-4 text-center font-bold text-gray-700">
                      {'★'.repeat(item.importance || 3)}
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
                          if (window.confirm(`Delete response "${item.name}" (${item.code})?`)) {
                            deleteResponse.mutate(item.id);
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
