import { RSMAnalysis } from '../../../lib/statistics/rsm';

export default function ModelStatistics({ analysis }: { analysis?: RSMAnalysis }) {
  if (!analysis) {
    return <div className="text-gray-500 italic">No model fitted. Please use Model Selection first.</div>;
  }

  const { fittedModel } = analysis;
  const fmt = (num: number | null, dec = 4) => num === null ? 'N/A' : num.toFixed(dec);

  return (
    <div className="max-w-xl">
      <h2 className="text-lg font-semibold text-gray-800 mb-4 border-b border-gray-300 pb-2">Model Statistics</h2>
      
      <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
        <div className="flex justify-between border-b border-gray-100 py-1">
          <span className="text-gray-600">R²</span>
          <span className="font-semibold">{fmt(fittedModel.R2)}</span>
        </div>
        <div className="flex justify-between border-b border-gray-100 py-1">
          <span className="text-gray-600">Mean Response</span>
          <span className="font-semibold">{fmt(fittedModel.mean)}</span>
        </div>

        <div className="flex justify-between border-b border-gray-100 py-1">
          <span className="text-gray-600">Adjusted R²</span>
          <span className="font-semibold">{fmt(fittedModel.adjR2)}</span>
        </div>
        <div className="flex justify-between border-b border-gray-100 py-1">
          <span className="text-gray-600">Std. Dev. (RMSE)</span>
          <span className="font-semibold">{fmt(fittedModel.rmse)}</span>
        </div>

        <div className="flex justify-between border-b border-gray-100 py-1">
          <span className="text-gray-600">Predicted R²</span>
          <span className="font-semibold">{fmt(fittedModel.predR2)}</span>
        </div>
        <div className="flex justify-between border-b border-gray-100 py-1">
          <span className="text-gray-600">%CV</span>
          <span className="font-semibold">{fmt(fittedModel.cv, 2)}%</span>
        </div>

        <div className="flex justify-between border-b border-gray-100 py-1">
          <span className="text-gray-600">Adeq Precision</span>
          <span className="font-semibold">{fmt(fittedModel.adequatePrecision)}</span>
        </div>
        <div className="flex justify-between border-b border-gray-100 py-1">
          <span className="text-gray-600">PRESS</span>
          <span className="font-semibold">{fmt(fittedModel.press)}</span>
        </div>

        <div className="flex justify-between border-b border-gray-100 py-1 mt-4">
          <span className="text-gray-600">SST</span>
          <span className="font-semibold">{fmt(fittedModel.SST)}</span>
        </div>
        <div className="flex justify-between border-b border-gray-100 py-1 mt-4">
          <span className="text-gray-600">Runs</span>
          <span className="font-semibold">{fittedModel.n}</span>
        </div>

        <div className="flex justify-between border-b border-gray-100 py-1">
          <span className="text-gray-600">SSR (Model)</span>
          <span className="font-semibold">{fmt(fittedModel.SSR)}</span>
        </div>
        <div className="flex justify-between border-b border-gray-100 py-1">
          <span className="text-gray-600">Terms</span>
          <span className="font-semibold">{fittedModel.p}</span>
        </div>

        <div className="flex justify-between border-b border-gray-100 py-1">
          <span className="text-gray-600">SSE (Residual)</span>
          <span className="font-semibold">{fmt(fittedModel.SSE)}</span>
        </div>
      </div>
    </div>
  );
}
