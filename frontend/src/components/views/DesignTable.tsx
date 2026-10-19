import { useState, useRef, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { DesignRun, CCDConfig } from '../../lib/design/ccd';
import { exportDesignTableToCsv, downloadCsvFile, sanitizeFileName } from '../../lib/projectIO';
import { Download } from 'lucide-react';

export const parseResponseValue = (valueStr: string): number | null => {
  const numValue = valueStr.trim() === '' ? null : parseFloat(valueStr);
  return isNaN(numValue as any) ? null : numValue;
};

export const getTargetCell = (
  direction: 'up' | 'down' | 'left' | 'right',
  currentRow: number,
  currentColKey: string,
  totalRows: number,
  responseKeys: string[]
): { row: number; col: string } | null => {
  const colIdx = responseKeys.indexOf(currentColKey);
  if (colIdx === -1) return null;

  if (direction === 'down') {
    if (currentRow + 1 < totalRows) {
      return { row: currentRow + 1, col: currentColKey };
    }
    return { row: currentRow, col: currentColKey };
  }

  if (direction === 'up') {
    if (currentRow - 1 >= 0) {
      return { row: currentRow - 1, col: currentColKey };
    }
    return { row: 0, col: currentColKey };
  }

  if (direction === 'right') {
    if (colIdx + 1 < responseKeys.length) {
      return { row: currentRow, col: responseKeys[colIdx + 1] };
    } else if (currentRow + 1 < totalRows) {
      return { row: currentRow + 1, col: responseKeys[0] };
    }
    return { row: currentRow, col: currentColKey };
  }

  if (direction === 'left') {
    if (colIdx - 1 >= 0) {
      return { row: currentRow, col: responseKeys[colIdx - 1] };
    } else if (currentRow - 1 >= 0) {
      return { row: currentRow - 1, col: responseKeys[responseKeys.length - 1] };
    }
    return { row: 0, col: currentColKey };
  }

  return null;
};

export const shouldNavigate = (
  key: string,
  input: { selectionStart: number | null; selectionEnd: number | null; value: string }
): boolean => {
  if (key === 'ArrowDown' || key === 'ArrowUp') {
    return true;
  }

  const { selectionStart, selectionEnd, value } = input;
  if (selectionStart === null || selectionEnd === null) return true;

  const isAllSelected = selectionStart === 0 && selectionEnd === value.length;

  if (key === 'ArrowLeft') {
    return isAllSelected || (selectionStart === 0 && selectionEnd === 0);
  }

  if (key === 'ArrowRight') {
    return (
      (isAllSelected && value.length > 0) ||
      (selectionStart === value.length && selectionEnd === value.length)
    );
  }

  return false;
};

// Spreadsheet-like Design Table
export default function DesignTable() {
  const { project, activeDesignId, updateDesignRunResponse } = useProject();
  
  const design = activeDesignId && project?.data?.designs ? project.data.designs[activeDesignId] : null;
  const config = design?.config as CCDConfig;
  const runs = design?.runs as DesignRun[];

  const [viewMode, setViewMode] = useState<'actual' | 'coded'>('actual');
  const [selectedCell, setSelectedCell] = useState<{row: number, col: string} | null>(null);
  const [editingCell, setEditingCell] = useState<{row: number, col: string} | null>(null);
  const [editValue, setEditValue] = useState('');

  const inputRef = useRef<HTMLInputElement | null>(null);
  const isNavigatingRef = useRef(false);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
      isNavigatingRef.current = false;
    }
  }, [editingCell?.row, editingCell?.col]);

  if (!design || !config || !runs) {
    return (
      <div className="flex flex-col h-full bg-white items-center justify-center text-gray-500">
        <p>No design has been generated yet.</p>
        <p className="text-xs mt-2">Use Design &gt; Central Composite Design to create one.</p>
      </div>
    );
  }

  const saveCell = (rowIndex: number, colKey: string, valueStr: string): DesignRun[] => {
    if (!colKey.startsWith('resp_')) return runs;
    const respId = colKey.replace('resp_', '');
    const finalVal = parseResponseValue(valueStr);
    const targetRun = runs[rowIndex];
    if (!targetRun) return runs;

    const runId = targetRun.id || rowIndex;
    return updateDesignRunResponse(activeDesignId, runId, respId, finalVal) as DesignRun[];
  };

  const handleExportCsv = () => {
    if (!design) return;
    const csvContent = exportDesignTableToCsv(design, viewMode);
    const fileName = `${sanitizeFileName(design.name || 'Design_Table')}_${viewMode}.csv`;
    downloadCsvFile(csvContent, fileName);
  };

  const handleCellActivate = (
    rowIndex: number,
    colKey: string,
    currentValue: any,
    isResponse: boolean
  ) => {
    setSelectedCell({ row: rowIndex, col: colKey });

    if (!isResponse) {
      if (editingCell) {
        saveCell(editingCell.row, editingCell.col, editValue);
        setEditingCell(null);
      }
      return;
    }

    if (editingCell?.row === rowIndex && editingCell?.col === colKey) {
      inputRef.current?.focus();
      return;
    }

    if (editingCell) {
      saveCell(editingCell.row, editingCell.col, editValue);
    }

    const valStr = currentValue === null || currentValue === undefined ? '' : String(currentValue);
    isNavigatingRef.current = true;
    setEditingCell({ row: rowIndex, col: colKey });
    setEditValue(valStr);
  };

  const handleBlur = () => {
    if (isNavigatingRef.current) {
      isNavigatingRef.current = false;
      return;
    }
    if (editingCell) {
      saveCell(editingCell.row, editingCell.col, editValue);
      setEditingCell(null);
    }
  };

  const navigateCell = (direction: 'up' | 'down' | 'left' | 'right') => {
    if (!editingCell) return;

    const responseKeys = config.responses.map(r => `resp_${r.id}`);
    if (responseKeys.length === 0) return;

    const updatedRuns = saveCell(editingCell.row, editingCell.col, editValue);

    const target = getTargetCell(
      direction,
      editingCell.row,
      editingCell.col,
      runs.length,
      responseKeys
    );

    if (!target) return;

    if (target.row === editingCell.row && target.col === editingCell.col) {
      inputRef.current?.focus();
      inputRef.current?.select();
      return;
    }

    const targetRespId = target.col.replace('resp_', '');
    const rawVal = updatedRuns[target.row]?.responses?.[targetRespId];
    const targetValStr = rawVal === null || rawVal === undefined ? '' : String(rawVal);

    isNavigatingRef.current = true;
    setSelectedCell(target);
    setEditingCell(target);
    setEditValue(targetValStr);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setEditingCell(null);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      navigateCell(e.shiftKey ? 'up' : 'down');
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      navigateCell(e.shiftKey ? 'left' : 'right');
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      const input = e.currentTarget;
      if (shouldNavigate(e.key, input)) {
        e.preventDefault();
        const dirMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
          ArrowDown: 'down',
          ArrowUp: 'up',
          ArrowLeft: 'left',
          ArrowRight: 'right',
        };
        navigateCell(dirMap[e.key]);
      }
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
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded-sm font-medium text-gray-700 shadow-2xs transition-colors"
            title={`Export Design Table (${viewMode} values) to CSV`}
          >
            <Download size={13} className="text-blue-600" />
            <span>Export CSV</span>
          </button>
          <span className="text-gray-500 italic">{runs.length} Runs</span>
        </div>
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
                    ${isEditing ? 'outline outline-2 outline-blue-500 bg-white z-10' : ''}
                  `}
                  style={{ width: col.width }}
                  onMouseDown={() => handleCellActivate(rowIndex, col.key, displayValue, isResponse)}
                  onClick={() => handleCellActivate(rowIndex, col.key, displayValue, isResponse)}
                >
                  {isEditing ? (
                    <input 
                      ref={inputRef}
                      type="text" 
                      className="w-full h-full outline-none text-xs bg-transparent p-0 m-0 border-none"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onMouseDown={e => e.stopPropagation()}
                      onBlur={handleBlur}
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
