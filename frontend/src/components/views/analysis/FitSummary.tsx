import { RSMAnalysis } from '../../../lib/statistics/rsm/types';

interface FitSummaryProps {
  analysis?: RSMAnalysis | null;
}

export default function FitSummary({ analysis }: FitSummaryProps) {
  if (!analysis || !analysis.fittedModel) {
    return (
      <div className="max-w-xl p-8 bg-white border border-[#C0C0C0] shadow-sm text-center my-6 mx-auto">
        <h2 className="text-base font-semibold text-[#003366] mb-2">Fit Summary</h2>
        <p className="text-gray-600 text-sm mb-1">No fitted analysis is available.</p>
        <p className="text-gray-500 text-xs">Run Start Analysis to generate model comparisons.</p>
      </div>
    );
  }

  const modelComparison = analysis.modelComparison || [];

  const fmt = (num: number | null | undefined, dec = 4) => {
    if (num === null || num === undefined) return '';
    if (Math.abs(num) < 0.0001 && num !== 0) return num.toExponential(dec);
    return num.toFixed(dec);
  };

  const fmtP = (num: number | null | undefined) => {
    if (num === null || num === undefined) return '';
    if (num < 0.0001) return '< 0.0001';
    return num.toFixed(4);
  };

  return (
    <div className="max-w-4xl space-y-4 text-sm font-sans select-none">
      <div className="border-b border-[#D0D0D0] pb-2">
        <h2 className="text-[15px] font-bold text-[#003366] mb-1">Fit Summary</h2>
        <p className="text-[11px] text-gray-700 font-medium">
          Response: {analysis.responseId}
        </p>
      </div>

      <div className="border border-[#909090] bg-white shadow-sm inline-block">
        <table className="divide-y divide-[#C0C0C0] text-[11px] min-w-[550px]">
          <thead className="bg-[#EFEFEF]">
            <tr className="divide-x divide-[#C0C0C0]">
              <th className="px-3 py-1.5 text-center font-semibold text-gray-800 w-32">Source</th>
              <th className="px-3 py-1.5 text-center font-semibold text-gray-800 w-24">Sequential<br/>p-value</th>
              <th className="px-3 py-1.5 text-center font-semibold text-gray-800 w-24">Lack of Fit<br/>p-value</th>
              <th className="px-3 py-1.5 text-center font-semibold text-gray-800 w-20">Adjusted<br/>R²</th>
              <th className="px-3 py-1.5 text-center font-semibold text-gray-800 w-20">Predicted<br/>R²</th>
              <th className="px-3 py-1.5 text-center font-bold text-gray-800 w-24 bg-[#E0E0E0]"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[#E0E0E0]">
            {modelComparison.map((row) => {
              const isSuggested = row.suggested;
              const isAliased = row.status === 'Aliased';
              const isSignificantSeq = row.sequentialPValue !== null && row.sequentialPValue < 0.05;
              const isLofSignificant = row.lackOfFitPValue !== null && row.lackOfFitPValue < 0.05;

              return (
                <tr key={row.modelType} className={`divide-x divide-[#E0E0E0] cursor-default ${isSuggested ? 'bg-[#F4F9FF]' : 'hover:bg-[#F9F9F9]'}`}>
                  <td className="px-3 py-1 text-right text-[#003366] pr-4 font-semibold">
                    {row.modelType}
                  </td>
                  <td className={`px-3 py-1 text-right font-mono tabular-nums ${isSignificantSeq ? 'text-[#0055A4] font-bold' : 'text-gray-800'}`}>
                    {fmtP(row.sequentialPValue)}
                  </td>
                  <td className={`px-3 py-1 text-right font-mono tabular-nums ${isLofSignificant ? 'text-[#B30000] font-bold' : 'text-gray-800'}`}>
                    {fmtP(row.lackOfFitPValue)}
                  </td>
                  <td className="px-3 py-1 text-right font-mono tabular-nums text-gray-800">
                    {fmt(row.adjR2)}
                  </td>
                  <td className="px-3 py-1 text-right font-mono tabular-nums text-gray-800">
                    {fmt(row.predR2)}
                  </td>
                  <td className="px-3 py-1 text-left font-bold pl-4">
                    {isSuggested ? (
                      <span className="text-[#0055A4]">Suggested</span>
                    ) : isAliased ? (
                      <span className="text-[#B30000]">Aliased</span>
                    ) : (
                      <span></span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-[#E5F3FF] border border-[#B3D9FF] p-2.5 text-[11px] text-[#003366] inline-block mt-2 shadow-sm">
        <span className="font-bold mr-1">Note:</span>
        Select the highest order polynomial where the additional terms are significant and the model is not aliased.
      </div>
    </div>
  );
}
