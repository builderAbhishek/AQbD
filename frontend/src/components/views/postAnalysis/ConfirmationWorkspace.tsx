import { useState, useMemo, useEffect } from 'react';
import { useProject } from '../../../context/ProjectContext';
import { 
  calculateConfirmationComparison, 
  ConfirmationRunItem, 
  ConfirmationComparisonResult 
} from '../../../lib/statistics/prediction';
import { ensureAllResponseModelsCurrent } from '../../../lib/statistics/rsm/modelFitting';
import { FactorBounds } from '../../../lib/optimization/solver';
import { 
  ClipboardCheck, 
  Plus, 
  Trash2, 
  Sparkles, 
  Copy, 
  Check, 
  CheckCircle2, 
  XCircle,
  Info
} from 'lucide-react';

export function ConfirmationWorkspace() {
  const { project, activeDesignId, saveProject } = useProject();
  const design = activeDesignId && project?.data?.designs ? project.data.designs[activeDesignId] : null;

  const rawFactors = useMemo(() => design?.config?.factors || [], [design?.config?.factors]);
  const rawResponses = useMemo(() => design?.config?.responses || [], [design?.config?.responses]);
  const rawRuns = useMemo(() => design?.runs || [], [design?.runs]);

  const factorBounds: FactorBounds[] = useMemo(() => {
    return rawFactors.map((f: any) => ({
      id: f.id,
      name: f.name,
      low: typeof f.low === 'number' ? f.low : 0,
      high: typeof f.high === 'number' ? f.high : 100,
      units: f.units
    }));
  }, [rawFactors]);

  // Ensure response models are current
  const { analyses } = useMemo(() => {
    let currentAnalyses = design?.analyses || {};
    if (design) {
      try {
        const criteria = design.optimization?.criteria || {};
        const { updatedAnalyses, didRefit } = ensureAllResponseModelsCurrent(design, criteria);
        if (didRefit) {
          currentAnalyses = updatedAnalyses;
        }
      } catch (e) {
        console.warn('Auto-refit check in Confirmation:', e);
      }
    }
    return { analyses: currentAnalyses };
  }, [design]);

  // Load persisted confirmation runs or initialize
  const persistedRuns: ConfirmationRunItem[] = useMemo(() => {
    return design?.confirmation?.runs || [];
  }, [design?.confirmation?.runs]);

  const [confirmationRuns, setConfirmationRuns] = useState<ConfirmationRunItem[]>(() => {
    if (persistedRuns && persistedRuns.length > 0) return persistedRuns;
    // Default initial run populated with optimum or center point
    const initialSettings: Record<string, number> = {};
    const bestSol = design?.optimization?.results?.solutions?.[0];
    for (const f of rawFactors) {
      if (bestSol && typeof bestSol.factors[f.id] === 'number') {
        initialSettings[f.id] = Number(bestSol.factors[f.id].toFixed(3));
      } else {
        initialSettings[f.id] = Number(((f.low + f.high) / 2).toFixed(3));
      }
    }
    return [
      {
        id: 'conf-1',
        runNumber: 1,
        timestamp: new Date().toISOString(),
        factorSettings: initialSettings,
        observedResponses: {},
        notes: bestSol ? 'Confirmation of Optimum #1' : 'Initial Confirmation Run'
      }
    ];
  });

  const [selectedRunId, setSelectedRunId] = useState<string>(() => confirmationRuns[0]?.id || 'conf-1');
  const [copied, setCopied] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Sync if design confirmation data changes externally
  useEffect(() => {
    if (design?.confirmation?.runs && design.confirmation.runs.length > 0) {
      setConfirmationRuns(design.confirmation.runs);
      if (!selectedRunId || !design.confirmation.runs.find((r: any) => r.id === selectedRunId)) {
        setSelectedRunId(design.confirmation.runs[0].id);
      }
    }
  }, [design?.confirmation?.runs]);

  // Persist confirmation runs
  const handleSaveConfirmation = async (runsToSave: ConfirmationRunItem[]) => {
    if (!project || !activeDesignId || !project.data.designs[activeDesignId]) return;
    setIsSaving(true);
    try {
      project.data.designs[activeDesignId].confirmation = {
        runs: runsToSave,
        lastUpdated: new Date().toISOString()
      };
      await saveProject(project.name);
    } catch (e) {
      console.error('Failed to save confirmation runs:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const activeRun = confirmationRuns.find(r => r.id === selectedRunId) || confirmationRuns[0];

  const handleAddRun = () => {
    const nextNum = confirmationRuns.length + 1;
    const settings: Record<string, number> = {};
    const bestSol = design?.optimization?.results?.solutions?.[0];
    for (const f of factorBounds) {
      if (bestSol && typeof bestSol.factors[f.id] === 'number') {
        settings[f.id] = Number(bestSol.factors[f.id].toFixed(3));
      } else {
        settings[f.id] = Number(((f.low + f.high) / 2).toFixed(3));
      }
    }

    const newRun: ConfirmationRunItem = {
      id: `conf-${Date.now()}`,
      runNumber: nextNum,
      timestamp: new Date().toISOString(),
      factorSettings: settings,
      observedResponses: {},
      notes: `Confirmation Run #${nextNum}`
    };

    const updated = [...confirmationRuns, newRun];
    setConfirmationRuns(updated);
    setSelectedRunId(newRun.id);
    handleSaveConfirmation(updated);
  };

  const handleDeleteRun = (id: string) => {
    if (confirmationRuns.length <= 1) return;
    const updated = confirmationRuns.filter(r => r.id !== id);
    setConfirmationRuns(updated);
    if (selectedRunId === id) {
      setSelectedRunId(updated[0]?.id || '');
    }
    handleSaveConfirmation(updated);
  };

  const handleUpdateFactorSetting = (factorId: string, val: number) => {
    if (!activeRun) return;
    const updated = confirmationRuns.map(r => {
      if (r.id === activeRun.id) {
        return {
          ...r,
          factorSettings: {
            ...r.factorSettings,
            [factorId]: val
          }
        };
      }
      return r;
    });
    setConfirmationRuns(updated);
    handleSaveConfirmation(updated);
  };

  const handleUpdateObservedResponse = (responseId: string, val: number | null) => {
    if (!activeRun) return;
    const updated = confirmationRuns.map(r => {
      if (r.id === activeRun.id) {
        return {
          ...r,
          observedResponses: {
            ...r.observedResponses,
            [responseId]: val
          }
        };
      }
      return r;
    });
    setConfirmationRuns(updated);
    handleSaveConfirmation(updated);
  };

  const handleLoadOptimumSettings = () => {
    const bestSol = design?.optimization?.results?.solutions?.[0];
    if (!bestSol || !activeRun) return;
    const updated = confirmationRuns.map(r => {
      if (r.id === activeRun.id) {
        return {
          ...r,
          factorSettings: { ...bestSol.factors },
          notes: `Confirmed against Optimum #${bestSol.solutionNumber} (D=${bestSol.desirability.toFixed(4)})`
        };
      }
      return r;
    });
    setConfirmationRuns(updated);
    handleSaveConfirmation(updated);
  };

  // Calculate confirmation comparisons for active run
  const comparisons: ConfirmationComparisonResult[] = useMemo(() => {
    if (!activeRun || factorBounds.length === 0 || rawResponses.length === 0) return [];
    return calculateConfirmationComparison(
      factorBounds,
      rawResponses,
      analyses,
      rawRuns,
      activeRun.factorSettings,
      activeRun.observedResponses,
      1
    );
  }, [activeRun, factorBounds, rawResponses, analyses, rawRuns]);

  // Overall confirmation status for the active run
  const activeConfirmedCount = comparisons.filter(c => c.isConfirmed === true).length;
  const activePendingCount = comparisons.filter(c => c.isConfirmed === null).length;
  const activeFailedCount = comparisons.filter(c => c.isConfirmed === false).length;

  const handleCopySummary = () => {
    if (!activeRun) return;
    let text = `AQbD Studio Confirmation Report — Run #${activeRun.runNumber}\n`;
    text += `Date: ${new Date(activeRun.timestamp).toLocaleString()}\n`;
    text += `Notes: ${activeRun.notes || 'None'}\n\n`;
    text += `FACTOR SETTINGS:\n`;
    for (const f of factorBounds) {
      text += `  • ${f.name}: ${activeRun.factorSettings[f.id]} ${f.units || ''}\n`;
    }
    text += `\nCONFIRMATION RESULTS:\n`;
    text += `Response\tObserved\tPredicted\tError\t% Error\t95% PI Low\t95% PI High\tStatus\n`;
    for (const c of comparisons) {
      const obs = c.observedValue !== null ? c.observedValue.toFixed(4) : 'Pending';
      const pred = c.predictedMean.toFixed(4);
      const err = c.predictionError !== null ? c.predictionError.toFixed(4) : '-';
      const pct = c.percentError !== null ? `${c.percentError.toFixed(2)}%` : '-';
      const status = c.isConfirmed === true ? 'CONFIRMED' : c.isConfirmed === false ? 'OUT OF RANGE' : 'PENDING';
      text += `${c.responseName}\t${obs}\t${pred}\t${err}\t${pct}\t${c.pi95.low.toFixed(4)}\t${c.pi95.high.toFixed(4)}\t${status}\n`;
    }
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!design) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white text-gray-400 font-sans">
        <p className="font-semibold text-gray-500 mb-1">No Active Design Selected</p>
        <p className="text-xs text-gray-400">Select an experimental design from the Project Tree to use Confirmation.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAFAFA] font-sans overflow-y-auto p-4 select-none">
      {/* Top Header */}
      <div className="bg-white border border-[#C0C0C0] p-4 shadow-xs rounded-xs mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#008000]/10 border border-[#008000]/30 text-[#008000] flex items-center justify-center font-bold text-sm rounded-xs">
            <ClipboardCheck size={18} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#003366]">Model Confirmation (Post Analysis)</h1>
            <p className="text-[11px] text-gray-500">
              Verify empirical response surface predictions against experimentally observed confirmation runs using 95% Prediction Intervals (PI)
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            onClick={handleAddRun}
            className="px-2.5 py-1 bg-[#0055A4] hover:bg-[#004488] text-white font-semibold rounded-xs shadow-xs flex items-center gap-1"
          >
            <Plus size={12} />
            Add Run
          </button>
          {design?.optimization?.results?.solutions?.[0] && (
            <button
              onClick={handleLoadOptimumSettings}
              className="px-2.5 py-1 bg-gray-50 hover:bg-[#F0F8FF] border border-[#C0C0C0] text-[#0055A4] font-semibold rounded-xs shadow-xs flex items-center gap-1"
            >
              <Sparkles size={12} />
              Load Optimum Settings
            </button>
          )}
          <button
            onClick={handleCopySummary}
            className="px-2.5 py-1 bg-white hover:bg-gray-50 border border-[#C0C0C0] text-gray-700 font-semibold rounded-xs shadow-xs flex items-center gap-1"
          >
            {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy Report'}
          </button>
          {confirmationRuns.length > 1 && (
            <button
              onClick={() => handleDeleteRun(activeRun?.id || '')}
              className="px-2 py-1 bg-white hover:bg-[#FFECEC] border border-[#B30000]/30 text-[#B30000] font-semibold rounded-xs shadow-xs flex items-center gap-1"
              title="Delete current run"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Runs Selector Bar */}
      <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1 text-xs">
        <span className="font-semibold text-gray-600 mr-1">Runs:</span>
        {confirmationRuns.map(r => {
          const isSelected = r.id === activeRun?.id;
          return (
            <button
              key={r.id}
              onClick={() => setSelectedRunId(r.id)}
              className={`px-3 py-1 font-semibold rounded-xs transition-colors border ${
                isSelected 
                  ? 'bg-[#003366] text-white border-[#003366] shadow-xs' 
                  : 'bg-white text-gray-700 hover:bg-gray-50 border-[#C0C0C0]'
              }`}
            >
              Run #{r.runNumber}
            </button>
          );
        })}
      </div>

      {/* Main Grid: Factor Settings (Left) & Confirmation Comparisons (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Factor Settings for this Confirmation Run */}
        <div className="lg:col-span-4 bg-white border border-[#C0C0C0] p-3.5 shadow-xs rounded-xs flex flex-col space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <span className="font-bold text-xs text-[#003366]">
              Run #{activeRun?.runNumber} Factor Coordinates
            </span>
            <span className="text-[10px] text-gray-400">
              {isSaving ? 'Saving...' : 'Saved'}
            </span>
          </div>

          <div className="space-y-2.5">
            {factorBounds.map(f => {
              const val = activeRun?.factorSettings[f.id] ?? (f.low + f.high) / 2;
              return (
                <div key={f.id} className="p-2 border border-gray-100 bg-[#FAFAFA] rounded-xs space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-gray-800">{f.name}</span>
                    <span className="text-gray-400 text-[10px] font-mono">[{f.low}, {f.high}]</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step={(f.high - f.low) / 100}
                      value={val}
                      onChange={(e) => handleUpdateFactorSetting(f.id, parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 text-xs font-mono font-bold text-[#003366] bg-white border border-[#C0C0C0] rounded-xs outline-none focus:border-[#0055A4]"
                    />
                    <span className="text-xs text-gray-500 font-medium whitespace-nowrap">{f.units || ''}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Run Notes */}
          <div className="pt-2 border-t border-gray-100">
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">Confirmation Notes</label>
            <input
              type="text"
              value={activeRun?.notes || ''}
              onChange={(e) => {
                const text = e.target.value;
                const updated = confirmationRuns.map(r => r.id === activeRun?.id ? { ...r, notes: text } : r);
                setConfirmationRuns(updated);
                handleSaveConfirmation(updated);
              }}
              placeholder="e.g. Lab confirmation on HPLC column #2"
              className="w-full px-2 py-1 text-xs bg-white border border-[#C0C0C0] rounded-xs outline-none"
            />
          </div>
        </div>

        {/* Confirmation Results & Observations Comparison Table */}
        <div className="lg:col-span-8 bg-white border border-[#C0C0C0] p-3.5 shadow-xs rounded-xs flex flex-col space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <span className="font-bold text-xs text-[#003366]">
              Observed vs. Predicted Confirmation Evaluation
            </span>
            <div className="flex items-center gap-2 text-[11px]">
              {activeFailedCount > 0 ? (
                <span className="bg-[#FFECEC] text-[#B30000] border border-[#B30000]/30 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                  <XCircle size={12} /> {activeFailedCount} Out of Range
                </span>
              ) : activeConfirmedCount > 0 && activePendingCount === 0 ? (
                <span className="bg-[#EAF5EA] text-[#006600] border border-[#008000]/30 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                  <CheckCircle2 size={12} /> All Confirmed
                </span>
              ) : (
                <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-medium">
                  {activePendingCount} Awaiting Observation
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#C0C0C0] text-xs">
              <thead className="bg-[#EFEFEF]">
                <tr>
                  <th className="px-2.5 py-1.5 text-left font-semibold text-gray-800">Response</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold text-gray-800">Predicted<br/>Mean</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold text-gray-800">95% PI<br/>[Low, High]</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold text-[#003366] bg-[#E6F0FA]">
                    Observed<br/>Value
                  </th>
                  <th className="px-2 py-1.5 text-right font-semibold text-gray-800">Prediction<br/>Error</th>
                  <th className="px-2 py-1.5 text-right font-semibold text-gray-800">% Error</th>
                  <th className="px-3 py-1.5 text-center font-semibold text-gray-800">Assessment</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-[#EAEAEA]">
                {comparisons.map(c => {
                  const obs = activeRun?.observedResponses[c.responseId];
                  const hasObs = obs !== null && obs !== undefined && typeof obs === 'number' && Number.isFinite(obs);

                  return (
                    <tr key={c.responseId} className="hover:bg-[#F0F8FF]">
                      <td className="px-2.5 py-2 font-bold text-[#003366]">
                        {c.responseName}
                        {c.units && <span className="text-[10px] font-normal text-gray-500 ml-1">({c.units})</span>}
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono font-bold text-gray-900">
                        {c.predictedMean.toFixed(4)}
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono text-[#7A5B00] font-medium whitespace-nowrap">
                        [{c.pi95.low.toFixed(4)}, {c.pi95.high.toFixed(4)}]
                      </td>
                      <td className="px-2.5 py-2 text-right bg-[#F5F9FD]">
                        <input
                          type="number"
                          step={0.01}
                          value={hasObs ? obs : ''}
                          placeholder="Enter observed"
                          onChange={(e) => {
                            const val = e.target.value === '' ? null : parseFloat(e.target.value);
                            handleUpdateObservedResponse(c.responseId, isNaN(val as any) ? null : val);
                          }}
                          className="w-24 px-2 py-1 text-right font-mono font-bold text-[#003366] bg-white border border-[#C0C0C0] rounded-xs outline-none focus:border-[#0055A4]"
                        />
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-gray-700">
                        {c.predictionError !== null ? (c.predictionError > 0 ? `+${c.predictionError.toFixed(4)}` : c.predictionError.toFixed(4)) : '—'}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-gray-700">
                        {c.percentError !== null ? `${c.percentError.toFixed(2)}%` : '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {c.isConfirmed === true ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[#EAF5EA] text-[#006600] border border-[#008000]/30">
                            <CheckCircle2 size={12} /> Confirmed
                          </span>
                        ) : c.isConfirmed === false ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[#FFECEC] text-[#B30000] border border-[#B30000]/30">
                            <XCircle size={12} /> Out of PI
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-500">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Statistical Guidance */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3 text-[11px] text-gray-600 space-y-1 rounded-xs mt-3">
            <div className="font-bold text-[#003366] flex items-center gap-1">
              <Info size={13} />
              Confirmation Criterion (Stat-Ease Design-Expert Methodology)
            </div>
            <p>
              An experimental confirmation run is considered <span className="font-semibold text-green-700">Confirmed</span> when the observed response falls within the 95% Prediction Interval (95% PI) of the fitted model.
            </p>
            <p className="text-gray-500 text-[10px]">
              If observed confirmation results consistently fall outside the 95% PI, inspect for column drift, reagent changes, or missing interaction/quadratic terms in the model.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
