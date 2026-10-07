import { useState, useMemo } from 'react';
import { RSMAnalysis, ObservationDiagnostic } from '../../../lib/statistics/rsm/types';
import { ScatterPlot, Point } from '../../shared/ScatterPlot';

interface DiagnosticsTabProps {
  analysis: RSMAnalysis;
  responseName: string;
}

type DiagView = 'residual-predicted' | 'predicted-actual';

function interpolateColor(val: number, min: number, max: number) {
  if (max === min) return '#0055A4';
  const pct = Math.max(0, Math.min(1, (val - min) / (max - min)));
  
  const colors = [
    { pct: 0, r: 0, g: 85, b: 164 },       // Blue
    { pct: 0.5, r: 153, g: 204, b: 51 },   // Green/Yellow
    { pct: 1, r: 179, g: 0, b: 0 }         // Red
  ];
  
  let i = 0;
  while (i < colors.length - 1 && pct >= colors[i+1].pct) {
    i++;
  }
  if (i === colors.length - 1) i--;
  
  const c1 = colors[i];
  const c2 = colors[i+1];
  const range = c2.pct - c1.pct;
  const t = (pct - c1.pct) / range;
  
  const r = Math.round(c1.r + t * (c2.r - c1.r));
  const g = Math.round(c1.g + t * (c2.g - c1.g));
  const b = Math.round(c1.b + t * (c2.b - c1.b));
  
  return `rgb(${r},${g},${b})`;
}

export function DiagnosticsTab({ analysis, responseName }: DiagnosticsTabProps) {
  const [view, setView] = useState<DiagView>('residual-predicted');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const diagnostics = analysis?.diagnostics || [];
  const fittedModel = analysis?.fittedModel || analysis?.fitted;

  // 9. MATHEMATICAL VALIDATION
  const isDataValid = useMemo(() => {
    if (!fittedModel || !diagnostics || diagnostics.length === 0) return false;
    
    // Check if lengths match
    if (diagnostics.length !== fittedModel.n) return false;

    // Check if Residual = Actual - Predicted and values are finite
    for (const d of diagnostics) {
      if (!Number.isFinite(d.observed) || !Number.isFinite(d.predicted) || !Number.isFinite(d.residual)) {
        return false;
      }
      const calculatedResidual = d.observed - d.predicted;
      // Allow small floating point difference
      if (Math.abs(calculatedResidual - d.residual) > 1e-5) {
        return false;
      }
    }
    return true;
  }, [diagnostics, fittedModel]);

  if (!analysis || !fittedModel || diagnostics.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-[#FAFAFA] font-sans">
        <div className="bg-white border border-[#C0C0C0] shadow-sm p-6 text-center max-w-md">
          <h2 className="text-[13px] font-bold text-[#003366] mb-2">Diagnostics Unavailable</h2>
          <p className="text-gray-700 text-[12px]">Run Start Analysis before viewing diagnostics.</p>
        </div>
      </div>
    );
  }

  if (!isDataValid) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-[#FAFAFA] font-sans">
        <div className="bg-white border border-[#B30000] shadow-sm p-6 text-center max-w-md">
          <h2 className="text-[13px] font-bold text-[#B30000] mb-2">Validation Error</h2>
          <p className="text-gray-700 text-[12px]">Diagnostics unavailable: the fitted analysis contains invalid or incomplete observation data.</p>
        </div>
      </div>
    );
  }

  // 5. COLOR BY RESPONSE
  const observedValues = diagnostics.map(d => d.observed);
  const minObserved = Math.min(...observedValues);
  const maxObserved = Math.max(...observedValues);

  const resVsPredData = useMemo(() => {
    return diagnostics.map((d: any) => ({
      id: d.runId || `${d.standardOrder}-${d.runOrder}`,
      x: d.predicted,
      y: d.residual,
      color: interpolateColor(d.observed, minObserved, maxObserved),
      data: d
    }));
  }, [diagnostics, minObserved, maxObserved]);

  const predVsActualData = useMemo(() => {
    return diagnostics.map((d: any) => ({
      id: d.runId || `${d.standardOrder}-${d.runOrder}`,
      x: d.observed,
      y: d.predicted,
      color: interpolateColor(d.observed, minObserved, maxObserved),
      data: d
    }));
  }, [diagnostics, minObserved, maxObserved]);

  // 6. POINT LABELS / TOOLTIP
  const renderTooltip = (point: Point) => {
    const d = point.data as ObservationDiagnostic;
    return (
      <div className="flex flex-col gap-0.5 w-32 font-sans text-[11px] select-none">
        <div className="font-bold border-b border-[#C0C0C0] pb-1 mb-1 text-[#003366]">
          Std: {d.standardOrder} | Run: {d.runOrder}
        </div>
        <div className="flex justify-between"><span>Actual:</span><span className="font-mono">{d.observed.toFixed(4)}</span></div>
        <div className="flex justify-between"><span>Predicted:</span><span className="font-mono">{d.predicted.toFixed(4)}</span></div>
        <div className="flex justify-between font-bold text-[#B30000] mt-1"><span>Residual:</span><span className="font-mono">{d.residual.toFixed(4)}</span></div>
      </div>
    );
  };

  const activeTabClass = "px-4 py-1.5 text-[11px] font-bold border-t-2 border-t-[#0055A4] border-b-2 border-b-[#FAFAFA] text-[#003366] bg-[#FAFAFA] relative top-[1px]";
  const inactiveTabClass = "px-4 py-1.5 text-[11px] font-medium border-t-2 border-transparent border-b-2 border-b-[#C0C0C0] text-gray-700 hover:text-gray-900 hover:bg-[#F5F5F5] transition-colors";

  return (
    <div className="flex flex-col h-full bg-[#FAFAFA] font-sans">
      
      <div className="flex border-b border-[#C0C0C0] bg-[#EAEAEA] select-none z-10 px-2 pt-1">
        <button
          className={view === 'residual-predicted' ? activeTabClass : inactiveTabClass}
          onClick={() => setView('residual-predicted')}
        >
          Resid. vs. Pred.
        </button>
        <button
          className={view === 'predicted-actual' ? activeTabClass : inactiveTabClass}
          onClick={() => setView('predicted-actual')}
        >
          Pred. vs. Actual
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        
        {/* Left Side: Diagnostics Plot & Legend */}
        <div className="flex-1 flex flex-col bg-white border border-[#909090] shadow-sm min-w-0">
          
          {/* Legend */}
          <div className="bg-[#EFEFEF] border-b border-[#C0C0C0] px-4 py-2 flex items-center justify-between text-[11px] shrink-0">
            <div className="flex items-center gap-4">
              <span className="font-bold text-[#003366]">Response:</span>
              <span className="font-medium text-gray-800">{responseName}</span>
              
              <div className="flex items-center gap-2 ml-4">
                <span className="text-gray-600 tabular-nums">{minObserved.toFixed(2)}</span>
                <div 
                  className="w-32 h-3 border border-gray-400"
                  style={{
                    background: 'linear-gradient(to right, rgb(0,85,164), rgb(153,204,51), rgb(179,0,0))'
                  }}
                />
                <span className="text-gray-600 tabular-nums">{maxObserved.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Plot Area */}
          <div className="flex-1 flex flex-col p-4 overflow-auto min-h-0 items-center justify-center">
            {view === 'residual-predicted' && (
              <ScatterPlot 
                data={resVsPredData} 
                xLabel={`Predicted`}
                yLabel="Residual" 
                title={`Residuals vs Predicted — ${responseName}`}
                referenceLine={{ type: 'horizontal', value: 0 }}
                renderTooltip={renderTooltip}
              />
            )}

            {view === 'predicted-actual' && (
              <ScatterPlot 
                data={predVsActualData} 
                xLabel={`Actual`}
                yLabel={`Predicted`}
                title={`Predicted vs Actual — ${responseName}`}
                referenceLine={{ type: 'identity' }}
                renderTooltip={renderTooltip}
              />
            )}
          </div>
        </div>

        {/* Right Side: Observation Diagnostics Table */}
        <div className="w-80 flex flex-col border border-[#909090] bg-white shadow-sm overflow-hidden shrink-0">
          <div className="bg-[#003366] px-3 py-1.5 text-[11px] font-bold text-white flex justify-between items-center shrink-0">
            <span>Observation Diagnostics</span>
            <span className="font-normal opacity-80 text-[10px]">n = {fittedModel.n}</span>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="min-w-full text-[11px] text-left divide-y divide-[#C0C0C0]">
              <thead className="bg-[#003366] sticky top-0 z-10 shadow-sm border-b border-[#002244]">
                <tr>
                  <th className="px-2 py-1.5 text-white font-semibold w-12 text-center">Run</th>
                  <th className="px-2 py-1.5 text-right text-white font-semibold">Actual</th>
                  <th className="px-2 py-1.5 text-right text-white font-semibold">Predicted</th>
                  <th className="px-2 py-1.5 text-right text-white font-semibold">Residual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEAEA]">
                {diagnostics.map((d: any, i: number) => {
                  const isZero = Math.abs(d.residual) < 1e-4;
                  const resColor = isZero ? 'text-gray-800' : (d.residual > 0 ? 'text-[#008080]' : 'text-[#D9534F]');
                  const resSign = isZero ? '' : (d.residual > 0 ? '+' : '');
                  return (
                    <tr 
                      key={i} 
                      className={`hover:bg-[#F0F8FF] cursor-pointer even:bg-[#F9F9F9] ${selectedRunId === d.runId ? 'bg-[#CCE8FF] font-medium even:bg-[#CCE8FF]' : ''}`}
                      onClick={() => setSelectedRunId(d.runId)}
                    >
                      <td className="px-2 py-1 text-gray-900 text-center">{d.runOrder}</td>
                      <td className="px-2 py-1 text-right font-mono text-gray-700">{d.observed.toFixed(3)}</td>
                      <td className="px-2 py-1 text-right font-mono text-gray-700">{d.predicted.toFixed(3)}</td>
                      <td className="px-2 py-1 text-right font-mono">
                        <span className={resColor}>
                          {resSign}{d.residual.toFixed(3)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
