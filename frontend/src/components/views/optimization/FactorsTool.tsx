import { useState } from 'react';
import { OptimizationSolution } from '../../../lib/optimization/types';
import { ChevronLeft, ChevronRight, Sliders, Beaker, RotateCcw } from 'lucide-react';

export interface FactorsToolGraphState {
  graphType: 'perturbation' | 'one_factor' | 'all_factors' | 'interaction' | 'contour' | 'surface';
  setGraphType?: React.Dispatch<React.SetStateAction<'perturbation' | 'one_factor' | 'all_factors' | 'interaction' | 'contour' | 'surface'>>;
  axisXId: string;
  setAxisXId: (id: string) => void;
  axisYId: string;
  setAxisYId: (id: string) => void;
  heldFactors: Record<string, number>;
  setHeldFactors: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  onResetToDefault: () => void;
}

interface FactorsToolProps {
  solutions: OptimizationSolution[];
  selectedSolutionIndex: number;
  onSelectSolution: (index: number) => void;
  factors: Array<{ id: string; name: string; low: number; high: number; units?: string }>;
  responses: Array<{ id: string; name: string; units?: string }>;
  graphState?: FactorsToolGraphState;
}

export function FactorsTool({
  solutions,
  selectedSolutionIndex,
  onSelectSolution,
  factors,
  responses,
  graphState,
}: FactorsToolProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeFactorId, setActiveFactorId] = useState<string>(factors[0]?.id || '');

  const totalSolutions = solutions.length;
  const currentSolution = solutions[selectedSolutionIndex] || solutions[0];

  if (!currentSolution) {
    return null;
  }

  const handlePrev = () => {
    if (selectedSolutionIndex > 0) {
      onSelectSolution(selectedSolutionIndex - 1);
    }
  };

  const handleNext = () => {
    if (selectedSolutionIndex < totalSolutions - 1) {
      onSelectSolution(selectedSolutionIndex + 1);
    }
  };

  if (isCollapsed) {
    return (
      <div className="w-9 bg-[#EAEAEA] border-l border-[#C0C0C0] flex flex-col items-center py-2 shrink-0 select-none">
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          className="p-1.5 hover:bg-[#D5D5D5] rounded text-[#003366] transition-colors"
          title="Expand Factors Tool"
        >
          <Sliders size={16} />
        </button>
        <span 
          className="text-[10px] font-bold text-gray-600 mt-4 tracking-wider uppercase" 
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          Factors Tool
        </span>
      </div>
    );
  }

  // Active factor value for input box
  const activeFactor = factors.find(f => f.id === activeFactorId) || factors[0];
  const activeValue = graphState?.heldFactors?.[activeFactor?.id] ?? currentSolution.factors[activeFactor?.id] ?? activeFactor?.low ?? 0;

  return (
    <div className="w-64 bg-[#F8FAFC] border-l border-[#C0C0C0] flex flex-col shrink-0 select-none font-sans text-xs shadow-xs">
      {/* Title Bar */}
      <div className="bg-[#003366] text-white px-3 py-1.5 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-1.5 font-bold text-[11px] tracking-wide">
          <Sliders size={13} className="text-[#A0C4FF]" />
          <span>Factors Tool</span>
        </div>
        <button
          type="button"
          onClick={() => setIsCollapsed(true)}
          className="p-0.5 hover:bg-[#002244] text-white/80 hover:text-white rounded"
          title="Collapse Panel"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3.5">
        
        {/* Graph Controls Toolbar if in Graph Mode (per DX13 Screenshot 3, 4, 5) */}
        {graphState && (
          <div className="bg-white border border-[#D0D0D0] p-2 rounded-xs shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-700 text-[11px]">Single Graph</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={graphState.onResetToDefault}
                  className="px-2 py-0.5 bg-[#EAEAEA] hover:bg-[#D5D5D5] text-[#111827] text-[10px] font-medium border border-[#B0B0B0] rounded-xs shadow-2xs flex items-center gap-1"
                  title="Reset held factor values to current optimal solution"
                >
                  <RotateCcw size={10} />
                  <span>Default</span>
                </button>
                <button
                  type="button"
                  disabled
                  className="px-2 py-0.5 bg-[#F5F5F5] text-gray-400 text-[10px] font-medium border border-gray-300 rounded-xs cursor-not-allowed"
                >
                  Sheet...
                </button>
              </div>
            </div>

            {/* Term selector for One Factor or Interaction */}
            {graphState.graphType === 'one_factor' && (
              <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                <span className="text-[10px] text-gray-600 font-bold">Term:</span>
                <select
                  value={graphState.axisXId}
                  onChange={(e) => {
                    graphState.setAxisXId(e.target.value);
                    setActiveFactorId(e.target.value);
                  }}
                  className="flex-1 bg-white border border-gray-300 text-gray-800 text-[11px] px-1.5 py-0.5 rounded focus:outline-none"
                >
                  {factors.map((f, i) => (
                    <option key={f.id} value={f.id}>
                      {String.fromCharCode(65 + i)}: {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {graphState.graphType === 'interaction' && (
              <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                <span className="text-[10px] text-gray-600 font-bold">Term:</span>
                <select
                  value={`${graphState.axisXId}__${graphState.axisYId}`}
                  onChange={(e) => {
                    const [xId, yId] = e.target.value.split('__');
                    if (xId) graphState.setAxisXId(xId);
                    if (yId) graphState.setAxisYId(yId);
                  }}
                  className="flex-1 bg-white border border-gray-300 text-gray-800 text-[11px] px-1.5 py-0.5 rounded focus:outline-none"
                >
                  {factors.flatMap((f1, i) =>
                    factors.slice(i + 1).map((f2, j) => {
                      const idx2 = i + 1 + j;
                      const l1 = String.fromCharCode(65 + i);
                      const l2 = String.fromCharCode(65 + idx2);
                      return (
                        <option key={`${f1.id}__${f2.id}`} value={`${f1.id}__${f2.id}`}>
                          {l1}{l2} ({f1.name} × {f2.name})
                        </option>
                      );
                    })
                  )}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Solution Selector Box */}
        <div className="bg-white border border-[#D0D0D0] p-2.5 rounded-sm shadow-xs space-y-2">
          <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase tracking-wider">
            <span>Solution:</span>
            <span className="text-gray-500 font-normal">of {totalSolutions}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={selectedSolutionIndex <= 0}
              onClick={handlePrev}
              className="p-1 border border-[#C0C0C0] rounded-xs hover:bg-[#EAEAEA] disabled:opacity-30 disabled:hover:bg-white text-gray-700"
              title="Previous Solution"
            >
              <ChevronLeft size={13} />
            </button>

            <select
              className="flex-1 border border-[#909090] bg-white px-2 py-1 text-xs font-mono font-semibold text-gray-800 rounded-xs focus:outline-none focus:border-[#0055A4]"
              value={selectedSolutionIndex}
              onChange={e => onSelectSolution(Number(e.target.value))}
            >
              {solutions.map((s, idx) => (
                <option key={s.solutionNumber || idx} value={idx}>
                  {s.solutionNumber || idx + 1} (D = {s.desirability.toFixed(4)})
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={selectedSolutionIndex >= totalSolutions - 1}
              onClick={handleNext}
              className="p-1 border border-[#C0C0C0] rounded-xs hover:bg-[#EAEAEA] disabled:opacity-30 disabled:hover:bg-white text-gray-700"
              title="Next Solution"
            >
              <ChevronRight size={13} />
            </button>
          </div>

          {/* Desirability Metric */}
          <div className="bg-[#FFFDF5] border border-[#F2D675] p-2 rounded-xs flex items-center justify-between">
            <span className="text-[10px] text-[#8A5200] font-semibold">Desirability:</span>
            <span className="font-mono font-bold text-sm text-[#B45309]">
              {currentSolution.desirability.toFixed(4)}
            </span>
          </div>
        </div>

        {/* Factors Sliders & Controls */}
        <div className="bg-white border border-[#D0D0D0] rounded-sm shadow-xs overflow-hidden">
          <div className="bg-[#F0F4F8] px-2.5 py-1 text-[10px] font-bold text-[#0055A4] uppercase tracking-wider border-b border-[#D8E4F0]">
            Factors
          </div>
          <div className="p-2.5 space-y-3">
            {factors.map((f, idx) => {
              const letter = String.fromCharCode(65 + idx);
              const label = `${letter}:${f.name}`;
              const val = graphState?.heldFactors?.[f.id] ?? currentSolution.factors[f.id] ?? (f.low + f.high) / 2;
              const isSelected = activeFactorId === f.id;

              // Check if factor is an active plot axis
              const isX1 = graphState && (
                graphState.graphType === 'one_factor' || 
                graphState.graphType === 'interaction' || 
                graphState.graphType === 'contour' || 
                graphState.graphType === 'surface'
              ) && graphState.axisXId === f.id;

              const isX2 = graphState && (
                graphState.graphType === 'interaction' || 
                graphState.graphType === 'contour' || 
                graphState.graphType === 'surface'
              ) && graphState.axisYId === f.id;

              return (
                <div 
                  key={f.id} 
                  onClick={() => setActiveFactorId(f.id)}
                  className={`p-1.5 rounded transition-colors cursor-pointer ${
                    isSelected ? 'bg-blue-50/70' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-gray-700 text-[11px] truncate max-w-[120px]" title={f.name}>
                      {label}
                    </span>
                    <span className="font-mono text-[11px] text-[#003366] font-bold">
                      {typeof val === 'number' ? val.toFixed(3) : '-'}
                    </span>
                  </div>

                  {/* Factor control: X1 button, X2 button, or Slider */}
                  {isX1 ? (
                    <div className="w-full py-0.5 bg-[#EAEAEA] border border-[#B0B0B0] text-center font-bold text-[10px] text-gray-700 rounded-xs shadow-2xs">
                      X1 (X-Axis)
                    </div>
                  ) : isX2 ? (
                    <div className="w-full py-0.5 bg-[#EAEAEA] border border-[#B0B0B0] text-center font-bold text-[10px] text-gray-700 rounded-xs shadow-2xs">
                      X2 (Interaction / Y)
                    </div>
                  ) : (
                    <input
                      type="range"
                      min={f.low}
                      max={f.high}
                      step={(f.high - f.low) / 200 || 0.01}
                      value={typeof val === 'number' ? val : f.low}
                      onChange={(e) => {
                        const num = Number(e.target.value);
                        if (graphState?.setHeldFactors) {
                          graphState.setHeldFactors(prev => ({ ...prev, [f.id]: num }));
                        }
                      }}
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#0055A4]"
                    />
                  )}
                </div>
              );
            })}

            {/* Factor Value Readout / Input Box */}
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
              <span className="text-[10px] text-gray-600 font-semibold">Factor value:</span>
              <input
                type="number"
                value={typeof activeValue === 'number' ? activeValue.toFixed(4) : ''}
                onChange={(e) => {
                  const num = Number(e.target.value);
                  if (Number.isFinite(num) && graphState?.setHeldFactors && activeFactor) {
                    graphState.setHeldFactors(prev => ({ ...prev, [activeFactor.id]: num }));
                  }
                }}
                className="w-24 text-right border border-gray-300 rounded px-1.5 py-0.5 font-mono text-[11px] text-gray-800 focus:outline-none focus:border-[#0055A4]"
              />
            </div>
          </div>
        </div>

        {/* Model Predictions */}
        <div className="bg-white border border-[#D0D0D0] rounded-sm shadow-xs overflow-hidden">
          <div className="bg-[#F4F9F4] px-2.5 py-1 text-[10px] font-bold text-[#006622] uppercase tracking-wider border-b border-[#D0E8D0]">
            Predictions at Optimum
          </div>
          <div className="p-2 space-y-1.5">
            {responses.map((r, idx) => {
              const code = `R${idx + 1}`;
              const val = currentSolution.predictions[r.id];
              const indD = currentSolution.individualDesirability?.[r.id];
              return (
                <div key={r.id} className="flex items-center justify-between text-[11px] border-b border-gray-100 pb-1 last:border-none last:pb-0">
                  <span className="truncate text-gray-700" title={r.name}>
                    {code}: {r.name}
                  </span>
                  <div className="text-right">
                    <span className="font-mono font-bold text-[#006622]">
                      {typeof val === 'number' ? val.toFixed(3) : '-'}
                    </span>
                    {typeof indD === 'number' && (
                      <span className="text-[9px] text-gray-400 ml-1 font-mono">(d={indD.toFixed(3)})</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scientific Safety Note */}
        <div className="bg-[#F5F5F5] border border-gray-300 p-2 rounded-xs text-[10px] text-gray-500 leading-tight">
          <div className="flex items-center gap-1 font-semibold text-gray-700 mb-0.5">
            <Beaker size={11} className="text-[#0055A4]" />
            <span>Mathematical Optimum</span>
          </div>
          Factor settings represent the global/local optimum located by the multi-start simplex search on fitted polynomial response surfaces.
        </div>

      </div>
    </div>
  );
}
