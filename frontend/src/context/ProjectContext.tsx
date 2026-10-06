import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Project, projectsApi } from '../api/client';
import { useNavigate } from 'react-router-dom';

interface ProjectContextType {
  project: Project | null;
  isModified: boolean;
  activeNode: string;
  setActiveNode: (node: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeResponseId: string | null;
  setActiveResponseId: (id: string | null) => void;
  activeDesignId: string | null;
  setActiveDesignId: (id: string | null) => void;
  openProject: (id: string) => Promise<void>;
  newProject: () => void;
  saveProject: (name: string) => Promise<void>;
  closeProject: () => void;
  setModified: (modified: boolean) => void;
  loading: boolean;
  saving: boolean;
  error: string | null;
  clearError: () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<Project | null>(null);
  const [isModified, setIsModified] = useState(false);
  const [activeNode, setActiveNode] = useState('Design Table');
  const [activeTab, setActiveTab] = useState('Design Table');
  const [activeResponseId, setActiveResponseId] = useState<string | null>(null);
  const [activeDesignId, setActiveDesignId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();

  const openProject = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await projectsApi.get(id);
      
      // Backward compatibility / migration
      if (data.data) {
        if (data.data.design && !data.data.designs) {
          // Migrate old single design to multiple designs
          const designId = data.data.design.id || 'design_' + Date.now();
          data.data.design.id = designId;
          data.data.designs = { [designId]: data.data.design };
          delete data.data.design;
        }
        
        // Select first available design if none active
        if (data.data.designs && Object.keys(data.data.designs).length > 0) {
          setActiveDesignId(Object.keys(data.data.designs)[0]);
        } else {
          setActiveDesignId(null);
        }
      } else {
        data.data = { designs: {} };
      }

      setProject(data);
      setIsModified(false);
      navigate(`/?id=${id}`); // Optional URL sync
    } catch (err: any) {
      setError(err.message || 'Failed to open project');
    } finally {
      setLoading(false);
    }
  };

  const newProject = () => {
    // Create an in-memory untitled project
    const newProj: any = {
      id: 'temp-' + Date.now(),
      name: '(Untitled)',
      status: 'Draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      data: {
        designs: {},
        analysis: {}
      }
    };
    setProject(newProj);
    setIsModified(true);
    setActiveDesignId(null);
    setActiveNode('Design Table');
    setActiveTab('Design Table');
    setActiveResponseId(null);
    navigate('/');
  };

  const saveProject = async (name: string) => {
    if (!project) return;
    setSaving(true);
    setError(null);
    try {
      if (project.id.startsWith('temp-')) {
        // Create new
        const created = await projectsApi.create({ name, data: project.data });
        setProject(created);
        navigate(`/?id=${created.id}`);
      } else {
        // Update existing
        const updated = await projectsApi.update(project.id, { name, data: project.data });
        setProject(updated);
      }
      setIsModified(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save project');
    } finally {
      setSaving(false);
    }
  };

  const closeProject = () => {
    setProject(null);
    setIsModified(false);
    navigate('/');
  };

  const setModified = (mod: boolean) => setIsModified(mod);
  const clearError = () => setError(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        newProject();
      } else if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (project && !project.id.startsWith('temp-')) {
          saveProject(project.name);
        } else {
          window.dispatchEvent(new CustomEvent('request-save-as'));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [project]);

  return (
    <ProjectContext.Provider value={{
      project, isModified, activeNode, setActiveNode, activeTab, setActiveTab,
      activeResponseId, setActiveResponseId, activeDesignId, setActiveDesignId,
      openProject, newProject, saveProject, closeProject, setModified,
      loading, saving, error, clearError
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
