import { OptimizationSolution, OptimizationCriterion } from '../../../lib/optimization/types';
import { ChevronLeft, ChevronRight, BarChart2 } from 'lucide-react';

interface BarGraphViewProps {
  solutions: OptimizationSolution[];
  selectedSolutionIndex: number;
  onSelectSolution: (index: number) => void;
  factors: Array<{ id: string; name: string; units?: string }>;
  responses: Array<{ id: string; name: string; units?: string }>;
  criteria: Record<string, OptimizationCriterion>;
}

export function BarGraphView({
  solutions,
  selectedSolutionIndex,
  onSelectSolution,
  factors,
  responses,
  criteria,
}: BarGraphViewProps) {
  if (!solutions || solutions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white border border-[#C0C0C0] text-gray-400 rounded-sm font-sans">
        <p className="font-semibold text-gray-500 mb-1">No optimization solutions to display</p>
        <p className="text-xs text-gray-400">Run optimization first to generate desirability bars.</p>
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

  // Compile active bars matching Design-Expert 13 Screenshot 2
  interface BarItem {
    id: string;
    label: string;
    desirability: number;
    color: string;
    type: 'factor' | 'response' | 'combined';
  }

  const bars: BarItem[] = [];

  // 1. Factors: labeled "A:A", "B:B", "C:C" with deep teal/blue fill
  factors.forEach((f, idx) => {
    const letter = String.fromCharCode(65 + idx);
    const label = `${letter}:${f.name}`;
    const val = solution.individualDesirability?.[f.id] ?? 1.0;
    bars.push({
      id: f.id,
      label,
      desirability: typeof val === 'number' && Number.isFinite(val) ? val : 1.0,
      color: '#005C8A', // Deep blue per DX13 screenshot
      type: 'factor',
    });
  });

  // 2. Responses: labeled with response name (e.g. "Resolution", "Retention Time") with light gray-blue fill
  responses.forEach((r) => {
    const crit = criteria[r.id];
    if (!crit || crit.goal !== 'none') {
      const val = solution.individualDesirability?.[r.id] ?? 0.0;
      bars.push({
        id: r.id,
        label: r.name,
        desirability: typeof val === 'number' && Number.isFinite(val) ? val : 0.0,
        color: '#CBD3DC', // Light gray-blue per DX13 screenshot
        type: 'response',
      });
    }
  });

  // 3. Overall Combined Desirability: labeled "Combined" with distinct orange/red fill
  bars.push({
    id: 'combined',
    label: 'Combined',
    desirability: solution.desirability,
    color: '#EB6A38', // Distinct orange per DX13 screenshot
    type: 'combined',
  });

  // Layout measurements for DX13 SVG Plot Box
  const rowHeight = 36;
  const barHeight = 22;
  const boxTop = 35;
  const boxLeft = 140;
  const boxWidth = 460;
  const boxHeight = bars.length * rowHeight;
  const totalSvgWidth = boxLeft + boxWidth + 80;
  const totalSvgHeight = boxTop + boxHeight + 65;

  const ticks = [0.0, 0.25, 0.5, 0.75, 1.0];

  const formatBarValue = (val: number): string => {
    if (Math.abs(val - 1.0) < 1e-4) return '1';
    if (Math.abs(val) < 1e-4) return '0';
    return val.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  };

  return (
    <div className="flex-1 flex flex-col bg-white border border-[#B0B0B0] shadow-xs overflow-hidden rounded-xs font-sans text-xs">
      
      {/* Top Header & Navigation Bar */}
      <div className="bg-[#003366] text-white px-4 py-1.5 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-[12px] tracking-wide">
            <BarChart2 size={15} className="text-[#A0C4FF]" />
            <span>Desirability Bar Graph</span>
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

        {/* Legend */}
        <div className="flex items-center gap-4 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 border border-black/60" style={{ backgroundColor: '#005C8A' }} />
            <span>Factor</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 border border-black/60" style={{ backgroundColor: '#CBD3DC' }} />
            <span>Response</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 border border-black/60" style={{ backgroundColor: '#EB6A38' }} />
            <span>Combined</span>
          </div>
        </div>
      </div>

      {/* Main Graph Area */}
      <div className="flex-1 overflow-auto p-4 flex flex-col items-center justify-center bg-white select-none">
        <svg
          width={totalSvgWidth}
          height={totalSvgHeight}
          viewBox={`0 0 ${totalSvgWidth} ${totalSvgHeight}`}
          className="overflow-visible font-sans max-w-full"
        >
          {/* Chart Title */}
          <text
            x={boxLeft + boxWidth / 2}
            y={20}
            textAnchor="middle"
            fill="#111827"
            fontSize="14"
            fontFamily="sans-serif"
            fontWeight="500"
          >
            Desirability
          </text>

          {/* Plotting Box Background */}
          <rect
            x={boxLeft}
            y={boxTop}
            width={boxWidth}
            height={boxHeight}
            fill="#FFFFFF"
            stroke="#222222"
            strokeWidth="1.2"
          />

          {/* Vertical Gridlines & Ticks */}
          {ticks.map((tick) => {
            const gx = boxLeft + tick * boxWidth;
            return (
              <g key={tick}>
                {/* Vertical grid line inside box */}
                <line
                  x1={gx}
                  y1={boxTop}
                  x2={gx}
                  y2={boxTop + boxHeight}
                  stroke="#555555"
                  strokeWidth="0.8"
                />
                {/* Bottom tick mark */}
                <line
                  x1={gx}
                  y1={boxTop + boxHeight}
                  x2={gx}
                  y2={boxTop + boxHeight + 5}
                  stroke="#222222"
                  strokeWidth="1.2"
                />
                {/* Tick label */}
                <text
                  x={gx}
                  y={boxTop + boxHeight + 18}
                  textAnchor="middle"
                  fill="#111827"
                  fontSize="10"
                  fontFamily="sans-serif"
                >
                  {tick.toFixed(3)}
                </text>
              </g>
            );
          })}

          {/* Horizontal Desirability Bars */}
          {bars.map((bar, i) => {
            const y = boxTop + i * rowHeight + (rowHeight - barHeight) / 2;
            const clampedVal = Math.max(0, Math.min(1, bar.desirability));
            const w = clampedVal * boxWidth;

            return (
              <g key={bar.id}>
                {/* Left Y-axis Label */}
                <text
                  x={boxLeft - 10}
                  y={y + barHeight / 2 + 4}
                  textAnchor="end"
                  fill="#111827"
                  fontSize="11"
                  fontFamily="sans-serif"
                >
                  {bar.label}
                </text>

                {/* Bar Fill Rectangle with Thin Black Border */}
                {w > 0 && (
                  <rect
                    x={boxLeft}
                    y={y}
                    width={w}
                    height={barHeight}
                    fill={bar.color}
                    stroke="#000000"
                    strokeWidth="1"
                  />
                )}

                {/* Numeric Desirability Value outside the box on the right */}
                <text
                  x={boxLeft + boxWidth + 8}
                  y={y + barHeight / 2 + 4}
                  textAnchor="start"
                  fill="#111827"
                  fontSize="12"
                  fontFamily="sans-serif"
                >
                  {formatBarValue(bar.desirability)}
                </text>
              </g>
            );
          })}

          {/* Footer Solution Note */}
          <text
            x={boxLeft + boxWidth / 2}
            y={boxTop + boxHeight + 46}
            textAnchor="middle"
            fill="#111827"
            fontSize="11"
            fontFamily="sans-serif"
          >
            Solution {selectedSolutionIndex + 1} out of {totalSolutions}
          </text>
        </svg>
      </div>

    </div>
  );
}
