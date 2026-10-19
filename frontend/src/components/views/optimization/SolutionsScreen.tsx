import { useState, useMemo, useEffect, useRef } from 'react';
import { useProject } from '../../../context/ProjectContext';
import { projectsApi } from '../../../api/client';
import { 
  OptimizationRunResult, 
  DEFAULT_OPTIMIZATION_OPTIONS,
  initializeDesignCriteria 
} from '../../../lib/optimization/types';
import { executeNumericalOptimization } from '../../../lib/optimization/solver';
import { ensureAllResponseModelsCurrent } from '../../../lib/statistics/rsm';
import { SolutionsTable } from './SolutionsTable';
import { StartingPointsTable } from './StartingPointsTable';
import { RampsView } from './RampsView';
import { BarGraphView } from './BarGraphView';
import { OptimizationReportView } from './OptimizationReportView';
import { OptimizationGraphsView } from './OptimizationGraphsView';
import { FactorsTool, FactorsToolGraphState } from './FactorsTool';
import { PopOutModal } from './PopOutModal';
import { 
  Play, 
  Loader2, 
  Table, 
  BarChart2, 
  FileText, 
  Maximize2, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2,
  Sliders,
  Layers
} from 'lucide-react';

interface SolutionsScreenProps {
  initialView?: 'tables' | 'ramps' | 'bargraph' | 'graphs' | 'report';
  onNavigateToCriteria?: () => void;
}

export function SolutionsScreen({ initialView = 'tables', onNavigateToCriteria }: SolutionsScreenProps) {
  const { project, activeDesignId, saveProject } = useProject();

  const design = activeDesignId && project?.data?.designs ? project.data.designs[activeDesignId] : null;

  const factors = useMemo(() => design?.config?.factors || [], [design]);
  const responses = useMemo(() => design?.config?.responses || [], [design]);
  const analyses = useMemo(() => {
    const designAnalyses = design?.analyses || {};
    const projectAnalyses = project?.data?.analysis || {};
    return { ...projectAnalyses, ...designAnalyses };
  }, [design, project]);
  const runs = useMemo(() => design?.runs || [], [design]);

  // Load existing or initialized criteria and options
  const criteria = useMemo(() => {
    return initializeDesignCriteria(
      factors,
      responses,
      runs,
      design?.optimization?.criteria
    );
  }, [factors, responses, runs, design?.optimization?.criteria]);

  const options = useMemo(() => {
    return design?.optimization?.options || { ...DEFAULT_OPTIMIZATION_OPTIONS };
  }, [design?.optimization?.options]);

  // Current optimization run results
  const [results, setResults] = useState<OptimizationRunResult | null>(() => {
    return design?.optimization?.results || null;
  });

  const [selectedSolutionIndex, setSelectedSolutionIndex] = useState<number>(() => {
    return design?.optimization?.results?.selectedSolutionIndex || 0;
  });

  // Sync if design results change externally
  useEffect(() => {
    if (design?.optimization?.results) {
      setResults(design.optimization.results);
      setSelectedSolutionIndex(design.optimization.results.selectedSolutionIndex || 0);
    }
  }, [design?.optimization?.results]);

  // Views & Tab States
  const [activeView, setActiveView] = useState<'tables' | 'ramps' | 'bargraph' | 'graphs' | 'report'>(initialView);

  useEffect(() => {
    if (initialView) {
      setActiveView(initialView);
    }
  }, [initialView]);
  const [activeTableSubtab, setActiveTableSubtab] = useState<'solutions' | 'startingPoints'>('solutions');
  const [isPopOutOpen, setIsPopOutOpen] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const activeOptimizationRequestIdRef = useRef(0);

  // Check whether response data has been modified since results were computed
  const isResultsStale = useMemo(() => {
    if (!results) return false;
    if (results.isOutdated) return true;
    if (design?.runsModifiedAt && results.timestamp) {
      return new Date(design.runsModifiedAt).getTime() > new Date(results.timestamp).getTime();
    }
    return false;
  }, [results, design?.runsModifiedAt]);

  // Check if any response models are missing
  const activeResponsesWithoutModels = useMemo(() => {
    const list: string[] = [];
    for (const r of responses) {
      const crit = criteria[r.id];
      if (crit && crit.goal !== 'none') {
        const hasModel = Boolean(analyses[r.id]?.fittedModel || analyses[r.id]?.fitted);
        if (!hasModel) list.push(r.name);
      }
    }
    return list;
  }, [responses, criteria, analyses]);

  // Handle running optimization
  const handleRunOptimization = async () => {
    const requestId = ++activeOptimizationRequestIdRef.current;
    setErrorMessage(null);
    setStatusMessage(null);
    setIsOptimizing(true);

    try {
      // 1. Proactively ensure all response models are current and refit if response observations were edited
      let currentAnalyses = { ...analyses };
      if (design) {
        const { updatedAnalyses, didRefit } = ensureAllResponseModelsCurrent(design, criteria);
        if (didRefit) {
          currentAnalyses = updatedAnalyses;
          if (project && activeDesignId) {
            project.data.designs[activeDesignId].analyses = updatedAnalyses;
            if (project.data.analysis) {
              project.data.analysis = { ...project.data.analysis, ...updatedAnalyses };
            }
            await saveProject(project.name);
          }
        }
      }

      // Check if any active response is still without a fitted model
      const missingModels: string[] = [];
      for (const r of responses) {
        const crit = criteria[r.id];
        if (crit && crit.goal !== 'none') {
          const hasModel = Boolean(currentAnalyses[r.id]?.fittedModel?.coefficients?.length);
          if (!hasModel) missingModels.push(r.name);
        }
      }

      if (missingModels.length > 0) {
        throw new Error(`The following response(s) have active optimization criteria but no fitted model: ${missingModels.join(', ')}. Please fit models in the Analysis tab or ensure all runs have valid response values.`);
      }

      let runResult: OptimizationRunResult;

      // If project is persisted on the backend (not temp-), call backend API
      if (project && !project.id.startsWith('temp-') && activeDesignId) {
        try {
          const apiRes = await projectsApi.optimize(project.id, activeDesignId);
          runResult = apiRes.result;
          if (apiRes.project) {
            project.data = apiRes.project.data;
          }
        } catch (apiErr: any) {
          console.warn('Backend optimize endpoint returned error, executing with local engine:', apiErr);
          // Fall back to local solver
          runResult = executeNumericalOptimization(
            factors,
            responses,
            currentAnalyses,
            criteria,
            options,
            runs,
            design?.runsModifiedAt
          );
        }
      } else {
        // In-memory or offline project: execute using local solver
        runResult = executeNumericalOptimization(
          factors,
          responses,
          currentAnalyses,
          criteria,
          options,
          runs,
          design?.runsModifiedAt
        );
      }

      // If a newer optimization run was launched in the meantime, discard this result
      if (requestId !== activeOptimizationRequestIdRef.current) {
        return;
      }

      runResult.isOutdated = false;

      // Update state and persist
      setResults(runResult);
      setSelectedSolutionIndex(0);

      if (project && activeDesignId) {
        if (!project.data.designs[activeDesignId].optimization) {
          project.data.designs[activeDesignId].optimization = {};
        }
        project.data.designs[activeDesignId].optimization.results = runResult;
        project.data.designs[activeDesignId].optimization.lastUpdated = new Date().toISOString();
        await saveProject(project.name);
      }

      if (runResult.status === 'no_feasible_solution') {
        setStatusMessage(runResult.message || 'No feasible solutions found.');
      } else if (runResult.status === 'error') {
        setErrorMessage(runResult.message || 'Optimization failed.');
      } else {
        setStatusMessage(runResult.message || `Found ${runResult.solutions.length} solutions.`);
      }
    } catch (err: any) {
      if (requestId === activeOptimizationRequestIdRef.current) {
        setErrorMessage(err.message || 'Failed to execute optimization.');
      }
    } finally {
      if (requestId === activeOptimizationRequestIdRef.current) {
        setIsOptimizing(false);
      }
    }
  };

  const handleSelectSolution = async (index: number) => {
    setSelectedSolutionIndex(index);
    if (project && activeDesignId && project.data.designs[activeDesignId].optimization?.results) {
      project.data.designs[activeDesignId].optimization.results.selectedSolutionIndex = index;
      try {
        await saveProject(project.name);
      } catch (e) {
        console.error('Failed to persist selected solution index:', e);
      }
    }
  };

  const currentSolutions = results?.solutions || [];
  const currentStartingPoints = results?.startingPoints || [];

  // Graphs View & Factors Tool state synchronization
  const [graphType, setGraphType] = useState<'perturbation' | 'one_factor' | 'all_factors' | 'interaction' | 'contour' | 'surface'>('perturbation');
  const [axisXId, setAxisXId] = useState<string>(factors[0]?.id || '');
  const [axisYId, setAxisYId] = useState<string>(factors[1]?.id || factors[0]?.id || '');
  const [heldFactors, setHeldFactors] = useState<Record<string, number>>({});

  useEffect(() => {
    if (factors.length > 0) {
      if (!axisXId || !factors.some((f: any) => f.id === axisXId)) {
        setAxisXId(factors[0].id);
      }
      if (!axisYId || !factors.some((f: any) => f.id === axisYId)) {
        setAxisYId(factors[1]?.id || factors[0].id);
      }
    }
  }, [factors, axisXId, axisYId]);

  // When selected solution changes, initialize held factors to that solution's factors
  useEffect(() => {
    const curSol = currentSolutions[selectedSolutionIndex] || currentSolutions[0];
    if (curSol?.factors) {
      setHeldFactors({ ...curSol.factors });
    }
  }, [selectedSolutionIndex, currentSolutions]);

  const handleResetHeldFactors = () => {
    const curSol = currentSolutions[selectedSolutionIndex] || currentSolutions[0];
    if (curSol?.factors) {
      setHeldFactors({ ...curSol.factors });
    } else {
      setHeldFactors({});
    }
  };

  const graphState = useMemo<FactorsToolGraphState>(() => ({
    graphType,
    setGraphType,
    axisXId,
    setAxisXId,
    axisYId,
    setAxisYId,
    heldFactors,
    setHeldFactors,
    onResetToDefault: handleResetHeldFactors,
  }), [graphType, axisXId, axisYId, heldFactors, currentSolutions, selectedSolutionIndex]);

  return (
    <div className="flex flex-col h-full bg-[#FAFAFA] font-sans text-xs select-none overflow-hidden">
      
      {/* Top Action Toolbar */}
      <div className="bg-[#EAEAEA] border-b border-[#C0C0C0] px-4 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0 shadow-xs">
        
        {/* Left: Action Button & Run Info */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={isOptimizing}
            onClick={handleRunOptimization}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0055A4] hover:bg-[#003366] text-white font-bold rounded-xs shadow-xs transition-colors disabled:opacity-50"
            title="Execute numerical optimization search"
          >
            {isOptimizing ? (
              <>
                <Loader2 size={14} className="animate-spin text-white" />
                <span>Optimizing...</span>
              </>
            ) : (
              <>
                <Play size={14} className="fill-white" />
                <span>Run Optimization</span>
              </>
            )}
          </button>

          {onNavigateToCriteria && (
            <button
              type="button"
              onClick={onNavigateToCriteria}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-[#F0F0F0] text-gray-700 font-semibold border border-[#B0B0B0] rounded-xs shadow-xs"
              title="Edit Optimization Criteria"
            >
              <Sliders size={13} className="text-[#0055A4]" />
              <span>Criteria...</span>
            </button>
          )}

          {results && results.solutions.length > 0 && (
            <span className="text-[11px] text-gray-600 ml-2">
              Best Desirability: <strong className="text-[#0055A4] font-mono">{results.solutions[0].desirability.toFixed(4)}</strong>
              {' '}({results.solutions.length} solutions)
            </span>
          )}

          {results && (
            isResultsStale ? (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-xs font-bold text-[10px] ml-2 animate-pulse" title="Response observations changed after this run">
                <AlertTriangle size={11} className="text-amber-600" />
                <span>STALE / OUTDATED</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xs text-[10px] ml-2 font-medium" title="Results match current response data">
                Current ({new Date(results.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
              </span>
            )
          )}
        </div>

        {/* Right: View Toggles & Pop-Out */}
        <div className="flex items-center gap-1.5">
          <div className="flex bg-white border border-[#B0B0B0] rounded-xs p-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveView('tables')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xs font-semibold text-[11px] transition-colors ${
                activeView === 'tables' 
                  ? 'bg-[#0055A4] text-white shadow-xs' 
                  : 'text-gray-700 hover:bg-[#F0F0F0]'
              }`}
            >
              <Table size={13} />
              <span>Tables</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('ramps')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xs font-semibold text-[11px] transition-colors ${
                activeView === 'ramps' 
                  ? 'bg-[#0055A4] text-white shadow-xs' 
                  : 'text-gray-700 hover:bg-[#F0F0F0]'
              }`}
            >
              <TrendingUp size={13} />
              <span>Ramps</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('bargraph')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xs font-semibold text-[11px] transition-colors ${
                activeView === 'bargraph' 
                  ? 'bg-[#0055A4] text-white shadow-xs' 
                  : 'text-gray-700 hover:bg-[#F0F0F0]'
              }`}
            >
              <BarChart2 size={13} />
              <span>Bar Graph</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('graphs')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xs font-semibold text-[11px] transition-colors ${
                activeView === 'graphs' 
                  ? 'bg-[#0055A4] text-white shadow-xs' 
                  : 'text-gray-700 hover:bg-[#F0F0F0]'
              }`}
            >
              <Layers size={13} />
              <span>Graphs</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('report')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xs font-semibold text-[11px] transition-colors ${
                activeView === 'report' 
                  ? 'bg-[#0055A4] text-white shadow-xs' 
                  : 'text-gray-700 hover:bg-[#F0F0F0]'
              }`}
            >
              <FileText size={13} />
              <span>Report</span>
            </button>
          </div>

          {/* Pop-Out Button (enabled for Ramps, Bar Graph & Graphs) */}
          <button
            type="button"
            disabled={!['ramps', 'bargraph', 'graphs'].includes(activeView) || currentSolutions.length === 0}
            onClick={() => setIsPopOutOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-[#E5F3FF] disabled:opacity-40 disabled:hover:bg-white text-[#003366] font-semibold border border-[#B0B0B0] rounded-xs shadow-xs transition-colors"
            title="Open enlarged Pop-Out View"
          >
            <Maximize2 size={13} />
            <span>Pop-Out</span>
          </button>
        </div>

      </div>

      {/* Outdated results banner */}
      {isResultsStale && (
        <div className="bg-amber-50 border-b border-amber-300 px-4 py-2 text-xs text-amber-900 flex items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-600 shrink-0" />
            <div>
              <span className="font-semibold">Response Data Modified Since Last Optimization:</span>{' '}
              <span>The response observations in the Design Table were modified after these optimization results were calculated. Click <strong>Run Optimization</strong> to recalculate models and optimization solutions with the updated data.</span>
            </div>
          </div>
          <button
            type="button"
            disabled={isOptimizing}
            onClick={handleRunOptimization}
            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded shadow-2xs transition-colors shrink-0 ml-3"
          >
            Update Results
          </button>
        </div>
      )}

      {/* Warning / Error / Status Banner */}
      {errorMessage && (
        <div className="bg-[#FFF0F0] border-b border-[#FFCCCC] px-4 py-2 text-xs text-[#B30000] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="font-bold px-2 py-0.5 hover:bg-red-100 rounded">✕</button>
        </div>
      )}

      {statusMessage && !errorMessage && (
        <div className="bg-[#EBF7EE] border-b border-[#B7E4C7] px-4 py-1.5 text-xs text-[#1B4332] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="shrink-0 text-[#2D6A4F]" />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="font-bold px-2 py-0.5 hover:bg-green-100 rounded">✕</button>
        </div>
      )}

      {activeResponsesWithoutModels.length > 0 && (
        <div className="bg-[#FFF8E6] border-b border-[#F2D675] px-4 py-1.5 text-xs text-[#7A5B00] flex items-center gap-2 shrink-0">
          <AlertTriangle size={14} className="text-[#D5AC2C] shrink-0" />
          <span>
            Response(s) <strong>{activeResponsesWithoutModels.join(', ')}</strong> do not have a fitted model. Model fitting under Analysis is required before running optimization.
          </span>
        </div>
      )}

      {results?.status === 'no_feasible_solution' && (
        <div className="bg-[#FFF9EA] border-b border-[#E8D49E] px-4 py-2 text-xs text-[#7A5B00] flex items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} className="text-[#D5AC2C] shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-[#664D00]">
                {results.message || 'No feasible solutions found satisfying all criteria simultaneously.'}
              </div>
              {results.warnings && results.warnings.length > 0 && (
                <div className="text-[11px] text-[#8C6D07] mt-0.5">
                  {results.warnings.join(' ')}
                </div>
              )}
            </div>
          </div>
          {onNavigateToCriteria && (
            <button
              type="button"
              onClick={onNavigateToCriteria}
              className="px-2.5 py-1 bg-white hover:bg-[#FFF2D0] border border-[#D5AC2C] text-[#7A5B00] font-semibold rounded-xs shadow-2xs transition-colors shrink-0 ml-3"
            >
              Adjust Criteria
            </button>
          )}
        </div>
      )}

      {/* Main View Area + Side Panel */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        
        {/* Left Column: Visualizations & Tables */}
        <div className="flex-1 flex flex-col overflow-hidden p-3 min-h-0">
          
          {/* Main View Switcher: Tables, Ramps, Bar Graph, Report */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            
            {/* View: Tables (Solutions & Starting Points) */}
            {activeView === 'tables' && (
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                {/* Subtabs Bar */}
                <div className="flex bg-[#EAEAEA] border-b border-[#C0C0C0] px-2 pt-1 z-10 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTableSubtab('solutions')}
                    className={`px-3 py-1 text-xs border mr-1 font-semibold transition-colors ${
                      activeTableSubtab === 'solutions'
                        ? 'bg-white text-[#003366] border-[#C0C0C0] border-t-2 border-t-[#0055A4] border-b-transparent translate-y-[1px]'
                        : 'bg-[#F0F0F0] text-gray-700 border-transparent hover:bg-white'
                    }`}
                  >
                    Solutions ({currentSolutions.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTableSubtab('startingPoints')}
                    className={`px-3 py-1 text-xs border mr-1 font-semibold transition-colors ${
                      activeTableSubtab === 'startingPoints'
                        ? 'bg-white text-[#003366] border-[#C0C0C0] border-t-2 border-t-[#0055A4] border-b-transparent translate-y-[1px]'
                        : 'bg-[#F0F0F0] text-gray-700 border-transparent hover:bg-white'
                    }`}
                  >
                    Starting Points ({currentStartingPoints.length})
                  </button>
                </div>

                {/* Subtab Content */}
                <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-white h-full">
                  {activeTableSubtab === 'solutions' ? (
                    <SolutionsTable
                      solutions={currentSolutions}
                      factors={factors}
                      responses={responses}
                      selectedSolutionIndex={selectedSolutionIndex}
                      onSelectSolution={handleSelectSolution}
                    />
                  ) : (
                    <StartingPointsTable
                      startingPoints={currentStartingPoints}
                      factors={factors}
                      diagnostic={results?.startingPointsDiagnostic}
                      runResult={results}
                      responses={responses}
                    />
                  )}
                </div>
              </div>
            )}

            {/* View: Ramps */}
            {activeView === 'ramps' && (
              <RampsView
                solutions={currentSolutions}
                selectedSolutionIndex={selectedSolutionIndex}
                onSelectSolution={handleSelectSolution}
                factors={factors}
                responses={responses}
                criteria={criteria}
              />
            )}

            {/* View: Bar Graph */}
            {activeView === 'bargraph' && (
              <BarGraphView
                solutions={currentSolutions}
                selectedSolutionIndex={selectedSolutionIndex}
                onSelectSolution={handleSelectSolution}
                factors={factors}
                responses={responses}
                criteria={criteria}
              />
            )}

            {/* View: Graphs (Contour & 3D Surface per Design-Expert 13) */}
            {activeView === 'graphs' && (
              <OptimizationGraphsView
                solutions={currentSolutions}
                selectedSolutionIndex={selectedSolutionIndex}
                onSelectSolution={handleSelectSolution}
                factors={factors}
                responses={responses}
                criteria={criteria}
                analyses={analyses}
                runs={runs}
                externalGraphState={graphState}
              />
            )}

            {/* View: Report */}
            {activeView === 'report' && (
              <OptimizationReportView
                result={results}
                projectName={project?.name || 'Current Project'}
                designName={design?.name || 'Active Design'}
                factors={factors}
                responses={responses}
                criteria={criteria}
              />
            )}

          </div>

        </div>

        {/* Right Side: Factors Tool (Available when solutions exist) */}
        {currentSolutions.length > 0 && (
          <FactorsTool
            solutions={currentSolutions}
            selectedSolutionIndex={selectedSolutionIndex}
            onSelectSolution={handleSelectSolution}
            factors={factors}
            responses={responses}
            graphState={activeView === 'graphs' ? graphState : undefined}
          />
        )}

      </div>

      {/* Pop-Out Modal for Enlarged Ramps, Bar Graph, or Graphs */}
      <PopOutModal
        isOpen={isPopOutOpen}
        onClose={() => setIsPopOutOpen(false)}
        title={
          activeView === 'ramps' 
            ? 'Ramps Visualization' 
            : activeView === 'bargraph'
            ? 'Desirability Bar Graph'
            : 'Numerical Optimization Graphs'
        }
      >
        {activeView === 'ramps' ? (
          <RampsView
            solutions={currentSolutions}
            selectedSolutionIndex={selectedSolutionIndex}
            onSelectSolution={handleSelectSolution}
            factors={factors}
            responses={responses}
            criteria={criteria}
          />
        ) : activeView === 'bargraph' ? (
          <BarGraphView
            solutions={currentSolutions}
            selectedSolutionIndex={selectedSolutionIndex}
            onSelectSolution={handleSelectSolution}
            factors={factors}
            responses={responses}
            criteria={criteria}
          />
        ) : (
          <OptimizationGraphsView
            solutions={currentSolutions}
            selectedSolutionIndex={selectedSolutionIndex}
            onSelectSolution={handleSelectSolution}
            factors={factors}
            responses={responses}
            criteria={criteria}
            analyses={analyses}
            runs={runs}
            externalGraphState={graphState}
          />
        )}
      </PopOutModal>

    </div>
  );
}
