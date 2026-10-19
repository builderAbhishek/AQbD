import { useState, useMemo, useEffect, useCallback } from 'react';
import { useProject } from '../../../context/ProjectContext';
import { 
  FactorBounds,
  FittedModelRef
} from '../../../lib/optimization/solver';
import { ensureAllResponseModelsCurrent } from '../../../lib/statistics/rsm/modelFitting';
import { 
  OptimizationSolution, 
  initializeDesignCriteria 
} from '../../../lib/optimization/types';
import {
  ResponseGraphicalLimit,
  initializeGraphicalLimits,
  calculateOverlayGrid,
  sliceDesignPoints,
} from '../../../lib/optimization/graphicalOptimization';
import { GraphicalCriteriaTab } from './graphical/GraphicalCriteriaTab';
import { OverlayPlotCanvas } from './graphical/OverlayPlotCanvas';
import { FactorsTool } from './graphical/FactorsTool';
import { 
  ListFilter,
  LineChart, 
  Layers, 
  Maximize2, 
  Code2
} from 'lucide-react';
import { PopOutModal } from './PopOutModal';

export function GraphicalOptimizationWorkspace() {
  const { project, activeDesignId, saveProject } = useProject();
  const design = activeDesignId && project?.data?.designs ? project.data.designs[activeDesignId] : null;

  const rawFactors = useMemo(() => design?.config?.factors || [], [design?.config?.factors]);
  const rawResponses = useMemo(() => design?.config?.responses || [], [design?.config?.responses]);
  const rawRuns = useMemo(() => design?.runs || [], [design?.runs]);

  // Primary top subtabs: Criteria vs Graphs (matching Design-Expert 13)
  const [activeTab, setActiveTab] = useState<'Criteria' | 'Graphs'>('Graphs');

  // Ensure optimization criteria is initialized
  const criteria = useMemo(() => {
    return initializeDesignCriteria(
      rawFactors,
      rawResponses,
      rawRuns,
      design?.optimization?.criteria
    );
  }, [rawFactors, rawResponses, rawRuns, design?.optimization?.criteria]);

  // Response models
  const { analyses } = useMemo(() => {
    let currentAnalyses = design?.analyses || {};
    if (design) {
      try {
        const { updatedAnalyses, didRefit } = ensureAllResponseModelsCurrent(design, criteria);
        if (didRefit) {
          currentAnalyses = updatedAnalyses;
        }
      } catch (e) {
        console.warn('Auto-refit check encountered an issue:', e);
      }
    }
    return { analyses: currentAnalyses };
  }, [design, criteria]);

  // Usable models dictionary
  const usableModels: Record<string, FittedModelRef> = useMemo(() => {
    const map: Record<string, FittedModelRef> = {};
    for (const r of rawResponses) {
      const an = analyses[r.id];
      const mod = an?.fittedModel || an?.fitted;
      if (mod && Array.isArray(mod.coefficients) && mod.coefficients.length > 0) {
        map[r.id] = {
          modelType: mod.modelType || 'Quadratic',
          terms: mod.terms || [],
          coefficients: mod.coefficients || [],
        };
      }
    }
    return map;
  }, [rawResponses, analyses]);

  // Graphical limits state
  const [graphicalLimits, setGraphicalLimits] = useState<Record<string, ResponseGraphicalLimit>>(() => {
    return initializeGraphicalLimits(
      rawResponses,
      criteria,
      rawRuns,
      design?.optimization?.graphicalLimits
    );
  });

  // Re-sync limits if design responses change
  useEffect(() => {
    setGraphicalLimits(prev => {
      return initializeGraphicalLimits(
        rawResponses,
        criteria,
        rawRuns,
        design?.optimization?.graphicalLimits || prev
      );
    });
  }, [rawResponses, criteria, rawRuns, design?.optimization?.graphicalLimits]);

  // Persistence handler for graphical limits
  const persistLimits = useCallback(
    async (updatedLimits: Record<string, ResponseGraphicalLimit>) => {
      if (!project || !activeDesignId) return;
      if (!project.data.designs[activeDesignId].optimization) {
        project.data.designs[activeDesignId].optimization = {};
      }
      project.data.designs[activeDesignId].optimization.graphicalLimits = updatedLimits;
      project.data.designs[activeDesignId].optimization.lastUpdated = new Date().toISOString();

      try {
        await saveProject(project.name);
      } catch (e) {
        console.error('Failed to save graphical optimization limits:', e);
      }
    },
    [project, activeDesignId, saveProject]
  );

  // Update a single response's limits
  const handleUpdateLimit = (responseId: string, updated: Partial<ResponseGraphicalLimit>) => {
    setGraphicalLimits(prev => {
      const next = {
        ...prev,
        [responseId]: {
          ...prev[responseId],
          ...updated,
        },
      };
      persistLimits(next);
      return next;
    });
  };

  // Sync limits with active Numerical Criteria
  const handleSyncWithNumericalCriteria = () => {
    const synced = initializeGraphicalLimits(rawResponses, criteria, rawRuns, undefined);
    setGraphicalLimits(synced);
    persistLimits(synced);
  };

  // Reset a response limit to observed min/max
  const handleResetToObserved = (responseId: string) => {
    setGraphicalLimits(prev => {
      const cur = prev[responseId];
      if (!cur) return prev;
      const next = {
        ...prev,
        [responseId]: {
          ...cur,
          lowerLimit: cur.observedMin,
          upperLimit: cur.observedMax,
          isOneSided: false,
        },
      };
      persistLimits(next);
      return next;
    });
  };

  // Factor bounds
  const factorBounds: FactorBounds[] = useMemo(() => {
    return rawFactors.map((f: any) => {
      let low = typeof f.low === 'number' ? f.low : 0;
      let high = typeof f.high === 'number' ? f.high : 100;
      const crit = criteria[f.id];
      if (crit && typeof crit.lowerLimit === 'number') low = crit.lowerLimit;
      if (crit && typeof crit.upperLimit === 'number') high = crit.upperLimit;

      if (rawRuns.length > 0) {
        const vals = rawRuns
          .map((r: any) => r.actualValues?.[f.id])
          .filter((v: any): v is number => typeof v === 'number');
        if (vals.length > 0) {
          low = Math.min(low, Math.min(...vals));
          high = Math.max(high, Math.max(...vals));
        }
      }

      if (low >= high) {
        low = 0;
        high = 100;
      }

      return { id: f.id, name: f.name, low, high, units: f.units };
    });
  }, [rawFactors, criteria, rawRuns]);

  // Numerical Optimization solutions for planting optimal point if available
  const solutions: OptimizationSolution[] = design?.optimization?.results?.solutions || [];
  const currentSolution = solutions[0] || null;

  // Factor Coding Mode: 'actual' (default) or 'coded'
  const [codingMode, setCodingMode] = useState<'actual' | 'coded'>('actual');

  // Axis selection
  const [axisXId, setAxisXId] = useState<string>(rawFactors[0]?.id || '');
  const [axisYId, setAxisYId] = useState<string>(rawFactors[1]?.id || rawFactors[0]?.id || '');
  const [heldValues, setHeldValues] = useState<Record<string, number>>({});
  const [showAllPointsProjected, setShowAllPointsProjected] = useState<boolean>(false);
  const [isPopOutOpen, setIsPopOutOpen] = useState<boolean>(false);

  // Ensure axis factors are distinct
  useEffect(() => {
    if (rawFactors.length >= 2) {
      if (!axisXId || !rawFactors.find((f: any) => f.id === axisXId)) {
        setAxisXId(rawFactors[0].id);
      }
      if (!axisYId || !rawFactors.find((f: any) => f.id === axisYId) || axisYId === axisXId) {
        const other = rawFactors.find((f: any) => f.id !== (axisXId || rawFactors[0].id));
        if (other) setAxisYId(other.id);
      }
    } else if (rawFactors.length === 1) {
      setAxisXId(rawFactors[0].id);
      setAxisYId(rawFactors[0].id);
    }
  }, [rawFactors, axisXId, axisYId]);

  // Initialize held values
  useEffect(() => {
    setHeldValues(prev => {
      const updated = { ...prev };
      for (const f of factorBounds) {
        if (updated[f.id] === undefined) {
          if (currentSolution && typeof currentSolution.factors[f.id] === 'number') {
            updated[f.id] = currentSolution.factors[f.id];
          } else {
            updated[f.id] = (f.low + f.high) / 2;
          }
        }
      }
      return updated;
    });
  }, [factorBounds, currentSolution]);

  const fX = factorBounds.find(f => f.id === axisXId) || factorBounds[0];
  const fY = factorBounds.find(f => f.id === axisYId) || factorBounds[1] || factorBounds[0];

  const handleHeldChange = (factorId: string, val: number) => {
    setHeldValues(prev => ({ ...prev, [factorId]: val }));
  };

  const handleResetToDefaults = () => {
    const defs: Record<string, number> = {};
    for (const f of factorBounds) {
      defs[f.id] = (f.low + f.high) / 2;
    }
    setHeldValues(defs);
  };

  const handleJumpToRun = (run: any) => {
    if (run?.actualValues) {
      setHeldValues(prev => ({
        ...prev,
        ...run.actualValues,
      }));
    }
  };

  // Compute Overlay Grid
  const overlayGrid = useMemo(() => {
    if (!fX || !fY) return null;
    return calculateOverlayGrid(
      fX,
      fY,
      heldValues,
      factorBounds,
      rawResponses,
      usableModels,
      graphicalLimits,
      50,
      codingMode
    );
  }, [fX, fY, heldValues, factorBounds, rawResponses, usableModels, graphicalLimits, codingMode]);

  // Sliced Design Points
  const slicedPoints = useMemo(() => {
    if (!fX || !fY) return [];
    return sliceDesignPoints(
      rawRuns,
      fX,
      fY,
      heldValues,
      factorBounds,
      codingMode,
      0.05
    );
  }, [rawRuns, fX, fY, heldValues, factorBounds, codingMode]);

  if (!design) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white text-gray-400 font-sans">
        <p className="font-semibold text-gray-500 mb-1">No Active Design Selected</p>
        <p className="text-xs text-gray-400">
          Select an experimental design from the Project Tree to view Graphical Optimization.
        </p>
      </div>
    );
  }

  const renderPlotArea = () => {
    if (!overlayGrid || !fX || !fY) {
      return (
        <div className="flex-1 flex items-center justify-center p-8 bg-gray-50 text-gray-400 text-xs">
          Insufficient factor parameters to render plot.
        </div>
      );
    }

    return (
      <OverlayPlotCanvas
        grid={overlayGrid}
        designPoints={slicedPoints}
        fX={fX}
        fY={fY}
        allFactors={factorBounds}
        heldValues={heldValues}
        limits={graphicalLimits}
        codingMode={codingMode}
        showAllPointsProjected={showAllPointsProjected}
      />
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAFAFA] font-sans overflow-hidden select-none">
      {/* Top Main Tab Bar: Criteria vs Graphs (Design-Expert 13 Navigation) */}
      <div className="bg-[#EAEAEA] border-b border-[#C0C0C0] px-2 pt-1 flex items-center justify-between shrink-0 select-none z-10">
        <div className="flex items-center">
          <button
            onClick={() => setActiveTab('Criteria')}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold border mr-1 transition-colors ${
              activeTab === 'Criteria'
                ? 'bg-white text-[#003366] border-[#C0C0C0] border-t-2 border-t-[#0055A4] border-b-transparent translate-y-[1px] shadow-xs'
                : 'bg-[#F0F0F0] text-gray-700 border-transparent border-b-[#C0C0C0] hover:bg-white'
            }`}
          >
            <ListFilter size={13} className={activeTab === 'Criteria' ? 'text-[#0055A4]' : 'text-gray-500'} />
            Criteria
          </button>

          <button
            onClick={() => setActiveTab('Graphs')}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold border mr-1 transition-colors ${
              activeTab === 'Graphs'
                ? 'bg-white text-[#003366] border-[#C0C0C0] border-t-2 border-t-[#0055A4] border-b-transparent translate-y-[1px] shadow-xs'
                : 'bg-[#F0F0F0] text-gray-700 border-transparent border-b-[#C0C0C0] hover:bg-white'
            }`}
          >
            <LineChart size={13} className={activeTab === 'Graphs' ? 'text-[#0055A4]' : 'text-gray-500'} />
            Graphs
          </button>
        </div>

        {/* Right Action Icons / Popout */}
        <div className="flex items-center gap-2 pb-1">
          <button
            onClick={() => setIsPopOutOpen(true)}
            className="flex items-center gap-1 text-xs font-semibold text-gray-700 hover:text-[#0055A4] border border-[#C0C0C0] px-2.5 py-1 bg-white hover:bg-[#F9FAFB] rounded-xs shadow-xs"
            title="Enlarge plot"
          >
            <Maximize2 size={13} />
            Pop Out
          </button>
        </div>
      </div>

      {/* Sub-toolbar for Graphs Tab (Matching Design-Expert 13 Toolbar) */}
      {activeTab === 'Graphs' && (
        <div className="bg-white border-b border-[#C0C0C0] px-4 py-2 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            {/* Contour Only Badge (Matching Design-Expert 13) */}
            <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-[#0055A4] text-[#0055A4] text-xs font-bold rounded shadow-xs">
              <Layers size={13} className="text-[#0055A4]" />
              <span>Contour</span>
            </div>

            {/* Factor Coding Indicator & Toggle (Actual vs Coded) */}
            <button
              onClick={() => setCodingMode(prev => (prev === 'actual' ? 'coded' : 'actual'))}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-[#C0C0C0] rounded shadow-xs"
              title="Toggle between physical (Actual) and coded (-1 to +1) factor coordinates"
            >
              <Code2 size={13} className="text-[#0055A4]" />
              Factor Coding: <strong className="text-[#0055A4] uppercase">{codingMode}</strong>
            </button>
          </div>

          {/* Sliced vs Projected points toggle */}
          <div className="flex items-center gap-3 text-xs text-gray-700">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showAllPointsProjected}
                onChange={e => setShowAllPointsProjected(e.target.checked)}
                className="rounded text-[#0055A4]"
              />
              Show all projected points (dimmed)
            </label>
          </div>
        </div>
      )}

      {/* Main Content Workspace */}
      <div className="flex-1 flex overflow-hidden min-h-0 bg-white">
        {activeTab === 'Criteria' ? (
          <GraphicalCriteriaTab
            responses={rawResponses}
            limits={graphicalLimits}
            onUpdateLimit={handleUpdateLimit}
            onSyncWithNumericalCriteria={handleSyncWithNumericalCriteria}
            onResetToObservedRange={handleResetToObserved}
            analyses={analyses}
          />
        ) : (
          <div className="flex-1 flex overflow-hidden w-full h-full">
            {/* Center Plot Area with Left Metadata */}
            <div className="flex-1 flex overflow-hidden bg-white">
              {renderPlotArea()}
            </div>

            {/* Right Factors Tool Sidebar (Matching Design-Expert 13) */}
            <FactorsTool
              factors={factorBounds}
              axisXId={axisXId}
              axisYId={axisYId}
              heldValues={heldValues}
              onSelectAxisX={setAxisXId}
              onSelectAxisY={setAxisYId}
              onUpdateHeldValue={handleHeldChange}
              onResetToDefaults={handleResetToDefaults}
              runs={rawRuns}
              onJumpToRun={handleJumpToRun}
              codingMode={codingMode}
            />
          </div>
        )}
      </div>

      {/* PopOut Modal */}
      <PopOutModal
        isOpen={isPopOutOpen}
        onClose={() => setIsPopOutOpen(false)}
        title="Graphical Optimization — Overlay Plot"
      >
        <div className="w-full h-full flex flex-col bg-white">
          {renderPlotArea()}
        </div>
      </PopOutModal>
    </div>
  );
}
