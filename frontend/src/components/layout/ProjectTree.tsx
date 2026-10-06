import React, { useState, useMemo, useEffect } from 'react';
import { ChevronRight, ChevronDown, Folder, File as FileIcon, Shuffle, Grid, Beaker, Info } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

type TreeNode = {
  id: string;
  label: string;
  children?: TreeNode[];
  isFolder?: boolean;
  disabled?: boolean;
  isFuture?: boolean;
  icon?: React.ReactNode;
  isDesignInstance?: boolean;
  color?: string; // Optional custom color for folders
};

export default function ProjectTree() {
  const { project, activeNode, setActiveNode, setActiveTab, activeDesignId, setActiveDesignId } = useProject();
  
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    'std_designs': true,
    'rs': true,
    'rs_randomized': true,
    'project_data': true,
    'project_designs': true,
    'grp_design': true,
    'grp_analysis': true,
    'grp_optimization': true,
    'grp_post': true,
  });

  useEffect(() => {
    const handleDesignCreated = () => {
      setExpanded(prev => ({
        ...prev,
        'std_designs': false,
        'project_data': true,
        'project_designs': true,
        'grp_design': true,
        'grp_analysis': true
      }));
    };
    window.addEventListener('design-created', handleDesignCreated);
    return () => window.removeEventListener('design-created', handleDesignCreated);
  }, []);

  useEffect(() => {
    if (project?.data?.designs && Object.keys(project.data.designs).length > 0) {
      setExpanded(prev => ({
        ...prev,
        'std_designs': false,
        'project_data': true,
        'project_designs': true
      }));
    } else {
      setExpanded(prev => ({
        ...prev,
        'std_designs': true,
        'project_data': true,
        'project_designs': true
      }));
    }
  }, [project?.id]);

  useEffect(() => {
    if (!activeDesignId) {
      setExpanded(prev => ({
        ...prev,
        'std_designs': true
      }));
    }
  }, [activeDesignId]);

  const treeData = useMemo(() => {
    const designNodes: TreeNode[] = [];
    if (project?.data?.designs) {
      Object.values(project.data.designs).forEach((d: any) => {
        let name = d.name;
        if (!name) {
          name = d.type === 'CCD' ? 'Central Composite' : 'Box-Behnken';
          if (d.config?.responses && d.config.responses.length > 0) {
            name += ` - ${d.config.responses[0].name}`;
          }
        }
        designNodes.push({
          id: d.id,
          label: name,
          isDesignInstance: true,
          icon: <Grid size={14} />
        });
      });
    }

    const stdDesigns: TreeNode = {
      id: 'std_designs',
      label: 'Standard Designs',
      isFolder: true,
      children: [
        {
          id: 'rs',
          label: 'Response Surface',
          isFolder: true,
          icon: <Beaker size={14} />,
          children: [
            {
              id: 'rs_randomized',
              label: 'Randomized',
              isFolder: true,
              icon: <Shuffle size={14} />,
              children: [
                { id: 'ccd', label: 'Central Composite', icon: <Grid size={14} /> },
                { id: 'bbd', label: 'Box-Behnken', icon: <Grid size={14} /> }
              ]
            }
          ]
        },
        { id: 'split_plot', label: 'Split-Plot', isFolder: true, disabled: true, children: [] },
        { id: 'mixture', label: 'Mixture', isFolder: true, disabled: true, children: [] },
        {
          id: 'custom_designs',
          label: 'Custom Designs',
          isFolder: true,
          disabled: true,
          children: [
            { id: 'cd_optimal', label: 'Optimal (Combined)', disabled: true },
            { id: 'cd_blank', label: 'Blank Spreadsheet', disabled: true },
            { id: 'cd_import', label: 'Import Data Set', disabled: true },
            { id: 'cd_user', label: 'User-Defined', disabled: true },
            { id: 'cd_simple', label: 'Simple Sample', disabled: true },
          ]
        }
      ]
    };

    const projectNode: TreeNode = {
      id: 'project_data',
      label: project ? `Project: ${project.name}` : 'Project',
      isFolder: true,
      children: [
        {
          id: 'project_designs',
          label: 'Designs',
          isFolder: true,
          children: designNodes
        }
      ]
    };

    if (activeDesignId && project?.data?.designs?.[activeDesignId]) {
      const activeDesign = project.data.designs[activeDesignId];
      const responses = activeDesign.config?.responses || [];

      let activeName = activeDesign.name;
      if (!activeName) {
        activeName = activeDesign.type === 'CCD' ? 'Central Composite' : 'Box-Behnken';
        if (responses.length > 0) activeName += ` - ${responses[0].name}`;
      }
      
      const rName = responses.length > 0 ? responses[0].name : 'R1';
      const hasAnalysis = Boolean(activeDesign.analyses && activeDesign.analyses[responses[0]?.id]);

      projectNode.children = [
        {
          id: 'grp_information',
          label: 'Information',
          isFolder: true,
          icon: <Info size={14} className="text-[#FF8C00]" />,
          children: [
            { id: 'Notes', label: 'Notes' },
            { id: 'Summary', label: 'Summary' }
          ]
        },
        {
          id: 'Design Overview',
          label: 'Design Overview',
          isFolder: true
        },
        {
          id: 'grp_design',
          label: 'Design',
          isFolder: true,
          color: '#0055A4',
          children: [
            {
              id: activeDesign.id,
              label: activeName,
              isDesignInstance: true,
              icon: <Grid size={14} />
            },
            { id: 'Design Table', label: 'Design (Actual)' },
            { id: 'Graph Columns', label: 'Graph Columns', disabled: true },
            { id: 'Evaluation', label: 'Evaluation', disabled: true },
            { id: 'Constraints', label: 'Constraints', disabled: true },
          ]
        },
        {
          id: 'grp_analysis',
          label: 'Analysis',
          isFolder: true,
          color: '#008000',
          children: [
            { id: 'Analysis', label: `${rName} ${hasAnalysis ? '(Analyzed)' : '(Empty)'}`.trim() },
          ]
        },
        {
          id: 'grp_optimization',
          label: 'Optimization',
          isFolder: true,
          color: '#B30000',
          children: [
            { id: 'Numerical', label: 'Numerical', disabled: true, isFuture: true },
            { id: 'Graphical', label: 'Graphical', disabled: true, isFuture: true },
          ]
        },
        {
          id: 'grp_post',
          label: 'Post Analysis',
          isFolder: true,
          color: '#7A5B00',
          children: [
            { id: 'Prediction', label: 'Point Prediction', disabled: true, isFuture: true },
            { id: 'Confirmation', label: 'Confirmation', disabled: true, isFuture: true },
            { id: 'Report', label: 'Coefficients Table', disabled: true, isFuture: true },
          ]
        }
      ];
      
      return [projectNode];
    }

    return [stdDesigns, projectNode];
  }, [project?.data?.designs, project?.name, activeDesignId]);

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleNodeClick = (node: TreeNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.disabled) return;
    
    if (node.isFolder) {
      toggleExpand(node.id);
      if (node.id === 'Design Overview') {
        setActiveNode(node.id);
        setActiveTab(node.id);
      }
    } else {
      if (node.isDesignInstance) {
        setActiveDesignId(node.id);
        setActiveNode('Design Table');
        setActiveTab('Design Table');
      } else {
        setActiveNode(node.id);
        if (node.id !== 'ccd' && node.id !== 'bbd') {
          setActiveTab(node.id);
        }
      }
    }
  };

  const handleDoubleClick = (node: TreeNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.disabled) return;
    
    if (!node.isFolder) {
      if (node.id === 'ccd') {
        window.dispatchEvent(new CustomEvent('request-ccd-wizard'));
      } else if (node.id === 'bbd') {
        window.dispatchEvent(new CustomEvent('request-bbd-wizard'));
      }
    }
  };

  const handleKeyDown = (node: TreeNode, e: React.KeyboardEvent) => {
    if (node.disabled) return;

    switch (e.key) {
      case 'Enter':
        if (!node.isFolder) {
          if (node.id === 'ccd') window.dispatchEvent(new CustomEvent('request-ccd-wizard'));
          else if (node.id === 'bbd') window.dispatchEvent(new CustomEvent('request-bbd-wizard'));
          else if (node.isDesignInstance) {
            setActiveDesignId(node.id);
            setActiveNode('Design Table');
            setActiveTab('Design Table');
          }
          else setActiveTab(node.id);
        } else {
          toggleExpand(node.id);
        }
        break;
      case 'ArrowRight':
        if (node.isFolder && !expanded[node.id]) toggleExpand(node.id);
        break;
      case 'ArrowLeft':
        if (node.isFolder && expanded[node.id]) toggleExpand(node.id);
        break;
      default:
        break;
    }
  };

  const renderNode = (node: TreeNode, depth = 0) => {
    const isExpanded = expanded[node.id];
    let isSelected = false;
    
    if (node.isDesignInstance) {
      isSelected = activeDesignId === node.id && (activeNode === 'Design Table' || activeNode === node.id);
    } else {
      isSelected = activeNode === node.id || (activeNode === node.label && !node.isFolder);
    }

    const paddingLeft = `${depth * 16 + 8}px`;

    let iconToRender = null;
    if (node.icon) {
      iconToRender = node.icon;
    } else if (node.isFolder) {
      iconToRender = <Folder size={14} fill={isExpanded ? "#FFDCA8" : "#FFC875"} color={node.disabled ? "#A0A0A0" : "#D99B38"} />;
    } else {
      iconToRender = <FileIcon size={14} />;
    }

    return (
      <div key={node.id}>
        <div 
          tabIndex={node.disabled ? -1 : 0}
          className={`flex items-center py-1 outline-none select-none ${
            node.disabled 
              ? 'text-[#A0A0A0] cursor-not-allowed' 
              : `cursor-pointer hover:bg-[#E5F3FF] ${isSelected ? 'bg-[#CCE8FF] text-[#003366] font-medium' : 'text-gray-800'}`
          }`}
          style={{ paddingLeft }}
          onClick={(e) => handleNodeClick(node, e)}
          onDoubleClick={(e) => handleDoubleClick(node, e)}
          onKeyDown={(e) => handleKeyDown(node, e)}
          title={node.disabled ? 'Not available in V1' : ''}
        >
          <span 
            className="w-4 h-4 flex items-center justify-center mr-1" 
            onClick={node.isFolder && !node.disabled ? (e) => toggleExpand(node.id, e) : undefined}
          >
            {node.isFolder && (
              isExpanded 
                ? <ChevronDown size={14} className={node.disabled ? "text-gray-300" : "text-gray-500"} /> 
                : <ChevronRight size={14} className={node.disabled ? "text-gray-300" : "text-gray-500"} />
            )}
          </span>
          {node.isFolder && node.color ? (
             <span className="mr-1.5" style={{ color: node.color, fontWeight: 'bold' }}>
               {iconToRender}
             </span>
          ) : (
            <span className={`mr-1.5 ${node.disabled ? 'text-gray-300' : 'text-gray-500'}`}>
              {iconToRender}
            </span>
          )}
          <span className={`truncate ${node.isFolder && node.color ? 'font-semibold' : ''}`} style={node.isFolder && node.color ? { color: node.color } : {}}>
            {node.label}
          </span>
          {node.isFuture && (
            <span className="ml-2 text-[10px] text-gray-400 italic">(V2)</span>
          )}
        </div>
        {node.isFolder && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#FAFAFA] text-[12px] font-sans overflow-hidden border-r border-[#C0C0C0]">
      <div className="bg-[#EAEAEA] font-bold text-xs px-2 py-1.5 border-b border-[#C0C0C0] text-[#003366] shrink-0">
        Project Explorer
      </div>
      <div className="flex-1 overflow-auto py-1">
        {treeData.map(node => renderNode(node, 0))}
      </div>
    </div>
  );
}
