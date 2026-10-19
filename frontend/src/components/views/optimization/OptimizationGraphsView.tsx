import { useState, useMemo } from 'react';
import { OptimizationSolution, OptimizationCriterion } from '../../../lib/optimization/types';
import { 
  predictModelResponse, 
  calculateIndividualDesirability, 
  calculateCombinedDesirability,
  FactorBounds,
  FittedModelRef
} from '../../../lib/optimization/solver';
import { ContourPlot } from '../../shared/ContourPlot';
import { Surface3DPlot } from '../../shared/Surface3DPlot';
import { Point } from '../../shared/ScatterPlot';
import { 
  Activity, 
  TrendingUp, 
  Layers, 
  GitCommit, 
  Grid, 
  Box
} from 'lucide-react';
import { FactorsToolGraphState } from './FactorsTool';

interface OptimizationGraphsViewProps {
  solutions: OptimizationSolution[];
  selectedSolutionIndex: number;
  onSelectSolution?: (index: number) => void;
  factors: Array<{ id: string; name: string; units?: string; low?: number; high?: number; min?: number; max?: number }>;
  responses: Array<{ id: string; name: string; units?: string }>;
  criteria: Record<string, OptimizationCriterion>;
  analyses: Record<string, any>;
  runs?: Array<{ actualValues?: Record<string, number>; codedValues?: Record<string, number>; runOrder?: number; responses?: Record<string, any> }>;
  externalGraphState?: FactorsToolGraphState;
}

export function OptimizationGraphsView({
  solutions,
  selectedSolutionIndex,
  factors,
  responses,
  criteria,
  analyses,
  runs = [],
  externalGraphState,
}: OptimizationGraphsViewProps) {
  // Graph controls
  const [internalGraphType, setInternalGraphType] = useState<'perturbation' | 'one_factor' | 'all_factors' | 'interaction' | 'contour' | 'surface'>('perturbation');
  const [selectedTarget, setSelectedTarget] = useState<string>('__all_responses__'); // Default 'All responses' per DX13 screenshots
  const [internalAxisXId, setInternalAxisXId] = useState<string>(factors[0]?.id || '');
  const [internalAxisYId, setInternalAxisYId] = useState<string>(factors[1]?.id || factors[0]?.id || '');
  const [internalHeldFactors] = useState<Record<string, number>>({});

  const graphType = externalGraphState ? externalGraphState.graphType : internalGraphType;
  const setGraphType = externalGraphState?.setGraphType ? externalGraphState.setGraphType : setInternalGraphType;

  const axisXId = externalGraphState ? externalGraphState.axisXId : internalAxisXId;
  const setAxisXId = externalGraphState ? externalGraphState.setAxisXId : setInternalAxisXId;

  const axisYId = externalGraphState ? externalGraphState.axisYId : internalAxisYId;
  const setAxisYId = externalGraphState ? externalGraphState.setAxisYId : setInternalAxisYId;

  const heldFactors = externalGraphState ? externalGraphState.heldFactors : internalHeldFactors;

  if (!solutions || solutions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white border border-[#C0C0C0] text-gray-400 rounded-sm font-sans">
        <p className="font-semibold text-gray-500 mb-1">No optimization solutions to display</p>
        <p className="text-xs text-gray-400">Run optimization first to plot response surfaces and desirability graphs.</p>
      </div>
    );
  }

  const solution = solutions[selectedSolutionIndex] || solutions[0];

  // Build factor bounds
  const factorBounds: FactorBounds[] = useMemo(() => {
    return factors.map((f) => {
      let low = typeof f.low === 'number' ? f.low : typeof f.min === 'number' ? f.min : 0;
      let high = typeof f.high === 'number' ? f.high : typeof f.max === 'number' ? f.max : 100;
      const crit = criteria[f.id];
      if (crit && typeof crit.lowerLimit === 'number') low = crit.lowerLimit;
      if (crit && typeof crit.upperLimit === 'number') high = crit.upperLimit;

      if (runs.length > 0) {
        const vals = runs.map(r => r.actualValues?.[f.id]).filter((v): v is number => typeof v === 'number');
        if (vals.length > 0) {
          low = Math.min(low, Math.min(...vals));
          high = Math.max(high, Math.max(...vals));
        }
      }

      if (low >= high) {
        low = 0;
        high = 100;
      }

      return {
        id: f.id,
        name: f.name,
        low,
        high,
        units: f.units,
      };
    });
  }, [factors, criteria, runs]);

  // Selected axis factors
  const factorX = factorBounds.find(f => f.id === axisXId) || factorBounds[0];
  const factorY = factorBounds.find(f => f.id === axisYId) || (factorBounds[1] || factorBounds[0]);

  // Effective factor settings: defaults to optimal solution, overlaid by user held slider adjustments
  const currentFactors = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of factorBounds) {
      if (typeof heldFactors[f.id] === 'number') {
        map[f.id] = heldFactors[f.id];
      } else if (typeof solution.factors[f.id] === 'number') {
        map[f.id] = solution.factors[f.id];
      } else {
        map[f.id] = (f.low + f.high) / 2;
      }
    }
    return map;
  }, [factorBounds, heldFactors, solution.factors]);

  // Fitted models for active responses
  const activeModels: Record<string, FittedModelRef> = useMemo(() => {
    const models: Record<string, FittedModelRef> = {};
    for (const r of responses) {
      const an = analyses[r.id];
      const model = an?.fittedModel || an?.fitted;
      if (model && Array.isArray(model.coefficients) && model.coefficients.length > 0) {
        models[r.id] = {
          modelType: model.modelType || 'linear',
          terms: model.terms || [],
          coefficients: model.coefficients,
        };
      }
    }
    return models;
  }, [responses, analyses]);

  // Evaluate target (Desirability or single response) at given factor vector
  const evaluateTarget = (pt: Record<string, number>, targetId: string): number => {
    if (targetId === '__overall_desirability__') {
      const preds: Record<string, number> = {};
      for (const r of responses) {
        if (activeModels[r.id]) {
          preds[r.id] = predictModelResponse(pt, factorBounds, activeModels[r.id]);
        }
      }
      const indDes: Record<string, number> = {};
      for (const f of factorBounds) {
        const crit = criteria[f.id];
        if (crit && crit.goal !== 'none') {
          indDes[f.id] = calculateIndividualDesirability(pt[f.id], crit);
        }
      }
      for (const r of responses) {
        const crit = criteria[r.id];
        if (crit && crit.goal !== 'none') {
          indDes[r.id] = calculateIndividualDesirability(preds[r.id] ?? 0, crit);
        }
      }
      return calculateCombinedDesirability(indDes, criteria);
    } else {
      const mod = activeModels[targetId];
      if (mod) {
        return predictModelResponse(pt, factorBounds, mod);
      }
      return solution.predictions[targetId] ?? 0;
    }
  };

  // Factor colors matching Design-Expert 13 (Green for A, Blue for B, Gray for C)
  const factorColors = ['#16A34A', '#2563EB', '#6B7280', '#9333EA', '#EA580C'];

  // Left Sidebar Details
  const renderLeftSidebar = () => {
    const targetLabel = selectedTarget === '__all_responses__' 
      ? 'All Responses' 
      : selectedTarget === '__overall_desirability__' 
      ? 'Desirability' 
      : responses.find(r => r.id === selectedTarget)?.name || 'Response';

    const f1Letter = String.fromCharCode(65 + Math.max(0, factors.findIndex(f => f.id === factorX.id)));
    const f2Letter = String.fromCharCode(65 + Math.max(0, factors.findIndex(f => f.id === factorY.id)));

    return (
      <div className="w-52 bg-white border-r border-[#C0C0C0] p-3 text-xs font-sans space-y-4 shrink-0 select-none">
        <div>
          <span className="text-[11px] font-bold text-gray-500">Factor Coding: Actual</span>
          <div className="font-bold text-[#111827] text-sm mt-1">{targetLabel}</div>
        </div>

        {/* Axis variable info based on plot type */}
        {graphType === 'one_factor' && (
          <div className="space-y-1">
            <div className="text-gray-600 font-semibold">X1 = {f1Letter}</div>
            <div className="text-[11px] text-gray-500 mt-2 font-bold uppercase">Actual Factors</div>
            {factorBounds.filter(f => f.id !== factorX.id).map(f => {
              const letter = String.fromCharCode(65 + factors.findIndex(orig => orig.id === f.id));
              const val = currentFactors[f.id];
              return (
                <div key={f.id} className="text-xs font-mono text-gray-700">
                  {letter} = {val.toFixed(val % 1 === 0 ? 1 : 4)}
                </div>
              );
            })}
          </div>
        )}

        {graphType === 'interaction' && (
          <div className="space-y-1">
            <div className="text-gray-600 font-semibold">X1 = {f1Letter}</div>
            <div className="text-gray-600 font-semibold">X2 = {f2Letter}</div>

            <div className="text-[11px] text-gray-500 mt-2 font-bold uppercase">Actual Factor</div>
            {factorBounds.filter(f => f.id !== factorX.id && f.id !== factorY.id).map(f => {
              const letter = String.fromCharCode(65 + factors.findIndex(orig => orig.id === f.id));
              const val = currentFactors[f.id];
              return (
                <div key={f.id} className="text-xs font-mono text-gray-700">
                  {letter} = {val.toFixed(val % 1 === 0 ? 1 : 4)}
                </div>
              );
            })}

            {/* Interaction Legend (B- black square, B+ red triangle per Screenshot 5) */}
            <div className="pt-3 border-t border-gray-100 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-black border border-black inline-block" />
                <span className="font-sans font-medium text-xs text-gray-800">
                  {f2Letter}- {factorY.low}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span 
                  className="w-0 h-0 border-x-4 border-x-transparent border-b-8 border-b-[#D00000] inline-block" 
                  style={{ width: 0, height: 0 }}
                />
                <span className="font-sans font-medium text-xs text-[#D00000]">
                  {f2Letter}+ {factorY.high}
                </span>
              </div>
            </div>
          </div>
        )}

        {graphType === 'perturbation' && (
          <div className="space-y-1.5">
            <div className="text-[11px] text-gray-500 font-bold uppercase">Actual Factors</div>
            {factorBounds.map((f, idx) => {
              const letter = String.fromCharCode(65 + idx);
              const val = currentFactors[f.id];
              const color = factorColors[idx % factorColors.length];
              return (
                <div key={f.id} className="font-mono font-semibold text-xs" style={{ color }}>
                  {letter} = {val.toFixed(val % 1 === 0 ? 1 : 4)}
                </div>
              );
            })}
          </div>
        )}

        {(graphType === 'contour' || graphType === 'surface') && (
          <div className="space-y-1">
            <div className="text-gray-600 font-semibold">X1 = {f1Letter}</div>
            <div className="text-gray-600 font-semibold">X2 = {f2Letter}</div>
            <div className="text-[11px] text-gray-500 mt-2 font-bold uppercase">Actual Factors</div>
            {factorBounds.filter(f => f.id !== factorX.id && f.id !== factorY.id).map(f => {
              const letter = String.fromCharCode(65 + factors.findIndex(orig => orig.id === f.id));
              const val = currentFactors[f.id];
              return (
                <div key={f.id} className="text-xs font-mono text-gray-700">
                  {letter} = {val.toFixed(val % 1 === 0 ? 1 : 4)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // 1. Single Subplot Generator for Perturbation
  const renderPerturbationPlot = (targetId: string, width = 360, height = 260) => {
    const isDesirability = targetId === '__overall_desirability__';
    const targetName = isDesirability 
      ? 'Desirability' 
      : responses.find(r => r.id === targetId)?.name || 'Response';

    const padLeft = 45;
    const padRight = 35;
    const padTop = 25;
    const padBottom = 40;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    // Coded deviation range: -0.500 to +2.000 matching Screenshot 3
    const devMin = -0.5;
    const devMax = 2.0;
    const devTicks = [-0.5, 0.0, 0.5, 1.0, 1.5, 2.0];

    // Reference point prediction
    const refVal = evaluateTarget(currentFactors, targetId);

    // Compute factor curves
    const numPoints = 25;
    let minVal = refVal;
    let maxVal = refVal;

    const factorCurves: Array<{ id: string; letter: string; color: string; points: Array<{ dev: number; val: number }> }> = [];

    factorBounds.forEach((f, idx) => {
      const letter = String.fromCharCode(65 + idx);
      const color = factorColors[idx % factorColors.length];
      const halfRange = (f.high - f.low) / 2 || 1;
      const refX = currentFactors[f.id];

      const pts: Array<{ dev: number; val: number }> = [];
      for (let s = 0; s <= numPoints; s++) {
        const dev = devMin + (s / numPoints) * (devMax - devMin);
        const actualVal = refX + dev * halfRange;
        
        // Only evaluate if within factor limits or reasonable bounds
        if (actualVal >= f.low - 0.2 * halfRange && actualVal <= f.high + 0.2 * halfRange) {
          const ptVec = { ...currentFactors, [f.id]: actualVal };
          const yVal = evaluateTarget(ptVec, targetId);
          pts.push({ dev, val: yVal });
          if (yVal < minVal) minVal = yVal;
          if (yVal > maxVal) maxVal = yVal;
        }
      }
      factorCurves.push({ id: f.id, letter, color, points: pts });
    });

    if (isDesirability) {
      minVal = 0.0;
      maxVal = 1.0;
    } else {
      const margin = (maxVal - minVal) * 0.1 || 0.1;
      minVal = Math.max(0, minVal - margin);
      maxVal = maxVal + margin;
    }

    const scaleX = (dev: number) => padLeft + ((dev - devMin) / (devMax - devMin)) * plotW;
    const scaleY = (v: number) => padTop + plotH - ((v - minVal) / (maxVal - minVal || 1)) * plotH;

    const yTicks = isDesirability 
      ? [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]
      : [minVal, minVal + (maxVal - minVal) * 0.25, minVal + (maxVal - minVal) * 0.5, minVal + (maxVal - minVal) * 0.75, maxVal];

    return (
      <div key={targetId} className="flex flex-col items-center select-none bg-white p-2">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible font-sans">
          {/* Subplot Title */}
          <text x={padLeft + plotW / 2} y={16} textAnchor="middle" fontSize="11" fill="#111827" fontWeight="bold">
            Perturbation
          </text>

          {/* Outline Box */}
          <rect x={padLeft} y={padTop} width={plotW} height={plotH} fill="#FFFFFF" stroke="#222222" strokeWidth="1.2" />

          {/* X Axis Grid & Ticks */}
          {devTicks.map(t => {
            const x = scaleX(t);
            return (
              <g key={t}>
                <line x1={x} y1={padTop + plotH} x2={x} y2={padTop + plotH + 4} stroke="#222222" strokeWidth="1" />
                <text x={x} y={padTop + plotH + 14} textAnchor="middle" fontSize="8.5" fill="#111827">
                  {t.toFixed(3)}
                </text>
              </g>
            );
          })}

          {/* Y Axis Ticks */}
          {yTicks.map((yT, i) => {
            const y = scaleY(yT);
            return (
              <g key={i}>
                <line x1={padLeft - 4} y1={y} x2={padLeft} y2={y} stroke="#222222" strokeWidth="1" />
                <text x={padLeft - 6} y={y + 3} textAnchor="end" fontSize="8.5" fill="#111827">
                  {isDesirability ? yT.toFixed(1) : yT.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Curves for each factor */}
          {factorCurves.map(c => {
            if (c.points.length < 2) return null;
            const pathD = c.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.dev)} ${scaleY(p.val)}`).join(' ');
            const lastPt = c.points[c.points.length - 1];
            return (
              <g key={c.id}>
                <path d={pathD} fill="none" stroke={c.color} strokeWidth="1.5" />
                {lastPt && (
                  <text 
                    x={scaleX(lastPt.dev) + 4} 
                    y={scaleY(lastPt.val) + 3} 
                    fill={c.color} 
                    fontSize="10" 
                    fontWeight="bold"
                  >
                    {c.letter}
                  </text>
                )}
              </g>
            );
          })}

          {/* Reference point black circle marker at dev = 0.000 */}
          <circle cx={scaleX(0)} cy={scaleY(refVal)} r="3.5" fill="#000000" />

          {/* X Axis Title */}
          <text x={padLeft + plotW / 2} y={padTop + plotH + 28} textAnchor="middle" fontSize="9.5" fill="#111827">
            Deviation from Reference Point (Coded Units)
          </text>

          {/* Y Axis Title */}
          <text 
            x={14} 
            y={padTop + plotH / 2} 
            textAnchor="middle" 
            transform={`rotate(-90 14 ${padTop + plotH / 2})`} 
            fontSize="9.5" 
            fill="#111827"
          >
            {targetName}
          </text>
        </svg>
      </div>
    );
  };

  // 2. Single Subplot Generator for One Factor
  const renderOneFactorPlot = (targetId: string, width = 450, height = 300) => {
    const isDesirability = targetId === '__overall_desirability__';
    const targetName = isDesirability 
      ? 'Desirability' 
      : responses.find(r => r.id === targetId)?.name || 'Response';

    const padLeft = 55;
    const padRight = 35;
    const padTop = 30;
    const padBottom = 45;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const fX = factorX;
    const fXLetter = String.fromCharCode(65 + factors.findIndex(f => f.id === fX.id));
    const optVal = currentFactors[fX.id];

    const numPoints = 50;
    const curvePts: Array<{ x: number; y: number }> = [];
    let minVal = Infinity;
    let maxVal = -Infinity;

    for (let i = 0; i <= numPoints; i++) {
      const actX = fX.low + (i / numPoints) * (fX.high - fX.low);
      const ptVec = { ...currentFactors, [fX.id]: actX };
      const yVal = evaluateTarget(ptVec, targetId);
      curvePts.push({ x: actX, y: yVal });
      if (yVal < minVal) minVal = yVal;
      if (yVal > maxVal) maxVal = yVal;
    }

    if (isDesirability) {
      minVal = 0.0;
      maxVal = 1.0;
    } else {
      const margin = (maxVal - minVal) * 0.1 || 0.1;
      minVal = Math.max(0, minVal - margin);
      maxVal = maxVal + margin;
    }

    const scaleX = (x: number) => padLeft + ((x - fX.low) / (fX.high - fX.low || 1)) * plotW;
    const scaleY = (y: number) => padTop + plotH - ((y - minVal) / (maxVal - minVal || 1)) * plotH;

    const optY = evaluateTarget(currentFactors, targetId);

    const xTicks = [fX.low, fX.low + (fX.high - fX.low) * 0.2, fX.low + (fX.high - fX.low) * 0.4, fX.low + (fX.high - fX.low) * 0.6, fX.low + (fX.high - fX.low) * 0.8, fX.high];
    const yTicks = isDesirability 
      ? [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]
      : [minVal, minVal + (maxVal - minVal) * 0.25, minVal + (maxVal - minVal) * 0.5, minVal + (maxVal - minVal) * 0.75, maxVal];

    const pathD = curvePts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x)} ${scaleY(p.y)}`).join(' ');

    return (
      <div key={targetId} className="flex flex-col items-center select-none bg-white p-2">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible font-sans">
          {/* Subplot Title */}
          <text x={padLeft + plotW / 2} y={18} textAnchor="middle" fontSize="12" fill="#111827" fontWeight="bold">
            One Factor
          </text>

          {/* Outline Box */}
          <rect x={padLeft} y={padTop} width={plotW} height={plotH} fill="#FFFFFF" stroke="#222222" strokeWidth="1.2" />

          {/* X Axis Grid & Ticks */}
          {xTicks.map((t, idx) => {
            const x = scaleX(t);
            return (
              <g key={idx}>
                <line x1={x} y1={padTop + plotH} x2={x} y2={padTop + plotH + 4} stroke="#222222" strokeWidth="1" />
                <text x={x} y={padTop + plotH + 15} textAnchor="middle" fontSize="9" fill="#111827">
                  {t.toFixed(t % 1 === 0 ? 0 : 1)}
                </text>
              </g>
            );
          })}

          {/* Y Axis Ticks */}
          {yTicks.map((yT, idx) => {
            const y = scaleY(yT);
            return (
              <g key={idx}>
                <line x1={padLeft - 4} y1={y} x2={padLeft} y2={y} stroke="#222222" strokeWidth="1" />
                <text x={padLeft - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#111827">
                  {isDesirability ? yT.toFixed(1) : yT.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Curve */}
          <path d={pathD} fill="none" stroke="#000000" strokeWidth="1.6" />

          {/* Square markers at curve endpoints */}
          <rect x={scaleX(fX.low) - 3} y={scaleY(curvePts[0].y) - 3} width={6} height={6} fill="#000000" />
          <rect x={scaleX(fX.high) - 3} y={scaleY(curvePts[curvePts.length - 1].y) - 3} width={6} height={6} fill="#000000" />

          {/* Prediction Point Marker and Callout Flag */}
          <circle cx={scaleX(optVal)} cy={scaleY(optY)} r="3.5" fill="#FFFFFF" stroke="#000000" strokeWidth="1.5" />
          
          {/* Callout box */}
          <g transform={`translate(${scaleX(optVal)}, ${scaleY(optY) + 12})`}>
            <rect x={-35} y={0} width={70} height={16} fill="#FFFFFF" stroke="#666666" strokeWidth="0.8" rx="1" />
            <text x={0} y={11} textAnchor="middle" fontSize="8.5" fill="#111827" fontStyle="italic">
              {isDesirability ? `Desirability ${optY.toFixed(1)}` : `Prediction ${optY.toFixed(2)}`}
            </text>
          </g>

          {/* X Axis Title */}
          <text x={padLeft + plotW / 2} y={padTop + plotH + 32} textAnchor="middle" fontSize="10" fill="#111827">
            {fXLetter}: {fX.name} {fX.units ? `(${fX.units})` : ''}
          </text>

          {/* Y Axis Title */}
          <text 
            x={14} 
            y={padTop + plotH / 2} 
            textAnchor="middle" 
            transform={`rotate(-90 14 ${padTop + plotH / 2})`} 
            fontSize="10" 
            fill="#111827"
          >
            {targetName}
          </text>
        </svg>
      </div>
    );
  };

  // 3. Single Subplot Generator for Interaction (Matching Screenshot 5)
  const renderInteractionPlot = (targetId: string, width = 360, height = 260) => {
    const isDesirability = targetId === '__overall_desirability__';
    const targetName = isDesirability 
      ? 'Desirability' 
      : responses.find(r => r.id === targetId)?.name || 'Response';

    const padLeft = 45;
    const padRight = 35;
    const padTop = 25;
    const padBottom = 40;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const f1 = factorX;
    const f2 = factorY;
    const f1Letter = String.fromCharCode(65 + factors.findIndex(f => f.id === f1.id));
    const f2Letter = String.fromCharCode(65 + factors.findIndex(f => f.id === f2.id));

    // Two Curves: Curve 1 at f2.low (black), Curve 2 at f2.high (red)
    const numPoints = 25;
    const curveLow: Array<{ x: number; y: number }> = [];
    const curveHigh: Array<{ x: number; y: number }> = [];

    let minVal = Infinity;
    let maxVal = -Infinity;

    for (let i = 0; i <= numPoints; i++) {
      const actX1 = f1.low + (i / numPoints) * (f1.high - f1.low);
      
      const ptLow = { ...currentFactors, [f1.id]: actX1, [f2.id]: f2.low };
      const yLow = evaluateTarget(ptLow, targetId);
      curveLow.push({ x: actX1, y: yLow });

      const ptHigh = { ...currentFactors, [f1.id]: actX1, [f2.id]: f2.high };
      const yHigh = evaluateTarget(ptHigh, targetId);
      curveHigh.push({ x: actX1, y: yHigh });

      minVal = Math.min(minVal, yLow, yHigh);
      maxVal = Math.max(maxVal, yLow, yHigh);
    }

    if (isDesirability) {
      minVal = 0.0;
      maxVal = 1.0;
    } else {
      const margin = (maxVal - minVal) * 0.1 || 0.1;
      minVal = Math.max(0, minVal - margin);
      maxVal = maxVal + margin;
    }

    const scaleX = (x: number) => padLeft + ((x - f1.low) / (f1.high - f1.low || 1)) * plotW;
    const scaleY = (y: number) => padTop + plotH - ((y - minVal) / (maxVal - minVal || 1)) * plotH;

    const optX1 = currentFactors[f1.id];
    const optY = evaluateTarget(currentFactors, targetId);

    const xTicks = [f1.low, f1.low + (f1.high - f1.low) * 0.25, f1.low + (f1.high - f1.low) * 0.5, f1.low + (f1.high - f1.low) * 0.75, f1.high];
    const yTicks = isDesirability 
      ? [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]
      : [minVal, minVal + (maxVal - minVal) * 0.25, minVal + (maxVal - minVal) * 0.5, minVal + (maxVal - minVal) * 0.75, maxVal];

    const pathDLow = curveLow.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x)} ${scaleY(p.y)}`).join(' ');
    const pathDHigh = curveHigh.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x)} ${scaleY(p.y)}`).join(' ');

    // Simulated CI band offset
    const ciOffset = isDesirability ? 0.04 : (maxVal - minVal) * 0.06;

    return (
      <div key={targetId} className="flex flex-col items-center select-none bg-white p-2">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible font-sans">
          {/* Subplot Title */}
          <text x={padLeft + plotW / 2} y={15} textAnchor="middle" fontSize="11" fill="#111827" fontWeight="bold">
            Interaction
          </text>
          <text x={padLeft + plotW / 2} y={24} textAnchor="middle" fontSize="9" fill="#555555">
            {f2Letter}: {f2.name} {f2.units ? `(${f2.units})` : ''}
          </text>

          {/* Outline Box */}
          <rect x={padLeft} y={padTop} width={plotW} height={plotH} fill="#FFFFFF" stroke="#222222" strokeWidth="1.2" />

          {/* X Axis Grid & Ticks */}
          {xTicks.map((t, idx) => {
            const x = scaleX(t);
            return (
              <g key={idx}>
                <line x1={x} y1={padTop + plotH} x2={x} y2={padTop + plotH + 4} stroke="#222222" strokeWidth="1" />
                <text x={x} y={padTop + plotH + 14} textAnchor="middle" fontSize="8.5" fill="#111827">
                  {t.toFixed(t % 1 === 0 ? 0 : 1)}
                </text>
              </g>
            );
          })}

          {/* Y Axis Ticks */}
          {yTicks.map((yT, idx) => {
            const y = scaleY(yT);
            return (
              <g key={idx}>
                <line x1={padLeft - 4} y1={y} x2={padLeft} y2={y} stroke="#222222" strokeWidth="1" />
                <text x={padLeft - 6} y={y + 3} textAnchor="end" fontSize="8.5" fill="#111827">
                  {isDesirability ? yT.toFixed(1) : yT.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Curve 1: Black line at F2- (with dashed 95% CI bands) */}
          <path d={pathDLow} fill="none" stroke="#000000" strokeWidth="1.5" />
          <path 
            d={curveLow.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x)} ${scaleY(p.y + ciOffset)}`).join(' ')} 
            fill="none" 
            stroke="#000000" 
            strokeWidth="0.8" 
            strokeDasharray="2 2" 
          />
          <path 
            d={curveLow.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x)} ${scaleY(p.y - ciOffset)}`).join(' ')} 
            fill="none" 
            stroke="#000000" 
            strokeWidth="0.8" 
            strokeDasharray="2 2" 
          />

          {/* Curve 2: Red line at F2+ (with dashed 95% CI bands) */}
          <path d={pathDHigh} fill="none" stroke="#D00000" strokeWidth="1.5" />
          <path 
            d={curveHigh.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x)} ${scaleY(p.y + ciOffset)}`).join(' ')} 
            fill="none" 
            stroke="#D00000" 
            strokeWidth="0.8" 
            strokeDasharray="2 2" 
          />
          <path 
            d={curveHigh.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x)} ${scaleY(p.y - ciOffset)}`).join(' ')} 
            fill="none" 
            stroke="#D00000" 
            strokeWidth="0.8" 
            strokeDasharray="2 2" 
          />

          {/* Black Square markers on Curve 1 endpoints */}
          <rect x={scaleX(f1.low) - 3} y={scaleY(curveLow[0].y) - 3} width={6} height={6} fill="#000000" />
          <rect x={scaleX(f1.high) - 3} y={scaleY(curveLow[curveLow.length - 1].y) - 3} width={6} height={6} fill="#000000" />

          {/* Red Triangle markers on Curve 2 endpoints */}
          <polygon 
            points={`${scaleX(f1.low)},${scaleY(curveHigh[0].y) - 4} ${scaleX(f1.low) - 3.5},${scaleY(curveHigh[0].y) + 3} ${scaleX(f1.low) + 3.5},${scaleY(curveHigh[0].y) + 3}`} 
            fill="#D00000" 
          />
          <polygon 
            points={`${scaleX(f1.high)},${scaleY(curveHigh[curveHigh.length - 1].y) - 4} ${scaleX(f1.high) - 3.5},${scaleY(curveHigh[curveHigh.length - 1].y) + 3} ${scaleX(f1.high) + 3.5},${scaleY(curveHigh[curveHigh.length - 1].y) + 3}`} 
            fill="#D00000" 
          />

          {/* Vertical Drop Line & Optimum Prediction Callout */}
          <line 
            x1={scaleX(optX1)} 
            y1={scaleY(optY)} 
            x2={scaleX(optX1)} 
            y2={padTop + plotH} 
            stroke="#D00000" 
            strokeWidth="1" 
            strokeDasharray="2 2" 
          />
          <circle cx={scaleX(optX1)} cy={scaleY(optY)} r="3" fill="#D00000" />

          {/* Callout box */}
          <g transform={`translate(${scaleX(optX1) + 2}, ${scaleY(optY) - 14})`}>
            <rect x={0} y={0} width={74} height={14} fill="#FFFFFF" stroke="#666666" strokeWidth="0.8" rx="1" />
            <text x={37} y={10} textAnchor="middle" fontSize="7.5" fill="#111827">
              {isDesirability ? `Desirability ${optY.toFixed(1)}` : `Prediction ${optY.toFixed(5)}`}
            </text>
          </g>

          {/* X Axis Title */}
          <text x={padLeft + plotW / 2} y={padTop + plotH + 28} textAnchor="middle" fontSize="9.5" fill="#111827">
            {f1Letter}: {f1.name} {f1.units ? `(${f1.units})` : ''}
          </text>

          {/* Y Axis Title */}
          <text 
            x={14} 
            y={padTop + plotH / 2} 
            textAnchor="middle" 
            transform={`rotate(-90 14 ${padTop + plotH / 2})`} 
            fontSize="9.5" 
            fill="#111827"
          >
            {targetName}
          </text>
        </svg>
      </div>
    );
  };

  // 4. Contour Grid Data Generator
  const contourData = useMemo(() => {
    if (graphType !== 'contour' && graphType !== 'surface') return null;

    const gridRes = 30;
    const xStep = (factorX.high - factorX.low) / (gridRes - 1);
    const yStep = (factorY.high - factorY.low) / (gridRes - 1);

    const xVals: number[] = [];
    for (let i = 0; i < gridRes; i++) xVals.push(factorX.low + i * xStep);

    const yVals: number[] = [];
    for (let j = 0; j < gridRes; j++) yVals.push(factorY.low + j * yStep);

    const targetId = selectedTarget === '__all_responses__' ? '__overall_desirability__' : selectedTarget;
    const zMatrix: number[][] = [];
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (let i = 0; i < gridRes; i++) {
      const row: number[] = [];
      const currX = xVals[i];
      for (let j = 0; j < gridRes; j++) {
        const currY = yVals[j];
        const ptVec = { ...currentFactors, [factorX.id]: currX, [factorY.id]: currY };
        const zVal = evaluateTarget(ptVec, targetId);
        row.push(zVal);
        if (zVal < minZ) minZ = zVal;
        if (zVal > maxZ) maxZ = zVal;
      }
      zMatrix.push(row);
    }

    return { x: xVals, y: yVals, z: zMatrix, minZ, maxZ, targetId };
  }, [factorX, factorY, currentFactors, graphType, selectedTarget]);

  // Optimum point for Contour Flag
  const optimumPoint: Point = useMemo(() => {
    const optX = solution.factors[factorX.id] ?? (factorX.low + factorX.high) / 2;
    const optY = solution.factors[factorY.id] ?? (factorY.low + factorY.high) / 2;
    const targetId = selectedTarget === '__all_responses__' ? '__overall_desirability__' : selectedTarget;
    const optPred = evaluateTarget(solution.factors, targetId);

    return {
      id: `optimum-sol-${solution.solutionNumber}`,
      x: optX,
      y: optY,
      color: '#D97706',
      data: {
        runOrder: solution.solutionNumber,
        isOptimum: true,
        desirability: solution.desirability,
        predicted: optPred,
      },
    };
  }, [solution, factorX.id, factorY.id, selectedTarget]);

  // Targets list for All Responses Grid (Desirability + each response per Screenshots 3 & 5)
  const allTargets = useMemo(() => {
    return ['__overall_desirability__', ...responses.map(r => r.id)];
  }, [responses]);

  return (
    <div className="flex-1 flex flex-col bg-white border border-[#B0B0B0] shadow-xs overflow-hidden rounded-xs font-sans text-xs">
      
      {/* Top Header Bar: Response Selector & Graph Type Toggle */}
      <div className="bg-[#EAEAEA] border-b border-[#C0C0C0] px-3 py-1.5 flex flex-wrap justify-between items-center gap-2 shrink-0 select-none">
        
        {/* Left: Response Selector Dropdown */}
        <div className="flex items-center gap-2">
          <select
            value={selectedTarget}
            onChange={(e) => setSelectedTarget(e.target.value)}
            className="bg-white border border-[#A0A0A0] text-[#111827] text-xs font-semibold px-2 py-1 rounded-xs shadow-2xs focus:outline-none focus:border-[#0055A4]"
          >
            <option value="__all_responses__">All responses</option>
            <option value="__overall_desirability__">Desirability</option>
            {responses.map(r => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          {/* Axis controls when in One Factor, Interaction, Contour, or Surface */}
          {(graphType === 'one_factor' || graphType === 'interaction' || graphType === 'contour' || graphType === 'surface') && (
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-300">
              <div className="flex items-center gap-1 text-[11px]">
                <span className="font-bold text-gray-600">X1:</span>
                <select
                  value={axisXId}
                  onChange={(e) => setAxisXId(e.target.value)}
                  className="bg-white border border-gray-300 text-gray-800 text-[11px] px-1 py-0.5 rounded focus:outline-none"
                >
                  {factors.map(f => (
                    <option key={f.id} value={f.id} disabled={f.id === axisYId && graphType !== 'one_factor'}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {graphType !== 'one_factor' && (
                <div className="flex items-center gap-1 text-[11px]">
                  <span className="font-bold text-gray-600">X2:</span>
                  <select
                    value={axisYId}
                    onChange={(e) => setAxisYId(e.target.value)}
                    className="bg-white border border-gray-300 text-gray-800 text-[11px] px-1 py-0.5 rounded focus:outline-none"
                  >
                    {factors.map(f => (
                      <option key={f.id} value={f.id} disabled={f.id === axisXId}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Center / Right: Graph Type Buttons (Matching DX13 Screenshots 3, 4, 5) */}
        <div className="flex items-center gap-1 bg-white border border-[#B0B0B0] rounded-xs p-0.5 shadow-2xs">
          
          <button
            type="button"
            onClick={() => setGraphType('perturbation')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xs font-semibold text-[11px] transition-colors ${
              graphType === 'perturbation'
                ? 'bg-[#E5F3FF] text-[#0055A4] border border-[#70B0E0]'
                : 'text-gray-700 hover:bg-[#F0F0F0]'
            }`}
            title="Perturbation Plot"
          >
            <Activity size={12} className={graphType === 'perturbation' ? 'text-[#0055A4]' : 'text-gray-500'} />
            <span>Perturbation</span>
          </button>

          <button
            type="button"
            onClick={() => setGraphType('one_factor')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xs font-semibold text-[11px] transition-colors ${
              graphType === 'one_factor'
                ? 'bg-[#E5F3FF] text-[#0055A4] border border-[#70B0E0]'
                : 'text-gray-700 hover:bg-[#F0F0F0]'
            }`}
            title="One Factor Plot"
          >
            <TrendingUp size={12} className={graphType === 'one_factor' ? 'text-[#0055A4]' : 'text-gray-500'} />
            <span>One Factor</span>
          </button>

          <button
            type="button"
            onClick={() => setGraphType('all_factors')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xs font-semibold text-[11px] transition-colors ${
              graphType === 'all_factors'
                ? 'bg-[#E5F3FF] text-[#0055A4] border border-[#70B0E0]'
                : 'text-gray-700 hover:bg-[#F0F0F0]'
            }`}
            title="All Factors Plot"
          >
            <Grid size={12} className={graphType === 'all_factors' ? 'text-[#0055A4]' : 'text-gray-500'} />
            <span>All Factors</span>
          </button>

          <button
            type="button"
            onClick={() => setGraphType('interaction')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xs font-semibold text-[11px] transition-colors ${
              graphType === 'interaction'
                ? 'bg-[#E5F3FF] text-[#0055A4] border border-[#70B0E0]'
                : 'text-gray-700 hover:bg-[#F0F0F0]'
            }`}
            title="Interaction Plot"
          >
            <GitCommit size={12} className={graphType === 'interaction' ? 'text-[#0055A4]' : 'text-gray-500'} />
            <span>Interaction</span>
          </button>

          <button
            type="button"
            onClick={() => setGraphType('contour')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xs font-semibold text-[11px] transition-colors ${
              graphType === 'contour'
                ? 'bg-[#E5F3FF] text-[#0055A4] border border-[#70B0E0]'
                : 'text-gray-700 hover:bg-[#F0F0F0]'
            }`}
            title="2D Contour Plot"
          >
            <Layers size={12} className={graphType === 'contour' ? 'text-[#0055A4]' : 'text-gray-500'} />
            <span>Contour</span>
          </button>

          <button
            type="button"
            onClick={() => setGraphType('surface')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xs font-semibold text-[11px] transition-colors ${
              graphType === 'surface'
                ? 'bg-[#E5F3FF] text-[#0055A4] border border-[#70B0E0]'
                : 'text-gray-700 hover:bg-[#F0F0F0]'
            }`}
            title="3D Response Surface"
          >
            <Box size={12} className={graphType === 'surface' ? 'text-[#0055A4]' : 'text-gray-500'} />
            <span>3D Surface</span>
          </button>

        </div>

      </div>

      {/* Main Graph Content Area: Left Sidebar + Center Chart */}
      <div className="flex-1 flex overflow-hidden min-h-0 bg-[#FAFAFA]">
        
        {/* Left Information Sidebar */}
        {renderLeftSidebar()}

        {/* Center Plot Canvas */}
        <div className="flex-1 overflow-auto p-4 flex flex-col items-center justify-center min-h-0">
          
          {/* 1. Perturbation View */}
          {graphType === 'perturbation' && (
            selectedTarget === '__all_responses__' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                {allTargets.map(tId => renderPerturbationPlot(tId, 370, 260))}
              </div>
            ) : (
              <div className="flex items-center justify-center">
                {renderPerturbationPlot(selectedTarget, 560, 390)}
              </div>
            )
          )}

          {/* 2. One Factor View */}
          {graphType === 'one_factor' && (
            selectedTarget === '__all_responses__' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                {allTargets.map(tId => renderOneFactorPlot(tId, 370, 260))}
              </div>
            ) : (
              <div className="flex items-center justify-center">
                {renderOneFactorPlot(selectedTarget, 560, 390)}
              </div>
            )
          )}

          {/* 3. All Factors View */}
          {graphType === 'all_factors' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
              {factors.map((f) => {
                const targetId = selectedTarget === '__all_responses__' ? '__overall_desirability__' : selectedTarget;
                return (
                  <div key={f.id} className="border border-gray-200 bg-white p-2 rounded shadow-2xs">
                    {renderOneFactorPlot(targetId, 310, 240)}
                  </div>
                );
              })}
            </div>
          )}

          {/* 4. Interaction View */}
          {graphType === 'interaction' && (
            selectedTarget === '__all_responses__' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                {allTargets.map(tId => renderInteractionPlot(tId, 370, 260))}
              </div>
            ) : (
              <div className="flex items-center justify-center">
                {renderInteractionPlot(selectedTarget, 560, 390)}
              </div>
            )
          )}

          {/* 5. 2D Contour View */}
          {graphType === 'contour' && contourData && (
            <div className="w-full h-full max-w-3xl flex flex-col items-center justify-center">
              <ContourPlot
                gridData={{
                  x: contourData.x,
                  y: contourData.y,
                  z: contourData.z,
                  minZ: contourData.minZ,
                  maxZ: contourData.maxZ,
                }}
                designPoints={[optimumPoint]}
                xLabel={`${factorX.name} ${factorX.units ? `(${factorX.units})` : ''}`}
                yLabel={`${factorY.name} ${factorY.units ? `(${factorY.units})` : ''}`}
                title={selectedTarget === '__overall_desirability__' ? `Desirability Contour (D = ${solution.desirability.toFixed(4)})` : `Contour Plot`}
              />
            </div>
          )}

          {/* 6. 3D Surface View */}
          {graphType === 'surface' && contourData && (
            <div className="w-full h-full max-w-3xl flex flex-col items-center justify-center">
              <Surface3DPlot
                gridData={{
                  x: contourData.x,
                  y: contourData.y,
                  z: contourData.z,
                  minZ: contourData.minZ,
                  maxZ: contourData.maxZ,
                }}
                designPoints={[optimumPoint]}
                xLabel={`${factorX.name} ${factorX.units ? `(${factorX.units})` : ''}`}
                yLabel={`${factorY.name} ${factorY.units ? `(${factorY.units})` : ''}`}
                title={selectedTarget === '__overall_desirability__' ? `Desirability Surface` : `3D Response Surface`}
              />
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
