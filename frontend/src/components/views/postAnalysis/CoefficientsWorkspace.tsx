import { useState, useMemo, useEffect } from 'react';
import { useProject } from '../../../context/ProjectContext';
import { extractCoefficientsDetail } from '../../../lib/statistics/prediction';
import { ensureAllResponseModelsCurrent } from '../../../lib/statistics/rsm/modelFitting';
import { 
  FileSpreadsheet, 
  Copy, 
  Check, 
  Table, 
  Code2
} from 'lucide-react';

export function CoefficientsWorkspace() {
  const { project, activeDesignId } = useProject();
  const design = activeDesignId && project?.data?.designs ? project.data.designs[activeDesignId] : null;

  const rawFactors = useMemo(() => design?.config?.factors || [], [design?.config?.factors]);
  const rawResponses = useMemo(() => design?.config?.responses || [], [design?.config?.responses]);

  // Selected response
  const [selectedResponseId, setSelectedResponseId] = useState<string>(() => rawResponses[0]?.id || '');
  const [equationMode, setEquationMode] = useState<'coded' | 'actual'>('coded');
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedEq, setCopiedEq] = useState<boolean>(false);

  useEffect(() => {
    if (rawResponses.length > 0 && (!selectedResponseId || !rawResponses.find((r: any) => r.id === selectedResponseId))) {
      setSelectedResponseId(rawResponses[0].id);
    }
  }, [rawResponses, selectedResponseId]);

  // Ensure response models are current
  const { analyses } = useMemo(() => {
    let currentAnalyses = design?.analyses || {};
    if (design) {
      try {
        const criteria = design.optimization?.criteria || {};
        const { updatedAnalyses, didRefit } = ensureAllResponseModelsCurrent(design, criteria);
        if (didRefit) {
          currentAnalyses = updatedAnalyses;
        }
      } catch (e) {
        console.warn('Auto-refit check in Coefficients:', e);
      }
    }
    return { analyses: currentAnalyses };
  }, [design]);

  const activeResponse = rawResponses.find((r: any) => r.id === selectedResponseId) || rawResponses[0];
  const activeAnalysis = analyses[selectedResponseId] || (activeResponse ? analyses[activeResponse.id] : null);

  const coeffDetail = useMemo(() => {
    return extractCoefficientsDetail(activeAnalysis, rawFactors, activeResponse?.name);
  }, [activeAnalysis, rawFactors, activeResponse]);

  const handleCopyTable = () => {
    let tsv = 'Term\tType\tEstimate\tdf\tStd Error\tt-Value\tp-Value\t95% CI Low\t95% CI High\tVIF\n';
    for (const c of coeffDetail.coefficients) {
      const se = c.standardError !== null ? c.standardError.toFixed(4) : '';
      const t = c.tValue !== null ? c.tValue.toFixed(3) : '';
      const p = c.pValue !== null ? (c.pValue < 0.0001 ? '<0.0001' : c.pValue.toFixed(4)) : '';
      const low = c.ciLow !== null ? c.ciLow.toFixed(4) : '';
      const high = c.ciHigh !== null ? c.ciHigh.toFixed(4) : '';
      const vif = c.vif !== null ? c.vif.toFixed(2) : '-';
      tsv += `${c.termName}\t${c.termType}\t${c.estimateCoded.toFixed(4)}\t${c.df}\t${se}\t${t}\t${p}\t${low}\t${high}\t${vif}\n`;
    }
    navigator.clipboard.writeText(tsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyEquation = () => {
    const eq = equationMode === 'coded' ? coeffDetail.codedEquation : (coeffDetail.actualEquation || coeffDetail.codedEquation);
    navigator.clipboard.writeText(eq);
    setCopiedEq(true);
    setTimeout(() => setCopiedEq(false), 2000);
  };

  if (!design) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white text-gray-400 font-sans">
        <p className="font-semibold text-gray-500 mb-1">No Active Design Selected</p>
        <p className="text-xs text-gray-400">Select an experimental design from the Project Tree to view Coefficients Table.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAFAFA] font-sans overflow-y-auto p-4 select-none">
      {/* Top Header */}
      <div className="bg-white border border-[#C0C0C0] p-4 shadow-xs rounded-xs mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#0055A4]/10 border border-[#0055A4]/30 text-[#0055A4] flex items-center justify-center font-bold text-sm rounded-xs">
            <FileSpreadsheet size={18} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#003366]">Coefficients Table (Post Analysis)</h1>
            <p className="text-[11px] text-gray-500">
              Regression coefficients, standard errors, Student t-tests, 95% confidence intervals, and Variance Inflation Factors (VIF)
            </p>
          </div>
        </div>

        {/* Response Selector & Actions */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-gray-700">Response:</span>
            <select
              value={selectedResponseId}
              onChange={(e) => setSelectedResponseId(e.target.value)}
              className="px-2.5 py-1 bg-white border border-[#C0C0C0] font-bold text-[#003366] rounded-xs outline-none focus:border-[#0055A4]"
            >
              {rawResponses.map((r: any) => (
                <option key={r.id} value={r.id}>
                  {r.name} {analyses[r.id] ? '(Fitted)' : '(No Model)'}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleCopyTable}
            className="px-2.5 py-1 bg-white hover:bg-gray-50 border border-[#C0C0C0] text-gray-700 font-semibold rounded-xs shadow-xs flex items-center gap-1"
          >
            {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy Table'}
          </button>
        </div>
      </div>

      {/* Model Metrics Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5 mb-4">
        <div className="bg-white border border-[#C0C0C0] p-2.5 rounded-xs shadow-xs">
          <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Model Type</div>
          <div className="text-sm font-bold text-[#003366] font-mono mt-0.5">{coeffDetail.modelType}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">df_error: {coeffDetail.dfError}</div>
        </div>

        <div className="bg-white border border-[#C0C0C0] p-2.5 rounded-xs shadow-xs">
          <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">R²</div>
          <div className="text-sm font-bold text-gray-900 font-mono mt-0.5">
            {coeffDetail.r2 !== null ? coeffDetail.r2.toFixed(4) : '—'}
          </div>
          <div className="text-[10px] text-green-700 font-semibold mt-0.5">
            {coeffDetail.r2 !== null && coeffDetail.r2 > 0.95 ? 'Excellent fit' : ''}
          </div>
        </div>

        <div className="bg-white border border-[#C0C0C0] p-2.5 rounded-xs shadow-xs">
          <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Adjusted R²</div>
          <div className="text-sm font-bold text-gray-900 font-mono mt-0.5">
            {coeffDetail.adjR2 !== null ? coeffDetail.adjR2.toFixed(4) : '—'}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">Penalized for terms</div>
        </div>

        <div className="bg-white border border-[#C0C0C0] p-2.5 rounded-xs shadow-xs">
          <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Predicted R²</div>
          <div className="text-sm font-bold text-gray-900 font-mono mt-0.5">
            {coeffDetail.predR2 !== null ? coeffDetail.predR2.toFixed(4) : '—'}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">Leave-one-out PRESS</div>
        </div>

        <div className="bg-white border border-[#C0C0C0] p-2.5 rounded-xs shadow-xs">
          <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Residual Std Dev</div>
          <div className="text-sm font-bold text-gray-900 font-mono mt-0.5">
            {coeffDetail.rmse !== null ? coeffDetail.rmse.toFixed(4) : (coeffDetail.msError ? Math.sqrt(coeffDetail.msError).toFixed(4) : '—')}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">√MS_Residual</div>
        </div>

        <div className="bg-white border border-[#C0C0C0] p-2.5 rounded-xs shadow-xs">
          <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Model Significance</div>
          <div className="text-sm font-bold text-[#008000] font-mono mt-0.5">
            {coeffDetail.pModel !== null ? (coeffDetail.pModel < 0.0001 ? 'p < 0.0001' : `p = ${coeffDetail.pModel.toFixed(4)}`) : '—'}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            {coeffDetail.fModel !== null ? `F = ${coeffDetail.fModel.toFixed(2)}` : ''}
          </div>
        </div>
      </div>

      {/* Main Coefficients Table */}
      <div className="bg-white border border-[#C0C0C0] shadow-xs rounded-xs overflow-hidden mb-4">
        <div className="bg-[#003366] text-white px-3.5 py-2 text-xs font-bold flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Table size={14} />
            Coefficients in Terms of Coded Factors ({activeResponse?.name})
          </span>
          <span className="text-[11px] font-normal text-blue-100">
            Factor Coding: <span className="font-semibold text-white">[-1, +1]</span> · Sum of Squares: <span className="font-semibold text-white">Type III Partial</span>
          </span>
        </div>

        {coeffDetail.coefficients.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-xs">
            No fitted model available for {activeResponse?.name}. Run Start Analysis to generate model coefficients.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#C0C0C0] text-xs">
              <thead className="bg-[#EFEFEF]">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-800">Factor / Term</th>
                  <th className="px-2 py-2 text-center font-semibold text-gray-800">Type</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-800">Coefficient<br/>Estimate</th>
                  <th className="px-2 py-2 text-right font-semibold text-gray-800">df</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-800">Standard<br/>Error</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-800">t for H₀<br/>Coeff = 0</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-800">p-value<br/>Prob &gt; |t|</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-800">95% CI Low</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-800">95% CI High</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-800">VIF</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-[#EAEAEA]">
                {coeffDetail.coefficients.map((row, idx) => {
                  const isSignificant = row.pValue !== null && row.pValue < 0.05;

                  return (
                    <tr key={idx} className="hover:bg-[#F0F8FF]">
                      <td className="px-3 py-1.5 font-bold text-[#003366]">
                        {row.termName}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                          row.termType === 'intercept' ? 'bg-gray-100 text-gray-700' :
                          row.termType === 'linear' ? 'bg-blue-50 text-blue-700 font-semibold' :
                          row.termType === 'interaction' ? 'bg-purple-50 text-purple-700 font-semibold' :
                          'bg-amber-50 text-amber-800 font-semibold'
                        }`}>
                          {row.termType}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono font-bold text-gray-900 text-[12px]">
                        {row.estimateCoded.toFixed(4)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-gray-600">
                        {row.df}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-gray-700">
                        {row.standardError !== null ? row.standardError.toFixed(4) : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums text-gray-800">
                        {row.tValue !== null ? row.tValue.toFixed(3) : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono font-bold">
                        {row.pValue !== null ? (
                          <span className={isSignificant ? 'text-[#008000]' : 'text-gray-500'}>
                            {row.pValue < 0.0001 ? '< 0.0001' : row.pValue.toFixed(4)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-[#0055A4] whitespace-nowrap">
                        {row.ciLow !== null ? row.ciLow.toFixed(4) : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-[#0055A4] whitespace-nowrap">
                        {row.ciHigh !== null ? row.ciHigh.toFixed(4) : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-gray-600">
                        {row.vif !== null ? (
                          <span className={row.vif > 10 ? 'text-red-600 font-bold' : ''}>
                            {row.vif.toFixed(2)}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Regression Equation Card */}
      <div className="bg-white border border-[#C0C0C0] shadow-xs rounded-xs overflow-hidden">
        <div className="bg-[#EAEAEA] border-b border-[#C0C0C0] px-3.5 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Code2 size={15} className="text-[#003366]" />
            <span className="font-bold text-[#003366]">Mathematical Regression Equation</span>
            <div className="flex bg-white border border-[#C0C0C0] rounded-xs ml-2 p-0.5 text-[11px]">
              <button
                onClick={() => setEquationMode('coded')}
                className={`px-2 py-0.5 rounded-xs font-semibold ${
                  equationMode === 'coded' ? 'bg-[#0055A4] text-white' : 'text-gray-700'
                }`}
              >
                Coded Factors
              </button>
              <button
                onClick={() => setEquationMode('actual')}
                className={`px-2 py-0.5 rounded-xs font-semibold ${
                  equationMode === 'actual' ? 'bg-[#0055A4] text-white' : 'text-gray-700'
                }`}
              >
                Actual Factors
              </button>
            </div>
          </div>

          <button
            onClick={handleCopyEquation}
            className="px-2 py-0.5 bg-white hover:bg-gray-50 border border-[#C0C0C0] text-gray-700 font-semibold rounded-xs shadow-xs text-[11px] flex items-center gap-1"
          >
            {copiedEq ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
            {copiedEq ? 'Copied' : 'Copy Equation'}
          </button>
        </div>

        <div className="p-3.5 bg-[#FAFBFD] font-mono text-xs text-gray-800 break-words leading-relaxed">
          {equationMode === 'coded' ? (
            coeffDetail.codedEquation || 'No equation available.'
          ) : (
            coeffDetail.actualEquation || coeffDetail.codedEquation || 'No equation available.'
          )}
        </div>
      </div>
    </div>
  );
}
