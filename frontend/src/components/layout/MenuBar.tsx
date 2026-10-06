import { useState, useRef, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { projectsApi } from '../../api/client';

type MenuState = string | null;

export default function MenuBar() {
  const [activeMenu, setActiveMenu] = useState<MenuState>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { newProject, saveProject, project, activeDesignId } = useProject();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMenu = (menuName: string) => {
    if (activeMenu === menuName) setActiveMenu(null);
    else setActiveMenu(menuName);
  };

  const handleHover = (menuName: string) => {
    if (activeMenu) setActiveMenu(menuName);
  };

  const handleAction = (action: () => void) => {
    action();
    setActiveMenu(null);
  };

  const MenuItem = ({ label, shortcut, onClick, disabled = false, separator = false, hasChildren = false, onMouseEnter, onMouseLeave }: any) => {
    if (separator) return <div className="border-t border-gray-300 my-1"></div>;
    return (
      <div 
        className={`px-4 py-1 flex justify-between items-center cursor-default relative ${disabled ? 'text-gray-400' : 'hover:bg-blue-500 hover:text-white'}`}
        onClick={() => {
          if (!disabled && onClick && !hasChildren) handleAction(onClick);
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <span>{label}</span>
        {shortcut && <span className="text-xs opacity-70 ml-6">{shortcut}</span>}
        {hasChildren && <span className="ml-4">▶</span>}
      </div>
    );
  };

  const hasProject = project && !project.id.startsWith('temp-');

  // State for nested menus
  const [activeSubMenu, setActiveSubMenu] = useState<string | null>(null);

  return (
    <div className="bg-[#FAFAFA] flex items-center h-7 px-2 border-b border-[#D0D0D0] text-xs shadow-sm" ref={menuRef}>
      <div className="flex space-x-1">
        {/* File Menu */}
        <div className="relative">
          <button 
            className={`px-2 py-1 rounded-sm ${activeMenu === 'File' ? 'bg-blue-100' : 'hover:bg-[#E5E5E5]'}`}
            onClick={() => toggleMenu('File')}
            onMouseEnter={() => handleHover('File')}
          >
            File
          </button>
          {activeMenu === 'File' && (
            <div className="absolute top-full left-0 mt-0 bg-white border border-gray-400 shadow-lg py-1 min-w-[200px] z-50">
              <MenuItem label="New Project" shortcut="Ctrl+N" onClick={newProject} />
              <MenuItem label="Open Project..." shortcut="Ctrl+O" onClick={() => window.dispatchEvent(new CustomEvent('request-open'))} />
              <MenuItem separator />
              <MenuItem label="Save" shortcut="Ctrl+S" onClick={() => {
                if (hasProject) {
                  saveProject(project.name);
                } else {
                  window.dispatchEvent(new CustomEvent('request-save-as'));
                }
              }} />
              <MenuItem label="Save As..." shortcut="Ctrl+Shift+S" onClick={() => window.dispatchEvent(new CustomEvent('request-save-as'))} />
              <MenuItem label="Close Design" disabled={!activeDesignId} onClick={() => window.dispatchEvent(new CustomEvent('request-close-design'))} />
              <MenuItem label="Rename Project..." disabled={!hasProject} onClick={() => window.dispatchEvent(new CustomEvent('request-rename'))} />
              <MenuItem separator />
              <MenuItem label="Duplicate Project..." disabled={!hasProject} onClick={async () => {
                if (project && !project.id.startsWith('temp-')) {
                  const newProj = await projectsApi.duplicate(project.id);
                  window.location.href = `/?id=${newProj.id}`;
                }
              }} />
              <MenuItem label="Archive Project..." disabled={!hasProject} onClick={async () => {
                if (project && !project.id.startsWith('temp-')) {
                  await projectsApi.archive(project.id);
                  newProject(); // Start fresh
                }
              }} />
              <MenuItem label="Delete Project..." disabled={!hasProject} onClick={() => window.dispatchEvent(new CustomEvent('request-delete'))} />
              <MenuItem separator />
              <MenuItem label="Import..." disabled />
              <MenuItem label="Export..." disabled={!hasProject} onClick={() => {
                 if (project && !project.id.startsWith('temp-')) {
                   const url = projectsApi.exportUrl(project.id);
                   window.open(url, '_blank');
                 }
              }} />
              <MenuItem separator />
              <MenuItem label="Exit" onClick={() => {}} />
            </div>
          )}
        </div>

        {/* Edit Menu */}
        <div className="relative">
          <button 
            className={`px-2 py-1 rounded-sm ${activeMenu === 'Edit' ? 'bg-blue-100' : 'hover:bg-[#E5E5E5]'}`}
            onClick={() => toggleMenu('Edit')}
            onMouseEnter={() => handleHover('Edit')}
          >
            Edit
          </button>
          {activeMenu === 'Edit' && (
            <div className="absolute top-full left-0 mt-0 bg-white border border-gray-400 shadow-lg py-1 min-w-[200px] z-50">
              <MenuItem label="Undo" shortcut="Ctrl+Z" disabled />
              <MenuItem label="Redo" shortcut="Ctrl+Y" disabled />
              <MenuItem separator />
              <MenuItem label="Cut" shortcut="Ctrl+X" disabled />
              <MenuItem label="Copy" shortcut="Ctrl+C" disabled />
              <MenuItem label="Paste" shortcut="Ctrl+V" disabled />
              <MenuItem label="Select All" shortcut="Ctrl+A" disabled />
            </div>
          )}
        </div>

        {/* View Menu */}
        <div className="relative">
          <button 
            className={`px-2 py-1 rounded-sm ${activeMenu === 'View' ? 'bg-blue-100' : 'hover:bg-[#E5E5E5]'}`}
            onClick={() => toggleMenu('View')}
            onMouseEnter={() => handleHover('View')}
          >
            View
          </button>
          {activeMenu === 'View' && (
            <div className="absolute top-full left-0 mt-0 bg-white border border-gray-400 shadow-lg py-1 min-w-[200px] z-50">
              <MenuItem label="Project Tree" disabled />
              <MenuItem label="Properties" disabled />
              <MenuItem label="Toolbar" disabled />
              <MenuItem label="Status Bar" disabled />
              <MenuItem separator />
              <MenuItem label="Reset Layout" disabled />
            </div>
          )}
        </div>

        {/* Design Menu */}
        <div className="relative">
          <button 
            className={`px-2 py-1 rounded-sm ${activeMenu === 'Design' ? 'bg-blue-100' : 'hover:bg-[#E5E5E5]'}`}
            onClick={() => { toggleMenu('Design'); setActiveSubMenu(null); }}
            onMouseEnter={() => { handleHover('Design'); setActiveSubMenu(null); }}
          >
            Design
          </button>
          {activeMenu === 'Design' && (
            <div className="absolute top-full left-0 mt-0 bg-white border border-gray-400 shadow-lg py-1 min-w-[200px] z-50">
              
              <div 
                className="relative group"
                onMouseEnter={() => setActiveSubMenu('rs')}
                onMouseLeave={() => setActiveSubMenu(null)}
              >
                <MenuItem label="Response Surface" hasChildren />
                
                {(activeSubMenu === 'rs' || activeSubMenu === 'rs-rand') && (
                  <div className="absolute top-0 left-full -mt-1 bg-white border border-gray-400 shadow-lg py-1 min-w-[200px] z-50">
                    <div 
                      className="relative group"
                      onMouseEnter={() => setActiveSubMenu('rs-rand')}
                      onMouseLeave={() => setActiveSubMenu('rs')}
                    >
                      <MenuItem label="Randomized" hasChildren />
                      
                      {activeSubMenu === 'rs-rand' && (
                        <div className="absolute top-0 left-full -mt-1 bg-white border border-gray-400 shadow-lg py-1 min-w-[200px] z-50"
                             onMouseEnter={() => setActiveSubMenu('rs-rand')}
                             onMouseLeave={() => setActiveSubMenu('rs')}>
                          <MenuItem label="Central Composite" onClick={() => window.dispatchEvent(new CustomEvent('request-ccd-wizard'))} />
                          <MenuItem label="Box-Behnken" onClick={() => window.dispatchEvent(new CustomEvent('request-bbd-wizard'))} />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <MenuItem label="Split-Plot" disabled />
              <MenuItem label="Mixture" disabled />
              <MenuItem label="Custom Designs" disabled hasChildren />
            </div>
          )}
        </div>

        {/* Analysis Menu */}
        <div className="relative">
          <button 
            className={`px-2 py-1 rounded-sm ${activeMenu === 'Analysis' ? 'bg-blue-100' : 'hover:bg-[#E5E5E5]'}`}
            onClick={() => toggleMenu('Analysis')}
            onMouseEnter={() => handleHover('Analysis')}
          >
            Analysis
          </button>
          {activeMenu === 'Analysis' && (
            <div className="absolute top-full left-0 mt-0 bg-white border border-gray-400 shadow-lg py-1 min-w-[200px] z-50">
              <MenuItem label="Model Selection" disabled />
              <MenuItem label="ANOVA" disabled />
              <MenuItem label="Diagnostics" disabled />
              <MenuItem label="Equations" disabled />
            </div>
          )}
        </div>
        
        {/* Help Menu */}
        <div className="relative">
          <button 
            className={`px-2 py-1 rounded-sm ${activeMenu === 'Help' ? 'bg-blue-100' : 'hover:bg-[#E5E5E5]'}`}
            onClick={() => toggleMenu('Help')}
            onMouseEnter={() => handleHover('Help')}
          >
            Help
          </button>
          {activeMenu === 'Help' && (
            <div className="absolute top-full left-0 mt-0 bg-white border border-gray-400 shadow-lg py-1 min-w-[200px] z-50">
              <MenuItem label="Documentation" disabled />
              <MenuItem separator />
              <MenuItem label="About AQbD Studio" disabled />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
