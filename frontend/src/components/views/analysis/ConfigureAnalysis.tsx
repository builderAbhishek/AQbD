import { useState } from 'react';
import { useProject } from '../../../context/ProjectContext';
import { createModelMatrix } from '../../../lib/statistics/rsm/modelMatrix';
import { analyzeModel } from '../../../lib/statistics/rsm/statistics';
import { validateAnalysisResult } from '../../../lib/statistics/rsm/validation';
import { RSMAnalysis } from '../../../lib/statistics/rsm/types';

interface ConfigureAnalysisProps {
  onComplete: () => void;
}

export function ConfigureAnalysis({ onComplete }: ConfigureAnalysisProps) {
  const { project, activeDesignId, activeResponseId, setActiveResponseId, saveProject, setModified } = useProject();
  
  const [isFitting, setIsFitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const design = activeDesignId && project?.data.designs ? project.data.designs[activeDesignId] : null;

  if (!design) return null;

  const responses = design.config.responses || [];
  const runs = design.runs || [];
  const factors = design.config.factors || [];

  const handleStartAnalysis = async () => {
    if (!activeResponseId) return;
    setErrorMessage(null);
    setIsFitting(true);

    try {
      const targetResponse = responses.find((r: any) => r.id === activeResponseId);
      if (!targetResponse) throw new Error('Selected response does not exist.');
      if (!factors || factors.length === 0) throw new Error('Design has no factors configured.');

      const codedData: any[] = [];
      const y: number[] = [];
      const rawRuns: any[] = [];
      const factorIds = factors.map((f: any) => f.id);

      for (let i = 0; i < runs.length; i++) {
        const run = runs[i];
        const val = run.responses ? run.responses[activeResponseId] : undefined;

        if (val === null || val === undefined || typeof val !== 'number' || !Number.isFinite(val)) {
          const runNum = run.runOrder || run.stdOrder || (i + 1);
          throw new Error(`Run ${runNum} has missing or non-numeric response data. All runs must have valid numerical response values.`);
        }

        codedData.push(run.codedValues);
        y.push(val);
        rawRuns.push(run);
      }

      const k = factors.length;
      const requiredParams = 1 + (2 * k) + (k * (k - 1) / 2);
      if (runs.length < requiredParams) {
        throw new Error(`Cannot fit Quadratic model: Design has ${runs.length} runs, but a Quadratic model requires at least ${requiredParams} runs.`);
      }

      const modelMatrix = createModelMatrix(codedData, factorIds, 'Quadratic');
      const analysisResult = analyzeModel(modelMatrix, y, 'Quadratic', codedData, rawRuns, design.config.factors);

      const fittedModel = analysisResult.fittedModel || analysisResult.fitted;
      const fullAnalysis: RSMAnalysis = {
        responseId: activeResponseId,
        modelType: 'Quadratic',
        factors: design.config.factors,
        fittedModel: fittedModel,
        fitted: fittedModel,
        anova: analysisResult.anova,
        lackOfFit: analysisResult.lackOfFit,
        diagnostics: analysisResult.diagnostics,
        modelComparison: analysisResult.modelComparison,
        timestamp: new Date().toISOString()
      };

      validateAnalysisResult(fullAnalysis);

      if (!design.analyses) design.analyses = {};
      design.analyses[activeResponseId] = fullAnalysis;

      setModified(true);
      if (project) await saveProject(project.name);

      setIsFitting(false);
      onComplete();

    } catch (err: any) {
      setIsFitting(false);
      setErrorMessage(err.message || 'An unexpected statistical calculation error occurred.');
    }
  };

let isComplete = false;
  let enteredCount = 0;
  const missingRuns: number[] = [];

  if (activeResponseId) {
    runs.forEach((run: any) => {
      const val = run.responses ? run.responses[activeResponseId] : undefined;
      if (val !== null && val !== undefined && typeof val === 'number' && Number.isFinite(val)) {
        enteredCount++;
      } else {
        missingRuns.push(run.runOrder || run.stdOrder || run.standardOrder || (runs.indexOf(run) + 1));
      }
    });
    isComplete = enteredCount === runs.length;
  }

  return (
    <div className="max-w-xl font-sans select-none space-y-4 text-sm">
      <div className="border-b border-[#D0D0D0] pb-2 mb-2">
        <h2 className="text-[15px] font-bold text-[#003366]">Configure Analysis</h2>
        <p className="text-[11px] text-gray-700">Select a response and initiate the analysis.</p>
      </div>
      
      {errorMessage && (
        <div className="bg-[#FFF0F0] border border-[#FFCCCC] p-3 shadow-sm">
          <div className="text-[11px] font-bold text-[#B30000] mb-1">Analysis Error</div>
          <div className="text-[11px] text-[#800000]">{errorMessage}</div>
          <button onClick={() => setErrorMessage(null)} className="mt-2 text-[10px] font-bold px-2 py-0.5 bg-white border border-[#FFCCCC] text-[#B30000]">Dismiss</button>
        </div>
      )}

      <div className="bg-[#FAFAFA] border border-[#D0D0D0] p-4 shadow-sm space-y-4">
        
        <div>
          <label className="block text-[11px] font-bold text-gray-800 mb-1">Response</label>
          <select
            className="w-full border border-[#909090] bg-white px-2 py-1 text-[11px] font-medium text-gray-900 focus:outline-none shadow-sm"
            value={activeResponseId || ''}
            onChange={(e) => setActiveResponseId(e.target.value)}
            disabled={isFitting}
          >
            <option value="" disabled>Select Response</option>
            {responses.map((r: any) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        {activeResponseId && !isComplete && (
          <div className="bg-[#FFF4CE] border border-[#F2D675] p-3 text-[11px] text-[#7A5B00] shadow-sm">
            <div className="font-bold mb-1">Response data incomplete.</div>
            <div className="mb-1">{enteredCount} / {runs.length} values entered</div>
            <ul className="list-disc pl-4 space-y-0.5">
              {missingRuns.slice(0, 3).map((r, i) => <li key={i}>Run {r}</li>)}
              {missingRuns.length > 3 && <li>...and {missingRuns.length - 3} more</li>}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-gray-800 mb-1">Regression Type</label>
            <select className="w-full border border-[#C0C0C0] bg-[#EFEFEF] px-2 py-1 text-[11px] text-gray-700 cursor-not-allowed shadow-sm" disabled>
              <option>Linear Regression</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-800 mb-1">Transformation</label>
            <select className="w-full border border-[#C0C0C0] bg-[#EFEFEF] px-2 py-1 text-[11px] text-gray-700 cursor-not-allowed shadow-sm" disabled>
              <option>No Transform</option>
            </select>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={handleStartAnalysis}
            disabled={!activeResponseId || !isComplete || isFitting}
            className="w-full bg-[#0055A4] hover:bg-[#003366] text-white font-bold py-1.5 px-4 text-[12px] shadow-sm disabled:bg-[#C0C0C0] disabled:text-[#808080] disabled:cursor-not-allowed transition-colors"
          >
            {isFitting ? 'Fitting Model...' : 'Start Analysis'}
          </button>
        </div>
        
      </div>
    </div>
  );
}
