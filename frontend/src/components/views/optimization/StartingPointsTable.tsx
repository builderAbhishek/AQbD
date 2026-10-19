import { StartingPoint, StartingPointsDiagnostic } from '../../../lib/optimization/types';
import { exportStartingPointsToCsv, exportOptimizationDiagnosticReport, downloadCsvFile } from '../../../lib/projectIO';
import { Download, FileText } from 'lucide-react';

interface StartingPointsTableProps {
  startingPoints: StartingPoint[];
  factors: Array<{ id: string; name: string; units?: string }>;
  diagnostic?: StartingPointsDiagnostic;
  runResult?: any;
  responses?: Array<{ id: string; name: string; units?: string }>;
}

export function StartingPointsTable({ startingPoints, factors, diagnostic, runResult, responses = [] }: StartingPointsTableProps) {
  if (!startingPoints || startingPoints.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white border border-[#C0C0C0] text-gray-400 rounded-sm font-sans h-full">
        <p className="font-semibold text-gray-500 mb-1">No starting points generated</p>
        <p className="text-xs text-gray-400 text-center max-w-md">
          Execute numerical optimization to view the candidate starting factor settings evaluated during the optimization run.
        </p>
      </div>
    );
  }

  const effectiveDiag = diagnostic || runResult?.startingPointsDiagnostic || (startingPoints as any).diagnostic;

  const handleExportCsv = () => {
    const csvContent = exportStartingPointsToCsv(startingPoints, factors);
    downloadCsvFile(csvContent, 'Starting_Points.csv');
  };

  const handleExportDiagnostic = () => {
    const exportResult = runResult || {
      runId: 'opt-eval',
      timestamp: new Date().toISOString(),
      status: 'optimal',
      startingPoints,
      startingPointsDiagnostic: effectiveDiag,
    };
    const csvContent = exportOptimizationDiagnosticReport(exportResult, factors, responses);
    downloadCsvFile(csvContent, 'Optimization_Diagnostic_Report.csv');
  };

  return (
    <div className="flex-1 flex flex-col bg-white border border-[#B0B0B0] shadow-xs overflow-hidden rounded-xs font-sans text-xs h-full min-h-0">
      <div className="bg-[#F0F4F8] px-3 py-1.5 border-b border-[#D0D8E0] flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#003366] text-[11px] tracking-wide uppercase">
            Evaluated Starting Points ({startingPoints.length})
          </span>
          <span className="text-[10px] text-gray-500 font-normal hidden sm:inline">
            Multi-start simplex search initialized from these coordinates
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportDiagnostic}
            className="flex items-center gap-1 px-2 py-0.5 bg-white hover:bg-gray-100 border border-gray-300 rounded-sm font-medium text-gray-700 shadow-2xs transition-colors shrink-0"
            title="Export Complete 5-Stage Diagnostic Report CSV"
          >
            <FileText size={12} className="text-[#003366]" />
            <span>Diagnostic Report</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1 px-2 py-0.5 bg-white hover:bg-gray-100 border border-gray-300 rounded-sm font-medium text-gray-700 shadow-2xs transition-colors shrink-0"
            title="Export Starting Points to CSV"
          >
            <Download size={12} className="text-blue-600" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {effectiveDiag && (
        <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-3 py-2 flex flex-wrap gap-2 text-[10px] items-center shrink-0">
          <div className="flex items-center gap-1 bg-white px-2 py-0.5 border border-gray-200 rounded-xs shadow-2xs">
            <span className="text-gray-500 font-medium">1. Initial Candidates:</span>
            <span className="font-bold text-gray-800">{effectiveDiag.initialDesignCandidates}</span>
          </div>
          <div className="flex items-center gap-1 bg-white px-2 py-0.5 border border-amber-200 text-amber-900 rounded-xs shadow-2xs">
            <span className="text-amber-700 font-medium">2. Out-of-Bounds Rejected:</span>
            <span className="font-bold">{effectiveDiag.rejectedOutOfBounds}</span>
          </div>
          <div className="flex items-center gap-1 bg-white px-2 py-0.5 border border-blue-200 text-blue-900 rounded-xs shadow-2xs">
            <span className="text-blue-700 font-medium">3. Duplicates Removed:</span>
            <span className="font-bold">{effectiveDiag.rejectedDuplicates}</span>
          </div>
          <div className="flex items-center gap-1 bg-white px-2 py-0.5 border border-indigo-200 text-indigo-900 rounded-xs shadow-2xs">
            <span className="text-indigo-700 font-medium">4. Accepted Design Starts:</span>
            <span className="font-bold">{effectiveDiag.acceptedDesignPoints}</span>
          </div>
          <div className="flex items-center gap-1 bg-white px-2 py-0.5 border border-purple-200 text-purple-900 rounded-xs shadow-2xs">
            <span className="text-purple-700 font-medium">5. Random Starts:</span>
            <span className="font-bold">{effectiveDiag.randomPointsGenerated}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-[#EBF3FB] px-2.5 py-0.5 border border-[#B8D5E5] text-[#003366] rounded-xs shadow-2xs ml-auto">
            <span className="font-medium">Total Unique Starts:</span>
            <span className="font-bold text-[11px]">{effectiveDiag.totalStartingPoints}</span>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-20">
            <tr className="bg-[#EAEAEA] border-b border-[#C0C0C0] text-[#003366] text-[10px] font-bold shadow-xs">
              <th className="px-3 py-1.5 border-r border-[#D0D0D0] text-center w-14 bg-[#EAEAEA]">Point #</th>
              <th className="px-2 py-1.5 border-r border-[#D0D0D0] text-center w-20 bg-[#EAEAEA]">Source</th>
              {factors.map(f => (
                <th key={f.id} className="px-3 py-1.5 border-r border-[#D0D0D0] text-right whitespace-nowrap bg-[#EAEAEA]">
                  <div>{f.name}</div>
                  {f.units && <div className="text-[9px] text-gray-500 font-normal">({f.units})</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EAEAEA] text-[11px]">
            {startingPoints.map((sp, idx) => {
              const srcLabel = sp.source === 'midpoint' ? 'Midpoint' : sp.source === 'design_point' ? 'Design Run' : 'Random';
              const srcBadgeColor = sp.source === 'midpoint' ? 'bg-amber-50 text-amber-800 border-amber-200' : sp.source === 'design_point' ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-200';
              return (
                <tr key={sp.pointNumber || idx} className="hover:bg-[#F5F9FF] text-gray-800 transition-colors">
                  <td className="px-3 py-1 border-r border-[#EAEAEA] text-center font-bold text-gray-500">
                    {sp.pointNumber || idx + 1}
                  </td>
                  <td className="px-2 py-1 border-r border-[#EAEAEA] text-center">
                    <span className={`inline-block px-1.5 py-0.2 rounded-xs border text-[9px] font-medium ${srcBadgeColor}`}>
                      {srcLabel}
                    </span>
                  </td>
                  {factors.map(f => {
                    const val = sp.factors?.[f.id];
                    return (
                      <td key={f.id} className="px-3 py-1 border-r border-[#EAEAEA] text-right font-mono">
                        {typeof val === 'number' ? val.toFixed(3) : '-'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
