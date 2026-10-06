import { useState, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';

export default function NotesWorkspace() {
  const { project, saveProject } = useProject();
  const [notes, setNotes] = useState(project?.data?.notes || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (project?.data?.notes !== undefined) {
      setNotes(project.data.notes);
    }
  }, [project?.data?.notes]);

  const handleBlur = async () => {
    if (!project) return;
    if (notes !== (project.data?.notes || '')) {
      setIsSaving(true);
      try {
        project.data = {
          ...project.data,
          notes
        };
        await saveProject(project.name);
      } catch (e) {
        console.error(e);
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#FAFAFA] font-sans">
      <div className="bg-[#EAEAEA] border-b border-[#C0C0C0] px-3 py-1.5 flex items-center justify-between shrink-0">
        <h2 className="text-[12px] font-bold text-[#003366]">Design Comments...</h2>
        {isSaving && <span className="text-[10px] text-gray-500">Saving...</span>}
      </div>
      
      <div className="p-4 flex-1 flex flex-col">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleBlur}
          placeholder="Type Your Notes Here....."
          className="flex-1 w-full max-w-4xl border border-[#C0C0C0] p-3 text-[12px] font-sans text-gray-800 shadow-sm focus:outline-none focus:border-[#0055A4] focus:ring-1 focus:ring-[#0055A4] resize-none"
        />
      </div>
    </div>
  );
}
