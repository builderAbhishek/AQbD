import { useState } from 'react';
import { Settings, Plus, Trash2, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { useProject } from '../../../context/ProjectContext';
import { generateBBD, BBDConfig, generateDefaultBBDConfig } from '../../../lib/design/bbd';

export default function BBDWizard({ onClose }: { onClose: () => void }) {
  const { project, saveProject, setActiveNode, setActiveDesignId } = useProject();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');

  const [config, setConfig] = useState<BBDConfig>(generateDefaultBBDConfig());

  const nextStep = () => {
    setError('');
    // Validations
    if (step === 1) {
      if (config.factors.length < 3 || config.factors.length > 5) {
        return setError('Must have between 3 and 5 factors for Box-Behnken Design.');
      }
      for (const f of config.factors) {
        if (!f.name.trim()) return setError('Factor names cannot be empty.');
        if (f.low >= f.high) return setError(`Factor "${f.name}" must have Low < High.`);
      }
    } else if (step === 2) {
      if (config.centerPoints < 1) return setError('Center points must be >= 1.');
    } else if (step === 3) {
      if (config.responses.length === 0) return setError('Must have at least one response.');
      for (const r of config.responses) {
        if (!r.name.trim()) return setError('Response names cannot be empty.');
      }
    }
    setStep(s => Math.min(5, s + 1));
  };

  const prevStep = () => {
    setError('');
    setStep(s => Math.max(1, s - 1));
  };

  const handleCreate = async () => {
    if (!project) return;
    try {
      const runs = generateBBD(config);
      const designId = 'design_' + Date.now();
      const existingDesigns = Object.keys(project.data.designs || {}).length;
      
      const designData = {
        id: designId,
        name: `Box-Behnken Design ${existingDesigns + 1}`,
        type: 'BBD',
        config: config,
        runs: runs,
        createdAt: new Date().toISOString()
      };

      project.data = { 
        ...project.data, 
        designs: { ...(project.data.designs || {}), [designId]: designData }
      };
      await saveProject(project.name);
      
      // Navigate to Design Table
      setActiveNode('Design Table');
      setActiveDesignId(designId);
      window.dispatchEvent(new CustomEvent('design-created', { detail: { id: designId } }));
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to generate design.');
    }
  };

  const updateFactor = (index: number, key: keyof typeof config.factors[0], value: any) => {
    const newFactors = [...config.factors];
    newFactors[index] = { ...newFactors[index], [key]: value };
    setConfig({ ...config, factors: newFactors });
  };

  const addFactor = () => {
    if (config.factors.length >= 5) return;
    setConfig({
      ...config,
      factors: [...config.factors, { id: `f${Date.now()}`, name: `Factor ${String.fromCharCode(65 + config.factors.length)}`, units: '', low: -1, high: 1 }]
    });
  };

  const removeFactor = (index: number) => {
    if (config.factors.length <= 3) return;
    const newFactors = [...config.factors];
    newFactors.splice(index, 1);
    setConfig({ ...config, factors: newFactors });
  };

  const updateResponse = (index: number, key: keyof typeof config.responses[0], value: any) => {
    const newResponses = [...config.responses];
    newResponses[index] = { ...newResponses[index], [key]: value };
    setConfig({ ...config, responses: newResponses });
  };

  const addResponse = () => {
    setConfig({
      ...config,
      responses: [...config.responses, { id: `r${Date.now()}`, name: `Response ${config.responses.length + 1}`, units: '' }]
    });
  };

  const removeResponse = (index: number) => {
    if (config.responses.length <= 1) return;
    const newResponses = [...config.responses];
    newResponses.splice(index, 1);
    setConfig({ ...config, responses: newResponses });
  };

  const k = config.factors.length;
  const nonCenterCount = 2 * k * (k - 1);
  const totalRuns = nonCenterCount + config.centerPoints;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 font-sans text-sm select-none">
      <div className="bg-[#F0F0F0] border border-[#A0A0A0] shadow-2xl rounded-sm w-[650px] flex flex-col h-[500px]">
        
        {/* Title bar */}
        <div className="bg-white border-b border-[#D0D0D0] px-3 py-2 flex justify-between items-center text-gray-800 font-semibold text-xs shrink-0 cursor-default">
          <div className="flex items-center gap-2">
            <Settings size={14} className="text-blue-600" />
            Box-Behnken Design (BBD) Setup
          </div>
          <button onClick={onClose} className="hover:bg-red-500 hover:text-white p-0.5 rounded-sm">
            <XIcon />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          
          {/* Left Sidebar Steps */}
          <div className="w-48 bg-[#FAFAFA] border-r border-[#D0D0D0] p-4 shrink-0 overflow-y-auto">
            {['Factors', 'Settings', 'Responses', 'Preview', 'Create'].map((name, i) => (
              <div 
                key={i} 
                className={`px-3 py-1.5 mb-1 text-xs rounded-sm ${step === i + 1 ? 'bg-blue-600 text-white font-medium shadow-sm' : (step > i + 1 ? 'text-gray-800 font-medium' : 'text-gray-500')}`}
              >
                {i + 1}. {name}
              </div>
            ))}
          </div>

          {/* Right Area */}
          <div className="flex-1 bg-white flex flex-col min-w-0 p-6 overflow-y-auto">
            {error && (
              <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 text-xs rounded-sm">
                {error}
              </div>
            )}

            {step === 1 && (
              <div className="flex flex-col h-full">
                <h2 className="text-sm font-bold text-gray-800 mb-1">Define Factors</h2>
                <p className="text-xs text-gray-600 mb-4">Enter 3 to 5 numeric continuous factors for BBD.</p>
                
                <div className="border border-gray-300 rounded-sm overflow-hidden flex-1">
                  <div className="bg-[#EAEAEA] flex text-xs font-semibold px-2 py-1.5 border-b border-gray-300">
                    <div className="w-24 border-r border-gray-300 mr-2">Name</div>
                    <div className="w-16 border-r border-gray-300 mr-2">Units</div>
                    <div className="w-20 border-r border-gray-300 mr-2">Low (-1)</div>
                    <div className="w-20 mr-2">High (+1)</div>
                    <div className="w-8"></div>
                  </div>
                  <div className="p-1 overflow-y-auto max-h-[250px]">
                    {config.factors.map((f, idx) => (
                      <div key={idx} className="flex gap-2 mb-1.5 items-center">
                        <input type="text" className="w-24 border border-gray-300 px-1.5 py-1 text-xs" value={f.name} onChange={e => updateFactor(idx, 'name', e.target.value)} />
                        <input type="text" className="w-16 border border-gray-300 px-1.5 py-1 text-xs" value={f.units} onChange={e => updateFactor(idx, 'units', e.target.value)} />
                        <input type="number" className="w-20 border border-gray-300 px-1.5 py-1 text-xs" value={f.low} onChange={e => updateFactor(idx, 'low', parseFloat(e.target.value))} />
                        <input type="number" className="w-20 border border-gray-300 px-1.5 py-1 text-xs" value={f.high} onChange={e => updateFactor(idx, 'high', parseFloat(e.target.value))} />
                        <button onClick={() => removeFactor(idx)} disabled={config.factors.length <= 3} className="text-gray-500 hover:text-red-500 disabled:opacity-30">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-3">
                  <button onClick={addFactor} disabled={config.factors.length >= 5} className="flex items-center gap-1 text-xs px-3 py-1.5 border border-gray-300 bg-[#F0F0F0] hover:bg-[#E5E5E5] rounded-sm disabled:opacity-50">
                    <Plus size={14} /> Add Factor
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col h-full">
                <h2 className="text-sm font-bold text-gray-800 mb-1">Design Settings</h2>
                <p className="text-xs text-gray-600 mb-4">Configure center points and run order.</p>

                <div className="grid grid-cols-[150px_1fr] gap-y-4 text-xs items-center max-w-sm">
                  <label className="text-gray-700 font-medium">Center Points:</label>
                  <input type="number" className="border border-gray-300 px-2 py-1.5 rounded-sm" value={config.centerPoints} onChange={e => setConfig({...config, centerPoints: parseInt(e.target.value) || 0})} />

                  <label className="text-gray-700 font-medium">Randomize Order:</label>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="randomize" checked={config.randomize} onChange={e => setConfig({...config, randomize: e.target.checked})} />
                    <label htmlFor="randomize">Randomize Run Order</label>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="flex flex-col h-full">
                <h2 className="text-sm font-bold text-gray-800 mb-1">Responses</h2>
                <p className="text-xs text-gray-600 mb-4">Define measured response variables.</p>
                
                <div className="border border-gray-300 rounded-sm overflow-hidden flex-1">
                  <div className="bg-[#EAEAEA] flex text-xs font-semibold px-2 py-1.5 border-b border-gray-300">
                    <div className="w-32 border-r border-gray-300 mr-2">Name</div>
                    <div className="w-20 border-r border-gray-300 mr-2">Units</div>
                    <div className="w-8"></div>
                  </div>
                  <div className="p-1 overflow-y-auto max-h-[250px]">
                    {config.responses.map((r, idx) => (
                      <div key={idx} className="flex gap-2 mb-1.5 items-center">
                        <input type="text" className="w-32 border border-gray-300 px-1.5 py-1 text-xs" value={r.name} onChange={e => updateResponse(idx, 'name', e.target.value)} />
                        <input type="text" className="w-20 border border-gray-300 px-1.5 py-1 text-xs" value={r.units} onChange={e => updateResponse(idx, 'units', e.target.value)} />
                        <button onClick={() => removeResponse(idx)} disabled={config.responses.length <= 1} className="text-gray-500 hover:text-red-500 disabled:opacity-30">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-3">
                  <button onClick={addResponse} className="flex items-center gap-1 text-xs px-3 py-1.5 border border-gray-300 bg-[#F0F0F0] hover:bg-[#E5E5E5] rounded-sm">
                    <Plus size={14} /> Add Response
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="flex flex-col h-full">
                <h2 className="text-sm font-bold text-gray-800 mb-1">Design Preview</h2>
                <p className="text-xs text-gray-600 mb-4">Review the generated design sizing before creation.</p>
                
                <div className="border border-gray-300 rounded-sm p-4 bg-[#FAFAFA] text-xs">
                  <div className="grid grid-cols-[120px_1fr] gap-y-2 mb-4">
                    <div className="text-gray-600">Design Type:</div>
                    <div className="font-semibold">{config.type}</div>
                    
                    <div className="text-gray-600">Factors:</div>
                    <div className="font-semibold">{config.factors.length}</div>
                    
                    <div className="text-gray-600">Randomization:</div>
                    <div className="font-semibold">{config.randomize ? 'ON' : 'OFF'}</div>
                  </div>

                  <div className="border-t border-gray-300 my-2"></div>

                  <div className="grid grid-cols-[120px_1fr] gap-y-2 mt-2">
                    <div className="text-gray-600">Non-center Runs:</div>
                    <div>{nonCenterCount}</div>
                    
                    <div className="text-gray-600">Center Runs:</div>
                    <div>{config.centerPoints}</div>
                    
                    <div className="text-gray-800 font-bold mt-2">Total Runs:</div>
                    <div className="text-gray-800 font-bold mt-2">{totalRuns}</div>
                  </div>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="flex flex-col h-full items-center justify-center text-center">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                  <Check size={32} />
                </div>
                <h2 className="text-lg font-bold text-gray-800 mb-2">Ready to Create</h2>
                <p className="text-sm text-gray-600 max-w-sm mb-6">
                  The {config.type} design with {totalRuns} total runs will be generated and added to your project workspace.
                </p>
                <div className="text-xs text-gray-500 italic">
                  Note: A design can only be generated once. Ensure settings are correct.
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer Buttons */}
        <div className="bg-[#EAEAEA] border-t border-[#D0D0D0] p-3 flex justify-between shrink-0">
          <button onClick={onClose} className="px-4 py-1.5 border border-gray-400 rounded-sm bg-[#F0F0F0] hover:bg-[#D5D5D5] text-xs">
            Cancel
          </button>
          
          <div className="flex gap-2">
            {step > 1 && (
              <button onClick={prevStep} className="px-4 py-1.5 border border-gray-400 rounded-sm bg-[#F0F0F0] hover:bg-[#D5D5D5] text-xs flex items-center gap-1">
                <ArrowLeft size={14} /> Back
              </button>
            )}
            
            {step < 5 ? (
              <button onClick={nextStep} className="px-4 py-1.5 border border-blue-600 rounded-sm bg-blue-600 text-white hover:bg-blue-700 text-xs flex items-center gap-1">
                Next <ArrowRight size={14} />
              </button>
            ) : (
              <button onClick={handleCreate} className="px-4 py-1.5 border border-green-600 rounded-sm bg-green-600 text-white hover:bg-green-700 text-xs font-semibold">
                Create Design
              </button>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);
