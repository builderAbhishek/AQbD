import { useProject } from '../../context/ProjectContext';

export default function StatusBar() {
  const { project, isModified, saving, activeDesignId } = useProject();

  const projectName = project ? project.name : '(No Project)';
  const modifiedText = isModified ? 'Modified: Yes' : 'Modified: No';
  
  let status = 'Ready';
  if (saving) status = 'Saving...';
  else if (!project) status = 'No Project Open';

  let designName = 'None';
  let runsCount = 0;
  
  if (project && activeDesignId && project.data.designs && project.data.designs[activeDesignId]) {
    const design = project.data.designs[activeDesignId];
    designName = design.name || (design.type === 'CCD' ? 'Central Composite' : 'Box-Behnken');
    runsCount = design.runs ? design.runs.length : 0;
  }

  return (
    <div className="bg-[#F0F0F0] h-6 border-t border-[#A0A0A0] flex items-center px-2 text-xs text-gray-700 shrink-0">
      <div className="w-32 border-r border-[#D0D0D0] px-2">{status}</div>
      <div className="flex-1 border-r border-[#D0D0D0] px-2 truncate">Project: {projectName}</div>
      <div className="w-64 border-r border-[#D0D0D0] px-2 truncate">Design: {designName}</div>
      <div className="w-24 border-r border-[#D0D0D0] px-2">Runs: {runsCount}</div>
      <div className="w-32 border-r border-[#D0D0D0] px-2">Model: None</div>
      <div className="w-32 border-r border-[#D0D0D0] px-2 text-center">{modifiedText}</div>
      <div className="w-auto px-4 text-right font-semibold text-gray-500 tracking-wide">Alag Innovative Solutions</div>
    </div>
  );
}
