import { OptimizationCriterion, isFactorCriterionCoded, codedToActual } from '../../../lib/optimization/types';

interface ConstraintsTableProps {
  criteria: Record<string, OptimizationCriterion>;
  factors: Array<{ id: string; name: string; low?: number; high?: number; units?: string }>;
  responses: Array<{ id: string; name: string; units?: string }>;
}

export function ConstraintsTable({ criteria, factors, responses }: ConstraintsTableProps) {
  const allItems: Array<{
    id: string;
    code: string;
    name: string;
    type: 'factor' | 'response';
    units?: string;
    crit: OptimizationCriterion;
    lowerDisp: number;
    upperDisp: number;
    targetDisp?: number;
  }> = [];

  factors.forEach((f, idx) => {
    const code = String.fromCharCode(65 + idx);
    const lowBound = typeof f.low === 'number' ? f.low : 0;
    const highBound = typeof f.high === 'number' ? f.high : 100;
    const crit = criteria[f.id] || {
      id: f.id,
      name: f.name,
      type: 'factor',
      goal: 'in_range',
      lowerLimit: lowBound,
      upperLimit: highBound,
      lowerWeight: 1.0,
      upperWeight: 1.0,
      importance: 3,
    };
    const isCoded = isFactorCriterionCoded(crit, { low: lowBound, high: highBound });
    const lowerDisp = isCoded ? codedToActual(crit.lowerLimit, lowBound, highBound) : crit.lowerLimit;
    const upperDisp = isCoded ? codedToActual(crit.upperLimit, lowBound, highBound) : crit.upperLimit;
    const targetDisp = typeof crit.targetValue === 'number'
      ? (isCoded ? codedToActual(crit.targetValue, lowBound, highBound) : crit.targetValue)
      : undefined;

    allItems.push({
      id: f.id,
      code,
      name: f.name,
      type: 'factor',
      units: f.units,
      crit,
      lowerDisp,
      upperDisp,
      targetDisp,
    });
  });

  responses.forEach((r, idx) => {
    const code = `R${idx + 1}`;
    const crit = criteria[r.id] || {
      id: r.id,
      name: r.name,
      type: 'response',
      goal: 'none',
      lowerLimit: 0,
      upperLimit: 100,
      lowerWeight: 1.0,
      upperWeight: 1.0,
      importance: 3,
    };
    allItems.push({
      id: r.id,
      code,
      name: r.name,
      type: 'response',
      units: r.units,
      crit,
      lowerDisp: crit.lowerLimit,
      upperDisp: crit.upperLimit,
      targetDisp: crit.targetValue,
    });
  });

  const formatGoal = (goal: string) => {
    switch (goal) {
      case 'maximize': return 'Maximize';
      case 'minimize': return 'Minimize';
      case 'target': return 'Target';
      case 'in_range': return 'In Range';
      case 'equal_to': return 'Equal To';
      case 'none': return 'None';
      default: return goal;
    }
  };

  const importanceStars = (imp: number) => '+'.repeat(Math.max(1, Math.min(5, imp || 3)));

  return (
    <div className="bg-white border border-[#B0B0B0] shadow-xs overflow-hidden rounded-xs font-sans text-xs">
      <div className="bg-[#F0F4F8] px-3 py-1.5 border-b border-[#D0D8E0] flex justify-between items-center">
        <span className="font-bold text-[#003366] text-[11px] tracking-wide uppercase">
          Optimization Constraints Summary
        </span>
        <span className="text-[10px] text-gray-500 font-normal">
          {allItems.filter(i => i.crit.goal !== 'none').length} Active Goals
        </span>
      </div>

      <div className="overflow-x-auto max-h-40 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#EAEAEA] border-b border-[#D0D0D0] text-[#003366] text-[10px] font-bold">
              <th className="px-2.5 py-1 border-r border-[#D0D0D0]">Name</th>
              <th className="px-2.5 py-1 border-r border-[#D0D0D0]">Goal</th>
              <th className="px-2.5 py-1 border-r border-[#D0D0D0] text-right">Lower Limit</th>
              <th className="px-2.5 py-1 border-r border-[#D0D0D0] text-right">Upper Limit</th>
              <th className="px-2.5 py-1 border-r border-[#D0D0D0] text-right">Lower Wt</th>
              <th className="px-2.5 py-1 border-r border-[#D0D0D0] text-right">Upper Wt</th>
              <th className="px-2.5 py-1 text-center">Importance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EAEAEA] text-[11px]">
            {allItems.map(item => {
              const { crit, code, name, type, units, lowerDisp, upperDisp } = item;
              const isNone = crit.goal === 'none';

              return (
                <tr 
                  key={item.id} 
                  className={`hover:bg-[#F5F9FF] transition-colors ${isNone ? 'text-gray-400 bg-gray-50/50' : 'text-gray-800'}`}
                >
                  <td className="px-2.5 py-1 border-r border-[#EAEAEA] whitespace-nowrap font-medium flex items-center gap-1.5">
                    <span className={`w-4 h-4 rounded-xs text-[9px] font-bold flex items-center justify-center text-white ${
                      type === 'factor' ? 'bg-[#0055A4]' : 'bg-[#008000]'
                    }`}>
                      {code}
                    </span>
                    <span>{name}</span>
                    {units && <span className="text-[10px] text-gray-400">({units})</span>}
                  </td>

                  <td className="px-2.5 py-1 border-r border-[#EAEAEA] whitespace-nowrap">
                    <span className={`px-1.5 py-0.5 rounded-xs text-[10px] font-semibold ${
                      isNone 
                        ? 'bg-gray-100 text-gray-400 border border-gray-200' 
                        : 'bg-[#E5F3FF] text-[#0055A4] border border-[#B3D9FF]'
                    }`}>
                      {formatGoal(crit.goal)}
                    </span>
                  </td>

                  <td className="px-2.5 py-1 border-r border-[#EAEAEA] text-right font-mono">
                    {isNone ? '-' : lowerDisp.toFixed(2)}
                  </td>

                  <td className="px-2.5 py-1 border-r border-[#EAEAEA] text-right font-mono">
                    {isNone ? '-' : upperDisp.toFixed(2)}
                  </td>

                  <td className="px-2.5 py-1 border-r border-[#EAEAEA] text-right font-mono">
                    {['maximize', 'target'].includes(crit.goal) ? crit.lowerWeight.toFixed(1) : '-'}
                  </td>

                  <td className="px-2.5 py-1 border-r border-[#EAEAEA] text-right font-mono">
                    {['minimize', 'target'].includes(crit.goal) ? crit.upperWeight.toFixed(1) : '-'}
                  </td>

                  <td className="px-2.5 py-1 text-center font-bold text-[#0055A4]">
                    {isNone ? '-' : importanceStars(crit.importance)}
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
