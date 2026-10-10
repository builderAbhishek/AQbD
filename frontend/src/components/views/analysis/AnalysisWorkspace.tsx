import { useState, useMemo, useEffect } from 'react';
import { useProject } from '../../../context/ProjectContext';
import { ConfigureAnalysis } from './ConfigureAnalysis';
import FitSummary from './FitSummary';
import { ModelTab } from './ModelTab';
import { ANOVA } from './ANOVA';
import { DiagnosticsTab } from './DiagnosticsTab';
import { ModelGraphsWorkspace } from './ModelGraphsWorkspace';
import { AnalysisErrorBoundary } from './AnalysisErrorBoundary';

// HMR trigger

export function AnalysisWorkspace({ defaultTab = 'Configure' }: { defaultTab?: string }) {
  const { project, activeDesignId, activeResponseId, setActiveResponseId } = useProject();
  const [internalTab, setInternalTab] = useState(defaultTab);
  
  useEffect(() => {
    setInternalTab(defaultTab);
  }, [defaultTab]);

  const design = activeDesignId && project?.data.designs ? project.data.designs[activeDesignId] : null;

  const responses = design?.config.responses || [];
  const currentResponse = responses.find((r: any) => r.id === activeResponseId);

  const analysis = useMemo(() => {
    if (!design || !activeResponseId || !design.analyses) return null;
    return design.analyses[activeResponseId] || null;
  }, [design, activeResponseId]);

  const hasFittedAnalysis = Boolean(analysis && (analysis.fittedModel || analysis.fitted));

  const isStale = useMemo(() => {
    if (!design || !analysis) return false;
    if (design.runsModifiedAt && analysis.timestamp) {
      return new Date(design.runsModifiedAt) > new Date(analysis.timestamp);
    }
    return false;
  }, [design, analysis]);

  if (!design) {
    return <div className="p-4 text-gray-500 text-sm">No design active.</div>;
  }

  const TABS = ['Configure', 'Fit Summary', 'Model', 'ANOVA', 'Diagnostics', 'Model Graphs'];

  return (
    <div className="flex flex-col h-full bg-[#FAFAFA] font-sans">
      {/* Top Header / Response Selector & Stale Warning */}
      <div className="bg-[#EAEAEA] border-b border-[#D0D0D0] px-4 py-1.5 flex flex-wrap items-center justify-between text-xs gap-3">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-gray-800">Response:</span>
          {responses.length > 0 ? (
            <select
              value={activeResponseId || ''}
              onChange={(e) => setActiveResponseId(e.target.value)}
              className="border border-[#C0C0C0] rounded-sm px-1.5 py-0.5 bg-white font-medium text-gray-800 shadow-sm focus:outline-none focus:border-[#0055A4] focus:ring-1 focus:ring-[#0055A4] transition-colors"
            >
              {responses.map((r: any) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.units ? `(${r.units})` : ''}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-gray-500">None configured</span>
          )}
        </div>

        {isStale && (
          <div className="flex items-center space-x-2 bg-[#FFF4CE] text-[#7A5B00] px-2 py-0.5 border border-[#F2D675] shadow-sm">
            <span className="font-semibold">⚠ Analysis out of date (data changed)</span>
            <button 
              onClick={() => setInternalTab('Configure')}
              className="px-2 py-0.5 bg-white hover:bg-[#F2D675] text-[#7A5B00] border border-[#D5AC2C] transition-colors shadow-sm"
            >
              Refit
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#C0C0C0] bg-[#EAEAEA] px-2 pt-2 z-10 select-none">
        {TABS.map(tab => {
          let disabled = false;
          let label = tab;
          
          if (tab === 'Fit Summary' || tab === 'ANOVA') {
            disabled = !hasFittedAnalysis;
          }
          if (tab === 'Diagnostics' || tab === 'Model Graphs') {
            disabled = !hasFittedAnalysis || isStale;
            if (disabled) label = `${tab} (Locked)`;
          }

          const isActive = internalTab === tab;

          return (
            <button
              key={tab}
              onClick={() => {
                if (!disabled) {
                  setInternalTab(tab);
                }
              }}
              disabled={disabled}
              className={`
                px-4 py-1 text-xs border mr-[2px] font-sans transition-colors
                ${disabled 
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
              {label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 z-0 bg-[#FAFAFA]">
        <AnalysisErrorBoundary onReset={() => setInternalTab('Configure')}>
          {internalTab === 'Configure' && <ConfigureAnalysis onComplete={() => setInternalTab('Model')} />}
          {internalTab === 'Fit Summary' && <FitSummary analysis={analysis} />}
          {internalTab === 'Model' && <ModelTab analysis={analysis} />}
          {internalTab === 'ANOVA' && (
            <ANOVA 
              analysis={analysis} 
              responseName={currentResponse?.name || 'Response'} 
            />
          )}
          {internalTab === 'Diagnostics' && (
            hasFittedAnalysis && !isStale ? (
              <DiagnosticsTab 
                analysis={analysis!} 
                responseName={currentResponse?.name || 'Response'} 
              />
            ) : (
              <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                <div className="text-4xl mb-4">(Locked)</div>
                <h2 className="text-lg font-semibold mb-2">Analysis Required</h2>
                <p className="text-sm max-w-md">
                  {isStale ? 'Analysis is out of date. Refit the model to update diagnostics.' : 'Run Start Analysis before viewing diagnostics.'}
                </p>
                <button 
                  onClick={() => setInternalTab('Configure')}
                  className="mt-6 px-4 py-2 bg-[#0055A4] text-white hover:bg-[#003366] font-medium text-sm shadow-sm"
                >
                  {isStale ? 'Refit Analysis' : 'Go to Configure'}
                </button>
              </div>
            )
          )}
          {internalTab === 'Model Graphs' && (
            hasFittedAnalysis && !isStale ? (
              <ModelGraphsWorkspace 
                analysis={analysis!} 
                design={design} 
                responseName={currentResponse?.name || 'Response'} 
              />
            ) : (
              <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                <div className="text-4xl mb-4">(Locked)</div>
                <h2 className="text-lg font-semibold mb-2">Analysis Required</h2>
                <p className="text-sm max-w-md">
                  {isStale ? 'Analysis is out of date. Refit the model before viewing Model Graphs.' : 'Run Start Analysis to generate model graphs.'}
                </p>
                <button 
                  onClick={() => setInternalTab('Configure')}
                  className="mt-6 px-4 py-2 bg-[#0055A4] text-white hover:bg-[#003366] font-medium text-sm shadow-sm"
                >
                  {isStale ? 'Refit Analysis' : 'Go to Configure'}
                </button>
              </div>
            )
          )}
        </AnalysisErrorBoundary>
      </div>
    </div>
  );
}
