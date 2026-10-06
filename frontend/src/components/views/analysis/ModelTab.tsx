import { useProject } from '../../../context/ProjectContext';
import { RSMAnalysis } from '../../../lib/statistics/rsm/types';
import { formatTermDisplay } from '../../../lib/statistics/rsm/statistics';

interface ModelTabProps {
  analysis: RSMAnalysis | null;
}

export function ModelTab({ analysis }: ModelTabProps) {
  const { project, activeDesignId } = useProject();

  const fittedModel = analysis?.fittedModel || analysis?.fitted;

  if (!analysis || !fittedModel) {
    return (
      <div className="max-w-xl p-8 bg-white border border-[#C0C0C0] rounded shadow-sm text-center my-6 mx-auto">
        <h2 className="text-base font-semibold text-[#003366] mb-2">Model</h2>
        <p className="text-gray-600 text-sm mb-1">No fitted analysis is available.</p>
        <p className="text-gray-500 text-xs">Run Start Analysis to generate the model.</p>
      </div>
    );
  }

  const design = activeDesignId && project?.data.designs ? project.data.designs[activeDesignId] : null;
  const factors = design?.config.factors || analysis.factors || [];

  return (
    <div className="max-w-4xl space-y-3 text-sm font-sans select-none">
      
      {/* Top Controls Toolbar */}
      <div className="flex items-center space-x-6 pb-2 border-b border-[#D0D0D0]">
        <div className="flex items-center space-x-2">
          <label className="text-[11px] font-semibold text-gray-800">Process Order:</label>
          <select
            value="Quadratic"
            disabled
            className="border border-[#909090] rounded-sm px-1.5 py-0.5 text-[11px] bg-[#EFEFEF] text-[#003366] font-bold shadow-sm focus:outline-none w-32 cursor-not-allowed"
          >
            <option value="Quadratic">Quadratic</option>
          </select>
        </div>

        <button
          disabled
          className="px-6 py-0.5 bg-[#E1E1E1] text-gray-600 border border-[#A0A0A0] shadow-sm text-[11px] cursor-not-allowed"
        >
          Auto Select...
        </button>

        <button
          disabled
          className="px-6 py-0.5 bg-[#E1E1E1] text-gray-600 border border-[#A0A0A0] shadow-sm text-[11px] cursor-not-allowed opacity-70"
        >
          Add Term
        </button>
      </div>

      <div className="flex gap-4 items-start pt-2">
        {/* Left Column: Terms List */}
        <div className="w-64 border border-[#909090] bg-white h-[450px] overflow-y-auto flex-shrink-0 shadow-sm">
          <div className="flex items-center bg-[#EFEFEF] border-b border-[#C0C0C0] py-1 px-2 cursor-default pt-2 pb-2">
             <div className="w-8 text-[#008000] font-bold text-base leading-none text-center">m</div>
             <div className="flex-1 text-center font-bold text-[#003366] text-[11px]">Intercept</div>
          </div>
          
          <div className="text-[11px] text-gray-800 pb-2 bg-white">
            {(fittedModel.terms || []).filter((t: any) => t.name !== 'Intercept').map((term: any, idx: number) => {
              const displayName = formatTermDisplay(term.name, factors);
              return (
                <div key={idx} className="flex items-center hover:bg-[#F0F8FF] py-1 px-2 cursor-default border-b border-[#F0F0F0]">
                  <div className="w-8 font-bold text-[#008000] text-base leading-none text-center">m</div>
                  <div className="flex-1 text-center font-semibold text-gray-900">{displayName}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Legend */}
        <div className="flex-1 border border-[#909090] bg-[#FAFAFA] text-[11px] flex flex-col max-w-lg shadow-sm">
          <div className="flex items-start border-b border-[#D0D0D0] px-3 py-2 bg-white">
            <div className="w-8 font-bold text-[#008000] text-lg leading-none mr-2 text-center mt-0.5">m</div>
            <div className="flex-1 text-gray-800 pt-1">The term will be included in the model.</div>
          </div>
          
          <div className="flex items-start border-b border-[#D0D0D0] px-3 py-2 bg-[#FFF4CE]">
            <div className="w-8 font-bold text-[#D5AC2C] text-lg leading-none mr-2 text-center mt-0.5">⚠</div>
            <div className="flex-1 text-[#7A5B00]">
              Indicates the term is aliased with another term, or was not estimated in the Fit Summary calculations. Including the term in the model is not recommended.
            </div>
          </div>

          <div className="flex items-start border-b border-[#D0D0D0] px-3 py-2 bg-white">
            <div className="w-8 font-bold text-[#008000] text-lg leading-none mr-2 text-center mt-0.5">🔒</div>
            <div className="flex-1 text-gray-800">
              A user-forced term. Automatic model selection will always produce a model that includes this term.
            </div>
          </div>
          
          <div className="flex items-start bg-[#EFEFEF] px-3 py-2">
            <div className="w-8 font-bold text-[#606060] text-lg leading-none mr-2 text-center mt-0.5">🔒</div>
            <div className="flex-1 text-[#404040]">
              Indicates that the term is required to be in the model by the program.
            </div>
          </div>
        </div>
      </div>
      
    </div>
  );
}
