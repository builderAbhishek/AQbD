import { useState } from 'react';
import { RSMAnalysis, generateCodedEquation, generateActualEquation } from '../../../lib/statistics/rsm';
import { Copy, Check } from 'lucide-react';

export default function Equations({ analysis }: { analysis?: RSMAnalysis }) {
  const [copied, setCopied] = useState<string | null>(null);

  if (!analysis) {
    return <div className="text-gray-500 italic">No model fitted. Please use Model Selection first.</div>;
  }

  const codedEq = generateCodedEquation(analysis.fittedModel);
  const actualEq = generateActualEquation(analysis.fittedModel, analysis.factors);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="max-w-4xl flex flex-col gap-8">
      <div>
        <div className="flex justify-between items-end mb-2 border-b border-gray-300 pb-2">
          <h2 className="text-lg font-semibold text-gray-800">Final Equation in Terms of Coded Factors</h2>
          <button 
            onClick={() => handleCopy(codedEq, 'coded')}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded border border-blue-200"
          >
            {copied === 'coded' ? <Check size={14} /> : <Copy size={14} />} 
            {copied === 'coded' ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="bg-[#FAFAFA] border border-[#D0D0D0] p-4 font-mono text-sm leading-relaxed overflow-x-auto whitespace-pre">
          {codedEq}
        </div>
        <p className="mt-2 text-xs text-gray-600">
          The equation in terms of coded factors can be used to make predictions about the response for given levels of each factor. By default, the high levels of the factors are coded as +1 and the low levels are coded as -1. The coded equation is useful for identifying the relative impact of the factors by comparing the factor coefficients.
        </p>
      </div>

      <div>
        <div className="flex justify-between items-end mb-2 border-b border-gray-300 pb-2">
          <h2 className="text-lg font-semibold text-gray-800">Final Equation in Terms of Actual Factors</h2>
          <button 
            onClick={() => handleCopy(actualEq, 'actual')}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded border border-blue-200"
          >
            {copied === 'actual' ? <Check size={14} /> : <Copy size={14} />} 
            {copied === 'actual' ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="bg-[#FAFAFA] border border-[#D0D0D0] p-4 font-mono text-sm leading-relaxed overflow-x-auto whitespace-pre">
          {actualEq}
        </div>
        <p className="mt-2 text-xs text-gray-600">
          The equation in terms of actual factors can be used to make predictions about the response for given levels of each factor in the original units. This equation should not be used to determine the relative impact of each factor because the coefficients are scaled to accommodate the units of each factor.
        </p>
      </div>
    </div>
  );
}
