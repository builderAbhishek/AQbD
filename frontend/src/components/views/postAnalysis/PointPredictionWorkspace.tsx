import { useState, useMemo, useEffect } from 'react';
import { useProject } from '../../../context/ProjectContext';
import { calculatePointPredictions, PointPredictionResult } from '../../../lib/statistics/prediction';
import { ensureAllResponseModelsCurrent } from '../../../lib/statistics/rsm/modelFitting';
import { FactorBounds } from '../../../lib/optimization/solver';
import { 
  Table, 
  MapPin, 
  X, 
  ChevronDown, 
  AlertTriangle 
} from 'lucide-react';

export function PointPredictionWorkspace() {
  const { project, activeDesignId } = useProject();
  const design = activeDesignId && project?.data?.designs ? project.data.designs[activeDesignId] : null;

  const rawFactors = useMemo(() => design?.config?.factors || [], [design?.config?.factors]);
  const rawResponses = useMemo(() => design?.config?.responses || [], [design?.config?.responses]);
  const rawRuns = useMemo(() => design?.runs || [], [design?.runs]);

  // Factor bounds with standard DOE letter codes (A, B, C...)
  const factorBounds: Array<FactorBounds & { letter: string }> = useMemo(() => {
    return rawFactors.map((f: any, index: number) => {
      const low = typeof f.low === 'number' ? f.low : 0;
      const high = typeof f.high === 'number' ? f.high : 100;
      const letter = String.fromCharCode(65 + index);
      return { id: f.id, name: f.name || letter, letter, low, high, units: f.units };
    });
  }, [rawFactors]);

  // Ensure all response models are current
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
        console.warn('Auto-refit check in Point Prediction:', e);
      }
    }
    return { analyses: currentAnalyses };
  }, [design]);

  // Point Prediction Tool options
  const [alpha, setAlpha] = useState<number>(0.05);
  const [toleranceProp, setToleranceProp] = useState<number>(0.99);
  const [intervalType, setIntervalType] = useState<'Two-sided' | 'One-sided'>('Two-sided');

  // Tool panel visibility toggles
  const [showPredictionTool, setShowPredictionTool] = useState(true);
  const [showFactorsTool, setShowFactorsTool] = useState(true);

  // Active factor coordinates (defaults to center point)
  const [factorValues, setFactorValues] = useState<Record<string, number>>({});
  const [selectedFactorId, setSelectedFactorId] = useState<string>('');

  // Initialize factor values to center point
  useEffect(() => {
    if (factorBounds.length > 0) {
      setFactorValues(prev => {
        const next: Record<string, number> = { ...prev };
        for (const f of factorBounds) {
          if (next[f.id] === undefined) {
            next[f.id] = Number(((f.low + f.high) / 2).toFixed(4));
          }
        }
        return next;
      });
      if (!selectedFactorId) {
        setSelectedFactorId(factorBounds[0].id);
      }
    }
  }, [factorBounds]);

  const handleFactorChange = (factorId: string, val: number) => {
    setFactorValues(prev => ({
      ...prev,
      [factorId]: val
    }));
  };

  const handleResetDefaults = () => {
    setAlpha(0.05);
    setToleranceProp(0.99);
    setIntervalType('Two-sided');
  };

  const handleSetCenterPoint = () => {
    const center: Record<string, number> = {};
    for (const f of factorBounds) {
      center[f.id] = Number(((f.low + f.high) / 2).toFixed(4));
    }
    setFactorValues(center);
  };

  const handleJumpToRun = (runIndex: number) => {
    if (runIndex < 0 || runIndex >= rawRuns.length) return;
    const run = rawRuns[runIndex];
    if (run?.actualValues) {
      const next: Record<string, number> = {};
      for (const f of factorBounds) {
        if (run.actualValues[f.id] !== undefined) {
          next[f.id] = run.actualValues[f.id];
        }
      }
      setFactorValues(next);
    }
  };

  // Compute point predictions
  const predictions: PointPredictionResult[] = useMemo(() => {
    if (factorBounds.length === 0 || rawResponses.length === 0) return [];
    return calculatePointPredictions(
      factorBounds,
      rawResponses,
      analyses,
      rawRuns,
      factorValues,
      { alpha, toleranceProp, intervalType }
    );
  }, [factorBounds, rawResponses, analyses, rawRuns, factorValues, alpha, toleranceProp, intervalType]);

  const hasExtrapolation = predictions.some(p => p.isExtrapolated);

  if (!design) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white text-gray-400 font-sans">
        <p className="font-semibold text-gray-500 mb-1">No Active Design Selected</p>
        <p className="text-xs text-gray-400">Select an experimental design from the Project Tree to use Point Prediction.</p>
      </div>
    );
  }

  const confidencePct = Math.round((1 - alpha) * 100);
  const populationPct = Math.round(toleranceProp * 100);

  return (
    <div className="flex-1 flex h-full bg-[#EAEAEA] font-sans overflow-hidden select-none">
      
      {/* Left Docked Box: Point Prediction Tool */}
      {showPredictionTool && (
        <div className="w-52 bg-white border-r border-[#C0C0C0] flex flex-col shrink-0 text-xs shadow-xs">
          <div className="bg-[#EAEAEA] border-b border-[#C0C0C0] px-2.5 py-1.5 flex items-center justify-between font-bold text-gray-800">
            <span>Point Prediction Tool</span>
            <button 
              onClick={() => setShowPredictionTool(false)} 
              className="text-gray-400 hover:text-gray-700 p-0.5"
              title="Close Tool"
            >
              <X size={13} />
            </button>
          </div>

          <div className="p-2 space-y-2 flex-1 overflow-y-auto">
            <table className="w-full border border-[#D0D0D0] text-[11px] border-collapse bg-white">
              <tbody>
                <tr className="border-b border-[#D0D0D0]">
                  <td className="px-2 py-1 bg-[#F5F5F5] font-semibold text-gray-700 w-24 border-r border-[#D0D0D0]">
                    alpha
                  </td>
                  <td className="p-0.5">
                    <input
                      type="number"
                      step={0.01}
                      min={0.001}
                      max={0.5}
                      value={alpha}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v > 0 && v < 1) setAlpha(v);
                      }}
                      className="w-full px-1.5 py-0.5 font-mono text-[11px] outline-none text-gray-800 focus:bg-[#EAF5FF]"
                    />
                  </td>
                </tr>
                <tr className="border-b border-[#D0D0D0]">
                  <td className="px-2 py-1 bg-[#F5F5F5] font-semibold text-gray-700 border-r border-[#D0D0D0]">
                    Tolerance Prop
                  </td>
                  <td className="p-0.5">
                    <input
                      type="number"
                      step={0.01}
                      min={0.5}
                      max={0.999}
                      value={toleranceProp}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v > 0 && v < 1) setToleranceProp(v);
                      }}
                      className="w-full px-1.5 py-0.5 font-mono text-[11px] outline-none text-gray-800 focus:bg-[#EAF5FF]"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="px-2 py-1 bg-[#F5F5F5] font-semibold text-gray-700 border-r border-[#D0D0D0]">
                    Interval
                  </td>
                  <td className="p-0.5">
                    <select
                      value={intervalType}
                      onChange={(e) => setIntervalType(e.target.value as any)}
                      className="w-full px-1 py-0.5 text-[11px] outline-none bg-white font-medium text-gray-800 focus:bg-[#EAF5FF]"
                    >
                      <option value="Two-sided">Two-sided</option>
                      <option value="One-sided">One-sided</option>
                    </select>
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="pt-2 flex justify-center">
              <button
                onClick={handleResetDefaults}
                className="px-4 py-1 bg-[#F0F0F0] hover:bg-[#E0E0E0] border border-[#B0B0B0] text-gray-800 font-semibold text-[11px] shadow-xs active:translate-y-px transition-colors"
              >
                Defaults
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Center Main Split: Factors Table (Top) and Point Prediction Table (Bottom) */}
      <div className="flex-1 flex flex-col overflow-y-auto bg-white p-3 space-y-3">
        
        {/* Toggle tools bar if tools are hidden */}
        {(!showPredictionTool || !showFactorsTool) && (
          <div className="flex items-center gap-2 pb-1 border-b border-gray-200 text-xs">
            {!showPredictionTool && (
              <button 
                onClick={() => setShowPredictionTool(true)}
                className="px-2 py-0.5 bg-[#F5F5F5] hover:bg-[#EAEAEA] border border-[#C0C0C0] text-gray-700 font-medium"
              >
                Show Point Prediction Tool
              </button>
            )}
            {!showFactorsTool && (
              <button 
                onClick={() => setShowFactorsTool(true)}
                className="px-2 py-0.5 bg-[#F5F5F5] hover:bg-[#EAEAEA] border border-[#C0C0C0] text-gray-700 font-medium"
              >
                Show Factors Tool
              </button>
            )}
          </div>
        )}

        {/* Extrapolation Warning */}
        {hasExtrapolation && (
          <div className="bg-[#FFF4CE] border-l-4 border-[#FF8C00] p-2 text-xs text-[#7A5B00] shadow-xs flex items-center gap-2">
            <AlertTriangle size={15} className="text-[#FF8C00] shrink-0" />
            <span>
              <strong>Extrapolation Warning:</strong> One or more factor coordinates lie outside experimental boundaries. Prediction leverage is elevated.
            </span>
          </div>
        )}

        {/* Upper Pane: Factors Table */}
        <div className="border border-[#C0C0C0] bg-white shadow-xs">
          <div className="bg-[#EAEAEA] border-b border-[#C0C0C0] px-3 py-1 flex items-center gap-1.5 text-xs text-gray-800">
            <Table size={13} className="text-[#0055A4]" />
            <span className="font-semibold">Factors</span>
            <ChevronDown size={11} className="text-gray-500" />
          </div>

          <div className="p-3">
            <h2 className="text-base font-bold text-gray-900 mb-2 font-serif">Factors</h2>
            
            <div className="overflow-x-auto">
              <table className="min-w-full border border-[#D0D0D0] text-xs border-collapse">
                <thead className="bg-[#EFEFEF] text-gray-800 font-semibold border-b border-[#C0C0C0]">
                  <tr>
                    <th className="px-3 py-1.5 text-left border-r border-[#D0D0D0]">Factor</th>
                    <th className="px-3 py-1.5 text-left border-r border-[#D0D0D0]">Name</th>
                    <th className="px-3 py-1.5 text-right border-r border-[#D0D0D0]">Level</th>
                    <th className="px-3 py-1.5 text-right border-r border-[#D0D0D0]">Low Level</th>
                    <th className="px-3 py-1.5 text-right border-r border-[#D0D0D0]">High Level</th>
                    <th className="px-3 py-1.5 text-right border-r border-[#D0D0D0]">Std. Dev.</th>
                    <th className="px-3 py-1.5 text-left">Coding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAEAEA] bg-white text-gray-800 font-mono">
                  {factorBounds.map(f => {
                    const currentVal = factorValues[f.id] ?? (f.low + f.high) / 2;
                    const isSelected = selectedFactorId === f.id;

                    return (
                      <tr 
                        key={f.id} 
                        onClick={() => setSelectedFactorId(f.id)}
                        className={`cursor-pointer ${isSelected ? 'bg-[#EBF3FB]' : 'hover:bg-[#F9F9F9]'}`}
                      >
                        <td className="px-3 py-1 border-r border-[#EAEAEA] font-sans font-medium text-gray-700">
                          {f.letter}
                        </td>
                        <td className="px-3 py-1 border-r border-[#EAEAEA] font-sans font-semibold text-[#0055A4]">
                          {f.name}
                        </td>
                        <td className="px-2 py-0.5 border-r border-[#EAEAEA] text-right">
                          <input
                            type="number"
                            step={(f.high - f.low) / 100}
                            value={currentVal}
                            onChange={(e) => handleFactorChange(f.id, parseFloat(e.target.value) || 0)}
                            className="w-20 px-1 py-0.5 text-right font-mono text-xs bg-transparent border border-transparent hover:border-[#C0C0C0] focus:border-[#0055A4] focus:bg-white outline-none"
                          />
                        </td>
                        <td className="px-3 py-1 border-r border-[#EAEAEA] text-right text-gray-600">
                          {f.low.toFixed(2)}
                        </td>
                        <td className="px-3 py-1 border-r border-[#EAEAEA] text-right text-gray-600">
                          {f.high.toFixed(2)}
                        </td>
                        <td className="px-3 py-1 border-r border-[#EAEAEA] text-right text-gray-500">
                          0.0000
                        </td>
                        <td className="px-3 py-1 font-sans text-gray-700">
                          Actual
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Lower Pane: Point Prediction Table */}
        <div className="border border-[#C0C0C0] bg-white shadow-xs">
          <div className="bg-[#EAEAEA] border-b border-[#C0C0C0] px-3 py-1 flex items-center gap-1.5 text-xs text-gray-800">
            <MapPin size={13} className="text-[#FF8C00]" />
            <span className="font-semibold">Point Prediction</span>
            <ChevronDown size={11} className="text-gray-500" />
          </div>

          <div className="p-3">
            <h2 className="text-base font-bold text-gray-900 mb-1 font-serif">Point Prediction</h2>
            <p className="text-xs text-gray-700 font-sans mb-3">
              {intervalType} Confidence = {confidencePct}% Population = {populationPct}%
            </p>

            <div className="overflow-x-auto">
              <table className="min-w-full border border-[#D0D0D0] text-xs border-collapse">
                <thead className="bg-[#EFEFEF] text-gray-800 font-semibold border-b border-[#C0C0C0]">
                  <tr>
                    <th className="px-3 py-1.5 text-left border-r border-[#D0D0D0]">Analysis</th>
                    <th className="px-3 py-1.5 text-right border-r border-[#D0D0D0]">Predicted<br/>Mean</th>
                    <th className="px-3 py-1.5 text-right border-r border-[#D0D0D0]">Predicted<br/>Median</th>
                    <th className="px-3 py-1.5 text-right border-r border-[#D0D0D0]">Observed</th>
                    <th className="px-3 py-1.5 text-right border-r border-[#D0D0D0]">Std Dev</th>
                    <th className="px-3 py-1.5 text-right border-r border-[#D0D0D0]">SE Mean</th>
                    <th className="px-3 py-1.5 text-right border-r border-[#D0D0D0]">
                      {confidencePct}% CI low<br/>for Mean
                    </th>
                    <th className="px-3 py-1.5 text-right border-r border-[#D0D0D0]">
                      {confidencePct}% CI high<br/>for Mean
                    </th>
                    <th className="px-3 py-1.5 text-right border-r border-[#D0D0D0]">
                      {confidencePct}% TI low<br/>for {populationPct}% Pop
                    </th>
                    <th className="px-3 py-1.5 text-right">
                      {confidencePct}% TI high<br/>for {populationPct}% Pop
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAEAEA] bg-white text-gray-800 font-mono">
                  {predictions.map(p => (
                    <tr key={p.responseId} className="hover:bg-[#F9F9F9]">
                      <td className="px-3 py-1.5 border-r border-[#EAEAEA] font-sans font-semibold text-[#0055A4] whitespace-nowrap">
                        {p.responseName}
                        {p.units && <span className="text-[10px] font-normal text-gray-500 ml-1">({p.units})</span>}
                      </td>
                      <td className="px-3 py-1.5 border-r border-[#EAEAEA] text-right font-bold text-gray-900">
                        {p.predictedMean !== null ? p.predictedMean.toFixed(5) : '-'}
                      </td>
                      <td className="px-3 py-1.5 border-r border-[#EAEAEA] text-right text-gray-800">
                        {p.predictedMedian !== null ? p.predictedMedian.toFixed(5) : '-'}
                      </td>
                      <td className="px-3 py-1.5 border-r border-[#EAEAEA] text-right font-semibold text-[#008000]">
                        {p.observedValue !== null ? p.observedValue.toFixed(5) : ''}
                      </td>
                      <td className="px-3 py-1.5 border-r border-[#EAEAEA] text-right text-gray-700">
                        {p.stdDev !== null ? p.stdDev.toFixed(7) : '-'}
                      </td>
                      <td className="px-3 py-1.5 border-r border-[#EAEAEA] text-right text-gray-700">
                        {p.stdErrorMean !== null ? p.stdErrorMean.toFixed(7) : '-'}
                      </td>
                      <td className="px-3 py-1.5 border-r border-[#EAEAEA] text-right text-[#0055A4]">
                        {p.ciLow !== null ? p.ciLow.toFixed(5) : '-'}
                      </td>
                      <td className="px-3 py-1.5 border-r border-[#EAEAEA] text-right text-[#0055A4]">
                        {p.ciHigh !== null ? p.ciHigh.toFixed(5) : '-'}
                      </td>
                      <td className="px-3 py-1.5 border-r border-[#EAEAEA] text-right text-[#7A5B00]">
                        {p.tiLow !== null ? p.tiLow.toFixed(5) : '-'}
                      </td>
                      <td className="px-3 py-1.5 text-right text-[#7A5B00]">
                        {p.tiHigh !== null ? p.tiHigh.toFixed(5) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {/* Right Docked Box: Factors Tool */}
      {showFactorsTool && (
        <div className="w-56 bg-white border-l border-[#C0C0C0] flex flex-col shrink-0 text-xs shadow-xs">
          <div className="bg-[#EAEAEA] border-b border-[#C0C0C0] px-2.5 py-1.5 flex items-center justify-between font-bold text-gray-800">
            <span>Factors Tool</span>
            <button 
              onClick={() => setShowFactorsTool(false)} 
              className="text-gray-400 hover:text-gray-700 p-0.5"
              title="Close Tool"
            >
              <X size={13} />
            </button>
          </div>

          <div className="p-2 space-y-3 flex-1 overflow-y-auto">
            
            {/* View Selector */}
            <select className="w-full border border-[#C0C0C0] bg-white px-1.5 py-0.5 text-xs text-gray-800 outline-none">
              <option>Single Graph</option>
            </select>

            {/* Presets */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={handleSetCenterPoint}
                className="px-2 py-1 bg-[#F0F0F0] hover:bg-[#E0E0E0] border border-[#B0B0B0] text-gray-800 font-semibold text-[11px] shadow-xs active:translate-y-px transition-colors text-center"
              >
                Default
              </button>
              <button
                className="px-2 py-1 bg-[#F0F0F0] hover:bg-[#E0E0E0] border border-[#B0B0B0] text-gray-800 font-semibold text-[11px] shadow-xs active:translate-y-px transition-colors text-center"
              >
                Sheet...
              </button>
            </div>

            {/* Jump to Run */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-700">Jump to run:</label>
              <select
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) handleJumpToRun(val);
                }}
                className="w-full border border-[#C0C0C0] bg-white px-1.5 py-0.5 text-xs text-gray-800 outline-none"
                defaultValue=""
              >
                <option value="" disabled>Run #</option>
                {rawRuns.map((r: any, idx: number) => (
                  <option key={r.id || idx} value={idx}>
                    Run {r.runOrder || idx + 1} (Std {r.stdOrder || idx + 1})
                  </option>
                ))}
              </select>
            </div>

            <hr className="border-[#E0E0E0]" />

            {/* Factor Sliders */}
            <div className="space-y-3">
              {factorBounds.map(f => {
                const currentVal = factorValues[f.id] ?? (f.low + f.high) / 2;
                const isSelected = selectedFactorId === f.id;

                return (
                  <div 
                    key={f.id} 
                    onClick={() => setSelectedFactorId(f.id)}
                    className={`space-y-1 p-1 rounded-xs cursor-pointer ${isSelected ? 'bg-[#F0F8FF]' : ''}`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-gray-800">{f.letter}:{f.name}</span>
                      <span className="font-mono text-[11px] text-[#0055A4]">{currentVal.toFixed(2)}</span>
                    </div>

                    <input
                      type="range"
                      min={f.low}
                      max={f.high}
                      step={(f.high - f.low) / 100}
                      value={currentVal}
                      onChange={(e) => handleFactorChange(f.id, parseFloat(e.target.value))}
                      className="w-full accent-[#0055A4] cursor-pointer h-1.5"
                    />
                  </div>
                );
              })}
            </div>

            <hr className="border-[#E0E0E0]" />

            {/* Factor Value Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-700">Factor value:</label>
              <input
                type="number"
                value={selectedFactorId && factorValues[selectedFactorId] !== undefined ? factorValues[selectedFactorId] : ''}
                onChange={(e) => {
                  if (selectedFactorId) {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) handleFactorChange(selectedFactorId, val);
                  }
                }}
                className="w-full border border-[#C0C0C0] px-2 py-1 text-xs font-mono outline-none focus:border-[#0055A4]"
                placeholder="Select a factor..."
              />
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
