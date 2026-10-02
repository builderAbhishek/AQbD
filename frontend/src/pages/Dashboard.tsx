import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [newProject, setNewProject] = useState({ project_code: '', project_name: '' });

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

  const selectProject = (id: number) => {
    localStorage.setItem('aqbd_project_id', id.toString());
    navigate('/atp');
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Projects Dashboard</h2>
      
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
                <td className="p-3">
                  <button 
                    onClick={() => selectProject(p.id)}
                    className="bg-green-600 text-white px-4 py-1 rounded text-sm hover:bg-green-700 transition"
                  >
                    Open Project
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
    </div>
  );
}
