import { useState } from 'react';
import { useProject } from '../../../context/ProjectContext';
import { ModelType, createModelMatrix, analyzeModel, RSMAnalysis } from '../../../lib/statistics/rsm';

export default function ModelSelection({ analysis, response }: { analysis?: RSMAnalysis, response: any }) {
  const { project, saveProject, activeResponseId, activeDesignId } = useProject();
  
  const [selectedModel, setSelectedModel] = useState<ModelType>(analysis?.modelType || 'Quadratic');
  const [error, setError] = useState<string | null>(null);

  const handleFitModel = async () => {
    if (!project || !activeResponseId || !activeDesignId) return;
    setError(null);

    const design = project.data.designs[activeDesignId];
    const runs = design.runs;
    
    // Check missing values
    const missing = runs.filter((r: any) => r.responses[activeResponseId] === null || r.responses[activeResponseId] === undefined);
    if (missing.length > 0) {
      setError(`Cannot fit model: ${missing.length} runs have missing response values.`);
      return;
    }

    try {
      const codedData = runs.map((r: any) => r.codedValues);
      const factorIds = design.config.factors.map((f: any) => f.id);
      const y = runs.map((r: any) => r.responses[activeResponseId]);

      const modelMatrix = createModelMatrix(codedData, factorIds, selectedModel);
      const result = analyzeModel(modelMatrix, y, selectedModel, codedData);

      // Create new analysis state
      const newAnalysis: RSMAnalysis = {
        responseId: activeResponseId,
        modelType: selectedModel,
        factors: design.config.factors,
        fittedModel: result.fitted,
        anova: result.anova,
        lackOfFit: result.lackOfFit,
        timestamp: new Date().toISOString()
      };

      // Add to project context
      if (!project.data.analysis) {
        project.data.analysis = {};
      }
      project.data.analysis[activeResponseId] = newAnalysis;
      
      await saveProject(project.name);

    } catch (err: any) {
      setError(err.message || 'Error fitting model.');
    }
  };

  return (
    <div className="max-w-xl">
      <h2 className="text-lg font-semibold text-gray-800 mb-4 border-b border-gray-300 pb-2">Model Selection</h2>
      
      {!response ? (
        <p className="text-gray-500">Please select a response.</p>
      ) : (
        <div className="space-y-6">
          <div className="bg-gray-50 p-4 border border-gray-200 rounded-sm">
            <h3 className="font-semibold text-gray-700 mb-2">Response: {response.name}</h3>
            <p className="text-xs text-gray-500 mb-4">Select the polynomial model to fit for this response.</p>
            
            <div className="space-y-2">
              {(['Linear', '2FI', 'Quadratic'] as ModelType[]).map(type => (
                <label key={type} className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="modelType" 
                    value={type} 
                    checked={selectedModel === type}
                    onChange={(e) => setSelectedModel(e.target.value as ModelType)}
                  />
                  <span>{type}</span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 p-3 text-xs border border-red-200 rounded-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button 
              onClick={handleFitModel}
              className="px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-sm hover:bg-blue-700 shadow-sm"
            >
              Fit Model
            </button>
          </div>

          {analysis && (
            <div className="mt-6 p-3 bg-green-50 border border-green-200 text-green-800 text-xs rounded-sm flex justify-between items-center">
              <div>
                <span className="font-semibold">Model successfully fitted:</span> {analysis.modelType}
                <div className="text-green-600 mt-1">Fitted on {new Date(analysis.timestamp).toLocaleString()}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
