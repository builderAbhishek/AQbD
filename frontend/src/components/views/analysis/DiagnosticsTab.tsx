import { useState, useMemo } from 'react';
import { RSMAnalysis, ObservationDiagnostic } from '../../../lib/statistics/rsm/types';
import { ScatterPlot, Point } from '../../shared/ScatterPlot';
import { inverseNormalCDF } from '../../../lib/statistics/rsm/diagnostics';

interface DiagnosticsTabProps {
  analysis: RSMAnalysis;
  responseName: string;
}

type DiagView = 'normal' | 'residual-predicted' | 'predicted-actual';

export function DiagnosticsTab({ analysis, responseName }: DiagnosticsTabProps) {
  const [view, setView] = useState<DiagView>('normal');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const diagnostics = analysis?.diagnostics || [];
  const fittedModel = analysis?.fittedModel || analysis?.fitted;

  if (!analysis || !fittedModel || diagnostics.length === 0) {
    return (
      <div className="max-w-xl p-8 bg-white border border-[#C0C0C0] shadow-sm text-center my-6 mx-auto font-sans">
        <h2 className="text-base font-bold text-[#003366] mb-2">Diagnostics</h2>
        <p className="text-gray-600 text-sm mb-1">No diagnostic data is available.</p>
        <p className="text-gray-500 text-xs">Run Start Analysis to generate the diagnostics.</p>
      </div>
    );
  }

  // Prepare Normal Probability Data
  const normalData = useMemo(() => {
    const sorted = [...diagnostics].sort((a, b) => a.residual - b.residual);
    const n = sorted.length;
    return sorted.map((d: any, i: number) => {
      const p = (i + 0.5) / n;
      const z = inverseNormalCDF(p);
      return {
        id: d.runId || `${d.standardOrder}-${d.runOrder}`,
        x: z,
        y: d.residual,
        data: d
      };
    });
  }, [diagnostics]);

  // Calculate regression line for normal plot
  const normalRefLine = useMemo(() => {
    if (normalData.length === 0) return undefined;
    const n = normalData.length;
    const sumX = normalData.reduce((acc, d) => acc + d.x, 0);
    const sumY = normalData.reduce((acc, d) => acc + d.y, 0);
    const sumXY = normalData.reduce((acc, d) => acc + d.x * d.y, 0);
    const sumX2 = normalData.reduce((acc, d) => acc + d.x * d.x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return { type: 'regression' as const, slope, intercept };
  }, [normalData]);

  const resVsPredData = useMemo(() => {
    return diagnostics.map((d: any) => ({
      id: d.runId || `${d.standardOrder}-${d.runOrder}`,
      x: d.predicted,
      y: d.residual,
      data: d
    }));
  }, [diagnostics]);

  const predVsActualData = useMemo(() => {
    return diagnostics.map((d: any) => ({
      id: d.runId || `${d.standardOrder}-${d.runOrder}`,
      x: d.observed,
      y: d.predicted,
      data: d
    }));
  }, [diagnostics]);

  const renderTooltip = (point: Point) => {
    const d = point.data as ObservationDiagnostic;
    return (
      <div className="flex flex-col gap-0.5 w-32 font-sans text-[11px]">
        <div className="font-bold border-b border-[#C0C0C0] pb-1 mb-1 text-[#003366]">
          Std: {d.standardOrder} | Run: {d.runOrder}
        </div>
        <div className="flex justify-between"><span>Observed:</span><span className="font-mono">{d.observed.toFixed(3)}</span></div>
        <div className="flex justify-between"><span>Predicted:</span><span className="font-mono">{d.predicted.toFixed(3)}</span></div>
        <div className="flex justify-between font-bold text-[#B30000] mt-1"><span>Residual:</span><span className="font-mono">{d.residual.toFixed(3)}</span></div>
      </div>
    );
  };

  const activeTabClass = "px-4 py-1.5 text-[11px] font-bold border-b-2 border-[#0055A4] text-[#003366] bg-white";
  const inactiveTabClass = "px-4 py-1.5 text-[11px] font-medium border-b-2 border-transparent text-gray-700 hover:text-gray-900 hover:bg-[#F5F5F5] transition-colors";

  return (
    <div className="flex flex-col h-full bg-[#FAFAFA] font-sans">
      
      <div className="p-2 border-b border-[#D0D0D0] bg-[#EAEAEA] flex gap-6 text-[11px] shadow-sm">
        <div><span className="text-gray-600 font-semibold">Response:</span> <span className="font-bold text-[#003366]">{responseName}</span></div>
        <div><span className="text-gray-600 font-semibold">Model:</span> <span className="font-bold text-[#003366]">{fittedModel.modelType}</span></div>
        <div><span className="text-gray-600 font-semibold">N:</span> <span className="font-mono">{fittedModel.n}</span></div>
        <div><span className="text-gray-600 font-semibold">RMSE:</span> <span className="font-mono">{fittedModel.rmse?.toFixed(4) || 'N/A'}</span></div>
        <div><span className="text-gray-600 font-semibold">R²:</span> <span className="font-mono">{fittedModel.R2 ? (fittedModel.R2 * 100).toFixed(2) + '%' : 'N/A'}</span></div>
      </div>

      <div className="flex border-b border-[#C0C0C0] bg-[#EAEAEA] select-none">
        <button
          className={view === 'normal' ? activeTabClass : inactiveTabClass}
          onClick={() => setView('normal')}
        >
          Normal Probability
        </button>
        <button
          className={view === 'residual-predicted' ? activeTabClass : inactiveTabClass}
          onClick={() => setView('residual-predicted')}
        >
          Residuals vs Predicted
        </button>
        <button
          className={view === 'predicted-actual' ? activeTabClass : inactiveTabClass}
          onClick={() => setView('predicted-actual')}
        >
          Predicted vs Actual
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        
        <div className="flex-1 flex flex-col bg-white border border-[#909090] shadow-sm">
          {view === 'normal' && (
            <div className="flex-1 flex flex-col p-2">
              <div className="flex-1 min-h-[300px]">
                <ScatterPlot 
                  data={normalData} 
                  xLabel="Theoretical Normal Quantile" 
                  yLabel="Residual" 
                  title={`Normal Probability Plot of Residuals — ${responseName}`}
                  referenceLine={normalRefLine}
                  renderTooltip={renderTooltip}
                />
              </div>
              <div className="mt-2 p-2 bg-[#E5F3FF] text-[#003366] text-[11px] border border-[#B3D9FF] shadow-sm">
                <strong className="mr-1">Interpretation:</strong> The Normal Probability plot is used to assess whether residuals are approximately normally distributed. Points should roughly follow the straight reference line.
              </div>
            </div>
          )}

          {view === 'residual-predicted' && (
            <div className="flex-1 flex flex-col p-2">
              <div className="flex-1 min-h-[300px]">
                <ScatterPlot 
                  data={resVsPredData} 
                  xLabel={`Predicted ${responseName}`}
                  yLabel="Residual" 
                  title={`Residuals vs Predicted — ${responseName}`}
                  referenceLine={{ type: 'horizontal', value: 0 }}
                  renderTooltip={renderTooltip}
                />
              </div>
              <div className="mt-2 p-2 bg-[#E5F3FF] text-[#003366] text-[11px] border border-[#B3D9FF] shadow-sm">
                <strong className="mr-1">Interpretation:</strong> Residual patterns can indicate non-linearity, non-constant variance, or unusual observations. Random scatter around the zero line is generally desirable.
              </div>
            </div>
          )}

          {view === 'predicted-actual' && (
            <div className="flex-1 flex flex-col p-2">
              <div className="flex-1 min-h-[300px]">
                <ScatterPlot 
                  data={predVsActualData} 
                  xLabel={`Actual ${responseName}`}
                  yLabel={`Predicted ${responseName}`}
                  title={`Predicted vs Actual — ${responseName}`}
                  referenceLine={{ type: 'identity' }}
                  renderTooltip={renderTooltip}
                />
              </div>
              <div className="mt-2 p-2 bg-[#E5F3FF] text-[#003366] text-[11px] border border-[#B3D9FF] shadow-sm">
                <strong className="mr-1">Interpretation:</strong> Points closer to the identity line indicate closer agreement between predicted and observed experimental values.
              </div>
            </div>
          )}
        </div>

        <div className="w-80 flex flex-col border border-[#909090] bg-white shadow-sm overflow-hidden shrink-0">
          <div className="bg-[#003366] px-3 py-1 text-[11px] font-bold text-white">
            Observation Diagnostics
          </div>
          <div className="flex-1 overflow-auto">
            <table className="min-w-full text-[11px] text-left divide-y divide-[#C0C0C0]">
              <thead className="bg-[#EFEFEF] sticky top-0 z-10 shadow-sm border-b border-[#C0C0C0]">
                <tr>
                  <th className="px-2 py-1.5 text-gray-800 font-semibold w-12">Std</th>
                  <th className="px-2 py-1.5 text-right text-gray-800 font-semibold">Obs</th>
                  <th className="px-2 py-1.5 text-right text-gray-800 font-semibold">Pred</th>
                  <th className="px-2 py-1.5 text-right text-gray-800 font-semibold">Res</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEAEA]">
                {diagnostics.map((d: any, i: number) => (
                  <tr 
                    key={i} 
                    className={`hover:bg-[#F0F8FF] cursor-pointer ${selectedRunId === d.runId ? 'bg-[#CCE8FF] font-medium' : ''}`}
                    onClick={() => setSelectedRunId(d.runId)}
                  >
                    <td className="px-2 py-1 text-gray-900">{d.standardOrder}</td>
                    <td className="px-2 py-1 text-right font-mono text-gray-700">{d.observed.toFixed(2)}</td>
                    <td className="px-2 py-1 text-right font-mono text-gray-700">{d.predicted.toFixed(2)}</td>
                    <td className="px-2 py-1 text-right font-mono">
                      <span className={d.residual > 0 ? 'text-[#0055A4]' : 'text-[#B30000]'}>
                        {d.residual > 0 ? '+' : ''}{d.residual.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
