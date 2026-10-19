import { OptimizationSolution } from '../../../lib/optimization/types';
import { exportOptimizationSolutionsToCsv, downloadCsvFile } from '../../../lib/projectIO';
import { CheckCircle2, Download } from 'lucide-react';

interface SolutionsTableProps {
  solutions: OptimizationSolution[];
  factors: Array<{ id: string; name: string; units?: string }>;
  responses: Array<{ id: string; name: string; units?: string }>;
  selectedSolutionIndex: number;
  onSelectSolution: (index: number) => void;
}

export function SolutionsTable({
  solutions,
  factors,
  responses,
  selectedSolutionIndex,
  onSelectSolution,
}: SolutionsTableProps) {
  if (!solutions || solutions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white border border-[#C0C0C0] text-gray-400 rounded-sm font-sans h-full">
        <p className="font-semibold text-gray-500 mb-1">No solutions found</p>
        <p className="text-xs text-gray-400 text-center max-w-md">
          Run numerical optimization to calculate candidate solutions satisfying the configured criteria.
        </p>
      </div>
    );
  }

  const handleExportCsv = () => {
    const csvContent = exportOptimizationSolutionsToCsv(solutions, factors, responses);
    downloadCsvFile(csvContent, 'Optimization_Solutions.csv');
  };

  return (
    <div className="flex-1 flex flex-col bg-white border border-[#B0B0B0] shadow-xs overflow-hidden rounded-xs font-sans text-xs h-full min-h-0">
      <div className="bg-[#F0F4F8] px-3 py-1.5 border-b border-[#D0D8E0] flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#003366] text-[11px] tracking-wide uppercase">
            Unique Feasible Solutions ({solutions.length})
          </span>
          <span className="text-[10px] text-gray-500 font-normal hidden sm:inline">
            Sorted by Combined Desirability (Best First)
          </span>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          className="flex items-center gap-1 px-2 py-0.5 bg-white hover:bg-gray-100 border border-gray-300 rounded-sm font-medium text-gray-700 shadow-2xs transition-colors shrink-0"
          title="Export Solutions to CSV"
        >
          <Download size={12} className="text-blue-600" />
          <span>Export CSV</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-20">
            <tr className="bg-[#EAEAEA] border-b border-[#C0C0C0] text-[#003366] text-[10px] font-bold shadow-xs">
              <th className="px-2.5 py-1.5 border-r border-[#D0D0D0] text-center w-12 bg-[#EAEAEA]">#</th>
              <th className="px-2 py-1.5 border-r border-[#D0D0D0] text-center w-14 bg-[#EAEAEA]">Select</th>
              
              {/* Factor columns */}
              {factors.map(f => (
                <th key={f.id} className="px-2.5 py-1.5 border-r border-[#D0D0D0] text-right whitespace-nowrap bg-[#EAEAEA]">
                  <div>{f.name}</div>
                  {f.units && <div className="text-[9px] text-gray-500 font-normal">({f.units})</div>}
                </th>
              ))}

              {/* Response columns */}
              {responses.map(r => (
                <th key={r.id} className="px-2.5 py-1.5 border-r border-[#D0D0D0] text-right whitespace-nowrap bg-[#E6F4EA]">
                  <div className="text-[#006622]">{r.name}</div>
                  <div className="text-[9px] text-gray-500 font-normal">Pred. {r.units ? `(${r.units})` : ''}</div>
                </th>
              ))}

              <th className="px-3 py-1.5 text-right w-28 bg-[#FFF8EE] text-[#995500]">
                Desirability
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#EAEAEA] text-[11px]">
            {solutions.map((sol, idx) => {
              const isSelected = idx === selectedSolutionIndex;

              return (
                <tr
                  key={sol.solutionNumber || idx}
                  onClick={() => onSelectSolution(idx)}
                  className={`cursor-pointer transition-colors ${
                    isSelected 
                      ? 'bg-[#CCE8FF] text-[#003366] font-semibold border-l-4 border-l-[#0055A4]' 
                      : 'hover:bg-[#F5F9FF] text-gray-800'
                  }`}
                >
                  <td className="px-2.5 py-1.5 border-r border-[#EAEAEA] text-center font-bold text-gray-500">
                    {sol.solutionNumber || idx + 1}
                  </td>

                  <td className="px-2 py-1.5 border-r border-[#EAEAEA] text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectSolution(idx);
                      }}
                      className={`p-0.5 rounded-full ${isSelected ? 'text-[#0055A4]' : 'text-gray-300 hover:text-gray-500'}`}
                      title={isSelected ? 'Selected Solution' : 'Select this solution'}
                    >
                      <CheckCircle2 size={15} className={isSelected ? 'fill-[#0055A4] text-white' : ''} />
                    </button>
                  </td>

                  {/* Factor Values */}
                  {factors.map(f => {
                    const val = sol.factors?.[f.id];
                    return (
                      <td key={f.id} className="px-2.5 py-1.5 border-r border-[#EAEAEA] text-right font-mono">
                        {typeof val === 'number' ? val.toFixed(3) : '-'}
                      </td>
                    );
                  })}

                  {/* Predicted Response Values */}
                  {responses.map(r => {
                    const val = sol.predictions?.[r.id];
                    return (
                      <td key={r.id} className="px-2.5 py-1.5 border-r border-[#EAEAEA] text-right font-mono text-[#006622]">
                        {typeof val === 'number' ? val.toFixed(3) : '-'}
                      </td>
                    );
                  })}

                  {/* Combined Desirability */}
                  <td className="px-3 py-1.5 text-right font-mono font-bold">
                    <span className={`inline-block px-2 py-0.5 rounded-xs border text-[11px] ${
                      sol.desirability >= 0.9
                        ? 'bg-[#EBF7EE] text-[#1B4332] border-[#B7E4C7]'
                        : sol.desirability >= 0.7
                        ? 'bg-[#E5F3FF] text-[#0055A4] border-[#B3D9FF]'
                        : 'bg-[#FFF8E6] text-[#7A5B00] border-[#F2D675]'
                    }`}>
                      {sol.desirability.toFixed(4)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
