import { useState } from 'react';
import { RSMAnalysis } from '../../../lib/statistics/rsm/types';

interface ANOVAProps {
  analysis: RSMAnalysis | null;
  responseName?: string;
}

export function ANOVA({ analysis, responseName }: ANOVAProps) {
  const [copiedType, setCopiedType] = useState<string | null>(null);

  const fittedModel = analysis?.fittedModel || analysis?.fitted;
  const anova = analysis?.anova;

  if (!analysis || !fittedModel || !anova) {
    return (
      <div className="max-w-xl p-8 bg-white border border-[#C0C0C0] shadow-sm text-center my-6 mx-auto">
        <h2 className="text-base font-semibold text-[#003366] mb-2">ANOVA</h2>
        <p className="text-gray-600 text-sm mb-1">No fitted analysis is available.</p>
        <p className="text-gray-500 text-xs">Run Start Analysis to generate the model.</p>
      </div>
    );
  }

  const formatNum = (num: number | null | undefined, digits = 4) => {
    if (num === null || num === undefined) return '';
    if (Math.abs(num) < 0.0001 && num !== 0) return num.toExponential(digits);
    return num.toFixed(digits);
  };

  const formatPValue = (num: number | null | undefined) => {
    if (num === null || num === undefined) return '';
    if (num < 0.0001) return '< 0.0001';
    return num.toFixed(4);
  };

  const handleCopy = (text: string, type: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const modelF = fittedModel.fModel;
  const modelP = fittedModel.pModel;
  const isModelSignificant = modelP !== null && modelP < 0.05;

  const lofResult = analysis.lackOfFit;
  const isLofSignificant = lofResult?.available && lofResult.pValue !== null && lofResult.pValue < 0.05;

  const coefficientTable = fittedModel.coefficientTable || [];

  return (
    <div className="max-w-6xl space-y-4 text-sm font-sans select-none">
      {/* Header */}
      <div className="border-b border-[#D0D0D0] pb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-bold text-[#003366]">Analysis of Variance (ANOVA)</h2>
          <div className="text-[11px] text-gray-700 font-medium mt-0.5">
            ANOVA for <span className="font-bold">{fittedModel.modelType}</span> model
            {responseName && <> | Response: <span className="font-bold">{responseName}</span></>}
          </div>
        </div>
        <div className="text-[11px] bg-[#EAEAEA] text-[#303030] px-2.5 py-1 border border-[#C0C0C0] shadow-sm font-medium">
          Factor coding is <span className="text-[#0055A4] font-bold">Coded</span>. Sum of squares is <span className="text-[#0055A4] font-bold">Type III - Partial</span>.
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        
        {/* Left Column: ANOVA Table & Interpretation */}
        <div className="lg:col-span-2 space-y-3">
          
          {/* ANOVA Table Panel */}
          <div className="border border-[#909090] bg-white shadow-sm flex flex-col">
            <div className="bg-[#003366] text-white text-[11px] font-bold px-3 py-1">
              ANOVA Table
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[#C0C0C0] text-[11px]">
                <thead className="bg-[#EFEFEF]">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-semibold text-gray-800">Source</th>
                    <th className="px-3 py-1.5 text-right font-semibold text-gray-800">Sum of Squares</th>
                    <th className="px-3 py-1.5 text-right font-semibold text-gray-800">df</th>
                    <th className="px-3 py-1.5 text-right font-semibold text-gray-800">Mean Square</th>
                    <th className="px-3 py-1.5 text-right font-semibold text-gray-800">F-value</th>
                    <th className="px-3 py-1.5 text-right font-semibold text-gray-800">p-value</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-[#EAEAEA]">
                  {anova.map((row: any, idx: number) => {
                    const isOverallModel = row.source === 'Model';
                    const isTotal = row.source === 'Total' || row.source === 'Cor Total';
                    const isResidual = row.source === 'Residual';
                    const isLOF = row.source === 'Lack of Fit';
                    const isPureError = row.source === 'Pure Error';
                    const isSignificant = row.pValue !== null && row.pValue < 0.05 && !isLOF;

                    const isBoldRow = isOverallModel || isTotal || isResidual || isLOF || isPureError;
                    const rowClass = isBoldRow ? 'font-bold text-[#003366]' : row.isTerm ? 'pl-6 text-gray-800' : 'text-gray-800';

                    return (
                      <tr key={idx} className={`hover:bg-[#F0F8FF] ${isBoldRow ? 'bg-[#FAFAFA]' : ''}`}>
                        <td className={`px-3 py-1 ${row.isTerm ? 'pl-6 text-gray-700' : ''}`}>
                          <span className={rowClass}>{row.source}</span>
                        </td>
                        <td className="px-3 py-1 text-right font-mono tabular-nums text-gray-800">
                          {formatNum(row.ss)}
                        </td>
                        <td className="px-3 py-1 text-right font-mono tabular-nums text-gray-800">
                          {row.df}
                        </td>
                        <td className="px-3 py-1 text-right font-mono tabular-nums text-gray-800">
                          {formatNum(row.ms)}
                        </td>
                        <td className="px-3 py-1 text-right font-mono tabular-nums text-gray-800">
                          {formatNum(row.fValue, 2)}
                        </td>
                        <td className={`px-3 py-1 text-right font-mono tabular-nums ${isSignificant ? 'font-bold text-[#008000]' : isLOF && isSignificant ? 'font-bold text-[#B30000]' : 'text-gray-800'}`}>
                          {formatPValue(row.pValue)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Scientific Interpretation */}
          <div className="border border-[#B3D9FF] bg-[#E5F3FF] p-3 text-[11px] text-[#003366] shadow-sm space-y-1.5">
            <div className="font-bold border-b border-[#B3D9FF] pb-1 mb-1">
              Scientific Interpretation
            </div>
            {modelF !== null && modelP !== null ? (
              <p className="leading-relaxed">
                The Model F-value of <span className="font-bold">{formatNum(modelF, 2)}</span> implies the model is{' '}
                <span className={`font-bold ${isModelSignificant ? 'text-[#008000]' : 'text-[#B30000]'}`}>
                  {isModelSignificant ? 'significant' : 'not significant'}
                </span> (p = {formatPValue(modelP)}).{' '}
                There is only a {(modelP * 100).toFixed(2)}% chance that an F-value this large could occur due to noise.
              </p>
            ) : null}

            {lofResult?.available ? (
              <p className="leading-relaxed">
                The Lack of Fit F-value of <span className="font-bold">{formatNum(lofResult.fValue, 2)}</span> implies the Lack of Fit is{' '}
                <span className={`font-bold ${!isLofSignificant ? 'text-[#008000]' : 'text-[#B30000]'}`}>
                  {!isLofSignificant ? 'not significant' : 'significant'}
                </span> relative to pure error (p = {formatPValue(lofResult.pValue)}).{' '}
                {!isLofSignificant 
                  ? 'Non-significant lack of fit is good; the model fits.' 
                  : 'Significant lack of fit is bad; the model does not fit.'}
              </p>
            ) : (
              <p className="italic text-[#0055A4]">
                {lofResult?.message || 'Lack of Fit cannot be estimated.'}
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Fit Statistics */}
        <div className="space-y-3">
          <div className="border border-[#909090] bg-white shadow-sm flex flex-col">
            <div className="bg-[#003366] text-white text-[11px] font-bold px-3 py-1">
              Fit Statistics
            </div>
            <div className="p-3 space-y-1.5 text-[11px]">
              <div className="flex justify-between items-center border-b border-[#EAEAEA] pb-0.5">
                <span className="text-[#303030] font-semibold">Std. Dev.</span>
                <span className="font-mono text-gray-900">{formatNum(fittedModel.rmse)}</span>
              </div>
              <div className="flex justify-between items-center border-b border-[#EAEAEA] pb-0.5">
                <span className="text-[#303030] font-semibold">Mean</span>
                <span className="font-mono text-gray-900">{formatNum(fittedModel.mean)}</span>
              </div>
              <div className="flex justify-between items-center border-b border-[#D0D0D0] pb-1.5 mb-1.5">
                <span className="text-[#303030] font-semibold">C.V. %</span>
                <span className="font-mono text-gray-900">
                  {fittedModel.cv !== null ? `${fittedModel.cv.toFixed(2)}%` : ''}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-[#EAEAEA] pb-0.5">
                <span className="text-[#303030] font-bold">R²</span>
                <span className="font-mono text-[#0055A4] font-bold">{formatNum(fittedModel.R2)}</span>
              </div>
              <div className="flex justify-between items-center border-b border-[#EAEAEA] pb-0.5">
                <span className="text-[#303030] font-bold">Adjusted R²</span>
                <span className="font-mono text-[#0055A4] font-bold">{formatNum(fittedModel.adjR2)}</span>
              </div>
              <div className="flex justify-between items-center border-b border-[#EAEAEA] pb-0.5">
                <span className="text-[#303030] font-bold">Predicted R²</span>
                <span className="font-mono text-[#0055A4] font-bold">
                  {fittedModel.predR2 !== null ? formatNum(fittedModel.predR2) : ''}
                </span>
              </div>
              <div className="flex justify-between items-center pt-0.5">
                <span className="text-[#303030] font-bold">Adeq Precision</span>
                <span className={`font-mono font-bold ${fittedModel.adequatePrecision !== null && fittedModel.adequatePrecision >= 4 ? 'text-[#008000]' : 'text-[#B30000]'}`}>
                  {fittedModel.adequatePrecision !== null ? fittedModel.adequatePrecision.toFixed(3) : ''}
                </span>
              </div>
            </div>
          </div>
          
          {/* Note on Adeq Precision */}
          {fittedModel.adequatePrecision !== null && (
            <div className={`p-2 text-[10px] shadow-sm border ${fittedModel.adequatePrecision >= 4 ? 'bg-[#EAF5EA] text-[#006600] border-[#99CC99]' : 'bg-[#FFF4CE] text-[#7A5B00] border-[#F2D675]'}`}>
              <span className="font-bold">Adeq Precision</span> measures the signal to noise ratio. A ratio greater than 4 is desirable. 
              {fittedModel.adequatePrecision >= 4 ? ' Your ratio indicates an adequate signal.' : ' Your ratio indicates an inadequate signal.'}
            </div>
          )}
        </div>
      </div>

      {/* Coefficients Table */}
      <div className="border border-[#909090] bg-white shadow-sm flex flex-col mt-4">
        <div className="bg-[#003366] text-white text-[11px] font-bold px-3 py-1 flex justify-between items-center">
          <span>Coefficients in Terms of Coded Factors</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#C0C0C0] text-[11px]">
            <thead className="bg-[#EFEFEF]">
              <tr>
                <th className="px-3 py-1.5 text-left font-semibold text-gray-800">Factor</th>
                <th className="px-3 py-1.5 text-right font-semibold text-gray-800">Coefficient<br/>Estimate</th>
                <th className="px-3 py-1.5 text-right font-semibold text-gray-800">df</th>
                <th className="px-3 py-1.5 text-right font-semibold text-gray-800">Standard<br/>Error</th>
                <th className="px-3 py-1.5 text-right font-semibold text-gray-800">95% CI Low</th>
                <th className="px-3 py-1.5 text-right font-semibold text-gray-800">95% CI High</th>
                <th className="px-3 py-1.5 text-right font-semibold text-gray-800">VIF</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-[#EAEAEA]">
              {coefficientTable.map((row, idx) => (
                <tr key={idx} className="hover:bg-[#F0F8FF]">
                  <td className="px-3 py-1 font-bold text-[#003366]">
                    {row.term}
                  </td>
                  <td className="px-3 py-1 text-right font-mono tabular-nums text-gray-900 font-semibold">
                    {formatNum(row.estimate)}
                  </td>
                  <td className="px-3 py-1 text-right font-mono tabular-nums text-gray-700">
                    {row.df}
                  </td>
                  <td className="px-3 py-1 text-right font-mono tabular-nums text-gray-700">
                    {formatNum(row.standardError)}
                  </td>
                  <td className="px-3 py-1 text-right font-mono tabular-nums text-gray-700">
                    {formatNum(row.ciLow)}
                  </td>
                  <td className="px-3 py-1 text-right font-mono tabular-nums text-gray-700">
                    {formatNum(row.ciHigh)}
                  </td>
                  <td className="px-3 py-1 text-right font-mono tabular-nums text-gray-700">
                    {row.vif !== null ? formatNum(row.vif, 2) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Equations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* Coded */}
        <div className="border border-[#909090] bg-white shadow-sm flex flex-col">
          <div className="bg-[#EAEAEA] border-b border-[#C0C0C0] text-[#003366] text-[11px] font-bold px-3 py-1.5 flex justify-between items-center">
            <span>Final Equation in Terms of Coded Factors</span>
            <button
              onClick={() => handleCopy(fittedModel.codedEquation, 'coded')}
              className="text-[#0055A4] hover:text-[#003366] font-semibold bg-white border border-[#C0C0C0] px-2 py-0.5 shadow-sm text-[10px]"
            >
              {copiedType === 'coded' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="p-3 bg-[#F9F9F9] text-[#303030] font-mono text-[11px] whitespace-pre overflow-x-auto leading-relaxed border-t border-white">
            {fittedModel.codedEquation || 'No equation generated.'}
          </div>
        </div>

        {/* Actual */}
        <div className="border border-[#909090] bg-white shadow-sm flex flex-col">
          <div className="bg-[#EAEAEA] border-b border-[#C0C0C0] text-[#003366] text-[11px] font-bold px-3 py-1.5 flex justify-between items-center">
            <span>Final Equation in Terms of Actual Factors</span>
            <button
              onClick={() => handleCopy(fittedModel.actualEquation || '', 'actual')}
              className="text-[#0055A4] hover:text-[#003366] font-semibold bg-white border border-[#C0C0C0] px-2 py-0.5 shadow-sm text-[10px]"
            >
              {copiedType === 'actual' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="p-3 bg-[#F9F9F9] text-[#303030] font-mono text-[11px] whitespace-pre overflow-x-auto leading-relaxed border-t border-white">
            {fittedModel.actualEquation || 'Actual equation is not available.'}
          </div>
        </div>
      </div>
    </div>
  );
}
