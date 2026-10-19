import { useState, useMemo, useEffect } from 'react';
import { useProject } from '../../../context/ProjectContext';
import { 
  OptimizationCriterion, 
  OptimizationOptions, 
  DEFAULT_OPTIMIZATION_OPTIONS,
  initializeDesignCriteria, 
  validateCriterion,
  isFactorCriterionCoded 
} from '../../../lib/optimization/types';
import { calculateIndividualDesirability, codedToActual, actualToCoded } from '../../../lib/optimization/solver';
import { OptimizationOptionsModal } from './OptimizationOptionsModal';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Sliders, 
  Layers, 
  Info, 
  Flag 
} from 'lucide-react';

/**
 * Checks whether a response's values are constant across experimental runs.
 */
function checkResponseDoesNotVary(
  runs: Array<{ responses?: Record<string, number | null> }>,
  responseId: string
): boolean {
  if (!runs || runs.length <= 1) return false;
  const values = runs
    .map(r => r.responses?.[responseId])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (values.length <= 1) return false;
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  return Math.abs(maxVal - minVal) < 1e-6;
}

export function CriteriaScreen() {
  const { project, activeDesignId, saveProject } = useProject();

  const design = activeDesignId && project?.data?.designs ? project.data.designs[activeDesignId] : null;

  // Design inputs
  const factors = useMemo(() => design?.config?.factors || [], [design]);
  const responses = useMemo(() => design?.config?.responses || [], [design]);
  const runs = useMemo(() => design?.runs || [], [design]);
  const analyses = useMemo(() => design?.analyses || {}, [design]);

  // Options modal state
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);

  // Load or initialize criteria
  const [criteria, setCriteria] = useState<Record<string, OptimizationCriterion>>(() => {
    return initializeDesignCriteria(
      factors,
      responses,
      runs,
      design?.optimization?.criteria,
      analyses
    );
  });

  // Load or initialize options
  const [options, setOptions] = useState<OptimizationOptions>(() => {
    return design?.optimization?.options || { ...DEFAULT_OPTIMIZATION_OPTIONS };
  });

  // Selected item ID (default to first factor or first response)
  const [selectedId, setSelectedId] = useState<string>(() => {
    if (factors.length > 0) return factors[0].id;
    if (responses.length > 0) return responses[0].id;
    return '';
  });

  // Hover state for interactive desirability graph
  const [graphHover, setGraphHover] = useState<{ xVal: number; dVal: number; px: number; py: number } | null>(null);

  // Synchronize state if design or project changes
  useEffect(() => {
    if (design) {
      const updated = initializeDesignCriteria(
        factors,
        responses,
        runs,
        design.optimization?.criteria || criteria,
        analyses
      );
      setCriteria(updated);

      if (design.optimization?.options) {
        setOptions(design.optimization.options);
      }

      if (!selectedId || (!updated[selectedId])) {
        if (factors.length > 0) setSelectedId(factors[0].id);
        else if (responses.length > 0) setSelectedId(responses[0].id);
      }
    }
  }, [design?.id, factors, responses, runs, analyses]);

  // Save criteria and options into design state and persist
  const persistOptimizationState = async (
    newCriteria: Record<string, OptimizationCriterion>,
    newOptions: OptimizationOptions
  ) => {
    if (!project || !activeDesignId) return;

    if (!project.data.designs[activeDesignId].optimization) {
      project.data.designs[activeDesignId].optimization = {};
    }

    const currentOpt = project.data.designs[activeDesignId].optimization || {};
    project.data.designs[activeDesignId].optimization = {
      ...currentOpt,
      criteria: newCriteria,
      options: newOptions,
      lastUpdated: new Date().toISOString()
    };

    try {
      await saveProject(project.name);
    } catch (e) {
      console.error('Failed to persist optimization criteria:', e);
    }
  };

  const handleUpdateCriterion = (updated: OptimizationCriterion) => {
    let toSave = updated;
    const isEq = updated.goal === 'equal_to' || (updated.goal as string) === 'equal' || (updated.goal as string) === 'is equal to';
    if (updated.type === 'factor' && isEq && selectedFactor) {
      toSave = {
        ...updated,
        lowerLimit: selectedFactor.low,
        upperLimit: selectedFactor.high,
        unitType: 'actual',
        isCoded: false,
      };
    }
    const nextCriteria = {
      ...criteria,
      [toSave.id]: toSave
    };
    setCriteria(nextCriteria);
    persistOptimizationState(nextCriteria, options);
  };

  const handleSaveOptions = (newOptions: OptimizationOptions) => {
    setOptions(newOptions);
    persistOptimizationState(criteria, newOptions);
  };

  // Currently selected item
  const selectedCriterion = criteria[selectedId];
  const selectedFactor = factors.find((f: any) => f.id === selectedId);
  const isCoded = selectedFactor && selectedCriterion ? isFactorCriterionCoded(selectedCriterion, selectedFactor) : false;

  // Term-in-model detection across fitted response models
  const factorModelInclusion = useMemo(() => {
    const result: Record<string, { inModel: boolean; responses: string[] }> = {};
    const fittedResponseIds = Object.keys(analyses).filter(
      rid => analyses[rid]?.fittedModel || analyses[rid]?.fitted
    );

    for (const f of factors) {
      if (fittedResponseIds.length === 0) {
        result[f.id] = { inModel: true, responses: [] };
        continue;
      }
      const matchedResponses: string[] = [];
      for (const rid of fittedResponseIds) {
        const model = analyses[rid]?.fittedModel || analyses[rid]?.fitted;
        const terms = model?.terms || [];
        const hasTerm = terms.some((t: any) => t.factors && t.factors.includes(f.id));
        if (hasTerm) {
          const respName = responses.find((r: any) => r.id === rid)?.name || rid;
          matchedResponses.push(respName);
        }
      }
      result[f.id] = {
        inModel: matchedResponses.length > 0,
        responses: matchedResponses
      };
    }
    return result;
  }, [factors, responses, analyses]);

  // Model status inspection for active item
  const modelStatus = useMemo(() => {
    if (!selectedCriterion) return null;

    if (selectedCriterion.type === 'response') {
      const analysis = analyses[selectedCriterion.id];
      const model = analysis?.fittedModel || analysis?.fitted;
      const hasModel = Boolean(model);
      return {
        hasModel,
        modelType: model?.modelType || analysis?.modelType,
        r2: model?.R2 ?? null,
        adjR2: model?.adjR2 ?? null,
        message: hasModel 
          ? `Model fitted: ${model.modelType || 'Regression'} (R² = ${model.R2?.toFixed(4) ?? 'N/A'}, Adj R² = ${model.adjR2?.toFixed(4) ?? 'N/A'}). Ready for numerical prediction.`
          : `No fitted regression model available for this response. Optimization cannot predict response values until analysis is configured and fitted under Analysis.`
      };
    } else {
      const fittedResponses = Object.keys(analyses).filter(rid => analyses[rid]?.fittedModel || analyses[rid]?.fitted);
      if (fittedResponses.length === 0) {
        return {
          hasModel: true,
          isWarning: false,
          message: `Active design factor with configured bounds [${selectedFactor?.low ?? '?'}, ${selectedFactor?.high ?? '?'}]. (No response models fitted yet).`
        };
      }

      const inclusion = factorModelInclusion[selectedCriterion.id];
      const inModel = inclusion?.inModel ?? false;
      return {
        hasModel: inModel,
        isWarning: !inModel,
        message: inModel
          ? `Factor is active and included in fitted response models: ${inclusion.responses.join(', ')}.`
          : `Term not in model: This factor is not present in any currently fitted response model. Its bounds will constrain the search space, but it does not affect predicted response values.`
      };
    }
  }, [selectedCriterion, analyses, selectedFactor, factorModelInclusion]);

  // Check if response has constant observed values
  const responseDoesNotVary = useMemo(() => {
    if (!selectedCriterion || selectedCriterion.type !== 'response') return false;
    return checkResponseDoesNotVary(runs, selectedCriterion.id);
  }, [selectedCriterion, runs]);

  // Validation errors for current item
  const validationErrors = useMemo(() => {
    if (!selectedCriterion) return [];
    const factorBounds = selectedFactor ? { low: selectedFactor.low, high: selectedFactor.high } : undefined;
    return validateCriterion(selectedCriterion, factorBounds);
  }, [selectedCriterion, selectedFactor]);

  // Desirability graph renderer (Phase 5)
  const renderDesirabilityGraph = () => {
    if (!selectedCriterion || selectedCriterion.goal === 'none') {
      return (
        <div className="h-44 bg-[#FAFAFA] border border-[#D0D0D0] flex flex-col items-center justify-center text-gray-500 text-[11px] p-4 text-center rounded-sm">
          <Info size={20} className="text-gray-400 mb-1.5" />
          <span className="font-semibold text-gray-700">Goal is set to None</span>
          <span className="text-[10px] text-gray-400 mt-1 max-w-xs leading-relaxed">
            This response is excluded from the desirability objective function D. Predicted values will still be computed unless &quot;Hide on report&quot; is checked.
          </span>
        </div>
      );
    }

    const { goal, lowerLimit, upperLimit, targetValue, lowerWeight, upperWeight } = selectedCriterion;

    // Check invalid bounds
    if (goal !== 'equal_to' && lowerLimit >= upperLimit) {
      return (
        <div className="h-44 bg-[#FFF0F0] border border-[#FFCCCC] flex flex-col items-center justify-center text-[#B30000] text-[11px] p-4 text-center rounded-sm">
          <AlertTriangle size={18} className="text-[#B30000] mb-1" />
          <span className="font-bold">Invalid Limits</span>
          <span className="text-[10px] mt-0.5">Lower limit must be strictly less than upper limit to plot the desirability function.</span>
        </div>
      );
    }

    const w = 340;
    const h = 170;
    const padLeft = 36;
    const padRight = 24;
    const padTop = 22;
    const padBottom = 34;

    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    // Calculate x domain
    let xMin: number;
    let xMax: number;

    if (goal === 'equal_to') {
      const T = targetValue !== undefined ? targetValue : lowerLimit;
      const span = Math.max(1, (upperLimit - lowerLimit) || 10);
      xMin = T - 0.25 * span;
      xMax = T + 0.25 * span;
    } else {
      const span = upperLimit - lowerLimit;
      xMin = lowerLimit - 0.15 * span;
      xMax = upperLimit + 0.15 * span;
    }

    const xDomain = xMax - xMin || 1;

    const toPxX = (val: number) => padLeft + ((val - xMin) / xDomain) * plotW;
    const toPxY = (d: number) => padTop + (1 - Math.max(0, Math.min(1, d))) * plotH;
    const fromPxX = (px: number) => xMin + ((px - padLeft) / plotW) * xDomain;

    // Sample 120 points for smooth true mathematical curve
    const samplePoints: Array<[number, number]> = [];
    const numSamples = 120;
    for (let i = 0; i <= numSamples; i++) {
      const xVal = xMin + (i / numSamples) * xDomain;
      const dVal = calculateIndividualDesirability(xVal, selectedCriterion);
      samplePoints.push([toPxX(xVal), toPxY(dVal)]);
    }

    // Build SVG path
    const linePath = samplePoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ');
    const areaPath = `${linePath} L ${toPxX(xMax).toFixed(2)} ${toPxY(0).toFixed(2)} L ${toPxX(xMin).toFixed(2)} ${toPxY(0).toFixed(2)} Z`;

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      if (clientX < padLeft || clientX > padLeft + plotW) {
        setGraphHover(null);
        return;
      }
      const xVal = fromPxX(clientX);
      const dVal = calculateIndividualDesirability(xVal, selectedCriterion);
      setGraphHover({
        xVal,
        dVal,
        px: toPxX(xVal),
        py: toPxY(dVal)
      });
    };

    // Curvature description
    let curvatureText = '';
    if (goal === 'maximize') {
      const s = lowerWeight || 1.0;
      if (Math.abs(s - 1.0) < 0.05) curvatureText = 'Linear ramp (s = 1.0)';
      else if (s > 1.0) curvatureText = `Concave curve (s = ${s.toFixed(1)}, priority near upper limit)`;
      else curvatureText = `Convex curve (s = ${s.toFixed(1)}, relaxed lower limit)`;
    } else if (goal === 'minimize') {
      const t = upperWeight || 1.0;
      if (Math.abs(t - 1.0) < 0.05) curvatureText = 'Linear ramp (t = 1.0)';
      else if (t > 1.0) curvatureText = `Concave curve (t = ${t.toFixed(1)}, priority near lower limit)`;
      else curvatureText = `Convex curve (t = ${t.toFixed(1)}, relaxed upper limit)`;
    } else if (goal === 'target') {
      const s = lowerWeight || 1.0;
      const t = upperWeight || 1.0;
      curvatureText = `Two-sided target ramp (s = ${s.toFixed(1)}, t = ${t.toFixed(1)})`;
    } else if (goal === 'in_range') {
      curvatureText = 'Step function: d = 1 inside [Lower, Upper], 0 outside';
    } else if (goal === 'equal_to') {
      curvatureText = 'Target equality spike (±0.2% tolerance band)';
    }

    return (
      <div className="bg-white border border-[#C0C0C0] p-3 shadow-xs flex flex-col items-center rounded-sm">
        <div className="w-full flex justify-between items-center text-[10px] text-gray-500 font-bold border-b border-[#EAEAEA] pb-1.5 mb-1.5">
          <span className="flex items-center gap-1.5">
            <span className="text-[#0055A4]">Desirability Function:</span>
            <span className="font-mono text-gray-700">d(y)</span>
          </span>
          <span className="text-[#0055A4] capitalize bg-[#F0F4F8] px-2 py-0.5 rounded text-[10px] border border-[#D0DCE5]">
            {goal.replace('_', ' ')}
          </span>
        </div>

        <svg 
          width={w} 
          height={h} 
          className="overflow-visible select-none font-sans cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setGraphHover(null)}
        >
          <defs>
            <linearGradient id="desirabilityGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0055A4" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#0055A4" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Grid lines and y labels */}
          <line x1={padLeft} y1={toPxY(1)} x2={padLeft + plotW} y2={toPxY(1)} stroke="#E0E0E0" strokeDasharray="3 3" />
          <text x={padLeft - 6} y={toPxY(1) + 3} textAnchor="end" className="text-[9px] fill-gray-500 font-mono">1.0</text>

          <line x1={padLeft} y1={toPxY(0.5)} x2={padLeft + plotW} y2={toPxY(0.5)} stroke="#EFEFEF" strokeDasharray="2 2" />
          <text x={padLeft - 6} y={toPxY(0.5) + 3} textAnchor="end" className="text-[9px] fill-gray-400 font-mono">0.5</text>

          <line x1={padLeft} y1={toPxY(0)} x2={padLeft + plotW} y2={toPxY(0)} stroke="#B0B0B0" strokeWidth="1" />
          <text x={padLeft - 6} y={toPxY(0) + 3} textAnchor="end" className="text-[9px] fill-gray-500 font-mono">0.0</text>

          {/* Left Y Axis */}
          <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + plotH} stroke="#B0B0B0" strokeWidth="1" />

          {/* Shaded Area under Curve */}
          <path d={areaPath} fill="url(#desirabilityGrad)" />

          {/* Desirability Curve */}
          <path d={linePath} fill="none" stroke="#0055A4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Vertical Limit Markers */}
          {goal !== 'equal_to' ? (
            <>
              {/* Lower Limit Marker */}
              <line 
                x1={toPxX(lowerLimit)} 
                y1={padTop} 
                x2={toPxX(lowerLimit)} 
                y2={padTop + plotH} 
                stroke="#666666" 
                strokeWidth="1.2" 
                strokeDasharray="3 3" 
              />
              <text 
                x={toPxX(lowerLimit)} 
                y={padTop + plotH + 13} 
                textAnchor="middle" 
                className="text-[9px] fill-gray-700 font-mono font-semibold"
              >
                {lowerLimit}
              </text>
              <text 
                x={toPxX(lowerLimit)} 
                y={padTop + plotH + 23} 
                textAnchor="middle" 
                className="text-[8px] fill-gray-400"
              >
                Lower
              </text>

              {/* Upper Limit Marker */}
              <line 
                x1={toPxX(upperLimit)} 
                y1={padTop} 
                x2={toPxX(upperLimit)} 
                y2={padTop + plotH} 
                stroke="#666666" 
                strokeWidth="1.2" 
                strokeDasharray="3 3" 
              />
              <text 
                x={toPxX(upperLimit)} 
                y={padTop + plotH + 13} 
                textAnchor="middle" 
                className="text-[9px] fill-gray-700 font-mono font-semibold"
              >
                {upperLimit}
              </text>
              <text 
                x={toPxX(upperLimit)} 
                y={padTop + plotH + 23} 
                textAnchor="middle" 
                className="text-[8px] fill-gray-400"
              >
                Upper
              </text>

              {/* Target Marker */}
              {goal === 'target' && targetValue !== undefined && (
                <>
                  <line 
                    x1={toPxX(targetValue)} 
                    y1={padTop} 
                    x2={toPxX(targetValue)} 
                    y2={padTop + plotH} 
                    stroke="#008000" 
                    strokeWidth="1.5" 
                    strokeDasharray="3 2" 
                  />
                  <circle cx={toPxX(targetValue)} cy={toPxY(1)} r="3.5" fill="#008000" stroke="#FFFFFF" strokeWidth="1" />
                  <text 
                    x={toPxX(targetValue)} 
                    y={padTop + plotH + 13} 
                    textAnchor="middle" 
                    className="text-[9px] fill-[#008000] font-mono font-bold"
                  >
                    {targetValue}
                  </text>
                  <text 
                    x={toPxX(targetValue)} 
                    y={padTop + plotH + 23} 
                    textAnchor="middle" 
                    className="text-[8px] fill-[#008000] font-semibold"
                  >
                    Target
                  </text>
                </>
              )}
            </>
          ) : (
            // Equal to Target Marker
            <>
              {targetValue !== undefined && (
                <>
                  <line 
                    x1={toPxX(targetValue)} 
                    y1={padTop} 
                    x2={toPxX(targetValue)} 
                    y2={padTop + plotH} 
                    stroke="#008000" 
                    strokeWidth="2" 
                  />
                  <circle cx={toPxX(targetValue)} cy={toPxY(1)} r="4" fill="#008000" stroke="#FFFFFF" strokeWidth="1.5" />
                  <text 
                    x={toPxX(targetValue)} 
                    y={padTop + plotH + 13} 
                    textAnchor="middle" 
                    className="text-[9px] fill-[#008000] font-mono font-bold"
                  >
                    {targetValue}
                  </text>
                  <text 
                    x={toPxX(targetValue)} 
                    y={padTop + plotH + 23} 
                    textAnchor="middle" 
                    className="text-[8px] fill-[#008000] font-semibold"
                  >
                    Equal To
                  </text>
                </>
              )}
            </>
          )}

          {/* Interactive Hover Point & Crosshair */}
          {graphHover && (
            <g>
              <line 
                x1={graphHover.px} 
                y1={padTop} 
                x2={graphHover.px} 
                y2={padTop + plotH} 
                stroke="#0055A4" 
                strokeWidth="1" 
                strokeDasharray="2 2" 
                opacity="0.8"
              />
              <circle cx={graphHover.px} cy={graphHover.py} r="4.5" fill="#0055A4" stroke="#FFFFFF" strokeWidth="2" />
              <rect 
                x={Math.min(padLeft + plotW - 130, Math.max(padLeft, graphHover.px - 65))} 
                y={padTop - 18} 
                width="130" 
                height="16" 
                rx="2" 
                fill="#003366" 
                opacity="0.95" 
              />
              <text 
                x={Math.min(padLeft + plotW - 65, Math.max(padLeft + 65, graphHover.px))} 
                y={padTop - 6} 
                textAnchor="middle" 
                className="text-[9px] fill-white font-mono font-semibold"
              >
                {selectedCriterion.type === 'factor' && selectedFactor && isCoded
                  ? `y=${graphHover.xVal.toFixed(2)} (${codedToActual(graphHover.xVal, selectedFactor.low, selectedFactor.high).toFixed(1)}), d=${graphHover.dVal.toFixed(3)}`
                  : `y=${graphHover.xVal.toFixed(2)}, d=${graphHover.dVal.toFixed(3)}`}
              </text>
            </g>
          )}
        </svg>

        {/* Curvature & Behavior Note */}
        <div className="w-full mt-2 pt-1.5 border-t border-[#EAEAEA] flex items-center justify-between text-[10px] text-gray-500">
          <span className="truncate">{curvatureText}</span>
          <span className="text-gray-400 font-mono text-[9px] shrink-0 ml-2">d &isin; [0, 1]</span>
        </div>
      </div>
    );
  };

  const importanceLabels = ['+', '++', '+++', '++++', '+++++'];

  // Visual styling for disabled controls (matches Win32 / Design-Expert greyed-out controls)
  const disabledInputStyle: React.CSSProperties = {
    backgroundColor: '#EBEBEB',
    color: '#808080',
    WebkitTextFillColor: '#808080',
    borderColor: '#D0D0D0',
    cursor: 'not-allowed',
    userSelect: 'none',
  };

  const disabledSliderStyle: React.CSSProperties = {
    accentColor: '#808080',
    filter: 'grayscale(100%)',
    cursor: 'not-allowed',
    opacity: 0.5,
  };

  const goal = selectedCriterion?.goal;
  const isEqualGoal = goal === 'equal_to' || (goal as string) === 'equal' || (goal as string) === 'is equal to';
  const isLimitsDisabled = selectedCriterion ? (selectedCriterion.goal === 'none' || isEqualGoal) : false;
  const isLowerWeightDisabled = selectedCriterion ? (!['maximize', 'target'].includes(selectedCriterion.goal) || isEqualGoal) : false;
  const isUpperWeightDisabled = selectedCriterion ? (!['minimize', 'target'].includes(selectedCriterion.goal) || isEqualGoal) : false;
  const isImportanceDisabled = selectedCriterion ? (selectedCriterion.goal === 'none' || isEqualGoal) : false;

  const displayLowerLimit = selectedCriterion
    ? (selectedCriterion.type === 'factor' && isEqualGoal)
      ? (selectedFactor ? selectedFactor.low : (selectedCriterion.lowerLimit ?? ''))
      : (selectedCriterion.lowerLimit !== undefined && !isNaN(selectedCriterion.lowerLimit))
        ? selectedCriterion.lowerLimit
        : (selectedCriterion.type === 'factor' ? (selectedFactor?.low ?? '') : '')
    : '';

  const displayUpperLimit = selectedCriterion
    ? (selectedCriterion.type === 'factor' && isEqualGoal)
      ? (selectedFactor ? selectedFactor.high : (selectedCriterion.upperLimit ?? ''))
      : (selectedCriterion.upperLimit !== undefined && !isNaN(selectedCriterion.upperLimit))
        ? selectedCriterion.upperLimit
        : (selectedCriterion.type === 'factor' ? (selectedFactor?.high ?? '') : '')
    : '';

  return (
    <div className="flex flex-col h-full bg-[#FAFAFA] font-sans text-xs select-none">
      
      {/* Top Banner / Breadcrumb */}
      <div className="bg-[#EAEAEA] border-b border-[#D0D0D0] px-4 py-2 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-2">
          <Layers size={15} className="text-[#0055A4]" />
          <span className="font-bold text-[#003366] text-[13px]">Numerical Optimization — Criteria</span>
          <span className="text-gray-500 text-[11px]">| Design: {design?.name || 'Active Design'}</span>
        </div>

        {/* Options Button */}
        <button
          type="button"
          onClick={() => setIsOptionsOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-[#E5F3FF] text-[#003366] font-semibold border border-[#B0B0B0] hover:border-[#0055A4] rounded-sm shadow-xs transition-colors"
          title="Optimization Options"
        >
          <Sliders size={13} className="text-[#0055A4]" />
          <span>Options...</span>
        </button>
      </div>

      {/* Main Two-Column Layout */}
      <div className="flex-1 flex overflow-hidden p-3 gap-3 min-h-0">
        
        {/* Left Column: Criteria Master List */}
        <div className="w-80 flex flex-col bg-white border border-[#909090] shadow-xs shrink-0 overflow-hidden rounded-sm">
          <div className="bg-[#003366] text-white px-3 py-1.5 font-bold text-[11px] flex justify-between items-center shrink-0">
            <span>Criteria Master List</span>
            <span className="text-[10px] text-white/80 font-normal">
              {factors.length} Factors, {responses.length} Responses
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#EAEAEA]">
            
            {/* Factors Section */}
            <div>
              <div className="bg-[#F0F4F8] px-3 py-1 text-[10px] font-bold text-[#0055A4] uppercase tracking-wider border-b border-[#D8E4F0]">
                Factors ({factors.length})
              </div>
              {factors.map((f: any, idx: number) => {
                const letter = String.fromCharCode(65 + idx);
                const crit = criteria[f.id];
                const isSelected = selectedId === f.id;
                const goalText = crit?.goal ? crit.goal.replace('_', ' ') : 'in range';
                const inclusion = factorModelInclusion[f.id];
                const isNotInModel = Object.keys(analyses).some(rid => analyses[rid]?.fittedModel || analyses[rid]?.fitted) && !inclusion?.inModel;

                return (
                  <div
                    key={f.id}
                    onClick={() => setSelectedId(f.id)}
                    className={`px-3 py-2 cursor-pointer flex items-center justify-between transition-colors border-b border-[#F0F0F0] ${
                      isSelected 
                        ? 'bg-[#CCE8FF] text-[#003366] font-semibold border-l-4 border-l-[#0055A4]' 
                        : 'hover:bg-[#F5F9FF] text-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-5 h-5 rounded-sm bg-[#0055A4] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                        {letter}
                      </span>
                      <div className="truncate">
                        <div className="truncate text-[11px] flex items-center gap-1.5">
                          <span>{f.name}</span>
                          {isNotInModel && (
                            <span 
                              className="text-[8px] bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D] px-1 rounded-xs font-medium" 
                              title="Term not in any fitted response model"
                            >
                              Term not in model
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-500 font-normal">
                          [{f.low}, {f.high}] {f.units || ''}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 ml-2">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-white border border-gray-300 capitalize text-gray-700">
                        {goalText}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Responses Section */}
            <div>
              <div className="bg-[#F0F4F8] px-3 py-1 text-[10px] font-bold text-[#0055A4] uppercase tracking-wider border-b border-[#D8E4F0]">
                Responses ({responses.length})
              </div>
              {responses.length === 0 ? (
                <div className="p-3 text-[11px] text-gray-400 italic">No responses configured.</div>
              ) : (
                responses.map((r: any, idx: number) => {
                  const code = `R${idx + 1}`;
                  const crit = criteria[r.id];
                  const isSelected = selectedId === r.id;
                  const goalText = crit?.goal ? crit.goal.replace('_', ' ') : 'none';
                  const hasModel = Boolean(analyses[r.id]?.fittedModel || analyses[r.id]?.fitted);

                  return (
                    <div
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className={`px-3 py-2 cursor-pointer flex items-center justify-between transition-colors border-b border-[#F0F0F0] ${
                        isSelected 
                          ? 'bg-[#CCE8FF] text-[#003366] font-semibold border-l-4 border-l-[#0055A4]' 
                          : 'hover:bg-[#F5F9FF] text-gray-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-5 h-5 rounded-sm bg-[#008000] text-white flex items-center justify-center font-bold text-[9px] shrink-0">
                          {code}
                        </span>
                        <div className="truncate">
                          <div className="truncate text-[11px] flex items-center gap-1.5">
                            <span>{r.name}</span>
                            {!hasModel && (
                              <span 
                                className="text-[9px] text-[#B30000] font-normal" 
                                title="No regression model fitted for this response"
                              >
                                ●
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-500 font-normal">
                            {r.units ? `(${r.units})` : 'Response'}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 ml-2">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] border capitalize ${
                          goalText === 'none' 
                            ? 'bg-gray-100 text-gray-500 border-gray-200' 
                            : 'bg-[#E5F3FF] text-[#0055A4] border-[#B3D9FF] font-semibold'
                        }`}>
                          {goalText}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>

        {/* Right Column: Criteria Editor */}
        <div className="flex-1 flex flex-col bg-white border border-[#909090] shadow-xs overflow-y-auto rounded-sm">
          
          {selectedCriterion ? (
            <div className="p-5 flex flex-col gap-4 max-w-3xl">
              
              {/* Header Info */}
              <div className="border-b border-[#D0D0D0] pb-3 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-white font-bold text-[10px] rounded-xs ${
                      selectedCriterion.type === 'factor' ? 'bg-[#0055A4]' : 'bg-[#008000]'
                    }`}>
                      {selectedCriterion.code || (selectedCriterion.type === 'factor' ? 'Factor' : 'Response')}
                    </span>
                    <h2 className="text-[15px] font-bold text-[#003366]">
                      {selectedCriterion.name}
                    </h2>
                    {selectedCriterion.units && (
                      <span className="text-gray-500 font-normal text-xs">({selectedCriterion.units})</span>
                    )}
                    {selectedCriterion.type === 'factor' && (
                      <span className="text-[10px] font-medium bg-[#E8F0FE] text-[#1967D2] px-1.5 py-0.5 rounded border border-[#C2E7FF]">
                        {isCoded ? 'Coded units [-1, +1]' : 'Actual units'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-600 mt-1">
                    Configure the optimization goal, acceptable bounds, weight curvature, and importance rating.
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[11px] bg-[#F5F5F5] border border-gray-300 px-2 py-1 rounded text-gray-700 capitalize font-medium">
                    Type: {selectedCriterion.type}
                  </span>
                </div>
              </div>

              {/* Phase 6: Response-specific Analysis Selection Dropdown */}
              {selectedCriterion.type === 'response' && (
                <div className="bg-[#F0F4F8] border border-[#C8D8E8] p-2.5 rounded-sm flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <label htmlFor="resp-analysis-select" className="text-[11px] font-bold text-[#003366] shrink-0">
                      Analysis:
                    </label>
                    <select
                      id="resp-analysis-select"
                      value={selectedCriterion.selectedAnalysisId || (analyses[selectedCriterion.id] ? selectedCriterion.id : '')}
                      onChange={e => handleUpdateCriterion({
                        ...selectedCriterion,
                        selectedAnalysisId: e.target.value
                      })}
                      disabled={!analyses[selectedCriterion.id]?.fittedModel && !analyses[selectedCriterion.id]?.fitted}
                      className={`flex-1 border px-2.5 py-1 text-xs rounded-sm shadow-xs focus:outline-none ${
                        analyses[selectedCriterion.id]?.fittedModel || analyses[selectedCriterion.id]?.fitted
                          ? 'bg-white border-[#0055A4] text-gray-900 font-medium'
                          : 'bg-[#EAEAEA] border-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {analyses[selectedCriterion.id]?.fittedModel || analyses[selectedCriterion.id]?.fitted ? (
                        <>
                          <option value={selectedCriterion.id}>
                            {selectedCriterion.name} — {analyses[selectedCriterion.id]?.fittedModel?.modelType || analyses[selectedCriterion.id]?.fitted?.modelType || 'Quadratic'} (Fitted Model)
                          </option>
                          {analyses[selectedCriterion.id]?.modelComparison && analyses[selectedCriterion.id]?.modelComparison.map((mc: any) => {
                            const currentType = analyses[selectedCriterion.id]?.fittedModel?.modelType || analyses[selectedCriterion.id]?.fitted?.modelType;
                            if (mc.source === currentType || mc.model === currentType) return null;
                            const modelName = mc.source || mc.model || 'Alternative Model';
                            return (
                              <option key={modelName} value={`${selectedCriterion.id}_${modelName}`}>
                                {selectedCriterion.name} — {modelName}
                              </option>
                            );
                          })}
                        </>
                      ) : (
                        <option value="">(No fitted model available)</option>
                      )}
                    </select>
                  </div>
                  {analyses[selectedCriterion.id]?.fittedModel || analyses[selectedCriterion.id]?.fitted ? (
                    <span className="text-[10px] text-[#2D6A4F] bg-[#E8F5E9] border border-[#A5D6A7] px-2 py-0.5 rounded-xs font-semibold shrink-0">
                      R² = {(analyses[selectedCriterion.id]?.fittedModel?.R2 ?? analyses[selectedCriterion.id]?.fitted?.R2)?.toFixed(4) ?? 'N/A'}
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#B30000] bg-[#FFEBEE] border border-[#FFCDD2] px-2 py-0.5 rounded-xs font-semibold shrink-0">
                      Unfitted
                    </span>
                  )}
                </div>
              )}

              {/* Model Status Message Banner */}
              {modelStatus && (
                <div className={`p-2.5 rounded-sm border flex items-start gap-2 text-[11px] ${
                  modelStatus.hasModel && !modelStatus.isWarning
                    ? 'bg-[#EBF7EE] border-[#B7E4C7] text-[#1B4332]' 
                    : 'bg-[#FFF8E6] border-[#F2D675] text-[#7A5B00]'
                }`}>
                  {modelStatus.hasModel && !modelStatus.isWarning ? (
                    <CheckCircle2 size={14} className="text-[#2D6A4F] shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle size={14} className="text-[#D5AC2C] shrink-0 mt-0.5" />
                  )}
                  <span className="leading-snug">{modelStatus.message}</span>
                </div>
              )}

              {/* Validation Alert Box */}
              {validationErrors.length > 0 && (
                <div className="bg-[#FFF0F0] border border-[#FFCCCC] p-3 rounded-sm text-[11px] text-[#B30000]">
                  <div className="font-bold flex items-center gap-1 mb-1">
                    <AlertTriangle size={13} />
                    Contradictory / Invalid Criteria Limit(s):
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {validationErrors.map((err, i) => (
                      <li key={i}>{err.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#FAFAFA] border border-[#D0D0D0] p-4 rounded-sm">
                
                {/* Left Side: Fields */}
                <div className="space-y-3.5">
                  
                  {/* Goal Dropdown */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-800 mb-1" htmlFor="crit-goal">
                      Goal:
                    </label>
                    <select
                      id="crit-goal"
                      className="w-full border border-[#909090] bg-white px-2.5 py-1 text-xs text-gray-900 focus:outline-none focus:border-[#0055A4] shadow-xs rounded-sm capitalize"
                      value={selectedCriterion.goal}
                      onChange={e => {
                        const newGoal = e.target.value as any;
                        const isEq = newGoal === 'equal_to' || newGoal === 'equal' || newGoal === 'is equal to';
                        const isFactor = selectedCriterion.type === 'factor';
                        const updated: OptimizationCriterion = {
                          ...selectedCriterion,
                          goal: newGoal,
                          lowerLimit: (isEq && isFactor && selectedFactor) 
                            ? selectedFactor.low 
                            : (selectedCriterion.lowerLimit ?? selectedFactor?.low ?? 0),
                          upperLimit: (isEq && isFactor && selectedFactor) 
                            ? selectedFactor.high 
                            : (selectedCriterion.upperLimit ?? selectedFactor?.high ?? 100),
                          unitType: isFactor ? 'actual' : selectedCriterion.unitType,
                          isCoded: isFactor ? false : selectedCriterion.isCoded,
                        };
                        if (isEq && (updated.targetValue === undefined || updated.targetValue === null || isNaN(updated.targetValue))) {
                          updated.targetValue = isFactor && selectedFactor 
                            ? (selectedFactor.low + selectedFactor.high) / 2 
                            : (selectedCriterion.upperLimit ?? selectedFactor?.high ?? 1);
                        }
                        handleUpdateCriterion(updated);
                      }}
                    >
                      {selectedCriterion.type === 'factor' ? (
                        <>
                          <option value="in_range">is in range</option>
                          <option value="maximize">maximize</option>
                          <option value="minimize">minimize</option>
                          <option value="target">target</option>
                          <option value="equal_to">is equal to</option>
                        </>
                      ) : (
                        <>
                          <option value="none">none</option>
                          <option value="maximize">maximize</option>
                          <option value="minimize">minimize</option>
                          <option value="target">target</option>
                          <option value="in_range">is in range</option>
                          <option value="equal_to">is equal to</option>
                        </>
                      )}
                    </select>

                    {/* Phase 3F: Goal None Controls (Responses only) */}
                    {selectedCriterion.type === 'response' && selectedCriterion.goal === 'none' && (
                      <div className="mt-2.5 pt-2 border-t border-[#EAEAEA] space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
                          <input
                            type="checkbox"
                            checked={selectedCriterion.hideOnReport ?? false}
                            onChange={e => handleUpdateCriterion({
                              ...selectedCriterion,
                              hideOnReport: e.target.checked
                            })}
                            className="rounded-xs text-[#0055A4] focus:ring-[#0055A4] border-gray-300"
                          />
                          <span>Hide on report</span>
                        </label>
                        <p className="text-[10px] text-gray-500">
                          When checked, this response prediction will be hidden from the final solutions optimization report.
                        </p>

                        {/* Constant Response Notice */}
                        {responseDoesNotVary && (
                          <div className="text-[11px] text-[#991B1B] bg-[#FEE2E2] border border-[#FCA5A5] p-2 rounded-sm font-medium flex items-center gap-1.5">
                            <AlertTriangle size={13} className="shrink-0" />
                            <span>Response doesn&apos;t vary across experimental runs.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Target Value (Enabled for Target, Equal to) */}
                  {['target', 'equal_to'].includes(selectedCriterion.goal) && (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[11px] font-bold text-gray-800" htmlFor="crit-target">
                          Target Value:
                        </label>
                        {selectedCriterion.goal === 'equal_to' && (
                          <span className="text-[9px] text-[#008000] font-semibold flex items-center gap-0.5">
                            <Flag size={10} /> Equality Constraint
                          </span>
                        )}
                      </div>
                      <input
                        id="crit-target"
                        type="number"
                        step="any"
                        className="w-full border border-[#909090] bg-white px-2 py-1 text-xs font-mono text-gray-900 focus:outline-none focus:border-[#0055A4] shadow-xs rounded-sm"
                        value={selectedCriterion.targetValue ?? ''}
                        onChange={e => {
                          const val = parseFloat(e.target.value);
                          handleUpdateCriterion({
                            ...selectedCriterion,
                            targetValue: isNaN(val) ? undefined : val
                          });
                        }}
                      />
                      {selectedCriterion.type === 'factor' && selectedFactor && isCoded && selectedCriterion.targetValue !== undefined && !isNaN(selectedCriterion.targetValue) && (
                        <span className="text-[10px] text-[#0055A4] font-sans block mt-0.5">
                          Coded target [{selectedCriterion.targetValue}] corresponds to {codedToActual(selectedCriterion.targetValue, selectedFactor.low, selectedFactor.high).toFixed(2)} {selectedFactor.units || ''} in actual factor units.
                        </span>
                      )}
                      {selectedCriterion.type === 'factor' && selectedFactor && !isCoded && selectedCriterion.targetValue !== undefined && !isNaN(selectedCriterion.targetValue) && (
                        <span className="text-[10px] text-[#0055A4] font-sans block mt-0.5">
                          Actual target [{selectedCriterion.targetValue} {selectedFactor.units || ''}] (configured range: [{selectedFactor.low}, {selectedFactor.high}], coded: {actualToCoded(selectedCriterion.targetValue, selectedFactor.low, selectedFactor.high).toFixed(3)}).
                        </span>
                      )}
                      {selectedCriterion.goal === 'equal_to' && (
                        <span className="text-[10px] text-gray-500 font-sans block mt-0.5">
                          Strict equality tolerance (&plusmn;0.2% span) applied during numerical search.
                        </span>
                      )}
                    </div>
                  )}

                  {/* Lower & Upper Limits Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Lower Limit */}
                    <div>
                      <label 
                        className={`block text-[11px] font-bold mb-1 ${
                          isLimitsDisabled ? 'text-[#808080]' : 'text-gray-800'
                        }`} 
                        htmlFor="crit-lower"
                      >
                        Lower Limit:
                      </label>
                      <input
                        id="crit-lower"
                        type="number"
                        step="any"
                        disabled={isLimitsDisabled}
                        readOnly={isLimitsDisabled}
                        style={isLimitsDisabled ? disabledInputStyle : undefined}
                        className={`w-full border px-2 py-1 text-xs font-mono shadow-xs rounded-sm ${
                          isLimitsDisabled
                            ? 'bg-[#EBEBEB] text-[#808080] border-[#D0D0D0] cursor-not-allowed select-none opacity-80'
                            : 'bg-white text-gray-900 border-[#909090] focus:outline-none focus:border-[#0055A4]'
                        }`}
                        value={displayLowerLimit}
                        onChange={e => {
                          if (isLimitsDisabled) return;
                          const val = parseFloat(e.target.value);
                          handleUpdateCriterion({
                            ...selectedCriterion,
                            lowerLimit: isNaN(val) ? 0 : val
                          });
                        }}
                      />
                      {selectedFactor && (
                        <span className={`text-[10px] font-sans block mt-0.5 ${
                          isLimitsDisabled ? 'text-[#808080]' : 'text-gray-500'
                        }`}>
                          {isCoded 
                            ? `Coded Min: -1 (Actual: ${selectedFactor.low} ${selectedFactor.units || ''})` 
                            : `Configured Min: ${selectedFactor.low} ${selectedFactor.units || ''}`}
                        </span>
                      )}
                    </div>

                    {/* Upper Limit */}
                    <div>
                      <label 
                        className={`block text-[11px] font-bold mb-1 ${
                          isLimitsDisabled ? 'text-[#808080]' : 'text-gray-800'
                        }`} 
                        htmlFor="crit-upper"
                      >
                        Upper Limit:
                      </label>
                      <input
                        id="crit-upper"
                        type="number"
                        step="any"
                        disabled={isLimitsDisabled}
                        readOnly={isLimitsDisabled}
                        style={isLimitsDisabled ? disabledInputStyle : undefined}
                        className={`w-full border px-2 py-1 text-xs font-mono shadow-xs rounded-sm ${
                          isLimitsDisabled
                            ? 'bg-[#EBEBEB] text-[#808080] border-[#D0D0D0] cursor-not-allowed select-none opacity-80'
                            : 'bg-white text-gray-900 border-[#909090] focus:outline-none focus:border-[#0055A4]'
                        }`}
                        value={displayUpperLimit}
                        onChange={e => {
                          if (isLimitsDisabled) return;
                          const val = parseFloat(e.target.value);
                          handleUpdateCriterion({
                            ...selectedCriterion,
                            upperLimit: isNaN(val) ? 0 : val
                          });
                        }}
                      />
                      {selectedFactor && (
                        <span className={`text-[10px] font-sans block mt-0.5 ${
                          isLimitsDisabled ? 'text-[#808080]' : 'text-gray-500'
                        }`}>
                          {isCoded 
                            ? `Coded Max: +1 (Actual: ${selectedFactor.high} ${selectedFactor.units || ''})` 
                            : `Configured Max: ${selectedFactor.high} ${selectedFactor.units || ''}`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Phase 4: Synchronized Weights with Interactive Range Sliders */}
                  <div className="space-y-3 pt-1 border-t border-[#EAEAEA]">
                    
                    {/* Lower Weight (Enabled for Maximize, Target) */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label 
                          className={`text-[11px] font-bold ${
                            isLowerWeightDisabled ? 'text-[#808080]' : 'text-gray-800'
                          }`} 
                          htmlFor="crit-l-weight"
                        >
                          Lower Weight (s):
                        </label>
                        <span 
                          className={`text-[10px] font-mono font-semibold ${
                            isLowerWeightDisabled ? 'text-[#808080]' : 'text-[#0055A4]'
                          }`}
                        >
                          {selectedCriterion.lowerWeight.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          id="crit-l-weight"
                          type="number"
                          min="0.1"
                          max="10"
                          step="0.1"
                          disabled={isLowerWeightDisabled}
                          readOnly={isLowerWeightDisabled}
                          style={isLowerWeightDisabled ? disabledInputStyle : undefined}
                          className={`w-20 border px-2 py-1 text-xs font-mono shadow-xs rounded-sm ${
                            isLowerWeightDisabled
                              ? 'bg-[#EBEBEB] text-[#808080] border-[#D0D0D0] cursor-not-allowed select-none opacity-80'
                              : 'bg-white text-gray-900 border-[#909090] focus:outline-none focus:border-[#0055A4]'
                          }`}
                          value={selectedCriterion.lowerWeight}
                          onChange={e => {
                            if (isLowerWeightDisabled) return;
                            const val = parseFloat(e.target.value);
                            handleUpdateCriterion({
                              ...selectedCriterion,
                              lowerWeight: isNaN(val) ? 1.0 : Math.max(0.1, Math.min(10, val))
                            });
                          }}
                        />
                        <input
                          type="range"
                          min="0.1"
                          max="10"
                          step="0.1"
                          disabled={isLowerWeightDisabled}
                          style={isLowerWeightDisabled ? disabledSliderStyle : undefined}
                          className={`flex-1 h-1.5 bg-gray-200 rounded-lg ${
                            isLowerWeightDisabled ? 'cursor-not-allowed opacity-40' : 'accent-[#0055A4] cursor-pointer'
                          }`}
                          value={selectedCriterion.lowerWeight}
                          onChange={e => {
                            if (isLowerWeightDisabled) return;
                            const val = parseFloat(e.target.value);
                            handleUpdateCriterion({
                              ...selectedCriterion,
                              lowerWeight: isNaN(val) ? 1.0 : val
                            });
                          }}
                        />
                      </div>
                      <div className={`flex justify-between text-[9px] mt-0.5 px-0.5 ${
                        isLowerWeightDisabled ? 'text-gray-300' : 'text-gray-400'
                      }`}>
                        <span>0.1 (relaxed)</span>
                        <span>1.0 (default)</span>
                        <span>10 (strict)</span>
                      </div>
                    </div>

                    {/* Upper Weight (Enabled for Minimize, Target) */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label 
                          className={`text-[11px] font-bold ${
                            isUpperWeightDisabled ? 'text-[#808080]' : 'text-gray-800'
                          }`} 
                          htmlFor="crit-u-weight"
                        >
                          Upper Weight (t):
                        </label>
                        <span 
                          className={`text-[10px] font-mono font-semibold ${
                            isUpperWeightDisabled ? 'text-[#808080]' : 'text-[#0055A4]'
                          }`}
                        >
                          {selectedCriterion.upperWeight.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          id="crit-u-weight"
                          type="number"
                          min="0.1"
                          max="10"
                          step="0.1"
                          disabled={isUpperWeightDisabled}
                          readOnly={isUpperWeightDisabled}
                          style={isUpperWeightDisabled ? disabledInputStyle : undefined}
                          className={`w-20 border px-2 py-1 text-xs font-mono shadow-xs rounded-sm ${
                            isUpperWeightDisabled
                              ? 'bg-[#EBEBEB] text-[#808080] border-[#D0D0D0] cursor-not-allowed select-none opacity-80'
                              : 'bg-white text-gray-900 border-[#909090] focus:outline-none focus:border-[#0055A4]'
                          }`}
                          value={selectedCriterion.upperWeight}
                          onChange={e => {
                            if (isUpperWeightDisabled) return;
                            const val = parseFloat(e.target.value);
                            handleUpdateCriterion({
                              ...selectedCriterion,
                              upperWeight: isNaN(val) ? 1.0 : Math.max(0.1, Math.min(10, val))
                            });
                          }}
                        />
                        <input
                          type="range"
                          min="0.1"
                          max="10"
                          step="0.1"
                          disabled={isUpperWeightDisabled}
                          style={isUpperWeightDisabled ? disabledSliderStyle : undefined}
                          className={`flex-1 h-1.5 bg-gray-200 rounded-lg ${
                            isUpperWeightDisabled ? 'cursor-not-allowed opacity-40' : 'accent-[#0055A4] cursor-pointer'
                          }`}
                          value={selectedCriterion.upperWeight}
                          onChange={e => {
                            if (isUpperWeightDisabled) return;
                            const val = parseFloat(e.target.value);
                            handleUpdateCriterion({
                              ...selectedCriterion,
                              upperWeight: isNaN(val) ? 1.0 : val
                            });
                          }}
                        />
                      </div>
                      <div className={`flex justify-between text-[9px] mt-0.5 px-0.5 ${
                        isUpperWeightDisabled ? 'text-gray-300' : 'text-gray-400'
                      }`}>
                        <span>0.1 (relaxed)</span>
                        <span>1.0 (default)</span>
                        <span>10 (strict)</span>
                      </div>
                    </div>

                  </div>

                  {/* Importance Selector Dropdown (Disabled for Equal To and None) */}
                  <div className="pt-2 border-t border-[#EAEAEA]">
                    <div className="flex justify-between items-center mb-1">
                      <label 
                        className={`text-[11px] font-bold ${
                          isImportanceDisabled ? 'text-[#808080]' : 'text-gray-800'
                        }`} 
                        htmlFor="crit-importance"
                      >
                        Importance:
                      </label>
                      <span 
                        className={`text-[10px] font-mono font-semibold ${
                          isImportanceDisabled ? 'text-[#808080]' : 'text-[#0055A4]'
                        }`}
                      >
                        {importanceLabels[selectedCriterion.importance - 1]} ({selectedCriterion.importance})
                      </span>
                    </div>
                    <select
                      id="crit-importance"
                      disabled={isImportanceDisabled}
                      style={isImportanceDisabled ? disabledInputStyle : undefined}
                      value={selectedCriterion.importance}
                      onChange={e => {
                        if (isImportanceDisabled) return;
                        handleUpdateCriterion({
                          ...selectedCriterion,
                          importance: parseInt(e.target.value, 10)
                        });
                      }}
                      className={`w-full border px-2.5 py-1 text-xs shadow-xs rounded-sm ${
                        isImportanceDisabled
                          ? 'bg-[#EBEBEB] text-[#808080] border-[#D0D0D0] cursor-not-allowed select-none opacity-80'
                          : 'bg-white text-gray-900 border-[#909090] focus:outline-none focus:border-[#0055A4]'
                      }`}
                    >
                      <option value="1">+ (1 - Low)</option>
                      <option value="2">++ (2)</option>
                      <option value="3">+++ (3 - Default)</option>
                      <option value="4">++++ (4)</option>
                      <option value="5">+++++ (5 - High)</option>
                    </select>
                  </div>

                </div>

                {/* Right Side: Visual Desirability Ramp */}
                <div className="flex flex-col space-y-4">
                  <div>
                    <h3 className="text-[11px] font-bold text-gray-700 mb-2">Real-Time Desirability Curve</h3>
                    {renderDesirabilityGraph()}
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 p-8">
              Select an item from the left criteria list to edit its numerical optimization parameters.
            </div>
          )}

        </div>

      </div>

      {/* Options Popup Modal */}
      <OptimizationOptionsModal
        isOpen={isOptionsOpen}
        onClose={() => setIsOptionsOpen(false)}
        options={options}
        onSave={handleSaveOptions}
      />

    </div>
  );
}
