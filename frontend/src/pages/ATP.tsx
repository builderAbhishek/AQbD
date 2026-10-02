import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function ATP() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const defaultForm = {
    name: '',
    description: '',
    unit: '',
    target_type: 'RANGE',
    target_value: '',
    lower_limit: '',
    upper_limit: ''
  };
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    const savedProjectId = localStorage.getItem('aqbd_project_id');
    if (!savedProjectId) {
      navigate('/');
    } else {
      setProjectId(Number(savedProjectId));
    }
  }, [navigate]);

  const { data: atps, isLoading } = useQuery({
    queryKey: ['atp', projectId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/atp/`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !!projectId
  });

  const createATP = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/atp/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Creation failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atp'] });
      setForm(defaultForm);
      setError(null);
    },
    onError: (err: any) => setError(err.message)
  });

  const updateATP = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`${API_URL}/api/v1/atp/${editingId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Update failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atp'] });
      setForm(defaultForm);
      setEditingId(null);
      setError(null);
    },
    onError: (err: any) => setError(err.message)
  });

  const deleteATP = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`${API_URL}/api/v1/atp/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atp'] });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic Validation
    if (!form.name.trim()) return setError('Parameter name is required.');
    if (!form.target_type) return setError('Acceptance criterion is required.');

    let payload: any = {
      name: form.name,
      description: form.description || null,
      unit: form.unit || null,
      target_type: form.target_type,
    };

    if (form.target_type === 'RANGE') {
      if (form.lower_limit === '' || form.upper_limit === '') return setError('Both Lower and Upper limits are required for RANGE.');
      if (Number(form.lower_limit) >= Number(form.upper_limit)) return setError('Upper limit must be greater than Lower limit.');
      payload.lower_limit = Number(form.lower_limit);
      payload.upper_limit = Number(form.upper_limit);
    } else if (form.target_type === 'MINIMUM') {
      if (form.lower_limit === '') return setError('Lower acceptable value is required for MINIMUM.');
      payload.lower_limit = Number(form.lower_limit);
    } else if (form.target_type === 'MAXIMUM') {
      if (form.upper_limit === '') return setError('Upper acceptable value is required for MAXIMUM.');
      payload.upper_limit = Number(form.upper_limit);
    } else if (form.target_type === 'TARGET') {
      if (form.target_value === '') return setError('Target value is required for TARGET.');
      payload.target_value = Number(form.target_value);
    }

    if (editingId) {
      updateATP.mutate(payload);
    } else {
      createATP.mutate(payload);
    }
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description || '',
      unit: item.unit || '',
      target_type: item.target_type,
      target_value: item.target_value !== null ? item.target_value.toString() : '',
      lower_limit: item.lower_limit !== null ? item.lower_limit.toString() : '',
      upper_limit: item.upper_limit !== null ? item.upper_limit.toString() : ''
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
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Analytical Target Profile (ATP)</h2>
        <button 
          onClick={() => navigate('/risk')}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded shadow"
        >
          Save & Continue to Risk Assessment ➔
        </button>
      </div>

      <div className="bg-white p-6 rounded shadow-md mb-8">
        <h3 className="text-xl font-semibold mb-4 text-gray-700">
          {editingId ? 'Edit ATP Parameter' : 'Define New ATP Parameter'}
        </h3>
        
        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parameter Name *</label>
            <input 
              type="text" 
              className="w-full border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500" 
              placeholder="e.g., Retention Time"
              value={form.name} 
              onChange={e => setForm({...form, name: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
            <input 
              type="text" 
              className="w-full border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500" 
              placeholder="e.g., min, %, mg/mL"
              value={form.unit} 
              onChange={e => setForm({...form, unit: e.target.value})}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
            <input 
              type="text" 
              className="w-full border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500" 
              placeholder="Brief justification or description"
              value={form.description} 
              onChange={e => setForm({...form, description: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Acceptance Criterion *</label>
            <select 
              className="w-full border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500"
              value={form.target_type} 
              onChange={e => setForm({...form, target_type: e.target.value})}
            >
              <option value="MINIMUM">MINIMUM (Must be &ge; lower limit)</option>
              <option value="MAXIMUM">MAXIMUM (Must be &le; upper limit)</option>
              <option value="TARGET">TARGET (Must hit specific value)</option>
              <option value="RANGE">RANGE (Must fall between limits)</option>
            </select>
          </div>

          <div className="flex gap-4 items-end">
            {(form.target_type === 'MINIMUM' || form.target_type === 'RANGE') && (
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {form.target_type === 'MINIMUM' ? 'Lower Acceptable Value *' : 'Lower Limit *'}
                </label>
                <input 
                  type="number" step="any"
                  className="w-full border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500" 
                  value={form.lower_limit} 
                  onChange={e => setForm({...form, lower_limit: e.target.value})}
                />
              </div>
            )}
            
            {(form.target_type === 'MAXIMUM' || form.target_type === 'RANGE') && (
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {form.target_type === 'MAXIMUM' ? 'Upper Acceptable Value *' : 'Upper Limit *'}
                </label>
                <input 
                  type="number" step="any"
                  className="w-full border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500" 
                  value={form.upper_limit} 
                  onChange={e => setForm({...form, upper_limit: e.target.value})}
                />
              </div>
            )}

            {form.target_type === 'TARGET' && (
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Value *</label>
                <input 
                  type="number" step="any"
                  className="w-full border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500" 
                  value={form.target_value} 
                  onChange={e => setForm({...form, target_value: e.target.value})}
                />
              </div>
            )}
          </div>

          <div className="md:col-span-2 flex gap-3 mt-4">
            <button 
              type="submit" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-medium shadow"
            >
              {editingId ? 'Update Parameter' : 'Add Parameter'}
            </button>
            {editingId && (
              <button 
                type="button" onClick={handleCancelEdit}
                className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-2 rounded font-medium shadow"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white rounded shadow-md overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b">
          <h3 className="text-xl font-semibold text-gray-700">Configured ATP Parameters</h3>
        </div>
        {isLoading ? (
          <div className="p-6 text-gray-500">Loading parameters...</div>
        ) : atps?.length === 0 ? (
          <div className="p-6 text-gray-500">No parameters defined yet.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-600 text-sm uppercase tracking-wide">
                <th className="p-4 font-medium border-b">Parameter Name</th>
                <th className="p-4 font-medium border-b">Unit</th>
                <th className="p-4 font-medium border-b">Criterion</th>
                <th className="p-4 font-medium border-b">Limits / Target</th>
                <th className="p-4 font-medium border-b text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {atps?.map((a: any) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="p-4 text-gray-800 font-medium">
                    {a.name}
                    {a.description && <div className="text-xs text-gray-500 font-normal mt-1">{a.description}</div>}
                  </td>
                  <td className="p-4 text-gray-600">{a.unit || '-'}</td>
                  <td className="p-4">
                    <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                      {a.target_type}
                    </span>
                  </td>
                  <td className="p-4 text-gray-600">
                    {a.target_type === 'RANGE' && `[${a.lower_limit} to ${a.upper_limit}]`}
                    {a.target_type === 'MINIMUM' && `≥ ${a.lower_limit}`}
                    {a.target_type === 'MAXIMUM' && `≤ ${a.upper_limit}`}
                    {a.target_type === 'TARGET' && `= ${a.target_value}`}
                  </td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => handleEdit(a)}
                      className="text-blue-600 hover:text-blue-800 font-medium text-sm mr-4"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => { if(confirm('Delete this parameter?')) deleteATP.mutate(a.id); }}
                      className="text-red-600 hover:text-red-800 font-medium text-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
