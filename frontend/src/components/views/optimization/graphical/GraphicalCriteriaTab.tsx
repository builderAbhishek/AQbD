import { useState } from 'react';
import { ResponseGraphicalLimit } from '../../../../lib/optimization/graphicalOptimization';
import { LimitsGraph } from './LimitsGraph';
import { Check, AlertCircle, RefreshCw } from 'lucide-react';

interface GraphicalCriteriaTabProps {
  responses: Array<{ id: string; name: string; units?: string }>;
  limits: Record<string, ResponseGraphicalLimit>;
  onUpdateLimit: (responseId: string, updated: Partial<ResponseGraphicalLimit>) => void;
  onSyncWithNumericalCriteria: () => void;
  onResetToObservedRange: (responseId: string) => void;
  analyses: Record<string, any>;
}

export function GraphicalCriteriaTab({
  responses,
  limits,
  onUpdateLimit,
  onSyncWithNumericalCriteria,
  onResetToObservedRange,
  analyses,
}: GraphicalCriteriaTabProps) {
  const [selectedResponseId, setSelectedResponseId] = useState<string>(
    responses[0]?.id || ''
  );

  const activeResponse = responses.find(r => r.id === selectedResponseId) || responses[0];
  const activeLimit = activeResponse ? limits[activeResponse.id] : null;
  const analysis = activeResponse ? analyses[activeResponse.id] : null;
  const fittedModel = analysis?.fittedModel || analysis?.fitted;
  const hasModel = Boolean(fittedModel && fittedModel.coefficients && fittedModel.coefficients.length > 0);

  const isReversed = Boolean(
    activeLimit &&
    activeLimit.isActive &&
    !activeLimit.isOneSided &&
    activeLimit.lowerLimit > activeLimit.upperLimit
  );

  return (
    <div className="flex-1 flex h-full bg-[#FAFAFA] font-sans overflow-hidden select-none">
      {/* Left List of Responses */}
      <div className="w-64 border-r border-[#C0C0C0] bg-white flex flex-col shrink-0">
        <div className="p-2.5 bg-[#F5F5F5] border-b border-[#C0C0C0] flex items-center justify-between">
          <span className="font-bold text-xs text-[#003366]">Responses</span>
          <button
            onClick={onSyncWithNumericalCriteria}
            className="text-[10px] text-[#0055A4] hover:underline flex items-center gap-1 font-medium"
            title="Sync limits with Numerical Optimization Criteria"
          >
            <RefreshCw size={10} /> Sync All
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {responses.map(r => {
            const lim = limits[r.id];
            const isSelected = r.id === selectedResponseId;
            const rAnalysis = analyses[r.id];
            const rHasModel = Boolean(
              rAnalysis?.fittedModel?.coefficients?.length || rAnalysis?.fitted?.coefficients?.length
            );

            return (
              <div
                key={r.id}
                onClick={() => setSelectedResponseId(r.id)}
                className={`px-3 py-2 border-b border-gray-100 cursor-pointer flex items-center justify-between text-xs transition-colors ${
                  isSelected
                    ? 'bg-[#0055A4] text-white font-semibold'
                    : 'text-gray-800 hover:bg-[#F0F8FF]'
                }`}
              >
                <div className="flex flex-col truncate">
                  <span className="truncate">{r.name}</span>
                  <span className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
                    {lim?.isActive ? (lim.isOneSided ? `${lim.oneSidedType === 'lower' ? '≥' : '≤'} Limit` : `[${lim.lowerLimit}, ${lim.upperLimit}]`) : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 ml-2">
                  {!rHasModel && (
                    <span
                      title="No statistical model fitted"
                      className={`text-[9px] px-1 py-0.5 rounded font-mono ${
                        isSelected ? 'bg-red-800 text-white' : 'bg-red-50 text-red-600 border border-red-200'
                      }`}
                    >
                      No Model
                    </span>
                  )}
                  {lim?.isActive && (
                    <span
                      className={`w-2 h-2 rounded-full ${isSelected ? 'bg-green-300' : 'bg-green-500'}`}
                      title="Active constraint in overlay"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Detail Pane */}
      {activeResponse && activeLimit ? (
        <div className="flex-1 flex flex-col overflow-y-auto p-6 bg-white space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 pb-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                {activeResponse.name}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Set acceptable upper and lower limits to delineate the feasible Sweet Spot on the Overlay Plot.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onResetToObservedRange(activeResponse.id)}
                className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-[#C0C0C0] hover:bg-gray-50 rounded shadow-xs"
                title="Reset limits to minimum and maximum observed response values"
              >
                Reset to Observed
              </button>
              <button
                onClick={onSyncWithNumericalCriteria}
                className="px-2.5 py-1 text-xs font-medium text-[#0055A4] bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded shadow-xs flex items-center gap-1"
                title="Synchronize limits from Numerical Optimization Criteria"
              >
                <RefreshCw size={12} />
                Sync Numerical Criteria
              </button>
            </div>
          </div>

          {/* Model Status & Selection */}
          <div className="flex items-center gap-4 text-xs">
            <span className="font-semibold text-gray-700 w-20">Analysis:</span>
            <div className="flex-1 max-w-md flex items-center gap-2">
              <select
                disabled
                value={analysis?.modelType || 'Quadratic'}
                className="w-full border border-[#C0C0C0] bg-gray-50 text-gray-800 px-3 py-1.5 rounded text-xs outline-none"
              >
                <option value={analysis?.modelType || 'Quadratic'}>
                  {activeResponse.name} ({analysis?.modelType || 'Quadratic'} Model)
                </option>
              </select>
              {hasModel ? (
                <span className="flex items-center gap-1 text-emerald-600 font-semibold text-xs shrink-0">
                  <Check size={14} /> Fitted
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-600 font-semibold text-xs shrink-0">
                  <AlertCircle size={14} /> Missing Model
                </span>
              )}
            </div>
          </div>

          {/* Active Constraint Toggle */}
          <div className="flex items-center gap-3 pt-1">
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={activeLimit.isActive}
                onChange={e => onUpdateLimit(activeResponse.id, { isActive: e.target.checked })}
                className="rounded text-[#0055A4] w-4 h-4"
              />
              Include in Overlay Sweet Spot (Active Constraint)
            </label>
          </div>

          {/* Interval Configuration */}
          <div className="space-y-4 max-w-xl bg-gray-50/70 border border-gray-200 p-4 rounded">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeLimit.isOneSided}
                  disabled={!activeLimit.isActive}
                  onChange={e => onUpdateLimit(activeResponse.id, { isOneSided: e.target.checked })}
                  className="rounded text-[#0055A4] w-4 h-4 disabled:opacity-50"
                />
                Use interval (one-sided)
              </label>

              {activeLimit.isOneSided && activeLimit.isActive && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-600 font-medium">Bound:</span>
                  <select
                    value={activeLimit.oneSidedType}
                    onChange={e =>
                      onUpdateLimit(activeResponse.id, {
                        oneSidedType: e.target.value as 'lower' | 'upper',
                      })
                    }
                    className="border border-[#C0C0C0] bg-white px-2 py-1 rounded text-xs outline-none"
                  >
                    <option value="lower">≥ Lower Limit Only</option>
                    <option value="upper">≤ Upper Limit Only</option>
                  </select>
                </div>
              )}
            </div>

            {/* Limits Inputs */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              {/* Lower Limit */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Lower Limit
                </label>
                <input
                  type="number"
                  step="any"
                  disabled={!activeLimit.isActive || (activeLimit.isOneSided && activeLimit.oneSidedType === 'upper')}
                  value={Number.isFinite(activeLimit.lowerLimit) ? activeLimit.lowerLimit : ''}
                  onChange={e => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      onUpdateLimit(activeResponse.id, { lowerLimit: val });
                    }
                  }}
                  className={`w-full border px-3 py-1.5 rounded text-xs font-mono outline-none ${
                    isReversed ? 'border-red-500 bg-red-50 text-red-900' : 'border-[#C0C0C0] bg-white text-gray-900'
                  } disabled:bg-gray-100 disabled:text-gray-400`}
                />
                <span className="text-[10px] text-gray-400 mt-1 block">
                  Observed Min: {activeLimit.observedMin.toFixed(3)}
                </span>
              </div>

              {/* Upper Limit */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Upper Limit
                </label>
                <input
                  type="number"
                  step="any"
                  disabled={!activeLimit.isActive || (activeLimit.isOneSided && activeLimit.oneSidedType === 'lower')}
                  value={Number.isFinite(activeLimit.upperLimit) ? activeLimit.upperLimit : ''}
                  onChange={e => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      onUpdateLimit(activeResponse.id, { upperLimit: val });
                    }
                  }}
                  className={`w-full border px-3 py-1.5 rounded text-xs font-mono outline-none ${
                    isReversed ? 'border-red-500 bg-red-50 text-red-900' : 'border-[#C0C0C0] bg-white text-gray-900'
                  } disabled:bg-gray-100 disabled:text-gray-400`}
                />
                <span className="text-[10px] text-gray-400 mt-1 block">
                  Observed Max: {activeLimit.observedMax.toFixed(3)}
                </span>
              </div>
            </div>

            {/* Reversal / Validation Error */}
            {isReversed && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>
                  <strong>Invalid Range:</strong> Lower Limit ({activeLimit.lowerLimit}) cannot exceed Upper Limit ({activeLimit.upperLimit}).
                </span>
              </div>
            )}
          </div>

          {/* Limits Graph Scale */}
          <div className="pt-2">
            <h3 className="text-xs font-bold text-[#003366] mb-2 uppercase tracking-wider">
              Limits Graph
            </h3>
            <LimitsGraph limit={activeLimit} />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-xs">
          Select a response to configure graphical limits.
        </div>
      )}
    </div>
  );
}
