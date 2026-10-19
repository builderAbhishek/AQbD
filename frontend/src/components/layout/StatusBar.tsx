import { useProject } from '../../context/ProjectContext';

export default function StatusBar() {
  const { project, isModified, saving, autosaveStatus, activeDesignId, activeResponseId } = useProject();

  const projectName = project ? project.name : '(No Project)';
  const modifiedText = isModified ? 'Modified: Yes' : 'Modified: No';
  
  let status = 'Ready';
  let statusColor = 'text-gray-700';

  if (!project) {
    status = 'No Project Open';
  } else if (saving || autosaveStatus === 'saving') {
    status = 'Saving...';
    statusColor = 'text-blue-600 font-semibold';
  } else if (autosaveStatus === 'error') {
    status = 'Save Error';
    statusColor = 'text-red-600 font-semibold';
  } else if (autosaveStatus === 'saved') {
    status = 'All changes saved';
    statusColor = 'text-green-700';
  } else if (isModified || autosaveStatus === 'unsaved') {
    status = 'Unsaved changes';
    statusColor = 'text-amber-700';
  }

  let designName = 'None';
  let runsCount = 0;
  let modelText = 'Model: None';
  
  if (project && activeDesignId && project.data.designs && project.data.designs[activeDesignId]) {
    const design = project.data.designs[activeDesignId];
    designName = design.name || (design.type === 'CCD' ? 'Central Composite' : 'Box-Behnken');
    runsCount = design.runs ? design.runs.length : 0;

    // Check model status
    const respId = activeResponseId || design.config?.responses?.[0]?.id;
    if (respId) {
      const an = design.analyses?.[respId] || project.data.analysis?.[respId];
      if (an?.fittedModel || an?.fitted) {
        const mType = an.modelType || 'Quadratic';
        if (an.isOutdated) {
          modelText = `Model: ${mType} (Outdated)`;
        } else {
          modelText = `Model: ${mType}`;
        }
      }
    }
  }

  return (
    <div className="bg-[#F0F0F0] h-6 border-t border-[#A0A0A0] flex items-center px-2 text-xs text-gray-700 shrink-0 font-sans select-none">
      <div className={`w-36 border-r border-[#D0D0D0] px-2 truncate ${statusColor}`}>{status}</div>
      <div className="flex-1 border-r border-[#D0D0D0] px-2 truncate">Project: {projectName}</div>
      <div className="w-60 border-r border-[#D0D0D0] px-2 truncate">Design: {designName}</div>
      <div className="w-24 border-r border-[#D0D0D0] px-2">Runs: {runsCount}</div>
      <div className="w-44 border-r border-[#D0D0D0] px-2 truncate" title={modelText}>{modelText}</div>
      <div className="w-28 border-r border-[#D0D0D0] px-2 text-center">{modifiedText}</div>
      <div className="w-auto px-4 text-right font-semibold text-gray-500 tracking-wide">AQbD Studio</div>
    </div>
  );
}
