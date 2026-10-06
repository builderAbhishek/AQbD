import { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { DesignRun, CCDConfig } from '../../lib/design/ccd';

// Spreadsheet-like Design Table
export default function DesignTable() {
  const { project, saveProject, activeDesignId } = useProject();
  
  const design = activeDesignId && project?.data?.designs ? project.data.designs[activeDesignId] : null;
  const config = design?.config as CCDConfig;
  const runs = design?.runs as DesignRun[];

  const [viewMode, setViewMode] = useState<'actual' | 'coded'>('actual');
  const [selectedCell, setSelectedCell] = useState<{row: number, col: string} | null>(null);
  const [editingCell, setEditingCell] = useState<{row: number, col: string} | null>(null);
  const [editValue, setEditValue] = useState('');

  if (!design || !config || !runs) {
    return (
      <div className="flex flex-col h-full bg-white items-center justify-center text-gray-500">
        <p>No design has been generated yet.</p>
        <p className="text-xs mt-2">Use Design &gt; Central Composite Design to create one.</p>
      </div>
    );
  }

  const handleEditStart = (rowIndex: number, colKey: string, currentValue: any) => {
    // Only allow editing responses
    if (!colKey.startsWith('resp_')) return;
    setEditingCell({ row: rowIndex, col: colKey });
    setEditValue(currentValue === null || currentValue === undefined ? '' : String(currentValue));
  };

  const handleEditSave = () => {
    if (!editingCell) return;
    
    const respId = editingCell.col.replace('resp_', '');
    const numValue = editValue.trim() === '' ? null : parseFloat(editValue);
    
    if (project) {
      // Create deep copy
      const newRuns = [...runs];
      newRuns[editingCell.row] = {
        ...newRuns[editingCell.row],
        responses: {
          ...newRuns[editingCell.row].responses,
          [respId]: isNaN(numValue as any) ? null : numValue
        }
      };

      if (activeDesignId) {
        project.data.designs[activeDesignId].runs = newRuns;
        project.data.designs[activeDesignId].runsModifiedAt = new Date().toISOString();
        saveProject(project.name);
      }
    }
    
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleEditSave();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const columns = [
    { key: 'stdOrder', label: 'Std', width: '50px' },
    { key: 'runOrder', label: 'Run', width: '50px' },
    ...config.factors.map(f => ({
      key: `factor_${f.id}`,
      label: f.name,
      width: '100px'
    })),
    ...config.responses.map(r => ({
      key: `resp_${r.id}`,
      label: r.name,
      width: '100px'
    }))
  ];

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden text-xs select-none">
      <div className="bg-[#FAFAFA] border-b border-[#D0D0D0] px-2 py-1 flex items-center gap-4 shrink-0">
        <span className="font-semibold text-gray-700">Design Table ({config.type})</span>
        <div className="flex items-center gap-1 bg-[#EAEAEA] rounded-sm border border-gray-300 p-0.5">
          <button 
            className={`px-3 py-0.5 rounded-sm ${viewMode === 'actual' ? 'bg-white shadow-sm font-semibold' : 'hover:bg-gray-200'}`}
            onClick={() => setViewMode('actual')}
          >
            Actual
          </button>
          <button 
            className={`px-3 py-0.5 rounded-sm ${viewMode === 'coded' ? 'bg-white shadow-sm font-semibold' : 'hover:bg-gray-200'}`}
            onClick={() => setViewMode('coded')}
          >
            Coded
          </button>
        </div>
        <span className="text-gray-500 italic ml-auto">{runs.length} Runs</span>
      </div>

      <div className="flex bg-[#EAEAEA] border-b border-[#A0A0A0]">
        <div className="w-8 border-r border-[#A0A0A0] bg-[#D0D0D0] shrink-0"></div>
        {columns.map(col => (
          <div 
            key={col.key} 
            className="border-r border-[#A0A0A0] px-2 py-1 font-semibold text-gray-700 truncate shrink-0"
            style={{ width: col.width }}
          >
            {col.label}
          </div>
        ))}
      </div>
      
      <div className="flex-1 overflow-auto">
        {runs.map((run, rowIndex) => (
          <div key={run.id} className="flex border-b border-[#E0E0E0] hover:bg-[#F5F5F5]">
            <div className="w-8 border-r border-[#A0A0A0] bg-[#EAEAEA] flex items-center justify-center text-gray-500 font-medium shrink-0">
              {rowIndex + 1}
            </div>
            {columns.map(col => {
              const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === col.key;
              const isEditing = editingCell?.row === rowIndex && editingCell?.col === col.key;
              
              let displayValue: any = '';
              let isResponse = col.key.startsWith('resp_');
              let isFactor = col.key.startsWith('factor_');

              if (col.key === 'stdOrder') displayValue = run.stdOrder;
              else if (col.key === 'runOrder') displayValue = run.runOrder;
              else if (isFactor) {
                const fid = col.key.replace('factor_', '');
                const val = viewMode === 'actual' ? run.actualValues[fid] : run.codedValues[fid];
                displayValue = (typeof val === 'number') ? val.toFixed(4).replace(/\.?0+$/, '') : '';
              }
              else if (isResponse) {
                const rid = col.key.replace('resp_', '');
                displayValue = run.responses[rid] ?? '';
              }

              return (
                <div 
                  key={col.key}
                  className={`border-r border-[#E0E0E0] px-2 py-1 truncate shrink-0
                    ${isResponse ? 'bg-[#FDFDFD] cursor-text' : 'cursor-default'}
                    ${isSelected && !isEditing ? 'outline outline-2 outline-blue-500 bg-blue-50 z-10' : ''}
                  `}
                  style={{ width: col.width }}
                  onClick={() => setSelectedCell({row: rowIndex, col: col.key})}
                  onDoubleClick={() => handleEditStart(rowIndex, col.key, displayValue)}
                >
                  {isEditing ? (
                    <input 
                      autoFocus
                      type="text" 
                      className="w-full h-full outline-none text-xs bg-white"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={handleEditSave}
                      onKeyDown={handleKeyDown}
                    />
                  ) : displayValue}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
