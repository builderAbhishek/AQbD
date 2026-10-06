import { 
  File, 
  FolderOpen, 
  Save, 
  SaveAll,
  Undo2,
  Redo2,
  Table,
  BarChart2,
  PieChart,
  Settings,
  FileText
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

export default function ToolBar() {
  const { newProject, saveProject, project } = useProject();

  const ToolBtn = ({ icon: Icon, label, disabled, onClick }: any) => (
    <button 
      className={`p-1.5 rounded flex items-center justify-center ${disabled ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-[#D5D5D5] active:bg-[#C0C0C0]'}`}
      title={label}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      <Icon size={16} strokeWidth={1.5} />
    </button>
  );

  const Divider = () => <div className="w-px h-6 bg-gray-300 mx-1"></div>;

  return (
    <div className="bg-[#F0F0F0] flex items-center h-10 px-2 border-b border-[#A0A0A0]">
      <div className="flex items-center space-x-1">
        <ToolBtn icon={File} label="New Project (Ctrl+N)" onClick={newProject} />
        <ToolBtn icon={FolderOpen} label="Open Project (Ctrl+O)" onClick={() => window.dispatchEvent(new CustomEvent('request-open'))} />
        <ToolBtn 
          icon={Save} 
          label="Save (Ctrl+S)" 
          onClick={() => {
            if (project && !project.id.startsWith('temp-')) {
              saveProject(project.name);
            } else {
              window.dispatchEvent(new CustomEvent('request-save-as'));
            }
          }} 
        />
        <ToolBtn icon={SaveAll} label="Save As (Ctrl+Shift+S)" onClick={() => window.dispatchEvent(new CustomEvent('request-save-as'))} />
        
        <Divider />
        
        <ToolBtn icon={Undo2} label="Undo (Ctrl+Z)" disabled />
        <ToolBtn icon={Redo2} label="Redo (Ctrl+Y)" disabled />
        
        <Divider />
        
        <ToolBtn icon={Table} label="Design" disabled />
        <ToolBtn icon={BarChart2} label="Analyze" disabled />
        <ToolBtn icon={PieChart} label="Graphs" disabled />
        <ToolBtn icon={Settings} label="Optimize" disabled />
        <ToolBtn icon={FileText} label="Report" disabled />
      </div>
    </div>
  );
}
