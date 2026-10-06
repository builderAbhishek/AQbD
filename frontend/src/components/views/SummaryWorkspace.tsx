import { useProject } from '../../context/ProjectContext';

export default function SummaryWorkspace() {
  const { project, activeDesignId } = useProject();

  const activeDesign = project?.data?.designs?.[activeDesignId || ''];

  return (
    <div className="flex flex-col h-full bg-[#FAFAFA] font-sans">
      <div className="bg-[#EAEAEA] border-b border-[#C0C0C0] px-3 py-1.5 flex items-center shrink-0">
        <h2 className="text-[12px] font-bold text-[#003366]">Build Information</h2>
      </div>

      <div className="p-4 flex-1 overflow-auto">
        <div className="mb-6">
          <h3 className="text-[13px] font-bold text-gray-800 mb-2 border-b border-[#C0C0C0] pb-1">Project Information</h3>
          <table className="w-[400px] text-[11px] text-left border-collapse border border-[#C0C0C0] bg-white">
            <tbody>
              <tr className="border-b border-[#EAEAEA]">
                <td className="py-1.5 px-2 bg-[#F5F5F5] font-semibold w-32 border-r border-[#C0C0C0]">Name</td>
                <td className="py-1.5 px-2 text-gray-800">{project?.name || '(Untitled)'}</td>
              </tr>
              <tr className="border-b border-[#EAEAEA]">
                <td className="py-1.5 px-2 bg-[#F5F5F5] font-semibold border-r border-[#C0C0C0]">Status</td>
                <td className="py-1.5 px-2 text-gray-800">{project?.status || 'NEW'}</td>
              </tr>
              <tr>
                <td className="py-1.5 px-2 bg-[#F5F5F5] font-semibold border-r border-[#C0C0C0]">Created</td>
                <td className="py-1.5 px-2 text-gray-800">
                  {project?.createdAt ? new Date(project.createdAt).toLocaleDateString() : ''}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {activeDesign && (
          <div className="mb-6">
            <h3 className="text-[13px] font-bold text-gray-800 mb-2 border-b border-[#C0C0C0] pb-1">Active Design Information</h3>
            <table className="w-[400px] text-[11px] text-left border-collapse border border-[#C0C0C0] bg-white">
              <tbody>
                <tr className="border-b border-[#EAEAEA]">
                  <td className="py-1.5 px-2 bg-[#F5F5F5] font-semibold w-32 border-r border-[#C0C0C0]">Design Type</td>
                  <td className="py-1.5 px-2 text-gray-800">{activeDesign.type === 'CCD' ? 'Central Composite' : activeDesign.type === 'BBD' ? 'Box-Behnken' : activeDesign.type}</td>
                </tr>
                <tr className="border-b border-[#EAEAEA]">
                  <td className="py-1.5 px-2 bg-[#F5F5F5] font-semibold border-r border-[#C0C0C0]">Factors</td>
                  <td className="py-1.5 px-2 text-gray-800 font-mono">{activeDesign.config?.factors?.length || 0}</td>
                </tr>
                <tr className="border-b border-[#EAEAEA]">
                  <td className="py-1.5 px-2 bg-[#F5F5F5] font-semibold border-r border-[#C0C0C0]">Responses</td>
                  <td className="py-1.5 px-2 text-gray-800 font-mono">{activeDesign.config?.responses?.length || 0}</td>
                </tr>
                <tr>
                  <td className="py-1.5 px-2 bg-[#F5F5F5] font-semibold border-r border-[#C0C0C0]">Runs</td>
                  <td className="py-1.5 px-2 text-gray-800 font-mono">{activeDesign.runs?.length || 0}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}
