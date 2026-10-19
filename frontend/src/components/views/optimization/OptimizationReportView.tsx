import { useState } from 'react';
import { OptimizationRunResult, OptimizationCriterion } from '../../../lib/optimization/types';
import { Printer, Copy, Check, FileText, AlertCircle, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';

interface OptimizationReportViewProps {
  result: OptimizationRunResult | null;
  projectName: string;
  designName: string;
  factors: Array<{ id: string; name: string; units?: string }>;
  responses: Array<{ id: string; name: string; units?: string }>;
  criteria: Record<string, OptimizationCriterion>;
}

export function OptimizationReportView({
  result,
  projectName,
  designName,
  factors,
  responses,
  criteria,
}: OptimizationReportViewProps) {
  const [copied, setCopied] = useState(false);
  const [showAllStartingPoints, setShowAllStartingPoints] = useState(false);

  if (!result || !result.solutions) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white border border-[#C0C0C0] text-gray-400 rounded-sm font-sans">
        <FileText size={32} className="text-gray-300 mb-2" />
        <p className="font-semibold text-gray-500 mb-1">No optimization report available</p>
        <p className="text-xs text-gray-400">Run numerical optimization to generate a full statistical report.</p>
      </div>
    );
  }

  const selectedSolution = result.solutions[result.selectedSolutionIndex] || result.solutions[0];
  const diagnostic = result.startingPointsDiagnostic;

  const handleCopyReport = () => {
    const reportText = `AQbD Studio - Numerical Optimization Report
Project: ${projectName}
Design: ${designName}
Run Date: ${new Date(result.timestamp).toLocaleString()}
Status: ${result.status} (${result.message || ''})

=== 1. CONSTRAINTS ON THE DESIGN SPACE & CRITERIA ===
${Object.values(criteria).map(c => `- ${c.name} (${c.type}): Goal=${c.goal}, Lower=${c.lowerLimit}, Upper=${c.upperLimit}, Lower Weight=${c.lowerWeight ?? 1}, Upper Weight=${c.upperWeight ?? 1}, Importance=${c.importance}`).join('\n')}

=== 2. STARTING POINTS SEARCH DIAGNOSTIC ===
- Initial Design Candidates (Midpoint + Runs): ${diagnostic?.initialDesignCandidates ?? result.options.numberDesignPoints}
- Out-of-Bounds Candidates Rejected: ${diagnostic?.rejectedOutOfBounds ?? 0}
- Replicate / Duplicate Starts Eliminated: ${diagnostic?.rejectedDuplicates ?? 0}
- Random Starting Points Generated: ${diagnostic?.randomPointsGenerated ?? result.options.randomStartingPoints}
- Final Unique Starting Points Searched: ${result.startingPoints.length}
- Penalty Escalation Schedule: 1, 100, 10^4, ..., 10^30 (15 iterations)
- Convergence Criterion: Relative tolerance < 1e-6

=== 3. OPTIMUM SOLUTIONS SUMMARY (${result.solutions.length} unique solutions) ===
${selectedSolution ? `Selected Optimal Solution (#${selectedSolution.solutionNumber}):
  * Overall Desirability (D): ${selectedSolution.desirability.toFixed(4)}
  * Factors:
${factors.map(f => `    - ${f.name}: ${selectedSolution.factors[f.id]?.toFixed(3)} ${f.units || ''}`).join('\n')}
  * Model Predictions:
${responses.map(r => `    - ${r.name}: ${selectedSolution.predictions[r.id]?.toFixed(3)} ${r.units || ''} (d = ${(selectedSolution.individualDesirability[r.id] ?? 0).toFixed(3)})`).join('\n')}
` : 'No solutions found.'}`;

    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex-1 flex flex-col bg-white border border-[#B0B0B0] shadow-xs overflow-hidden rounded-xs font-sans text-xs">
      
      {/* Report Header Bar */}
      <div className="bg-[#003366] text-white px-4 py-2 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-[#A0C4FF]" />
          <span className="font-bold text-[12px] tracking-wide">
            Numerical Optimization Report
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyReport}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-[#E5F3FF] text-[#003366] font-semibold rounded-xs shadow-xs transition-colors"
            title="Copy Report Text"
          >
            {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy Text'}</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-[#E5F3FF] text-[#003366] font-semibold rounded-xs shadow-xs transition-colors"
            title="Print Report"
          >
            <Printer size={13} />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Report Printable Content Body */}
      <div className="flex-1 overflow-y-auto p-6 bg-[#FAFAFA]">
        <div className="max-w-4xl mx-auto bg-white border border-[#D0D0D0] p-8 shadow-sm rounded-sm space-y-6">
          
          {/* Header Title Box */}
          <div className="border-b-2 border-[#003366] pb-4">
            <h1 className="text-xl font-bold text-[#003366]">Numerical Optimization Report</h1>
            <p className="text-xs text-gray-500 mt-1">
              Stat-Ease Design-Expert 13 Desirability Function & Simplex Search Output
            </p>
            <div className="grid grid-cols-2 gap-y-1 text-gray-600 text-xs mt-3">
              <div><strong>Project:</strong> {projectName}</div>
              <div><strong>Design:</strong> {designName}</div>
              <div><strong>Run Date:</strong> {new Date(result.timestamp).toLocaleString()}</div>
              <div className="flex items-center gap-1.5">
                <strong>Status:</strong>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  result.status === 'optimal' 
                    ? 'bg-[#EBF7EE] text-[#1B4332]' 
                    : result.status === 'suboptimal' 
                    ? 'bg-[#E5F3FF] text-[#0055A4]' 
                    : 'bg-[#FFF0F0] text-[#B30000]'
                }`}>
                  {result.status === 'optimal' ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                  <span className="capitalize">{result.status.replace('_', ' ')}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Warnings Banner if any */}
          {result.warnings && result.warnings.length > 0 && (
            <div className="bg-[#FFF8E6] border border-[#F2D675] p-3 rounded text-xs text-[#7A5B00] space-y-1">
              <strong className="block text-[#8A5200]">Notice / Configuration Warnings:</strong>
              <ul className="list-disc pl-5 space-y-0.5">
                {result.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Section 1: The Constraints on the Design Space & Criteria */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-[#003366] border-b border-[#EAEAEA] pb-1">
              1. Constraints on the Design Space & Criteria
            </h2>
            <div className="overflow-x-auto border border-[#E0E0E0] rounded-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F0F4F8] border-b border-[#D0D0D0] text-[#003366] font-bold text-[10px]">
                    <th className="px-3 py-1.5 border-r border-[#D0D0D0]">Parameter</th>
                    <th className="px-3 py-1.5 border-r border-[#D0D0D0]">Type</th>
                    <th className="px-3 py-1.5 border-r border-[#D0D0D0]">Goal</th>
                    <th className="px-3 py-1.5 border-r border-[#D0D0D0] text-right">Lower Limit</th>
                    <th className="px-3 py-1.5 border-r border-[#D0D0D0] text-right">Upper Limit</th>
                    <th className="px-3 py-1.5 border-r border-[#D0D0D0] text-right">Lower Wt</th>
                    <th className="px-3 py-1.5 border-r border-[#D0D0D0] text-right">Upper Wt</th>
                    <th className="px-3 py-1.5 text-center">Importance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAEAEA]">
                  {Object.values(criteria).map(crit => {
                    return (
                      <tr key={crit.id} className="hover:bg-[#F5F9FF]">
                        <td className="px-3 py-1.5 border-r border-[#EAEAEA] font-semibold text-gray-800">
                          {crit.name}
                        </td>
                        <td className="px-3 py-1.5 border-r border-[#EAEAEA] capitalize text-gray-500">
                          {crit.type}
                        </td>
                        <td className="px-3 py-1.5 border-r border-[#EAEAEA] capitalize font-medium text-[#0055A4]">
                          {crit.goal.replace('_', ' ')}
                          {crit.goal === 'equal_to' && ` (${crit.targetValue})`}
                        </td>
                        <td className="px-3 py-1.5 border-r border-[#EAEAEA] text-right font-mono">
                          {typeof crit.lowerLimit === 'number' ? crit.lowerLimit.toFixed(3) : '-'}
                        </td>
                        <td className="px-3 py-1.5 border-r border-[#EAEAEA] text-right font-mono">
                          {typeof crit.upperLimit === 'number' ? crit.upperLimit.toFixed(3) : '-'}
                        </td>
                        <td className="px-3 py-1.5 border-r border-[#EAEAEA] text-right font-mono text-gray-600">
                          {crit.lowerWeight ?? 1.0}
                        </td>
                        <td className="px-3 py-1.5 border-r border-[#EAEAEA] text-right font-mono text-gray-600">
                          {crit.upperWeight ?? 1.0}
                        </td>
                        <td className="px-3 py-1.5 text-center font-bold text-gray-700">
                          {crit.goal === 'none' ? '-' : '+'.repeat(crit.importance || 3)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-gray-500 italic">
              * Per Design-Expert 13, weights (0.1–10.0) alter curve shape d_i = ((Y - L)/(U - L))^w. Importance (1–5) defines relative priority in the geometric mean exponent D = (∏ d_i^r_i)^(1 / ∑ r_i). In-range and factor constraints are excluded from the denominator sum of importances.
            </p>
          </div>

          {/* Section 2: Selected Optimal Solution */}
          {selectedSolution && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-[#003366] border-b border-[#EAEAEA] pb-1">
                2. Selected Optimum (Solution #{selectedSolution.solutionNumber})
              </h2>
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-4 rounded-sm flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-500 block">Overall Desirability Index (D):</span>
                  <span className="text-2xl font-bold font-mono text-[#0055A4]">
                    {selectedSolution.desirability.toFixed(4)}
                  </span>
                </div>
                <div className="text-right text-[11px] text-gray-500">
                  <span className="font-semibold text-emerald-700">Optimal Tradeoff Found</span>
                  <p className="text-[10px]">Satisfies all active criteria simultaneously</p>
                </div>
              </div>

              {/* Factors Settings & Model Predictions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-[#E0E0E0] rounded-sm overflow-hidden">
                  <div className="bg-[#F0F4F8] px-3 py-1 font-bold text-[#003366] text-[11px] border-b border-[#E0E0E0]">
                    Factor Settings
                  </div>
                  <table className="w-full text-xs">
                    <tbody>
                      {factors.map(f => (
                        <tr key={f.id} className="border-b border-[#F0F0F0] last:border-none">
                          <td className="px-3 py-1.5 font-medium text-gray-700">{f.name} {f.units ? `(${f.units})` : ''}</td>
                          <td className="px-3 py-1.5 text-right font-mono font-bold text-[#0055A4]">
                            {selectedSolution.factors[f.id]?.toFixed(3) ?? '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="border border-[#E0E0E0] rounded-sm overflow-hidden">
                  <div className="bg-[#F4F9F4] px-3 py-1 font-bold text-[#006622] text-[11px] border-b border-[#E0E0E0]">
                    Model Predictions & Desirability
                  </div>
                  <table className="w-full text-xs">
                    <tbody>
                      {responses.map(r => {
                        const val = selectedSolution.predictions[r.id];
                        const indD = selectedSolution.individualDesirability[r.id];
                        const se = selectedSolution.stdErrors?.[r.id];
                        const ciLow = selectedSolution.confidenceIntervals?.[r.id]?.low;
                        const ciHigh = selectedSolution.confidenceIntervals?.[r.id]?.high;

                        return (
                          <tr key={r.id} className="border-b border-[#F0F0F0] last:border-none">
                            <td className="px-3 py-1.5 font-medium text-gray-700">
                              {r.name} {r.units ? `(${r.units})` : ''}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono">
                              <span className="font-bold text-[#006622]">{typeof val === 'number' ? val.toFixed(3) : '-'}</span>
                              {typeof indD === 'number' && (
                                <span className="ml-2 text-[10px] text-gray-500 font-normal">(d = {indD.toFixed(3)})</span>
                              )}
                              {typeof se === 'number' && (
                                <div className="text-[9px] text-gray-400">
                                  SE: {se.toFixed(3)} {typeof ciLow === 'number' && `[${ciLow.toFixed(2)}, ${ciHigh?.toFixed(2)}]`}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Section 3: List of Optimum Solutions Found */}
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-[#EAEAEA] pb-1">
              <h2 className="text-sm font-bold text-[#003366]">
                3. Optimum Solutions Found ({result.solutions.length} unique solutions)
              </h2>
              <span className="text-[10px] text-gray-400">
                Sorted with highest desirability first
              </span>
            </div>
            <div className="overflow-x-auto border border-[#E0E0E0] rounded-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F0F4F8] border-b border-[#D0D0D0] text-[#003366] font-bold text-[10px]">
                    <th className="px-2 py-1.5 border-r border-[#D0D0D0] text-center">#</th>
                    {factors.map(f => (
                      <th key={f.id} className="px-2 py-1.5 border-r border-[#D0D0D0] text-right">{f.name}</th>
                    ))}
                    {responses.map(r => (
                      <th key={r.id} className="px-2 py-1.5 border-r border-[#D0D0D0] text-right text-[#006622]">{r.name} (Pred)</th>
                    ))}
                    <th className="px-2 py-1.5 text-right font-bold text-[#995500]">Desirability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAEAEA]">
                  {result.solutions.slice(0, 20).map(sol => (
                    <tr key={sol.solutionNumber} className="hover:bg-[#F5F9FF]">
                      <td className="px-2 py-1 border-r border-[#EAEAEA] text-center font-bold text-gray-500">{sol.solutionNumber}</td>
                      {factors.map(f => (
                        <td key={f.id} className="px-2 py-1 border-r border-[#EAEAEA] text-right font-mono">
                          {sol.factors[f.id]?.toFixed(3) ?? '-'}
                        </td>
                      ))}
                      {responses.map(r => (
                        <td key={r.id} className="px-2 py-1 border-r border-[#EAEAEA] text-right font-mono text-[#006622]">
                          {sol.predictions[r.id]?.toFixed(3) ?? '-'}
                        </td>
                      ))}
                      <td className="px-2 py-1 text-right font-mono font-bold text-[#995500]">
                        {sol.desirability.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.solutions.length > 20 && (
              <p className="text-[10px] text-gray-500 italic">
                Showing top 20 of {result.solutions.length} solutions. Design-Expert eliminates multiple starts that lead to the same optimum; all reported solutions meet the criteria.
              </p>
            )}
          </div>

          {/* Section 4: Starting Points Search & Diagnostic Summary */}
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-[#EAEAEA] pb-1">
              <h2 className="text-sm font-bold text-[#003366]">
                4. Starting Points Search Summary & Verification
              </h2>
              <button
                type="button"
                onClick={() => setShowAllStartingPoints(!showAllStartingPoints)}
                className="flex items-center gap-1 text-[11px] text-[#0055A4] font-semibold hover:underline"
              >
                {showAllStartingPoints ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <span>{showAllStartingPoints ? 'Hide Starting Points Table' : 'Show Starting Points Table'}</span>
              </button>
            </div>

            {/* 5-Stage Starting Points Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-[#F8FAFC] border border-[#E2E8F0] p-3 rounded-sm text-xs">
              <div>
                <span className="text-gray-500 block text-[10px]">Initial Candidates:</span>
                <span className="font-mono font-bold text-gray-800">
                  {diagnostic?.initialDesignCandidates ?? result.options.numberDesignPoints}
                </span>
                <span className="text-[9px] text-gray-400 block">Midpoint + Design Runs</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px]">Rejected Out-of-Bounds:</span>
                <span className="font-mono font-bold text-red-600">
                  {diagnostic?.rejectedOutOfBounds ?? 0}
                </span>
                <span className="text-[9px] text-gray-400 block">Violate factor criteria limits</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px]">Duplicates Eliminated:</span>
                <span className="font-mono font-bold text-amber-600">
                  {diagnostic?.rejectedDuplicates ?? 0}
                </span>
                <span className="text-[9px] text-gray-400 block">Replicates of midpoint/runs</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px]">Total Searched:</span>
                <span className="font-mono font-bold text-[#0055A4]">
                  {result.startingPoints.length}
                </span>
                <span className="text-[9px] text-gray-400 block">
                  {diagnostic?.acceptedDesignPoints ?? (result.startingPoints.length - (diagnostic?.randomPointsGenerated ?? 100))} design + {diagnostic?.randomPointsGenerated ?? 100} random
                </span>
              </div>
            </div>

            {/* Collapsible Starting Points Table */}
            {showAllStartingPoints && (
              <div className="overflow-x-auto border border-[#E0E0E0] rounded-sm max-h-64 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-[#F0F4F8] border-b border-[#D0D0D0]">
                    <tr className="text-[#003366] font-bold text-[10px]">
                      <th className="px-2 py-1.5 border-r border-[#D0D0D0] text-center">#</th>
                      <th className="px-2 py-1.5 border-r border-[#D0D0D0]">Source</th>
                      {factors.map(f => (
                        <th key={f.id} className="px-2 py-1.5 border-r border-[#D0D0D0] text-right">{f.name}</th>
                      ))}
                      <th className="px-2 py-1.5 text-right font-bold text-[#0055A4]">Initial D</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAEAEA]">
                    {result.startingPoints.map(sp => (
                      <tr key={sp.pointNumber} className="hover:bg-[#F5F9FF]">
                        <td className="px-2 py-1 border-r border-[#EAEAEA] text-center font-bold text-gray-500">{sp.pointNumber}</td>
                        <td className="px-2 py-1 border-r border-[#EAEAEA] capitalize font-medium text-gray-700">
                          {sp.source ? sp.source.replace('_', ' ') : 'Random'}
                        </td>
                        {factors.map(f => (
                          <td key={f.id} className="px-2 py-1 border-r border-[#EAEAEA] text-right font-mono">
                            {sp.factors[f.id]?.toFixed(3) ?? '-'}
                          </td>
                        ))}
                        <td className="px-2 py-1 text-right font-mono font-bold text-[#0055A4]">
                          {typeof sp.desirability === 'number' ? sp.desirability.toFixed(4) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 5: Optimization Algorithm & Solver Settings */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-[#003366] border-b border-[#EAEAEA] pb-1">
              5. Algorithm & Solver Parameters
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs bg-[#F8FAFC] border border-[#E2E8F0] p-4 rounded-sm">
              <div>
                <span className="text-gray-500 block text-[10px]">Search Method:</span>
                <span className="font-semibold text-gray-800">Nelder–Mead Simplex</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px]">Penalty Schedule:</span>
                <span className="font-semibold text-gray-800">15 stages (p = 1, 100, ..., 10³⁰)</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px]">Boundary Penalty:</span>
                <span className="font-semibold text-gray-800">+10¹⁰ for out-of-bounds</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px]">Simplex Fraction:</span>
                <span className="font-mono font-bold text-gray-800">{result.options.simplexFraction}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px]">Duplicate Filter:</span>
                <span className="font-mono font-bold text-gray-800">{result.options.duplicateFilter}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px]">Relative Convergence:</span>
                <span className="font-mono font-bold text-gray-800">&lt; 1e-6</span>
              </div>
            </div>
          </div>

          <div className="border-t border-[#EAEAEA] pt-4 text-center text-[10px] text-gray-400">
            AQbD Studio — Response Surface Methodology & Derringer-Suich Numerical Optimization Engine
          </div>

        </div>
      </div>

    </div>
  );
}
