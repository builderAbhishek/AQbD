import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Save, 
  Settings, 
  ArrowLeft, 
  BarChart2, 
  PieChart, 
  Activity, 
  LineChart,
  Target,
  CheckCircle,
  FileText
} from 'lucide-react';
import { projectsApi, Project } from '../api/client';

export default function ProjectWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState('(Untitled)');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [saveAsModalOpen, setSaveAsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  useEffect(() => {
    if (id) {
      loadProject(id);
    } else {
      setLoading(false);
    }
  }, [id]);

  const loadProject = async (projectId: string) => {
    try {
      const data = await projectsApi.get(projectId);
      setProject(data);
      setName(data.name);
    } catch (error) {
      console.error('Failed to load project', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (project?.id) {
        await projectsApi.update(project.id, { name, data: project.data });
      } else {
        if (name === '(Untitled)') {
          setNewProjectName('My Project');
          setSaveAsModalOpen(true);
          setSaving(false);
          return;
        }
        const newProject = await projectsApi.create({ name, data: {} });
        navigate(`/projects/${newProject.id}`, { replace: true });
      }
    } catch (error) {
      console.error('Failed to save project', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAs = async () => {
    try {
      const newProject = await projectsApi.create({ 
        name: newProjectName || name + ' (Copy)', 
        data: project?.data || {} 
      });
      setSaveAsModalOpen(false);
      navigate(`/projects/${newProject.id}`);
    } catch (error) {
      console.error('Failed to save as', error);
    }
  };

  if (loading) {
    return <div className="p-8 text-gray-500">Loading workspace...</div>;
  }

  const sidebarItems = [
    { name: 'Design (Coming V1)', icon: Settings, disabled: true },
    { name: 'Analysis (Coming V1)', icon: BarChart2, disabled: true },
    { name: 'Diagnostics (Coming V1)', icon: Activity, disabled: true },
    { name: 'Model Graphs (Coming V1)', icon: PieChart, disabled: true },
    { name: 'Optimization (Coming V1)', icon: Target, disabled: true },
    { name: 'Prediction (Coming V1)', icon: LineChart, disabled: true },
    { name: 'Confirmation (Coming V1)', icon: CheckCircle, disabled: true },
    { name: 'Report (Coming V1)', icon: FileText, disabled: true },
  ];

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-200">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4">
          <div className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Project Modules
          </div>
          <nav className="space-y-1 px-2">
            {sidebarItems.map((item, index) => (
              <div 
                key={index}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${
                  item.disabled 
                    ? 'text-gray-400 cursor-not-allowed bg-gray-50/50' 
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 cursor-pointer'
                }`}
                title={item.disabled ? 'Coming in V1' : ''}
              >
                <item.icon size={18} />
                {item.name}
              </div>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {/* Workspace Toolbar */}
        <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            {isEditingName ? (
              <input 
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                className="text-lg font-medium text-gray-900 bg-gray-100 px-2 py-1 rounded outline-none ring-2 ring-blue-500"
                autoFocus
              />
            ) : (
              <h2 
                className="text-lg font-medium text-gray-900 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                onClick={() => setIsEditingName(true)}
              >
                {name}
              </h2>
            )}
            {project?.status && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {project.status}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setNewProjectName(name);
                setSaveAsModalOpen(true);
              }}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded border border-gray-300"
            >
              Save As
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Workspace Content */}
        <div className="flex-1 p-8 overflow-auto">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-12 text-center max-w-2xl mx-auto mt-10">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Settings size={32} />
            </div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">Project Workspace initialized</h3>
            <p className="text-gray-500 mb-6">
              The project structure is ready. Statistical modules (Design, Analysis, Optimization) will be implemented in Phase 2 (V1).
            </p>
            <div className="bg-gray-50 rounded p-4 text-left text-sm text-gray-600 font-mono border border-gray-200">
              <pre>{JSON.stringify({ id: project?.id || 'new', name, status: project?.status || 'NEW', data: project?.data || {} }, null, 2)}</pre>
            </div>
          </div>
        </div>
      </div>

      {/* Save As Modal */}
      {saveAsModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Save Project As</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
              <input 
                type="text" 
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter project name..."
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setSaveAsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded border border-gray-300"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveAs}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
              >
                Save Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
