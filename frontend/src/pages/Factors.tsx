import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface FactorItem {
  id: number;
  project_id: number;
  name: string;
  code: string;
  type: 'CONTINUOUS' | 'CATEGORICAL';
  unit?: string | null;
  low_value: number | null;
  high_value: number | null;
  center_value?: number | null;
  levels?: number | null;
  role: 'CRITICAL' | 'IMPORTANT' | 'CONTROL';
  description?: string | null;
}

interface FactorFormData {
  name: string;
  code: string;
  type: 'CONTINUOUS' | 'CATEGORICAL';
  unit: string;
  low_value: string;
  high_value: string;
  role: 'CRITICAL' | 'IMPORTANT' | 'CONTROL';
  description: string;
}

const defaultForm: FactorFormData = {
  name: '',
  code: '',
  type: 'CONTINUOUS',
  unit: '',
  low_value: '',
  high_value: '',
  role: 'CRITICAL',
  description: ''
};

export default function Factors() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FactorFormData>(defaultForm);

  useEffect(() => {
    const savedProjectId = localStorage.getItem('aqbd_project_id');
    if (!savedProjectId) {
      navigate('/');
    } else {
      setProjectId(Number(savedProjectId));
    }
  }, [navigate]);

  const { data: factors, isLoading } = useQuery<FactorItem[]>({
    queryKey: ['factors', projectId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/factors/`);
      if (!res.ok) throw new Error('Failed to fetch factors');
      return res.json();
    },
    enabled: !!projectId
  });

  const createFactor = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/factors/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to create factor');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factors', projectId] });
      setForm(defaultForm);
      setError(null);
    },
    onError: (err: any) => setError(err.message)
  });

  const updateFactor = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${API_URL}/api/v1/factors/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to update factor');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factors', projectId] });
      setForm(defaultForm);
      setEditingId(null);
      setError(null);
    },
    onError: (err: any) => setError(err.message)
  });

  const deleteFactor = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_URL}/api/v1/factors/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete factor');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factors', projectId] });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setError('Factor Name is required.');
      return;
    }

    const trimmedCode = form.code.trim().toUpperCase();
    if (!trimmedCode) {
      setError('Factor Code is required.');
      return;
    }

    // Code uniqueness check within project (excluding current editing item)
    if (factors) {
      const codeExists = factors.some(
        f => f.code.toUpperCase() === trimmedCode && f.id !== editingId
      );
      if (codeExists) {
        setError(`Factor code "${trimmedCode}" already exists in this project. Each factor must have a unique code.`);
        return;
      }
    }

    if (form.low_value === '' || form.low_value === null) {
      setError('Low Level is required.');
      return;
    }

    if (form.high_value === '' || form.high_value === null) {
      setError('High Level is required.');
      return;
    }

    const lowNum = Number(form.low_value);
    const highNum = Number(form.high_value);

    if (isNaN(lowNum)) {
      setError('Low Level must be a valid numeric value.');
      return;
    }

    if (isNaN(highNum)) {
      setError('High Level must be a valid numeric value.');
      return;
    }

    if (highNum <= lowNum) {
      setError(`High Level (${highNum}) must be strictly greater than Low Level (${lowNum}).`);
      return;
    }

    const centerNum = (lowNum + highNum) / 2.0;

    const payload = {
      name: trimmedName,
      code: trimmedCode,
      type: form.type,
      unit: form.unit.trim() || null,
      low_value: lowNum,
      high_value: highNum,
      center_value: centerNum,
      levels: 2,
      role: form.role,
      description: form.description.trim() || null
    };

    if (editingId) {
      updateFactor.mutate(payload);
    } else {
      createFactor.mutate(payload);
    }
  };

  const handleEdit = (item: FactorItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      code: item.code,
      type: item.type,
      unit: item.unit || '',
      low_value: item.low_value !== null ? item.low_value.toString() : '',
      high_value: item.high_value !== null ? item.high_value.toString() : '',
      role: item.role,
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
            <span className="font-semibold text-blue-600">Factors</span>
            <span>&rarr;</span>
            <span>Responses</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-800">Experimental Factors</h2>
          <p className="text-gray-600 text-sm mt-1">
            Define independent procedure parameters and their experimental ranges for the Design of Experiments (DOE).
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/risk')}
            className="border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded shadow-sm transition"
          >
            &larr; Back to Risk Assessment
          </button>
          <button
            onClick={() => navigate('/responses')}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded shadow transition flex items-center gap-2"
          >
            Save &amp; Continue to Responses &rarr;
          </button>
        </div>
      </div>

      {/* Main Factor Definition Form Card */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8 border border-gray-100">
        <div className="flex items-center justify-between pb-3 border-b mb-5">
          <h3 className="text-xl font-semibold text-gray-800">
            {editingId ? 'Edit Experimental Factor' : 'Define New Experimental Factor'}
          </h3>
          <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium border border-blue-200">
            Continuous 2-Level Factor
          </span>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded mb-5 text-sm">
            <span className="font-bold">Validation Error: </span> {error}
          </div>
        )}

        {/* Clear Helper Text Banner */}
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-md mb-6 text-sm flex items-start gap-2">
          <span className="text-base font-bold">&#9432;</span>
          <div>
            <strong>Guidance:</strong> The Low and High levels define the experimental range used by the DOE engine. 
            The center point will automatically be calculated as the midpoint between Low and High.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Factor Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 p-2.5 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Example: Mobile Phase Composition, Flow Rate, Column Temperature"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">Full analytical parameter title.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Factor Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                maxLength={4}
                className="w-full border border-gray-300 p-2.5 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono uppercase"
                placeholder="Example: A"
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
              <p className="text-xs text-gray-500 mt-1">Short single-letter code used in DOE models (A, B, C...).</p>
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
                placeholder="Example: %, mL/min, °C, mM"
                value={form.unit}
                onChange={e => setForm({ ...form, unit: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">Measurement engineering unit.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Low Level (-1) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                className="w-full border border-gray-300 p-2.5 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Example: 60 or 0.8"
                value={form.low_value}
                onChange={e => setForm({ ...form, low_value: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">Minimum experimental boundary.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                High Level (+1) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                className="w-full border border-gray-300 p-2.5 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Example: 70 or 1.2"
                value={form.high_value}
                onChange={e => setForm({ ...form, high_value: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">Maximum experimental boundary (must be &gt; Low).</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Criticality / Role
              </label>
              <select
                className="w-full border border-gray-300 p-2.5 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value as any })}
              >
                <option value="CRITICAL">CRITICAL (Study in Design Space)</option>
                <option value="IMPORTANT">IMPORTANT (Secondary Parameter)</option>
                <option value="CONTROL">CONTROL (Fixed/Monitored Parameter)</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (Optional)
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 p-2.5 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Brief justification or experimental conditions note"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>

          {/* Dynamic Range Preview */}
          {form.low_value !== '' && form.high_value !== '' && !isNaN(Number(form.low_value)) && !isNaN(Number(form.high_value)) && (
            <div className="p-3 bg-gray-50 rounded border border-gray-200 text-xs flex items-center justify-between text-gray-600">
              <span>
                <strong>Range Preview:</strong> Low (-1) = {form.low_value} {form.unit} &bull; Center (0) = {((Number(form.low_value) + Number(form.high_value)) / 2).toFixed(3)} {form.unit} &bull; High (+1) = {form.high_value} {form.unit}
              </span>
              {Number(form.high_value) <= Number(form.low_value) && (
                <span className="text-red-600 font-bold">Invalid range: High must be greater than Low</span>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded font-medium shadow transition"
            >
              {editingId ? 'Update Factor' : 'Add Factor'}
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

      {/* Factors Table Card */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-100">
        <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Configured Factors</h3>
            <p className="text-xs text-gray-500 mt-0.5">Factors available for experimental DOE matrix design</p>
          </div>
          <span className="text-sm font-medium text-gray-600 bg-white px-3 py-1 rounded border shadow-sm">
            Total: {factors?.length || 0} factor(s)
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading experimental factors...</div>
        ) : !factors || factors.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No factors defined yet. Use the form above to add procedure parameters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600 text-xs uppercase tracking-wider">
                  <th className="p-4 font-semibold border-b text-center w-20">Code</th>
                  <th className="p-4 font-semibold border-b">Factor</th>
                  <th className="p-4 font-semibold border-b">Unit</th>
                  <th className="p-4 font-semibold border-b text-right">Low (-1)</th>
                  <th className="p-4 font-semibold border-b text-right">High (+1)</th>
                  <th className="p-4 font-semibold border-b text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {factors.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition">
                    <td className="p-4 text-center">
                      <span className="inline-block px-2.5 py-1 bg-blue-100 text-blue-800 rounded font-mono font-bold text-sm">
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
                    <td className="p-4 text-right font-mono text-gray-800 font-medium">
                      {item.low_value !== null ? item.low_value : '-'}
                    </td>
                    <td className="p-4 text-right font-mono text-gray-800 font-medium">
                      {item.high_value !== null ? item.high_value : '-'}
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
                          if (window.confirm(`Delete factor "${item.name}" (${item.code})?`)) {
                            deleteFactor.mutate(item.id);
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
