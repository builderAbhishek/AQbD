import { OptimizationSolution, OptimizationCriterion, isFactorCriterionCoded, codedToActual } from '../../../lib/optimization/types';
import { ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';

interface RampsViewProps {
  solutions: OptimizationSolution[];
  selectedSolutionIndex: number;
  onSelectSolution: (index: number) => void;
  factors: Array<{ id: string; name: string; low: number; high: number; units?: string }>;
  responses: Array<{ id: string; name: string; units?: string }>;
  criteria: Record<string, OptimizationCriterion>;
}

export function RampsView({
  solutions,
  selectedSolutionIndex,
  onSelectSolution,
  factors,
  responses,
  criteria,
}: RampsViewProps) {
  if (!solutions || solutions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white border border-[#C0C0C0] text-gray-400 rounded-sm font-sans">
        <p className="font-semibold text-gray-500 mb-1">No optimization solutions to display</p>
        <p className="text-xs text-gray-400">Run optimization first to generate solution ramps.</p>
      </div>
    );
  }

  const solution = solutions[selectedSolutionIndex] || solutions[0];
  const totalSolutions = solutions.length;

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

  // Subplot dimensions
  const plotWidth = 240;
  const plotHeight = 135;
  const padLeft = 35;
  const padRight = 35;
  const baselineY = 95;
  const plateauY = 40;

  return (
    <div className="flex-1 flex flex-col bg-white border border-[#B0B0B0] shadow-xs overflow-hidden rounded-xs font-sans text-xs">
      
      {/* Top Header & Navigation Bar */}
      <div className="bg-[#003366] text-white px-4 py-1.5 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-[12px] tracking-wide">
            <TrendingUp size={15} className="text-[#A0C4FF]" />
            <span>Optimization Ramps</span>
          </div>

          {/* Solution Selector */}
          <div className="flex items-center gap-1.5 bg-[#002244] px-2 py-0.5 rounded-xs border border-[#004080]">
            <button
              type="button"
              disabled={selectedSolutionIndex <= 0}
              onClick={handlePrev}
              className="p-0.5 hover:bg-[#003366] rounded disabled:opacity-30 disabled:hover:bg-transparent"
              title="Previous Solution"
            >
              <ChevronLeft size={13} />
            </button>
            <span className="text-[11px] font-semibold text-gray-200">Solution:</span>
            <select
              value={selectedSolutionIndex}
              onChange={(e) => onSelectSolution(Number(e.target.value))}
              className="bg-[#00172E] text-white font-mono font-bold text-[11px] px-1.5 py-0.5 rounded border border-[#004080] focus:outline-none"
            >
              {solutions.map((s, idx) => (
                <option key={s.solutionNumber || idx} value={idx}>
                  {s.solutionNumber || idx + 1} (D = {s.desirability.toFixed(4)})
                </option>
              ))}
            </select>
            <span className="text-[11px] text-gray-300">of {totalSolutions}</span>
            <button
              type="button"
              disabled={selectedSolutionIndex >= totalSolutions - 1}
              onClick={handleNext}
              className="p-0.5 hover:bg-[#003366] rounded disabled:opacity-30 disabled:hover:bg-transparent"
              title="Next Solution"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>

        <div className="text-[11px] text-gray-200">
          Red dot: Factor setting | Gray dot: Response prediction
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-white select-none">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Top Row: Factor Ramps */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 justify-items-center">
            {factors.map((f, idx) => {
              const letter = String.fromCharCode(65 + idx);
              const crit = criteria[f.id];
              const isCoded = crit ? isFactorCriterionCoded(crit, f) : false;
              const low = isCoded ? codedToActual(crit?.lowerLimit ?? -1, f.low, f.high) : (crit?.lowerLimit ?? f.low);
              const high = isCoded ? codedToActual(crit?.upperLimit ?? 1, f.low, f.high) : (crit?.upperLimit ?? f.high);
              const actVal = solution.factors?.[f.id] ?? (low + high) / 2;
              
              const span = high - low;
              const ratio = span > 0 ? Math.max(0, Math.min(1, (actVal - low) / span)) : 0.5;

              const xLow = padLeft;
              const xHigh = plotWidth - padRight;
              const xDot = xLow + ratio * (xHigh - xLow);
              const yDot = plateauY;

              return (
                <div key={f.id} className="flex flex-col items-center">
                  <svg
                    width={plotWidth}
                    height={plotHeight}
                    viewBox={`0 0 ${plotWidth} ${plotHeight}`}
                    className="overflow-visible font-sans"
                  >
                    {/* Outline Box */}
                    <rect
                      x={0}
                      y={0}
                      width={plotWidth}
                      height={plotHeight}
                      fill="#FFFFFF"
                      stroke="#222222"
                      strokeWidth="1.2"
                    />

                    {/* Baseline */}
                    <line
                      x1={10}
                      y1={baselineY}
                      x2={plotWidth - 10}
                      y2={baselineY}
                      stroke="#444444"
                      strokeWidth="1"
                    />

                    {/* Factor Plateau Shape: Step Up at low, Flat top, Step Down at high */}
                    <polyline
                      points={`${10},${baselineY} ${xLow},${baselineY} ${xLow},${plateauY} ${xHigh},${plateauY} ${xHigh},${baselineY} ${plotWidth - 10},${baselineY}`}
                      fill="none"
                      stroke="#222222"
                      strokeWidth="1.2"
                    />

                    {/* Low & High limit labels below ticks */}
                    <text
                      x={xLow}
                      y={baselineY + 16}
                      textAnchor="middle"
                      fill="#111827"
                      fontSize="10"
                      fontFamily="sans-serif"
                    >
                      {low % 1 === 0 ? low.toString() : low.toFixed(1)}
                    </text>
                    <text
                      x={xHigh}
                      y={baselineY + 16}
                      textAnchor="middle"
                      fill="#111827"
                      fontSize="10"
                      fontFamily="sans-serif"
                    >
                      {high % 1 === 0 ? high.toString() : high.toFixed(1)}
                    </text>

                    {/* Red Marker Dot at Factor Setting */}
                    <circle
                      cx={xDot}
                      cy={yDot}
                      r="4.5"
                      fill="#E00000"
                      stroke="#000000"
                      strokeWidth="1"
                    />
                  </svg>

                  {/* Centered label below box */}
                  <div className="mt-1.5 text-center font-sans text-xs text-[#111827]">
                    {letter}:{f.name} = {actVal.toFixed(actVal % 1 === 0 ? 2 : 4)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Row: Response Ramps */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 justify-items-center">
            {responses.map((r) => {
              const crit = criteria[r.id];
              const goal = crit?.goal || 'in_range';
              const predVal = solution.predictions?.[r.id] ?? 0;
              const low = crit?.lowerLimit ?? 0;
              const high = crit?.upperLimit ?? 100;
              const target = crit?.targetValue ?? (low + high) / 2;

              const span = high - low;
              const ratio = span > 0 ? Math.max(0, Math.min(1, (predVal - low) / span)) : 0.5;

              const xLow = padLeft;
              const xHigh = plotWidth - padRight;
              const xDot = xLow + ratio * (xHigh - xLow);

              // Calculate yDot and ramp geometry based on goal
              let polylinePoints = '';
              let yDot = plateauY;

              if (goal === 'maximize') {
                polylinePoints = `${10},${baselineY} ${xLow},${baselineY} ${xHigh},${plateauY} ${xHigh},${baselineY} ${plotWidth - 10},${baselineY}`;
                yDot = baselineY - ratio * (baselineY - plateauY);
              } else if (goal === 'minimize') {
                polylinePoints = `${10},${baselineY} ${xLow},${baselineY} ${xLow},${plateauY} ${xHigh},${baselineY} ${plotWidth - 10},${baselineY}`;
                yDot = plateauY + ratio * (baselineY - plateauY);
              } else if (goal === 'target') {
                const targetRatio = span > 0 ? Math.max(0, Math.min(1, (target - low) / span)) : 0.5;
                const xTarget = xLow + targetRatio * (xHigh - xLow);
                polylinePoints = `${10},${baselineY} ${xLow},${baselineY} ${xTarget},${plateauY} ${xHigh},${baselineY} ${plotWidth - 10},${baselineY}`;
                if (predVal <= target) {
                  const subRatio = (predVal - low) / (target - low || 1);
                  yDot = baselineY - Math.max(0, Math.min(1, subRatio)) * (baselineY - plateauY);
                } else {
                  const subRatio = (predVal - target) / (high - target || 1);
                  yDot = plateauY + Math.max(0, Math.min(1, subRatio)) * (baselineY - plateauY);
                }
              } else {
                // In range (default plateau per Screenshot 1)
                polylinePoints = `${10},${baselineY} ${xLow},${baselineY} ${xLow},${plateauY} ${xHigh},${plateauY} ${xHigh},${baselineY} ${plotWidth - 10},${baselineY}`;
                yDot = plateauY;
              }

              return (
                <div key={r.id} className="flex flex-col items-center">
                  <svg
                    width={plotWidth}
                    height={plotHeight}
                    viewBox={`0 0 ${plotWidth} ${plotHeight}`}
                    className="overflow-visible font-sans"
                  >
                    {/* Outline Box */}
                    <rect
                      x={0}
                      y={0}
                      width={plotWidth}
                      height={plotHeight}
                      fill="#FFFFFF"
                      stroke="#222222"
                      strokeWidth="1.2"
                    />

                    {/* Baseline */}
                    <line
                      x1={10}
                      y1={baselineY}
                      x2={plotWidth - 10}
                      y2={baselineY}
                      stroke="#444444"
                      strokeWidth="1"
                    />

                    {/* Ramp Line */}
                    <polyline
                      points={polylinePoints}
                      fill="none"
                      stroke="#222222"
                      strokeWidth="1.2"
                    />

                    {/* Low & High limit labels */}
                    <text
                      x={xLow}
                      y={baselineY + 16}
                      textAnchor="middle"
                      fill="#111827"
                      fontSize="10"
                      fontFamily="sans-serif"
                    >
                      {low % 1 === 0 ? low.toString() : low.toFixed(2)}
                    </text>
                    <text
                      x={xHigh}
                      y={baselineY + 16}
                      textAnchor="middle"
                      fill="#111827"
                      fontSize="10"
                      fontFamily="sans-serif"
                    >
                      {high % 1 === 0 ? high.toString() : high.toFixed(2)}
                    </text>

                    {/* Gray Marker Dot at Predicted Response */}
                    <circle
                      cx={xDot}
                      cy={yDot}
                      r="4.5"
                      fill="#B8C5D0"
                      stroke="#000000"
                      strokeWidth="1"
                    />
                  </svg>

                  {/* Centered label below box */}
                  <div className="mt-1.5 text-center font-sans text-xs text-[#111827]">
                    {r.name} = {typeof predVal === 'number' ? predVal.toFixed(predVal % 1 === 0 ? 2 : 5) : '-'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Left Summary */}
          <div className="pt-4 border-t border-gray-100 font-sans text-xs text-[#111827] space-y-0.5">
            <div>Desirability = {solution.desirability.toFixed(3)}</div>
            <div>Solution {selectedSolutionIndex + 1} out of {totalSolutions}</div>
          </div>

        </div>
      </div>

    </div>
  );
}
