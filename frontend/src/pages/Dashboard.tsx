import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [newProject, setNewProject] = useState({ project_code: '', project_name: '' });
  
  // Delete Modal State
  const [projectToDelete, setProjectToDelete] = useState<any>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState('');

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/v1/projects/`);
      return res.json();
    }
  });

  const createProject = useMutation({
    mutationFn: async (project: { project_code: string; project_name: string }) => {
      const res = await fetch(`${API_URL}/api/v1/projects/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project)
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setNewProject({ project_code: '', project_name: '' });
      selectProject(data.id);
    }
  });

  const deleteProject = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_URL}/api/v1/projects/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        throw new Error('Failed to delete project');
      }
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setProjectToDelete(null);
      setDeleteSuccess('Project deleted successfully.');
      setTimeout(() => setDeleteSuccess(''), 3000);
      
      const activeProjectId = localStorage.getItem('aqbd_project_id');
      if (activeProjectId === deletedId.toString()) {
        localStorage.removeItem('aqbd_project_id');
      }
    },
    onError: (err: any) => {
      setDeleteError(err.message || 'Deletion failed.');
      setProjectToDelete(null);
      setTimeout(() => setDeleteError(''), 3000);
    }
  });

  const selectProject = (id: number) => {
    localStorage.setItem('aqbd_project_id', id.toString());
    navigate('/atp');
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Projects Dashboard</h2>
      
      {deleteSuccess && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {deleteSuccess}
        </div>
      )}
      {deleteError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {deleteError}
        </div>
      )}

      <div className="bg-white p-4 rounded shadow mb-8">
        <h3 className="text-xl mb-4 font-semibold text-gray-700">Create New Project</h3>
        <div className="flex gap-4">
          <input 
            type="text" placeholder="Project Code (e.g., PROJ-001)" className="border p-2 rounded flex-1"
            value={newProject.project_code} onChange={e => setNewProject({...newProject, project_code: e.target.value})}
          />
          <input 
            type="text" placeholder="Project Name" className="border p-2 rounded flex-1"
            value={newProject.project_name} onChange={e => setNewProject({...newProject, project_name: e.target.value})}
          />
          <button 
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
            onClick={() => createProject.mutate(newProject)}
          >
            Create & Continue
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <h3 className="text-xl mb-4 font-semibold text-gray-700">Existing Projects</h3>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-3">ID</th>
              <th className="p-3">Code</th>
              <th className="p-3">Name</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects?.map((p: any) => (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="p-3">{p.id}</td>
                <td className="p-3">{p.project_code}</td>
                <td className="p-3">{p.project_name}</td>
                <td className="p-3">{p.status}</td>
                <td className="p-3 flex gap-2">
                  <button 
                    onClick={() => selectProject(p.id)}
                    className="bg-green-600 text-white px-4 py-1 rounded text-sm hover:bg-green-700 transition"
                  >
                    Open Project
                  </button>
                  <button 
                    onClick={() => setProjectToDelete(p)}
                    className="bg-red-600 text-white px-4 py-1 rounded text-sm hover:bg-red-700 transition"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {(!projects || projects.length === 0) && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-500">No projects found. Create one above.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {projectToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg max-w-md w-full">
            <h3 className="text-xl font-bold text-red-600 mb-4">DELETE PROJECT</h3>
            <p className="font-semibold mb-2">This action cannot be undone.</p>
            <p className="text-gray-600 mb-6">
              All AQbD data and generated reports associated with this project ({projectToDelete.project_code}) will be permanently deleted.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition"
                onClick={() => setProjectToDelete(null)}
                disabled={deleteProject.isPending}
              >
                Cancel
              </button>
              <button 
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition disabled:opacity-50"
                onClick={() => deleteProject.mutate(projectToDelete.id)}
                disabled={deleteProject.isPending}
              >
                {deleteProject.isPending ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
