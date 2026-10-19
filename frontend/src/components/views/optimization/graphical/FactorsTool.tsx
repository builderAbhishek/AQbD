import React from 'react';
import { FactorBounds, actualToCoded, codedToActual } from '../../../../lib/optimization/solver';
import { RotateCcw } from 'lucide-react';

interface FactorsToolProps {
  factors: FactorBounds[];
  axisXId: string;
  axisYId: string;
  heldValues: Record<string, number>;
  onSelectAxisX: (factorId: string) => void;
  onSelectAxisY: (factorId: string) => void;
  onUpdateHeldValue: (factorId: string, val: number) => void;
  onResetToDefaults: () => void;
  runs: Array<{
    id?: string;
    stdOrder?: number;
    runOrder?: number;
    actualValues?: Record<string, number>;
  }>;
  onJumpToRun: (run: any) => void;
  codingMode: 'actual' | 'coded';
}

export function FactorsTool({
  factors,
  axisXId,
  axisYId,
  heldValues,
  onSelectAxisX,
  onSelectAxisY,
  onUpdateHeldValue,
  onResetToDefaults,
  runs,
  onJumpToRun,
  codingMode,
}: FactorsToolProps) {
  // Generate term pairs (e.g. AB, AC, BC) for quick switching
  const terms = React.useMemo(() => {
    const list: Array<{ label: string; xId: string; yId: string }> = [];
    for (let i = 0; i < factors.length; i++) {
      for (let j = i + 1; j < factors.length; j++) {
        const code1 = String.fromCharCode(65 + i);
        const code2 = String.fromCharCode(65 + j);
        list.push({
          label: `${code1}${code2}`,
          xId: factors[i].id,
          yId: factors[j].id,
        });
      }
    }
    return list;
  }, [factors]);

  // Current active term
  const currentTermLabel = React.useMemo(() => {
    const idxX = factors.findIndex(f => f.id === axisXId);
    const idxY = factors.findIndex(f => f.id === axisYId);
    if (idxX === -1 || idxY === -1) return terms[0]?.label || '';
    const first = Math.min(idxX, idxY);
    const second = Math.max(idxX, idxY);
    return `${String.fromCharCode(65 + first)}${String.fromCharCode(65 + second)}`;
  }, [factors, axisXId, axisYId, terms]);

  return (
    <div className="w-72 bg-[#F3F4F6] border-l border-[#C0C0C0] flex flex-col shrink-0 select-none text-xs">
      {/* Factors Tool Header */}
      <div className="bg-[#E5E7EB] border-b border-[#C0C0C0] px-3 py-2 flex items-center justify-between">
        <span className="font-bold text-gray-800 text-xs">Factors Tool</span>
        <button
          onClick={onResetToDefaults}
          className="text-[11px] text-[#0055A4] hover:underline flex items-center gap-1 font-semibold"
          title="Reset to center / default factor values"
        >
          <RotateCcw size={11} /> Default
        </button>
      </div>

      {/* Tabs / Controls Bar */}
      <div className="p-3 space-y-3 flex-1 overflow-y-auto">
        {/* Jump to Run Dropdown */}
        {runs.length > 0 && (
          <div className="bg-white border border-[#D0D0D0] p-2.5 rounded shadow-xs space-y-1">
            <label className="block text-[11px] font-bold text-gray-700">Jump to run:</label>
            <select
              onChange={e => {
                const order = parseInt(e.target.value, 10);
                const matched = runs.find(r => r.runOrder === order || r.stdOrder === order);
                if (matched) onJumpToRun(matched);
              }}
              className="w-full border border-[#C0C0C0] bg-white px-2 py-1 text-xs rounded outline-none"
              defaultValue=""
            >
              <option value="" disabled>Select Run #</option>
              {runs.map(r => (
                <option key={r.id || r.runOrder} value={r.runOrder}>
                  Run {r.runOrder} (Std {r.stdOrder})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Term Pair Selector */}
        {terms.length > 1 && (
          <div className="bg-white border border-[#D0D0D0] p-2.5 rounded shadow-xs space-y-1">
            <label className="block text-[11px] font-bold text-gray-700">Term (Factor Pair):</label>
            <select
              value={currentTermLabel}
              onChange={e => {
                const term = terms.find(t => t.label === e.target.value);
                if (term) {
                  onSelectAxisX(term.xId);
                  onSelectAxisY(term.yId);
                }
              }}
              className="w-full border border-[#C0C0C0] bg-white px-2 py-1 text-xs rounded font-mono font-bold text-[#0055A4] outline-none"
            >
              {terms.map(t => (
                <option key={t.label} value={t.label}>
                  {t.label} (
                  {factors.find(f => f.id === t.xId)?.name} × {factors.find(f => f.id === t.yId)?.name}
                  )
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Factor Assignment & Held Slider Controls */}
        <div className="space-y-2">
          {factors.map((f, idx) => {
            const letter = String.fromCharCode(65 + idx);
            const isX = f.id === axisXId;
            const isY = f.id === axisYId;
            const isHeld = !isX && !isY;
            const heldVal = heldValues[f.id] ?? (f.low + f.high) / 2;

            const displayVal = codingMode === 'coded'
              ? actualToCoded(heldVal, f.low, f.high)
              : heldVal;

            return (
              <div
                key={f.id}
                className={`border rounded p-2.5 shadow-xs transition-colors ${
                  isX || isY ? 'bg-blue-50/60 border-blue-200' : 'bg-white border-[#D0D0D0]'
                }`}
              >
                {/* Factor Header & Axis Buttons */}
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-bold font-mono text-[#003366] text-xs">
                      {letter}: {letter}
                    </span>
                    <span className="text-[11px] text-gray-600 truncate" title={f.name}>
                      ({f.name})
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onSelectAxisX(f.id)}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-colors ${
                        isX
                          ? 'bg-[#0055A4] text-white border-[#003366] shadow-xs'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                      }`}
                      title={`Assign ${f.name} to X-Axis`}
                    >
                      X1
                    </button>
                    <button
                      onClick={() => onSelectAxisY(f.id)}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-colors ${
                        isY
                          ? 'bg-[#0055A4] text-white border-[#003366] shadow-xs'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                      }`}
                      title={`Assign ${f.name} to Y-Axis`}
                    >
                      X2
                    </button>
                  </div>
                </div>

                {/* Held Slider & Value Input */}
                {isHeld && (
                  <div className="pt-1.5 border-t border-gray-100 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-500 font-medium">Factor value:</span>
                      <input
                        type="number"
                        step="any"
                        value={Number(displayVal.toFixed(3))}
                        onChange={e => {
                          const num = parseFloat(e.target.value);
                          if (!isNaN(num)) {
                            const actualNum = codingMode === 'coded'
                              ? codedToActual(num, f.low, f.high)
                              : num;
                            onUpdateHeldValue(f.id, Math.max(f.low, Math.min(f.high, actualNum)));
                          }
                        }}
                        className="w-20 px-1.5 py-0.5 text-right font-mono font-bold text-xs border border-gray-300 rounded bg-white outline-none focus:border-[#0055A4]"
                      />
                    </div>

                    <input
                      type="range"
                      min={f.low}
                      max={f.high}
                      step={(f.high - f.low) / 100}
                      value={heldVal}
                      onChange={e => onUpdateHeldValue(f.id, parseFloat(e.target.value))}
                      className="w-full accent-[#0055A4] cursor-pointer"
                    />

                    <div className="flex justify-between items-center text-[10px] text-gray-400">
                      <span>{codingMode === 'coded' ? '-1.0' : f.low}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onUpdateHeldValue(f.id, f.low)}
                          className="hover:text-gray-800 underline"
                        >
                          Low
                        </button>
                        <span>·</span>
                        <button
                          onClick={() => onUpdateHeldValue(f.id, (f.low + f.high) / 2)}
                          className="hover:text-gray-800 underline"
                        >
                          Mid
                        </button>
                        <span>·</span>
                        <button
                          onClick={() => onUpdateHeldValue(f.id, f.high)}
                          className="hover:text-gray-800 underline"
                        >
                          High
                        </button>
                      </div>
                      <span>{codingMode === 'coded' ? '+1.0' : f.high}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
