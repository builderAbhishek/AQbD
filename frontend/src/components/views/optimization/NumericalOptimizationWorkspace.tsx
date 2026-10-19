import { useState, useEffect } from 'react';
import { useProject } from '../../../context/ProjectContext';
import { CriteriaScreen } from './CriteriaScreen';
import { SolutionsScreen } from './SolutionsScreen';

export function NumericalOptimizationWorkspace() {
  const { activeTab, setActiveTab } = useProject();
  const [activeSubTab, setActiveSubTab] = useState<'Criteria' | 'Solutions' | 'Graphs'>(() => {
    if (activeTab === 'Graphs' || activeTab === 'Optimization Graphs' || activeTab.startsWith('Optimization Graphs')) {
      return 'Graphs';
    }
    return activeTab === 'Solutions' ? 'Solutions' : 'Criteria';
  });

  useEffect(() => {
    if (activeTab === 'Solutions') {
      setActiveSubTab('Solutions');
    } else if (activeTab === 'Graphs' || activeTab === 'Optimization Graphs' || activeTab.startsWith('Optimization Graphs')) {
      setActiveSubTab('Graphs');
    } else if (activeTab === 'Criteria' || activeTab === 'Numerical') {
      setActiveSubTab('Criteria');
    }
  }, [activeTab]);

  const SUB_TABS = [
    { id: 'Criteria', label: 'Criteria', disabled: false },
    { id: 'Solutions', label: 'Solutions', disabled: false },
    { id: 'Graphs', label: 'Graphs', disabled: false, tooltip: 'Response and desirability graphs (Perturbation, One Factor, All Factors, Interaction, Contour, 3D Surface)' },
  ];

  const handleTabChange = (tabId: string) => {
    setActiveSubTab(tabId as any);
    if (tabId === 'Criteria' || tabId === 'Solutions' || tabId === 'Graphs') {
      setActiveTab(tabId);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#FAFAFA] font-sans">
      {/* Sub Tabs Bar */}
      <div className="flex border-b border-[#C0C0C0] bg-[#EAEAEA] px-2 pt-1.5 z-10 select-none">
        {SUB_TABS.map(tab => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              disabled={tab.disabled}
              onClick={() => {
                if (!tab.disabled) handleTabChange(tab.id);
              }}
              title={tab.tooltip || ''}
              className={`
                px-4 py-1 text-xs border mr-[2px] font-sans transition-colors
                ${tab.disabled 
                  ? 'bg-[#F5F5F5] text-[#A0A0A0] cursor-not-allowed border-transparent border-b-[#C0C0C0]' 
                  : isActive 
                    ? 'bg-white text-[#003366] border-[#C0C0C0] border-t-2 border-t-[#0055A4] border-b-transparent font-bold translate-y-[1px]' 
                    : 'bg-[#F0F0F0] text-gray-700 border-transparent border-b-[#C0C0C0] hover:bg-white hover:border-[#D0D0D0] hover:border-b-[#C0C0C0]'}
              `}
              style={{
                marginBottom: isActive ? '-1px' : '0',
                boxShadow: isActive ? '0 -1px 2px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden min-h-0 bg-[#FAFAFA]">
        {activeSubTab === 'Criteria' && <CriteriaScreen />}
        {activeSubTab === 'Solutions' && (
          <SolutionsScreen 
            initialView="tables"
            onNavigateToCriteria={() => handleTabChange('Criteria')} 
          />
        )}
        {activeSubTab === 'Graphs' && (
          <SolutionsScreen 
            initialView="graphs"
            onNavigateToCriteria={() => handleTabChange('Criteria')} 
          />
        )}
      </div>
    </div>
  );
}

