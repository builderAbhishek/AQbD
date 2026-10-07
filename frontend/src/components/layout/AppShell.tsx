import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import MenuBar from './MenuBar';
import ToolBar from './ToolBar';
import ProjectTree from './ProjectTree';
import Workspace from './Workspace';
import StatusBar from './StatusBar';
import { useProject } from '../../context/ProjectContext';
import { projectsApi, Project } from '../../api/client';
import { FolderOpen, Save, Trash2, X, Edit3 } from 'lucide-react';
import CCDWizard from '../views/design/CCDWizard';
import BBDWizard from '../views/design/BBDWizard';

export default function AppShell() {
  const [searchParams] = useSearchParams();
  const { openProject, newProject, saveProject, project, isModified, setActiveDesignId, setActiveTab, openProject: reloadProject } = useProject();

  const [dialogState, setDialogState] = useState<{
    open: boolean;
    type: 'open' | 'saveAs' | 'delete' | 'rename' | 'ccdWizard' | 'bbdWizard' | 'closeDesign';
  }>({ open: false, type: 'open' });

  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [saveName, setSaveName] = useState('');
  const [loadingList, setLoadingList] = useState(false);

  useEffect(() => {
    const id = searchParams.get('id');
    if (id && (!project || project.id !== id)) {
      openProject(id);
    } else if (!id && !project) {
      newProject();
    }
  }, [searchParams, openProject, newProject, project]);

  useEffect(() => {
    const handleOpenDialog = async (type: 'open' | 'saveAs' | 'delete' | 'rename' | 'ccdWizard' | 'bbdWizard' | 'closeDesign') => {
      setDialogState({ open: true, type });
      if (type === 'open') {
        setLoadingList(true);
        try {
          const list = await projectsApi.list();
          setProjectsList(list);
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingList(false);
        }
      }
      if (type === 'saveAs' || type === 'rename') {
        setSaveName(project?.name === '(Untitled)' ? '' : (project?.name || ''));
      }
    };

    const listeners = {
      'request-open': () => handleOpenDialog('open'),
      'request-save-as': () => handleOpenDialog('saveAs'),
      'request-rename': () => handleOpenDialog('rename'),
      'request-delete': () => handleOpenDialog('delete'),
      'request-ccd-wizard': () => handleOpenDialog('ccdWizard'),
      'request-bbd-wizard': () => handleOpenDialog('bbdWizard')
    };

    window.addEventListener('request-open', listeners['request-open']);
    window.addEventListener('request-save-as', listeners['request-save-as']);
    window.addEventListener('request-rename', listeners['request-rename']);
    window.addEventListener('request-delete', listeners['request-delete']);
    window.addEventListener('request-ccd-wizard', listeners['request-ccd-wizard']);
    window.addEventListener('request-bbd-wizard', listeners['request-bbd-wizard']);

    return () => {
      window.removeEventListener('request-open', listeners['request-open']);
      window.removeEventListener('request-save-as', listeners['request-save-as']);
      window.removeEventListener('request-rename', listeners['request-rename']);
      window.removeEventListener('request-delete', listeners['request-delete']);
      window.removeEventListener('request-ccd-wizard', listeners['request-ccd-wizard']);
      window.removeEventListener('request-bbd-wizard', listeners['request-bbd-wizard']);
    };
  }, [project]);

  useEffect(() => {
    const handleCloseRequest = () => {
      if (isModified) {
        setDialogState({ open: true, type: 'closeDesign' });
      } else {
        setActiveDesignId(null);
      }
    };
    const handleHelpRequest = () => {
      setActiveTab('Help & Documentation');
    };
    window.addEventListener('request-close-design', handleCloseRequest);
    window.addEventListener('request-help', handleHelpRequest);
    return () => {
      window.removeEventListener('request-close-design', handleCloseRequest);
      window.removeEventListener('request-help', handleHelpRequest);
    };
  }, [isModified, setActiveDesignId, setActiveTab]);

  const closeDialog = () => setDialogState({ ...dialogState, open: false });

  const handleOpenProject = (id: string) => {
    openProject(id);
    closeDialog();
  };

  const handleSaveAs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveName.trim()) return;
    await saveProject(saveName);
    closeDialog();
  };
  
  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveName.trim() || !project || project.id.startsWith('temp-')) return;
    await saveProject(saveName); // saveProject already updates the existing one if not temp
    closeDialog();
  };

  const handleDeleteProject = async () => {
    if (!project || project.id.startsWith('temp-')) return;
    try {
      await projectsApi.delete(project.id);
      newProject(); // Start fresh
      closeDialog();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCloseDesignSave = async () => {
    if (project) {
      try {
        await saveProject(project.name);
        setActiveDesignId(null);
        closeDialog();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleCloseDesignDontSave = async () => {
    if (project) {
      try {
        if (!project.id.startsWith('temp-')) {
          await reloadProject(project.id);
        } else {
          newProject();
        }
        setActiveDesignId(null);
        closeDialog();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleCloseDesignCancel = () => {
    closeDialog();
  };

  const DialogOverlay = ({ children, title, icon: Icon }: any) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-[#F0F0F0] border border-[#A0A0A0] shadow-xl rounded-sm w-[450px] flex flex-col font-sans text-sm select-none">
        {/* Title bar */}
        <div className="bg-white border-b border-[#D0D0D0] px-3 py-2 flex justify-between items-center text-gray-800 font-semibold text-xs">
          <div className="flex items-center gap-2">
            <Icon size={14} className="text-blue-600" />
            {title}
          </div>
          <button onClick={closeDialog} className="hover:bg-red-500 hover:text-white p-0.5 rounded-sm">
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen w-screen bg-[#F0F0F0] text-sm overflow-hidden font-sans select-none">
      <MenuBar />
      <ToolBar />

      <div className="flex-1 flex min-h-0 overflow-hidden border-t border-[#A0A0A0]">
        <div className="w-64 border-r border-[#A0A0A0] bg-white flex flex-col shadow-[1px_0_3px_rgba(0,0,0,0.1)] z-10 shrink-0">
          <ProjectTree />
        </div>
        <div className="flex-1 bg-[#E8E8E8] flex flex-col min-w-0">
          <Workspace />
        </div>
      </div>

      <StatusBar />
      
      {dialogState.open && dialogState.type === 'open' && (
        <DialogOverlay title="Open Project" icon={FolderOpen}>
          <div className="p-4 bg-white flex-1 min-h-[250px] max-h-[400px] overflow-auto">
            {loadingList ? (
              <div className="text-center text-gray-500 py-8">Loading...</div>
            ) : projectsList.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No projects found.</div>
            ) : (
              <div className="border border-gray-300">
                <div className="bg-[#EAEAEA] flex text-xs font-semibold px-2 py-1 border-b border-gray-300">
                  <div className="flex-1">Name</div>
                  <div className="w-32">Modified</div>
                </div>
                {projectsList.map(p => (
                  <div 
                    key={p.id} 
                    className="flex text-xs px-2 py-1.5 border-b border-gray-100 hover:bg-blue-50 cursor-pointer"
                    onClick={() => handleOpenProject(p.id)}
                  >
                    <div className="flex-1 truncate font-medium">{p.name}</div>
                    <div className="w-32 text-gray-500 truncate">{new Date(p.updatedAt).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-[#F0F0F0] border-t border-[#D0D0D0] p-3 flex justify-end gap-2">
            <button onClick={closeDialog} className="px-4 py-1.5 border border-gray-400 rounded-sm bg-[#E0E0E0] hover:bg-[#D0D0D0]">Cancel</button>
          </div>
        </DialogOverlay>
      )}

      {dialogState.open && dialogState.type === 'saveAs' && (
        <DialogOverlay title="Save Project As" icon={Save}>
          <form onSubmit={handleSaveAs}>
            <div className="p-6 bg-white">
              <label className="block text-xs font-semibold text-gray-700 mb-2">Project Name:</label>
              <input 
                autoFocus
                type="text" 
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                className="w-full border border-gray-400 p-1.5 text-sm rounded-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                placeholder="Enter project name"
              />
            </div>
            <div className="bg-[#F0F0F0] border-t border-[#D0D0D0] p-3 flex justify-end gap-2">
              <button type="button" onClick={closeDialog} className="px-4 py-1.5 border border-gray-400 rounded-sm bg-[#E0E0E0] hover:bg-[#D0D0D0]">Cancel</button>
              <button type="submit" disabled={!saveName.trim()} className="px-4 py-1.5 border border-blue-600 rounded-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">Save</button>
            </div>
          </form>
        </DialogOverlay>
      )}

      {dialogState.open && dialogState.type === 'rename' && (
        <DialogOverlay title="Rename Project" icon={Edit3}>
          <form onSubmit={handleRename}>
            <div className="p-6 bg-white">
              <label className="block text-xs font-semibold text-gray-700 mb-2">New Project Name:</label>
              <input 
                autoFocus
                type="text" 
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                className="w-full border border-gray-400 p-1.5 text-sm rounded-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                placeholder="Enter project name"
              />
            </div>
            <div className="bg-[#F0F0F0] border-t border-[#D0D0D0] p-3 flex justify-end gap-2">
              <button type="button" onClick={closeDialog} className="px-4 py-1.5 border border-gray-400 rounded-sm bg-[#E0E0E0] hover:bg-[#D0D0D0]">Cancel</button>
              <button type="submit" disabled={!saveName.trim()} className="px-4 py-1.5 border border-blue-600 rounded-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">Rename</button>
            </div>
          </form>
        </DialogOverlay>
      )}

      {dialogState.open && dialogState.type === 'delete' && (
        <DialogOverlay title="Confirm Delete" icon={Trash2}>
          <div className="p-6 bg-white flex items-start gap-4">
            <div className="text-red-500 mt-1"><Trash2 size={24} /></div>
            <div>
              <h3 className="font-semibold text-gray-800 text-base mb-1">Delete Project Permanently?</h3>
              <p className="text-gray-600">Are you sure you want to delete "{project?.name}"? This action cannot be undone.</p>
            </div>
          </div>
          <div className="bg-[#F0F0F0] border-t border-[#D0D0D0] p-3 flex justify-end gap-2">
            <button onClick={closeDialog} className="px-4 py-1.5 border border-gray-400 rounded-sm bg-[#E0E0E0] hover:bg-[#D0D0D0]">Cancel</button>
            <button onClick={handleDeleteProject} className="px-4 py-1.5 border border-red-600 rounded-sm bg-red-600 text-white hover:bg-red-700">Delete</button>
          </div>
        </DialogOverlay>
      )}

      {dialogState.open && dialogState.type === 'closeDesign' && (
        <DialogOverlay title="Close Design">
          <div className="p-6 bg-white">
            <p className="text-gray-800 text-sm">Do you want to save changes before closing this design?</p>
          </div>
          <div className="bg-[#F0F0F0] border-t border-[#D0D0D0] p-3 flex justify-end gap-2">
            <button autoFocus onClick={handleCloseDesignSave} className="px-4 py-1.5 border border-gray-400 rounded-sm bg-[#E0E0E0] hover:bg-[#D0D0D0]">Save</button>
            <button onClick={handleCloseDesignDontSave} className="px-4 py-1.5 border border-gray-400 rounded-sm bg-[#E0E0E0] hover:bg-[#D0D0D0]">Don't Save</button>
            <button onClick={handleCloseDesignCancel} className="px-4 py-1.5 border border-gray-400 rounded-sm bg-[#E0E0E0] hover:bg-[#D0D0D0]">Cancel</button>
          </div>
        </DialogOverlay>
      )}

      {dialogState.open && dialogState.type === 'ccdWizard' && (
        <CCDWizard onClose={closeDialog} />
      )}

      {dialogState.open && dialogState.type === 'bbdWizard' && (
        <BBDWizard onClose={closeDialog} />
      )}
    </div>
  );
}
