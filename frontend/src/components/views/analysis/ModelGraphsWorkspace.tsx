import { useState, useMemo, useEffect } from 'react';
import { RSMAnalysis, FactorDefinition } from '../../../lib/statistics/rsm/types';
import { createModelMatrix } from '../../../lib/statistics/rsm/modelMatrix';
import { ScatterPlot, Curve } from '../../shared/ScatterPlot';
import { ContourPlot } from '../../shared/ContourPlot';
import { Surface3DPlot } from '../../shared/Surface3DPlot';

interface ModelGraphsWorkspaceProps {
  analysis: RSMAnalysis;
  design: any;
  responseName: string;
}

type GraphType = 'Perturbation' | 'One Factor' | 'Interaction' | 'Contour' | '3D Surface' | 'Pred. vs Actual';

export function ModelGraphsWorkspace({ analysis, design, responseName }: ModelGraphsWorkspaceProps) {
  const [activeGraph, setActiveGraph] = useState<GraphType>('One Factor');
  const [selectedFactorId, setSelectedFactorId] = useState<string>('');
  const [selectedFactor2Id, setSelectedFactor2Id] = useState<string>('');
  const [perturbationFactorId, setPerturbationFactorId] = useState<string>('All');
  const [displayMode, setDisplayMode] = useState<'Coded' | 'Actual'>('Coded');
  const [heldValues, setHeldValues] = useState<Record<string, number>>({});
  const [selectedRunId, setSelectedRunId] = useState<string>('');

  const fittedModel = analysis.fittedModel || analysis.fitted;
  const factors: FactorDefinition[] = analysis.factors || [];

  // Initialize selected factors
  useEffect(() => {
    if (factors.length > 0) {
      if (!selectedFactorId || !factors.find(f => f.id === selectedFactorId)) {
        setSelectedFactorId(factors[0].id);
      }
      if (factors.length >= 2) {
        if (!selectedFactor2Id || !factors.find(f => f.id === selectedFactor2Id) || selectedFactor2Id === selectedFactorId) {
          const nextFact = factors.find(f => f.id !== (selectedFactorId || factors[0].id));
          if (nextFact) setSelectedFactor2Id(nextFact.id);
        }
      }
    }
  }, [factors, selectedFactorId, selectedFactor2Id]);

  if (!fittedModel || factors.length === 0) {
    return <div className="p-8 text-center text-gray-500">No fitted model or factors available.</div>;
  }

  let activeFactor = factors.find(f => f.id === selectedFactorId);
  if (!activeFactor) activeFactor = factors[0];

  let activeFactor2 = factors.find(f => f.id === selectedFactor2Id);
  if (!activeFactor2 && factors.length >= 2) activeFactor2 = factors.find(f => f.id !== activeFactor!.id) || factors[1];

  const isFactorInModel = fittedModel.terms.some(t => t.factors.includes(activeFactor!.id));
  const isFactor2InModel = activeFactor2 ? fittedModel.terms.some(t => t.factors.includes(activeFactor2!.id)) : false;

  // Prepare plot data
  const { curveData, multiCurveData, designPoints, gridData } = useMemo(() => {
    if (activeGraph !== 'Pred. vs Actual') {
      if (!activeFactor || !fittedModel || !isFactorInModel) return { curveData: [], multiCurveData: [], designPoints: [], gridData: null };
      if (['Interaction', 'Contour', '3D Surface'].includes(activeGraph) && (!activeFactor2 || factors.length < 2)) return { curveData: [], multiCurveData: [], designPoints: [], gridData: null };
    }
    const factorIds = factors.map(f => f.id);
    const curveResolution = 50; 
    let minCoded = -1; 
    let maxCoded = 1;
    if (design.runs) {
      for (const r of design.runs) {
        if (r.codedValues) {
          if (activeGraph === 'Perturbation') {
            for (const f of factors) {
              if (typeof r.codedValues[f.id] === 'number') {
                minCoded = Math.min(minCoded, r.codedValues[f.id]);
                maxCoded = Math.max(maxCoded, r.codedValues[f.id]);
              }
            }
          } else {
            if (typeof r.codedValues[activeFactor.id] === 'number') {
              minCoded = Math.min(minCoded, r.codedValues[activeFactor.id]);
              maxCoded = Math.max(maxCoded, r.codedValues[activeFactor.id]);
            }
          }
        }
      }
    }

    let cData: any[] = [];
    let mcData: Curve[] = [];
    const pts: any[] = [];
    const diagnostics = analysis.diagnostics || [];

    // Helper to evaluate a coded row
    const evalPrediction = (codedRow: Record<string, number>) => {
      const { X } = createModelMatrix([codedRow], factorIds, fittedModel.modelType, fittedModel.terms);
      let yPred = 0;
      for (let j = 0; j < X[0].length; j++) {
        yPred += X[0][j] * fittedModel.coefficients[j];
      }
      return yPred;
    };

    const getXVal = (f: FactorDefinition, codedVal: number) => {
      return displayMode === 'Coded' ? codedVal : (f.low + f.high) / 2 + codedVal * (f.high - f.low) / 2;
    };

    if (activeGraph === 'One Factor') {
      for (let i = 0; i <= curveResolution; i++) {
        const val = minCoded + (maxCoded - minCoded) * (i / curveResolution);
        const row: Record<string, number> = {};
        for (const f of factors) row[f.id] = (f.id === activeFactor.id) ? val : (heldValues[f.id] ?? 0);
        cData.push({ x: getXVal(activeFactor, val), y: evalPrediction(row) });
      }

      for (const d of diagnostics) {
        const run = (design.runs || []).find((r: any) => r.id === d.runId);
        if (run && run.codedValues) {
          // Check if design point matches held values for other factors
          let matchesHeld = true;
          for (const f of factors) {
            if (f.id === activeFactor.id) continue;
            const expected = heldValues[f.id] ?? 0;
            const actual = run.codedValues[f.id] ?? 0;
            if (Math.abs(expected - actual) > 0.05) {
              matchesHeld = false;
              break;
            }
          }

          if (matchesHeld) {
            const xValCoded = run.codedValues[activeFactor.id] ?? 0;
            const isSelectedRun = selectedRunId === String(run.id);
            pts.push({
              id: d.runId || Math.random().toString(),
              x: getXVal(activeFactor, xValCoded),
              y: d.observed,
              color: isSelectedRun ? '#B30000' : '#E04A26', 
              data: {
                runOrder: d.runOrder,
                xVal: getXVal(activeFactor, xValCoded),
                xValCoded,
                observed: d.observed,
                predicted: d.predicted,
                residual: d.residual
              }
            });
          }
        }
      }

    } else if (activeGraph === 'Interaction' && activeFactor2) {
      const levels = [
        { coded: -1, color: '#0055A4', name: 'Low' },
        { coded: 0, color: '#4B8B3B', name: 'Center' },
        { coded: 1, color: '#B30000', name: 'High' }
      ];

      for (const level of levels) {
        const curvePts = [];
        for (let i = 0; i <= curveResolution; i++) {
          const val = minCoded + (maxCoded - minCoded) * (i / curveResolution);
          const row: Record<string, number> = {};
          for (const f of factors) {
            if (f.id === activeFactor.id) row[f.id] = val;
            else if (f.id === activeFactor2.id) row[f.id] = level.coded;
            else row[f.id] = (heldValues[f.id] ?? 0);
          }
          curvePts.push({ x: getXVal(activeFactor, val), y: evalPrediction(row) });
        }
        mcData.push({
          id: `interaction-${level.name}`,
          name: `${activeFactor2.name}: ${level.name} (${getXVal(activeFactor2, level.coded).toFixed(3)})`,
          points: curvePts,
          color: level.color
        });
      }

      for (const d of diagnostics) {
        const run = (design.runs || []).find((r: any) => r.id === d.runId);
        if (run && run.codedValues) {
          let matchesHeld = true;
          for (const f of factors) {
            if (f.id === activeFactor.id || f.id === activeFactor2.id) continue;
            const expected = heldValues[f.id] ?? 0;
            const actual = run.codedValues[f.id] ?? 0;
            if (Math.abs(expected - actual) > 0.05) {
              matchesHeld = false;
              break;
            }
          }

          if (matchesHeld) {
            const val2 = run.codedValues[activeFactor2.id] ?? 0;
            let matchedLevel = null;
            for (const level of levels) {
              if (Math.abs(val2 - level.coded) < 0.05) {
                matchedLevel = level;
                break;
              }
            }

            if (matchedLevel) {
              const xValCoded = run.codedValues[activeFactor.id] ?? 0;
              const isSelectedRun = selectedRunId === String(run.id);
              pts.push({
                id: d.runId || Math.random().toString(),
                x: getXVal(activeFactor, xValCoded),
                y: d.observed,
                color: isSelectedRun ? '#000000' : matchedLevel.color, 
                data: {
                  runOrder: d.runOrder,
                  xVal: getXVal(activeFactor, xValCoded),
                  xValCoded,
                  observed: d.observed,
                  predicted: d.predicted,
                  residual: d.residual,
                  x2Val: getXVal(activeFactor2, run.codedValues[activeFactor2.id] ?? 0),
                  x2ValCoded: run.codedValues[activeFactor2.id] ?? 0
                }
              });
            }
          }
        }
      }

    } else if (activeGraph === 'Perturbation') {
      const factorColors = ['#E04A26', '#0055A4', '#4B8B3B', '#FFA500', '#800080', '#008080'];
      const numericFactors = factors;

      numericFactors.forEach((factor, fIndex) => {
        if (perturbationFactorId !== 'All' && factor.id !== perturbationFactorId) return;

        const curvePts = [];
        for (let i = 0; i <= curveResolution; i++) {
          const val = minCoded + (maxCoded - minCoded) * (i / curveResolution);
          const row: Record<string, number> = {};
          for (const f of factors) {
            row[f.id] = f.id === factor.id ? val : 0;
          }
          curvePts.push({ 
            x: val, 
            y: evalPrediction(row), 
            realXVal: getXVal(factor, val) 
          });
        }
        
        mcData.push({
          id: `perturb-${factor.id}`,
          name: factor.name,
          points: curvePts,
          color: factorColors[fIndex % factorColors.length]
        });
      });

      // Perturbation Design Points
      for (const d of diagnostics) {
        const run = (design.runs || []).find((r: any) => r.id === d.runId);
        if (run && run.codedValues) {
          let nonZeroFactors = [];
          for (const f of factors) {
            if (Math.abs(run.codedValues[f.id] ?? 0) > 1e-6) {
              nonZeroFactors.push(f);
            }
          }

          let belongToFactor = null;
          if (nonZeroFactors.length === 0) {
            if (perturbationFactorId !== 'All') {
              belongToFactor = factors.find(f => f.id === perturbationFactorId);
            } else {
              belongToFactor = factors[0]; 
            }
          } else if (nonZeroFactors.length === 1) {
            belongToFactor = nonZeroFactors[0];
          }

          if (belongToFactor) {
            if (perturbationFactorId !== 'All' && belongToFactor.id !== perturbationFactorId) continue;
            
            const fIndex = factors.findIndex(f => f.id === belongToFactor!.id);
            const xValCoded = run.codedValues[belongToFactor.id] ?? 0;
            pts.push({
              id: d.runId || Math.random().toString(),
              x: xValCoded,
              y: d.observed,
              color: factorColors[fIndex % factorColors.length],
              data: {
                isPerturbationPoint: true,
                runOrder: d.runOrder,
                factorName: belongToFactor.name,
                xValCoded,
                xVal: getXVal(belongToFactor, xValCoded),
                observed: d.observed,
                predicted: d.predicted,
                residual: d.residual
              }
            });
          }
        }
      }
    } else if (activeGraph === 'Pred. vs Actual') {
      let minResp = Infinity, maxResp = -Infinity;
      diagnostics.forEach(d => {
        if (d.observed < minResp) minResp = d.observed;
        if (d.observed > maxResp) maxResp = d.observed;
      });

      const getRespColor = (val: number) => {
        if (minResp === maxResp) return '#00FF00';
        const ratio = (val - minResp) / (maxResp - minResp);
        const hue = 240 - ratio * 240; 
        return `hsl(${hue}, 100%, 50%)`;
      };

      for (const d of diagnostics) {
        const run = (design.runs || []).find((r: any) => r.id === d.runId);
        const isSelectedRun = selectedRunId === String(run?.id);
        pts.push({
          id: d.runId || Math.random().toString(),
          x: d.observed,
          y: d.predicted,
          color: isSelectedRun ? '#000000' : getRespColor(d.observed),
          data: {
            runOrder: d.runOrder,
            observed: d.observed,
            predicted: d.predicted,
            residual: d.residual
          }
        });
      }
    }

    let gridData = null;
    if ((activeGraph === 'Contour' || activeGraph === '3D Surface') && activeFactor2) {
      gridData = {
        x: [] as number[], y: [] as number[], z: [] as number[][],
        minZ: Infinity, maxZ: -Infinity
      };
      
      let minCoded2 = -1;
      let maxCoded2 = 1;
      if (design.runs) {
        let fMin = Infinity, fMax = -Infinity;
        for (const r of design.runs) {
          if (r.codedValues && typeof r.codedValues[activeFactor2.id] === 'number') {
            fMin = Math.min(fMin, r.codedValues[activeFactor2.id]);
            fMax = Math.max(fMax, r.codedValues[activeFactor2.id]);
          }
        }
        if (fMin !== Infinity) minCoded2 = fMin;
        if (fMax !== -Infinity) maxCoded2 = fMax;
      }
      
      const gridRes = 51;
      for (let i = 0; i < gridRes; i++) {
        const xCoded = minCoded + (maxCoded - minCoded) * (i / (gridRes - 1));
        gridData.x.push(getXVal(activeFactor, xCoded));
        
        const zRow = [];
        for (let j = 0; j < gridRes; j++) {
          const yCoded = minCoded2 + (maxCoded2 - minCoded2) * (j / (gridRes - 1));
          if (i === 0) gridData.y.push(getXVal(activeFactor2, yCoded));
          
          const row: Record<string, number> = {};
          for (const f of factors) {
            if (f.id === activeFactor.id) row[f.id] = xCoded;
            else if (f.id === activeFactor2.id) row[f.id] = yCoded;
            else row[f.id] = heldValues[f.id] ?? 0;
          }
          
          const z = evalPrediction(row);
          zRow.push(z);
          if (z < gridData.minZ) gridData.minZ = z;
          if (z > gridData.maxZ) gridData.maxZ = z;
        }
        gridData.z.push(zRow);
      }
      
      for (const d of diagnostics) {
        const run = (design.runs || []).find((r: any) => r.id === d.runId);
        if (run && run.codedValues) {
          let matchesHeld = true;
          for (const f of factors) {
            if (f.id === activeFactor.id || f.id === activeFactor2.id) continue;
            const expected = heldValues[f.id] ?? 0;
            const actual = run.codedValues[f.id] ?? 0;
            if (Math.abs(expected - actual) > 0.05) {
              matchesHeld = false;
              break;
            }
          }
          if (matchesHeld) {
            const xValCoded = run.codedValues[activeFactor.id] ?? 0;
            const yValCoded = run.codedValues[activeFactor2.id] ?? 0;
            const isSelectedRun = selectedRunId === String(run.id);
            pts.push({
              id: d.runId || Math.random().toString(),
              x: getXVal(activeFactor, xValCoded),
              y: getXVal(activeFactor2, yValCoded),
              color: isSelectedRun ? '#FFFFFF' : '#E04A26',
              data: {
                runOrder: d.runOrder,
                xVal: getXVal(activeFactor, xValCoded),
                yVal: getXVal(activeFactor2, yValCoded),
                observed: d.observed,
                predicted: d.predicted,
                residual: d.residual
              }
            });
          }
        }
      }
    }

    return { curveData: cData, multiCurveData: mcData, designPoints: pts, gridData };
  }, [activeGraph, activeFactor, activeFactor2, perturbationFactorId, fittedModel, factors, analysis, design, displayMode, isFactorInModel, heldValues, selectedRunId]);

  // UI Tabs
  const GRAPHS: GraphType[] = ['Perturbation', 'One Factor', 'Interaction', 'Contour', '3D Surface', 'Pred. vs Actual'];

  const activeTabClass = "px-4 py-1.5 text-[11px] font-bold border-t-2 border-t-[#0055A4] border-b-2 border-b-[#FAFAFA] text-[#003366] bg-[#FAFAFA] relative top-[1px]";
  const inactiveTabClass = "px-4 py-1.5 text-[11px] font-medium border-t-2 border-transparent border-b-2 border-b-[#C0C0C0] text-gray-700 hover:text-gray-900 hover:bg-[#F5F5F5] transition-colors";
  const disabledTabClass = "px-4 py-1.5 text-[11px] font-medium border-t-2 border-transparent border-b-2 border-b-[#C0C0C0] text-[#A0A0A0] cursor-not-allowed";

  const renderTooltip = (pt: any) => {
    const d = pt.data;
    if (!d) return null;
    
    if (d.isCurve) {
      if (activeGraph === 'Perturbation') {
        return (
          <div className="flex flex-col gap-0.5 w-auto min-w-[140px] font-sans text-[11px] select-none whitespace-nowrap">
            <div className="font-bold border-b border-[#C0C0C0] pb-1 mb-1 text-[#003366]">
              Perturbation Curve
            </div>
            <div className="flex justify-between gap-4">
              <span>Factor:</span>
              <span className="font-mono">{d.curveName}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Deviation:</span>
              <span className="font-mono">{(d.xVal > 0 ? '+' : '') + d.xVal.toFixed(3)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Factor Value:</span>
              <span className="font-mono">{displayMode === 'Actual' ? d.realXVal.toFixed(4) : d.xVal.toFixed(4)}</span>
            </div>
            <div className="flex justify-between font-bold text-[#0055A4] mt-1 gap-4 pt-1 border-t border-[#EAEAEA]">
              <span>Predicted Response:</span>
              <span className="font-mono">{d.predicted.toFixed(4)}</span>
            </div>
          </div>
        );
      }

      return (
        <div className="flex flex-col gap-0.5 w-auto min-w-[140px] font-sans text-[11px] select-none whitespace-nowrap">
          <div className="font-bold border-b border-[#C0C0C0] pb-1 mb-1 text-[#003366]">
            Prediction Curve
          </div>
          <div className="flex justify-between gap-4">
            <span>{activeFactor!.name}:</span>
            <span className="font-mono">{d.xVal.toFixed(4)}</span>
          </div>
          {activeGraph === 'Interaction' && activeFactor2 && (
            <div className="flex justify-between gap-4">
              <span>{activeFactor2.name}:</span>
              <span className="font-mono">{d.curveName?.split(': ')[1] || d.curveName}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-[#0055A4] mt-1 gap-4">
            <span>Predicted:</span>
            <span className="font-mono">{d.predicted.toFixed(4)}</span>
          </div>
        </div>
      );
    }

    if (d.isPerturbationPoint) {
      return (
        <div className="flex flex-col gap-0.5 w-auto min-w-[140px] font-sans text-[11px] select-none whitespace-nowrap">
          <div className="font-bold border-b border-[#C0C0C0] pb-1 mb-1 text-[#003366]">
            Run: {d.runOrder}
          </div>
          <div className="flex justify-between gap-4">
            <span>Factor:</span>
            <span className="font-mono">{d.factorName}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Deviation:</span>
            <span className="font-mono">{(d.xValCoded > 0 ? '+' : '') + d.xValCoded.toFixed(3)}</span>
          </div>
          <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-[#EAEAEA]">
            <span>Observed Response:</span>
            <span className="font-mono">{d.observed.toFixed(4)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Predicted Response:</span>
            <span className="font-mono">{d.predicted.toFixed(4)}</span>
          </div>
          <div className="flex justify-between gap-4 font-bold text-[#B30000]">
            <span>Residual:</span>
            <span className="font-mono">{(d.residual > 0 ? '+' : '') + d.residual.toFixed(4)}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-0.5 w-auto min-w-[140px] font-sans text-[11px] select-none whitespace-nowrap">
        <div className="font-bold border-b border-[#C0C0C0] pb-1 mb-1 text-[#003366]">
          Run: {d.runOrder}
        </div>
        {activeGraph !== 'Pred. vs Actual' && (
          <div className="flex justify-between gap-4">
            <span>{activeFactor!.name}:</span>
            <span className="font-mono">{d.xVal?.toFixed(4)}</span>
          </div>
        )}
        {activeGraph === 'Interaction' && activeFactor2 && (
          <div className="flex justify-between gap-4">
            <span>{activeFactor2.name}:</span>
            <span className="font-mono">{d.x2Val?.toFixed(4)}</span>
          </div>
        )}
        <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-[#EAEAEA]">
          <span>Actual:</span>
          <span className="font-mono">{d.observed.toFixed(4)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Predicted:</span>
          <span className="font-mono">{d.predicted.toFixed(4)}</span>
        </div>
        <div className="flex justify-between gap-4 font-bold text-[#B30000]">
          <span>Residual:</span>
          <span className="font-mono">{d.residual.toFixed(4)}</span>
        </div>
      </div>
    );
  };

  const missingFactorMsg = activeGraph === 'Pred. vs Actual' ? null
    : activeGraph === 'One Factor' || activeGraph === 'Perturbation'
    ? (!isFactorInModel ? `Factor ${activeFactor?.name} is not included in the fitted model.` : null)
    : (!isFactorInModel || !isFactor2InModel ? `Selected factors are not included in the fitted model.` : null);

  const missingFactorsOverall = ['Interaction', 'Contour', '3D Surface'].includes(activeGraph) && factors.length < 2;

  const getInteractionWarning = () => {
    if (!activeFactor || activeGraph === 'Perturbation') return null;
    const term = fittedModel.terms.find(t => t.type === 'Interaction' && t.factors.includes(activeFactor.id));
    if (term) {
      const termName = term.factors.map(fId => factors.find(f => f.id === fId)?.name).join('');
      return `Warning: Factor involved in ${termName} interaction.`;
    }
    return null;
  };
  const interactionWarning = getInteractionWarning();

  const getXValUI = (f: FactorDefinition, codedVal: number) => {
    return displayMode === 'Coded' ? codedVal : (f.low + f.high) / 2 + codedVal * (f.high - f.low) / 2;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] min-h-[500px] bg-[#FAFAFA] font-sans -m-4">
      
      {/* Top Toolbar */}
      <div className="flex border-b border-[#C0C0C0] bg-[#EAEAEA] select-none z-10 px-6 pt-2 shrink-0">
        {GRAPHS.map(g => {
          const isImplemented = true; // All graphs are now implemented
          const isActive = activeGraph === g;
          return (
            <button
              key={g}
              onClick={() => isImplemented && setActiveGraph(g)}
              disabled={!isImplemented}
              className={!isImplemented ? disabledTabClass : (isActive ? activeTabClass : inactiveTabClass)}
            >
              {g} {!isImplemented && ' 🔒'}
            </button>
          );
        })}
      </div>

      <div className="flex-1 flex overflow-hidden bg-[#FAFAFA] p-4 gap-4 min-h-0">
        
        {/* Left Side: Graph */}
        <div className="flex-1 flex flex-col bg-white border border-[#909090] shadow-sm min-w-0 h-full">
          <div className="bg-[#EFEFEF] border-b border-[#C0C0C0] px-4 py-2 flex items-center justify-between text-[11px] shrink-0">
            <div className="flex items-center gap-4">
              <span className="font-bold text-[#003366]">Model:</span>
              <span className="font-medium text-gray-800">{fittedModel.modelType}</span>
              
              <span className="font-bold text-[#003366] ml-4">Response:</span>
              <span className="font-medium text-gray-800">{responseName}</span>
            </div>
          </div>
          
          <div className="flex-1 w-full h-full min-h-0 relative flex flex-row items-stretch p-4 gap-4">
            {true && (
              <div className="w-[160px] flex flex-col gap-4 text-[11px] font-sans text-gray-700 bg-white p-3 border border-gray-300 shadow-sm rounded-sm shrink-0 overflow-y-auto">
                <div>
                  <div className="font-bold text-[#003366]">{responseName}</div>
                  
                  {['One Factor', 'Interaction'].includes(activeGraph) && (
                    <div className="mt-3 flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[16px] text-[#E04A26] leading-none">●</span>
                        <span>Design Points</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] text-[#008080] font-bold tracking-tighter leading-none">- - -</span>
                        <span>95% CI Bands</span>
                      </div>
                    </div>
                  )}

                  {['Contour', '3D Surface', 'Pred. vs Actual'].includes(activeGraph) && (
                    <div className="mt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[16px] text-[#E04A26] leading-none">●</span>
                        <span>Design Points</span>
                      </div>
                      <div className="h-4 w-full bg-gradient-to-r from-blue-600 via-green-500 to-red-600 border border-gray-400"></div>
                      <div className="flex justify-between mt-1 text-[10px] font-mono text-gray-600">
                         <span>{(gridData?.minZ ?? Math.min(...designPoints.map(d=>d.data.observed))).toFixed(3)}</span>
                         <span>{(gridData?.maxZ ?? Math.max(...designPoints.map(d=>d.data.observed))).toFixed(3)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {interactionWarning && (
                  <div className="font-bold text-[#B30000]">
                    {interactionWarning}
                  </div>
                )}
                
                {activeGraph !== 'Perturbation' && activeGraph !== 'Pred. vs Actual' && (
                  <div>
                    <div className="font-bold text-[#003366] mb-1">X1 = {activeFactor.name}</div>
                    {['Interaction', 'Contour', '3D Surface'].includes(activeGraph) && activeFactor2 && (
                      <div className="font-bold text-[#003366] mb-1">X2 = {activeFactor2.name}</div>
                    )}
                  </div>
                )}

                <div>
                  <div className="font-bold text-[#003366]">Factor Coding:</div>
                  <div>{displayMode}</div>
                </div>

                {activeGraph !== 'Pred. vs Actual' && (
                  <div>
                    <div className="font-bold text-[#003366]">{displayMode === 'Actual' ? 'Actual Factors:' : 'Reference Point:'}</div>
                    {factors.map(f => {
                      if (activeGraph !== 'Perturbation' && f.id === activeFactor.id) return null;
                      if (['Interaction', 'Contour', '3D Surface'].includes(activeGraph) && f.id === activeFactor2?.id) return null;
                      const val = heldValues[f.id] ?? 0;
                      return (
                        <div key={f.id}>{f.name} = {getXValUI(f, val).toFixed(3)}</div>
                      );
                    })}
                  </div>
                )}
                {factors.filter(f => !fittedModel.terms.some(t => t.factors.includes(f.id))).length > 0 && (
                  <div>
                    <div className="font-bold text-[#003366]">Factors not in Model:</div>
                    {factors.filter(f => !fittedModel.terms.some(t => t.factors.includes(f.id))).map(f => (
                      <div key={f.id} className="text-[#B30000]">{f.name}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flex-1 relative flex items-center justify-center min-w-0">
              {missingFactorsOverall ? (
                <div className="bg-white border border-[#B30000] shadow-sm p-6 text-center max-w-md">
                  <h2 className="text-[13px] font-bold text-[#B30000] mb-2">Insufficient Factors</h2>
                  <p className="text-gray-700 text-[12px]">Interaction graph requires at least two factors.</p>
                </div>
              ) : missingFactorMsg ? (
                <div className="bg-white border border-[#B30000] shadow-sm p-6 text-center max-w-md">
                  <h2 className="text-[13px] font-bold text-[#B30000] mb-2">Factor Not Included</h2>
                  <p className="text-gray-700 text-[12px]">{missingFactorMsg}</p>
                </div>
              ) : activeGraph === 'Contour' && gridData ? (
                <ContourPlot 
                  gridData={gridData} 
                  designPoints={designPoints} 
                  xLabel={activeFactor.name} 
                  yLabel={activeFactor2!.name} 
                  title={`${responseName} Contour`} 
                />
              ) : activeGraph === '3D Surface' && gridData ? (
                <Surface3DPlot 
                  gridData={gridData} 
                  designPoints={designPoints} 
                  xLabel={activeFactor.name} 
                  yLabel={activeFactor2!.name} 
                  title={`${responseName} 3D Surface`} 
                />
              ) : activeGraph === 'Pred. vs Actual' ? (
                <ScatterPlot 
                  data={designPoints} 
                  xLabel="Actual" 
                  yLabel="Predicted" 
                  title="Predicted vs Actual" 
                  referenceLine={{ type: 'identity' }}
                />
              ) : (
                <ScatterPlot 
                  data={designPoints} 
                  curveData={activeGraph === 'One Factor' ? curveData : []}
                  multiCurveData={['Interaction', 'Perturbation'].includes(activeGraph) ? multiCurveData : []}
                  xLabel={activeGraph === 'Perturbation' ? 'Deviation from Reference Point (Coded Units)' : `${activeFactor.name} ${displayMode === 'Actual' && activeFactor.units ? '(' + activeFactor.units + ')' : ''}`}
                  yLabel={responseName}
                  title={activeGraph === 'Perturbation' ? 'Perturbation' : activeGraph === 'Interaction' ? `Interaction — ${activeFactor.name} × ${activeFactor2!.name}` : `One Factor — ${activeFactor.name}`}
                  renderTooltip={renderTooltip}
                  referenceLine={activeGraph === 'Perturbation' ? { type: 'vertical', value: 0 } : undefined}
                />
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Tools */}
        <div className="w-[280px] flex flex-col border border-[#909090] bg-white shadow-sm shrink-0 h-full overflow-y-auto">
          <div className="bg-[#EFEFEF] border-b border-[#C0C0C0] px-3 py-2 text-[11px] font-bold text-[#003366] shrink-0">
            {activeGraph} Settings
          </div>
          
          <div className="p-4 flex flex-col gap-4 text-[12px] text-gray-800">
            {/* Display Mode */}
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-[#003366]">Display Coding</span>
              <select
                value={displayMode}
                onChange={e => setDisplayMode(e.target.value as 'Coded' | 'Actual')}
                className="border border-[#C0C0C0] rounded-sm px-2 py-1 focus:outline-none focus:border-[#0055A4]"
              >
                <option value="Coded">Coded</option>
                <option value="Actual">Actual</option>
              </select>
            </div>

            {activeGraph === 'Perturbation' && (
              <>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-[#003366]">Reference</span>
                  <select disabled className="border border-[#C0C0C0] rounded-sm px-2 py-1 bg-gray-100 text-gray-500">
                    <option>Center</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-[#003366]">Factor display</span>
                  <select
                    value={perturbationFactorId}
                    onChange={e => setPerturbationFactorId(e.target.value)}
                    className="border border-[#C0C0C0] rounded-sm px-2 py-1 focus:outline-none focus:border-[#0055A4]"
                  >
                    <option value="All">All Factors</option>
                    {factors.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex flex-col gap-1 mt-2">
                  <span className="font-semibold text-[#003366]">Factors</span>
                  <div className="border border-[#EAEAEA] bg-[#F9F9F9] p-2 rounded-sm text-[11px] flex flex-col gap-1">
                    {factors.map((f, i) => {
                      const colors = ['#E04A26', '#0055A4', '#4B8B3B', '#FFA500', '#800080', '#008080'];
                      const c = colors[i % colors.length];
                      return (
                        <div key={f.id} className="flex items-center gap-2">
                          <span className="text-[14px]" style={{ color: c }}>●</span>
                          <span className="font-medium text-gray-700">{f.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {activeGraph !== 'Perturbation' && (
              <div className="flex gap-2 mb-2">
                <button 
                  onClick={() => {
                    setHeldValues({});
                    setSelectedRunId('');
                    setDisplayMode('Actual');
                    if (factors.length > 0) setSelectedFactorId(factors[0].id);
                    if (factors.length > 1) setSelectedFactor2Id(factors[1].id);
                  }}
                  className="flex-1 bg-gray-100 border border-gray-300 py-1 text-center hover:bg-gray-200 text-[#003366] font-semibold text-[11px] shadow-sm rounded-sm"
                >
                  Default
                </button>
                <button 
                  className="flex-1 bg-gray-100 border border-gray-300 py-1 text-center hover:bg-gray-200 text-[#003366] font-semibold text-[11px] shadow-sm rounded-sm"
                >
                  Sheet...
                </button>
              </div>
            )}

            {['One Factor', 'Perturbation', 'Pred. vs Actual'].includes(activeGraph) && (
              <>
                <div className="flex flex-col gap-1 mb-2">
                  <span className="font-semibold text-[#003366]">Jump to run:</span>
                  <select 
                    value={selectedRunId}
                    onChange={e => {
                      const runId = e.target.value;
                      setSelectedRunId(runId);
                      const run = (design.runs || []).find((r: any) => String(r.id) === runId);
                      if (run && run.codedValues) {
                         const newHeld = { ...heldValues };
                         factors.forEach(f => {
                           if (f.id !== activeFactor.id) newHeld[f.id] = run.codedValues[f.id] ?? 0;
                         });
                         setHeldValues(newHeld);
                      }
                    }}
                    className="border border-[#C0C0C0] rounded-sm px-2 py-1 focus:outline-none focus:border-[#0055A4]"
                  >
                    <option value="">-- Select Run --</option>
                    {(design.runs || []).map((r: any) => (
                      <option key={r.id} value={r.id}>Run {r.order || r.id}</option>
                    ))}
                  </select>
                </div>

                {activeGraph !== 'Pred. vs Actual' && (
                  <div className="flex flex-col gap-1 mb-2">
                    <span className="font-semibold text-[#003366]">Term:</span>
                    <select
                      value={activeFactor.id}
                      onChange={e => setSelectedFactorId(e.target.value)}
                      className="border border-[#C0C0C0] rounded-sm px-2 py-1 focus:outline-none focus:border-[#0055A4]"
                    >
                      {factors.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {activeGraph !== 'Pred. vs Actual' && factors.filter(f => f.id !== activeFactor.id).map(f => (
                  <div key={f.id} className="flex flex-col gap-1 mb-2">
                    <span className="font-semibold text-[#003366]">{f.name}:{f.name}</span>
                    <input 
                      type="range" 
                      min={-1} 
                      max={1} 
                      step={0.01} 
                      value={heldValues[f.id] ?? 0}
                      onChange={e => setHeldValues({...heldValues, [f.id]: parseFloat(e.target.value)})}
                      className="w-full accent-[#0055A4]"
                    />
                    <div className="flex items-center justify-between text-[11px]">
                       <span className="text-gray-600">Factor value:</span>
                       <span className="font-mono bg-[#FAFAFA] border border-[#EAEAEA] px-1 py-0.5 rounded-sm">
                         {getXValUI(f, heldValues[f.id] ?? 0).toFixed(3)}
                       </span>
                    </div>
                  </div>
                ))}
              </>
            )}

            {['Interaction', 'Contour', '3D Surface'].includes(activeGraph) && (
              <>
                 <div className="flex flex-col gap-1 mb-2">
                  <span className="font-semibold text-[#003366]">Jump to run:</span>
                  <select 
                    value={selectedRunId}
                    onChange={e => {
                      const runId = e.target.value;
                      setSelectedRunId(runId);
                      const run = (design.runs || []).find((r: any) => String(r.id) === runId);
                      if (run && run.codedValues) {
                         const newHeld = { ...heldValues };
                         factors.forEach(f => {
                           if (f.id !== activeFactor.id && f.id !== activeFactor2?.id) newHeld[f.id] = run.codedValues[f.id] ?? 0;
                         });
                         setHeldValues(newHeld);
                      }
                    }}
                    className="border border-[#C0C0C0] rounded-sm px-2 py-1 focus:outline-none focus:border-[#0055A4]"
                  >
                    <option value="">-- Select Run --</option>
                    {(design.runs || []).map((r: any) => (
                      <option key={r.id} value={r.id}>Run {r.order || r.id}</option>
                    ))}
                  </select>
                </div>

                 <div className="flex flex-col gap-1">
                   <span className="font-semibold text-[#003366]">Factor X</span>
                   <select
                     value={activeFactor.id}
                     onChange={e => setSelectedFactorId(e.target.value)}
                     className="border border-[#C0C0C0] rounded-sm px-2 py-1 focus:outline-none focus:border-[#0055A4]"
                   >
                     {factors.map(f => (
                       <option key={f.id} value={f.id}>{f.name}</option>
                     ))}
                   </select>
                 </div>
                 {factors.length >= 2 && (
                   <div className="flex flex-col gap-1 mt-2 mb-2">
                     <span className="font-semibold text-[#003366]">Factor Y</span>
                     <select
                       value={activeFactor2!.id}
                       onChange={e => setSelectedFactor2Id(e.target.value)}
                       className="border border-[#C0C0C0] rounded-sm px-2 py-1 focus:outline-none focus:border-[#0055A4]"
                     >
                       {factors.map(f => (
                         <option key={f.id} value={f.id} disabled={f.id === activeFactor.id}>{f.name}</option>
                       ))}
                     </select>
                   </div>
                 )}

                 {factors.filter(f => f.id !== activeFactor.id && f.id !== activeFactor2?.id).map(f => (
                  <div key={f.id} className="flex flex-col gap-1 mb-2">
                    <span className="font-semibold text-[#003366]">{f.name}:{f.name}</span>
                    <input 
                      type="range" 
                      min={-1} 
                      max={1} 
                      step={0.01} 
                      value={heldValues[f.id] ?? 0}
                      onChange={e => setHeldValues({...heldValues, [f.id]: parseFloat(e.target.value)})}
                      className="w-full accent-[#0055A4]"
                    />
                    <div className="flex items-center justify-between text-[11px]">
                       <span className="text-gray-600">Factor value:</span>
                       <span className="font-mono bg-[#FAFAFA] border border-[#EAEAEA] px-1 py-0.5 rounded-sm">
                         {getXValUI(f, heldValues[f.id] ?? 0).toFixed(3)}
                       </span>
                    </div>
                  </div>
                ))}
              </>
            )}
            
            {/* Legend info */}
            <div className="flex flex-col gap-1 mt-4 pt-4 border-t border-[#EAEAEA]">
              {activeGraph === 'Perturbation' ? (
                <>
                  <div className="flex items-center gap-2 text-[11px] font-bold text-[#003366] mb-1">
                    <span>Factors:</span>
                  </div>
                  {multiCurveData.map(curve => (
                    <div key={curve.id} className="flex items-center gap-2 text-[11px]">
                      <div className="w-3 h-[2.5px]" style={{ backgroundColor: curve.color }}></div>
                      <span>{curve.name}</span>
                    </div>
                  ))}
                </>
              ) : activeGraph === 'One Factor' ? (
                <>
                  <div className="flex items-center gap-2 text-[11px]">
                    <div className="w-3 h-[2.5px] bg-[#0055A4]"></div>
                    <span>Prediction Curve</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#333333] border border-white"></div>
                    <span>Design Points</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-[11px] font-bold text-[#003366] mb-1">
                    <span>{activeFactor2?.name} Levels:</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <div className="w-3 h-[2.5px] bg-[#B30000]"></div>
                    <span>High</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <div className="w-3 h-[2.5px] bg-[#4B8B3B]"></div>
                    <span>Center</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <div className="w-3 h-[2.5px] bg-[#0055A4]"></div>
                    <span>Low</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] mt-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#333333] border border-white"></div>
                    <span>Design Points</span>
                  </div>
                </>
              )}
            </div>
            
            {/* Interpretation */}
            {activeGraph === 'Interaction' && (
              <div className="flex flex-col gap-1 mt-auto pt-4 border-t border-[#EAEAEA] text-[11px]">
                <span className="font-bold text-[#003366]">Interaction Interpretation</span>
                <ul className="list-disc pl-4 text-gray-700 space-y-1 mt-1">
                  <li><span className="font-medium text-gray-900">Parallel lines:</span> Weaker interaction.</li>
                  <li><span className="font-medium text-gray-900">Non-parallel:</span> Interaction may be present.</li>
                  <li><span className="font-medium text-gray-900">Crossing lines:</span> Strong interaction.</li>
                </ul>
              </div>
            )}
            
          </div>
        </div>

      </div>
    </div>
  );
}
