import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { X } from 'lucide-react';
import DesignTable from '../views/DesignTable';
import { AnalysisWorkspace } from '../views/analysis/AnalysisWorkspace';
import NotesWorkspace from '../views/NotesWorkspace';
import SummaryWorkspace from '../views/SummaryWorkspace';

export default function Workspace() {
  const { activeTab, setActiveTab } = useProject();
  const [openTabs, setOpenTabs] = useState<string[]>(['Design Table']);

  // Ensure activeTab is in openTabs, otherwise add it
  React.useEffect(() => {
    if (activeTab && !openTabs.includes(activeTab)) {
      setOpenTabs(prev => [...prev, activeTab]);
    }
  }, [activeTab]);

  const closeTab = (tab: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTabs = openTabs.filter(t => t !== tab);
    setOpenTabs(newTabs);
    if (activeTab === tab) {
      setActiveTab(newTabs.length > 0 ? newTabs[newTabs.length - 1] : '');
    }
  };

  const renderContent = () => {
    if (!activeTab) {
      return (
        <div className="flex-1 flex items-center justify-center text-gray-400 bg-[#FAFAFA]">
          <p>Select a node from the Project Tree to view it here.</p>
        </div>
      );
    }
    
    if (activeTab === 'Design Table') {
      return <DesignTable />;
    }

    if (activeTab.includes('Analysis')) {
      return <AnalysisWorkspace defaultTab="Configure" />;
    }

    if (activeTab.includes('Diagnostics')) {
      return <AnalysisWorkspace defaultTab="Diagnostics" />;
    }

    if (activeTab === 'Notes') {
      return <NotesWorkspace />;
    }

    if (activeTab === 'Summary' || activeTab === 'Design Overview') {
      return <SummaryWorkspace />;
    }

    return (
      <div className="flex-1 bg-[#FAFAFA] p-4">
        <h2 className="text-lg font-semibold text-[#003366] border-b border-[#D0D0D0] pb-2 mb-4">{activeTab}</h2>
        <div className="text-gray-500 italic text-sm border-2 border-dashed border-[#C0C0C0] bg-white p-12 text-center rounded">
          Placeholder for {activeTab} view.
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#EAEAEA] font-sans">
      {/* Tabs */}
      <div className="flex bg-[#EAEAEA] border-b border-[#C0C0C0] shrink-0 px-1 pt-1 overflow-x-auto no-scrollbar select-none z-10">
        {openTabs.map(tab => {
          const isActive = activeTab === tab;
          return (
            <div
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center px-3 py-1 text-xs cursor-pointer border border-[#C0C0C0] mr-0.5 max-w-[200px] transition-colors
                ${isActive 
                  ? 'bg-[#FAFAFA] font-bold text-[#003366] border-t-2 border-t-[#0055A4] border-b-transparent translate-y-[1px]' 
                  : 'bg-[#F0F0F0] text-gray-700 hover:bg-white border-b-[#C0C0C0]'}
              `}
              style={{ 
                marginBottom: isActive ? '-1px' : '0',
                boxShadow: isActive ? '0 -1px 2px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              <span className="truncate mr-2">{tab}</span>
              <button 
                className={`p-0.5 rounded-sm flex items-center justify-center ${isActive ? 'hover:bg-[#E5F3FF] text-[#0055A4]' : 'hover:bg-[#EAEAEA] text-gray-500'}`}
                onClick={(e) => closeTab(tab, e)}
              >
                <X size={12} strokeWidth={2.5} />
              </button>
            </div>
          );
        })}
      </div>
      
      {/* Document Area */}
      <div className="flex-1 overflow-auto bg-[#EAEAEA] p-1.5 relative z-0">
        <div className="absolute inset-1.5 bg-[#FAFAFA] border border-[#C0C0C0] shadow-sm flex flex-col overflow-hidden">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
