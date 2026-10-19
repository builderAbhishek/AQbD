import { createContext, useContext, useState, useRef, ReactNode, useEffect } from 'react';
import { Project, projectsApi } from '../api/client';
import { useNavigate } from 'react-router-dom';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'unsaved' | 'error';

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
  autosaveStatus: AutosaveStatus;
  error: string | null;
  clearError: () => void;
  updateDesignRunResponse: (designId: string | null, runIdOrIndex: string | number, respId: string, value: number | null) => any[];
  saveDesignAnalysis: (designId: string, responseId: string, analysis: any) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<Project | null>(null);
  const [isModified, setIsModified] = useState(false);
  const [activeNode, setActiveNode] = useState('Design Table');
  const [activeTab, setActiveTab] = useState('Design Table');
  const [activeResponseId, setActiveResponseId] = useState<string | null>(null);
  const [activeDesignId, setActiveDesignId] = useState<string | null>(() => {
    return localStorage.getItem('aqbd_active_design_id') || null;
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  // Track latest project in a ref to avoid stale closures in debounced saves
  const projectRef = useRef<Project | null>(project);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  const autosaveTimerRef = useRef<any>(null);
  const isSavingInProgressRef = useRef(false);
  const pendingSaveNeededRef = useRef(false);

  const handleSetActiveDesignId = (id: string | null) => {
    setActiveDesignId(id);
    if (id) {
      localStorage.setItem('aqbd_active_design_id', id);
    } else {
      localStorage.removeItem('aqbd_active_design_id');
    }
  };

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

        // Normalize analyses: ensure design.analyses exists
        if (data.data.designs) {
          for (const dId of Object.keys(data.data.designs)) {
            const des = data.data.designs[dId];
            if (!des.analyses) {
              des.analyses = {};
            }
            // Merge from top-level data.analysis if present
            if (data.data.analysis) {
              for (const [rId, an] of Object.entries(data.data.analysis)) {
                if (!des.analyses[rId]) {
                  des.analyses[rId] = an;
                }
              }
            }
          }
        }
        
        // Restore active design from stored or first available
        const storedDesignId = localStorage.getItem('aqbd_active_design_id');
        if (storedDesignId && data.data.designs?.[storedDesignId]) {
          handleSetActiveDesignId(storedDesignId);
        } else if (data.data.designs && Object.keys(data.data.designs).length > 0) {
          handleSetActiveDesignId(Object.keys(data.data.designs)[0]);
        } else {
          handleSetActiveDesignId(null);
        }
      } else {
        data.data = { designs: {} };
      }

      setProject(data);
      projectRef.current = data;
      setIsModified(false);
      setAutosaveStatus('saved');
      localStorage.setItem('aqbd_active_project_id', id);
      navigate(`/?id=${id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to open project');
      localStorage.removeItem('aqbd_active_project_id');
    } finally {
      setLoading(false);
    }
  };

  const newProject = () => {
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
    projectRef.current = newProj;
    setIsModified(true);
    setAutosaveStatus('unsaved');
    handleSetActiveDesignId(null);
    setActiveNode('Design Table');
    setActiveTab('Design Table');
    setActiveResponseId(null);
    localStorage.removeItem('aqbd_active_project_id');
    localStorage.removeItem('aqbd_active_design_id');
    navigate('/');
  };

  const performSave = async (name: string): Promise<Project | null> => {
    const current = projectRef.current;
    if (!current) return null;

    setSaving(true);
    setAutosaveStatus('saving');
    setError(null);
    isSavingInProgressRef.current = true;

    try {
      let savedProject: Project;
      if (current.id.startsWith('temp-')) {
        savedProject = await projectsApi.create({ name, data: current.data });
        localStorage.setItem('aqbd_active_project_id', savedProject.id);
        navigate(`/?id=${savedProject.id}`);
      } else {
        savedProject = await projectsApi.update(current.id, { name, data: current.data });
      }

      // Merge saved metadata while strictly preserving any in-memory edits that happened while request was in-flight
      setProject(prev => {
        if (!prev) return savedProject;
        return {
          ...savedProject,
          data: prev.data, // preserve latest in-memory edits
        };
      });

      projectRef.current = {
        ...savedProject,
        data: projectRef.current?.data || savedProject.data,
      };

      setIsModified(false);
      setAutosaveStatus('saved');
      return savedProject;
    } catch (err: any) {
      console.error('Save failed:', err);
      setError(err.message || 'Failed to save project');
      setAutosaveStatus('error');
      setIsModified(true);
      return null;
    } finally {
      setSaving(false);
      isSavingInProgressRef.current = false;

      // If another save was requested while this one was saving, execute it now
      if (pendingSaveNeededRef.current) {
        pendingSaveNeededRef.current = false;
        performSave(name);
      }
    }
  };

  const saveProject = async (name: string) => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    await performSave(name);
  };

  const scheduleAutosave = () => {
    setIsModified(true);
    setAutosaveStatus('unsaved');

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(async () => {
      const current = projectRef.current;
      if (!current) return;
      if (isSavingInProgressRef.current) {
        pendingSaveNeededRef.current = true;
        return;
      }
      await performSave(current.name);
    }, 600);
  };

  const updateDesignRunResponse = (
    designId: string | null,
    runIdOrIndex: string | number,
    respId: string,
    value: number | null
  ): any[] => {
    const current = projectRef.current;
    if (!current || !designId || !current.data?.designs?.[designId]) {
      return [];
    }

    const design = current.data.designs[designId];
    const runs = [...(design.runs || [])];

    // Find run by ID or stdOrder/runOrder or index
    let runIndex = runs.findIndex(r => r.id === runIdOrIndex);
    if (runIndex === -1 && typeof runIdOrIndex === 'number') {
      runIndex = runs.findIndex(r => r.stdOrder === runIdOrIndex || r.runOrder === runIdOrIndex);
    }
    if (runIndex === -1 && typeof runIdOrIndex === 'number' && runIdOrIndex >= 0 && runIdOrIndex < runs.length) {
      runIndex = runIdOrIndex;
    }

    if (runIndex === -1) {
      return runs;
    }

    const oldVal = runs[runIndex]?.responses?.[respId] ?? null;
    if (oldVal === value) {
      return runs;
    }

    // Immutable update of run
    runs[runIndex] = {
      ...runs[runIndex],
      responses: {
        ...(runs[runIndex]?.responses || {}),
        [respId]: value,
      },
    };

    // Mark existing analysis for this response as outdated
    const updatedAnalyses = { ...(design.analyses || {}) };
    if (updatedAnalyses[respId]) {
      updatedAnalyses[respId] = {
        ...updatedAnalyses[respId],
        isOutdated: true,
        outdatedReason: `Response data modified at run ${runs[runIndex].stdOrder || runIndex + 1}`,
      };
    }

    // Mark optimization results as outdated
    const updatedOptimization = { ...(design.optimization || {}) };
    if (updatedOptimization.results) {
      updatedOptimization.results = {
        ...updatedOptimization.results,
        isOutdated: true,
      };
    }

    const updatedDesigns = {
      ...current.data.designs,
      [designId]: {
        ...design,
        runs,
        analyses: updatedAnalyses,
        optimization: updatedOptimization,
        runsModifiedAt: new Date().toISOString(),
      },
    };

    const updatedProject: Project = {
      ...current,
      data: {
        ...current.data,
        designs: updatedDesigns,
        analysis: current.data.analysis ? {
          ...current.data.analysis,
          [respId]: updatedAnalyses[respId] || current.data.analysis[respId],
        } : undefined,
      },
    };

    setProject(updatedProject);
    projectRef.current = updatedProject;
    scheduleAutosave();

    return runs;
  };

  const saveDesignAnalysis = async (
    designId: string,
    responseId: string,
    analysis: any
  ) => {
    const current = projectRef.current;
    if (!current || !designId || !current.data?.designs?.[designId]) return;

    const design = current.data.designs[designId];
    const updatedAnalyses = {
      ...(design.analyses || {}),
      [responseId]: {
        ...analysis,
        isOutdated: false,
        timestamp: new Date().toISOString(),
      },
    };

    // Mark optimization results as outdated when a model is refitted
    const updatedOptimization = { ...(design.optimization || {}) };
    if (updatedOptimization.results) {
      updatedOptimization.results = {
        ...updatedOptimization.results,
        isOutdated: true,
      };
    }

    const updatedDesigns = {
      ...current.data.designs,
      [designId]: {
        ...design,
        analyses: updatedAnalyses,
        optimization: updatedOptimization,
      },
    };

    const updatedProject: Project = {
      ...current,
      data: {
        ...current.data,
        designs: updatedDesigns,
        analysis: current.data.analysis
          ? {
              ...current.data.analysis,
              [responseId]: updatedAnalyses[responseId],
            }
          : undefined,
      },
    };

    setProject(updatedProject);
    projectRef.current = updatedProject;
    await performSave(current.name);
  };

  const closeProject = () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    setProject(null);
    projectRef.current = null;
    setIsModified(false);
    setAutosaveStatus('idle');
    localStorage.removeItem('aqbd_active_project_id');
    localStorage.removeItem('aqbd_active_design_id');
    navigate('/');
  };

  const setModified = (mod: boolean) => {
    setIsModified(mod);
    setAutosaveStatus(mod ? 'unsaved' : 'saved');
  };

  const clearError = () => setError(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
      activeResponseId, setActiveResponseId, activeDesignId, setActiveDesignId: handleSetActiveDesignId,
      openProject, newProject, saveProject, closeProject, setModified,
      loading, saving, autosaveStatus, error, clearError, updateDesignRunResponse,
      saveDesignAnalysis
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
