import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilePlus, FolderOpen, Upload, Clock, Trash2, MoreVertical, Copy, Archive } from 'lucide-react';
import { projectsApi, Project } from '../api/client';
import { formatDistanceToNow } from 'date-fns';

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const data = await projectsApi.list();
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewProject = () => {
    navigate('/projects/new');
  };

  const handleOpenProject = (id: string) => {
    navigate(`/projects/${id}`);
  };

  const handleDelete = async (id: string) => {
    try {
      await projectsApi.delete(id);
      setDeleteConfirmId(null);
      setMenuOpenId(null);
      loadProjects();
    } catch (error) {
      console.error('Failed to delete project', error);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await projectsApi.duplicate(id);
      setMenuOpenId(null);
      loadProjects();
    } catch (error) {
      console.error('Failed to duplicate project', error);
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await projectsApi.archive(id);
      setMenuOpenId(null);
      loadProjects();
    } catch (error) {
      console.error('Failed to archive project', error);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = JSON.parse(e.target?.result as string);
        await projectsApi.import({
          name: content.name || 'Imported Project',
          data: content.data || content,
          status: 'IMPORTED'
        });
        loadProjects();
      } catch (error) {
        alert('Invalid project file');
        console.error(error);
      }
    };
    reader.readAsText(file);
    
    // Reset input
    if (event.target) event.target.value = '';
  };

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h2 className="text-2xl font-semibold text-gray-800 mb-8">Welcome to AQbD Studio</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <button 
          onClick={handleNewProject}
          className="flex flex-col items-center justify-center p-8 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-blue-500 hover:shadow-md transition-all group"
        >
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-100">
            <FilePlus size={24} />
          </div>
          <span className="font-medium text-gray-900">New Project</span>
          <span className="text-sm text-gray-500 mt-1">Create a blank project</span>
        </button>

        <button 
          className="flex flex-col items-center justify-center p-8 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-blue-500 hover:shadow-md transition-all group"
        >
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-indigo-100">
            <FolderOpen size={24} />
          </div>
          <span className="font-medium text-gray-900">Open Project</span>
          <span className="text-sm text-gray-500 mt-1">Browse existing projects</span>
        </button>

        <button 
          onClick={handleImportClick}
          className="flex flex-col items-center justify-center p-8 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-blue-500 hover:shadow-md transition-all group"
        >
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-green-100">
            <Upload size={24} />
          </div>
          <span className="font-medium text-gray-900">Import Data</span>
          <span className="text-sm text-gray-500 mt-1">Import from JSON</span>
        </button>
        <input 
          type="file" 
          accept=".json" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleFileChange} 
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-medium text-gray-800 flex items-center gap-2">
            <Clock size={20} className="text-gray-500" />
            Recent Projects
          </h3>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-lg p-12 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <FolderOpen size={32} />
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h4>
            <p className="text-gray-500 mb-6">Create a new project to get started with AQbD Studio.</p>
            <button 
              onClick={handleNewProject}
              className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors"
            >
              Create New Project
            </button>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500">
                  <th className="py-3 px-6 font-medium">Project Name</th>
                  <th className="py-3 px-6 font-medium">Status</th>
                  <th className="py-3 px-6 font-medium">Last Modified</th>
                  <th className="py-3 px-6 font-medium">Last Opened</th>
                  <th className="py-3 px-6 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-6">
                      <button 
                        onClick={() => handleOpenProject(project.id)}
                        className="font-medium text-blue-600 hover:underline text-left"
                      >
                        {project.name}
                      </button>
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {project.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-500">
                      {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-500">
                      {project.lastOpenedAt ? formatDistanceToNow(new Date(project.lastOpenedAt), { addSuffix: true }) : 'Never'}
                    </td>
                    <td className="py-4 px-6 text-right relative">
                      <button 
                        onClick={() => setMenuOpenId(menuOpenId === project.id ? null : project.id)}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded"
                      >
                        <MoreVertical size={20} />
                      </button>
                      
                      {menuOpenId === project.id && (
                        <div className="absolute right-8 top-10 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10 py-1">
                          <button 
                            onClick={() => handleOpenProject(project.id)}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            Open
                          </button>
                          <button 
                            onClick={() => handleDuplicate(project.id)}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                          >
                            <Copy size={16} /> Duplicate
                          </button>
                          <a 
                            href={projectsApi.exportUrl(project.id)}
                            download
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                          >
                            <Upload size={16} className="rotate-180" /> Export JSON
                          </a>
                          <button 
                            onClick={() => handleArchive(project.id)}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                          >
                            <Archive size={16} /> Archive
                          </button>
                          <div className="border-t border-gray-100 my-1"></div>
                          <button 
                            onClick={() => setDeleteConfirmId(project.id)}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <Trash2 size={16} /> Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Delete permanently?</h3>
            <p className="text-sm text-gray-500 mb-6">
              This action cannot be undone. This will permanently delete the project and all its data.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded border border-gray-300"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
