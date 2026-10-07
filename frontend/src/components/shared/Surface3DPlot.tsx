import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Point } from './ScatterPlot';

export interface Surface3DPlotProps {
  gridData: {
    x: number[];
    y: number[];
    z: number[][];
    minZ: number;
    maxZ: number;
  };
  designPoints: Point[];
  xLabel: string;
  yLabel: string;
  title: string;
}

export function Surface3DPlot({ gridData, designPoints, xLabel, yLabel, title }: Surface3DPlotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Camera state
  const [yaw, setYaw] = useState(Math.PI / 4);
  const [pitch, setPitch] = useState(Math.PI / 6);
  const [zoom, setZoom] = useState(1);
  
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  // Normalize grid data for 3D engine (-1 to 1)
  const normalizedGrid = useMemo(() => {
    if (!gridData || gridData.x.length === 0) return null;
    const xMin = gridData.x[0], xMax = gridData.x[gridData.x.length - 1];
    const yMin = gridData.y[0], yMax = gridData.y[gridData.y.length - 1];
    
    // Fallback if min==max
    const dz = gridData.maxZ > gridData.minZ ? (gridData.maxZ - gridData.minZ) : 1;
    
    const zNorm = gridData.z.map(row => 
      row.map(v => ((v - gridData.minZ) / dz) - 0.5)
    );
    
    return {
      xMin, xMax, yMin, yMax, zNorm,
      dz, minZ: gridData.minZ, maxZ: gridData.maxZ
    };
  }, [gridData]);

  // Color helper
  const getColor = (z: number) => {
    if (gridData.maxZ === gridData.minZ) return 'rgb(0,255,0)';
    const ratio = Math.max(0, Math.min(1, (z - gridData.minZ) / (gridData.maxZ - gridData.minZ)));
    const hue = 240 - ratio * 240; 
    return `hsl(${hue}, 100%, 50%)`;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !normalizedGrid) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const scale = 250 * zoom;
    const cx = width / 2;
    const cy = height / 2 + 30;

    // Projection
    const project = (nx: number, ny: number, nz: number) => {
      // Rotate yaw around Z
      const rx = nx * Math.cos(yaw) - ny * Math.sin(yaw);
      const ry = nx * Math.sin(yaw) + ny * Math.cos(yaw);
      
      // Rotate pitch around X
      const pz = nz * Math.cos(pitch) - ry * Math.sin(pitch);
      const py = nz * Math.sin(pitch) + ry * Math.cos(pitch);
      
      return {
        sx: cx + rx * scale,
        sy: cy - py * scale,
        depth: pz // for depth sorting
      };
    };

    // 1. Build Quads
    const quads = [];
    const xLen = gridData.x.length;
    const yLen = gridData.y.length;
    
    for (let i = 0; i < xLen - 1; i += 2) { // Step by 2 for performance/rendering style if needed, but let's do all
      for (let j = 0; j < yLen - 1; j += 2) {
        const nx1 = ((i) / (xLen - 1)) * 2 - 1;
        const nx2 = ((i+2) / (xLen - 1)) * 2 - 1;
        const ny1 = ((j) / (yLen - 1)) * 2 - 1;
        const ny2 = ((j+2) / (yLen - 1)) * 2 - 1;

        // Ensure we don't go out of bounds
        const i2 = Math.min(i+2, xLen-1);
        const j2 = Math.min(j+2, yLen-1);

        const z00 = normalizedGrid.zNorm[i][j];
        const z10 = normalizedGrid.zNorm[i2][j];
        const z01 = normalizedGrid.zNorm[i][j2];
        const z11 = normalizedGrid.zNorm[i2][j2];

        const p00 = project(nx1, ny1, z00);
        const p10 = project(nx2, ny1, z10);
        const p01 = project(nx1, ny2, z01);
        const p11 = project(nx2, ny2, z11);

        const avgDepth = (p00.depth + p10.depth + p01.depth + p11.depth) / 4;
        const realZ = gridData.z[i][j];

        quads.push({
          pts: [p00, p10, p11, p01],
          depth: avgDepth,
          color: getColor(realZ)
        });
      }
    }

    // 2. Build Axes lines
    const axes = [];
    axes.push({ pts: [project(-1,-1,-0.5), project(1,-1,-0.5)], depth: (project(-1,-1,-0.5).depth+project(1,-1,-0.5).depth)/2, isAxis: true });
    axes.push({ pts: [project(-1,-1,-0.5), project(-1,1,-0.5)], depth: (project(-1,-1,-0.5).depth+project(-1,1,-0.5).depth)/2, isAxis: true });
    axes.push({ pts: [project(-1,-1,-0.5), project(-1,-1,0.5)], depth: (project(-1,-1,-0.5).depth+project(-1,-1,0.5).depth)/2, isAxis: true });

    // 3. Build Design Points
    const points = designPoints.map(pt => {
      const nx = ((pt.x - normalizedGrid.xMin) / (normalizedGrid.xMax - normalizedGrid.xMin)) * 2 - 1;
      const ny = ((pt.y - normalizedGrid.yMin) / (normalizedGrid.yMax - normalizedGrid.yMin)) * 2 - 1;
      
      const realZ = pt.data.observed;
      const nz = ((realZ - normalizedGrid.minZ) / normalizedGrid.dz) - 0.5;

      const p = project(nx, ny, nz);
      return {
        ...p,
        pt,
        isPoint: true
      };
    });

    // 4. Sort all by depth (Painter's algorithm)
    const renderList = [...quads, ...axes, ...points];
    renderList.sort((a, b) => a.depth - b.depth);

    // 5. Draw
    for (const item of renderList) {
      if ((item as any).isAxis) {
        ctx.beginPath();
        ctx.moveTo((item as any).pts[0].sx, (item as any).pts[0].sy);
        ctx.lineTo((item as any).pts[1].sx, (item as any).pts[1].sy);
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if ((item as any).isPoint) {
        ctx.beginPath();
        ctx.arc((item as any).sx, (item as any).sy, 4, 0, 2*Math.PI);
        ctx.fillStyle = (item as any).pt.color || '#E04A26';
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        const quad = item as any;
        ctx.beginPath();
        ctx.moveTo(quad.pts[0].sx, quad.pts[0].sy);
        ctx.lineTo(quad.pts[1].sx, quad.pts[1].sy);
        ctx.lineTo(quad.pts[2].sx, quad.pts[2].sy);
        ctx.lineTo(quad.pts[3].sx, quad.pts[3].sy);
        ctx.closePath();
        
        ctx.fillStyle = quad.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.15)'; // wireframe over surface
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }

    // Title
    ctx.fillStyle = '#003366';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, 20);

  }, [gridData, designPoints, yaw, pitch, zoom, normalizedGrid, title]);

  // Handlers for Rotation
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      setYaw(y => y - dx * 0.01);
      setPitch(p => Math.max(-Math.PI/2, Math.min(Math.PI/2, p + dy * 0.01)));
      lastMouse.current = { x: e.clientX, y: e.clientY };
    } else {
      // Hover detection logic would go here. A 3D raycast is expensive, so we just check screen pos of design points for tooltips.
      const canvas = canvasRef.current;
      if (!canvas || !normalizedGrid) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setMousePos({ x: mx, y: my });

      const scale = 250 * zoom;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2 + 30;

      const project = (nx: number, ny: number, nz: number) => {
        const rx = nx * Math.cos(yaw) - ny * Math.sin(yaw);
        const ry = nx * Math.sin(yaw) + ny * Math.cos(yaw);
        const py = nz * Math.sin(pitch) + ry * Math.cos(pitch);
        return { sx: cx + rx * scale, sy: cy - py * scale };
      };

      let found = null;
      for (const pt of designPoints) {
        const nx = ((pt.x - normalizedGrid.xMin) / (normalizedGrid.xMax - normalizedGrid.xMin)) * 2 - 1;
        const ny = ((pt.y - normalizedGrid.yMin) / (normalizedGrid.yMax - normalizedGrid.yMin)) * 2 - 1;
        const nz = ((pt.data.observed - normalizedGrid.minZ) / normalizedGrid.dz) - 0.5;
        const { sx, sy } = project(nx, ny, nz);
        if (Math.hypot(sx - mx, sy - my) < 10) {
          found = pt;
          break;
        }
      }
      setHoveredPoint(found);
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-white border border-[#C0C0C0] shadow-sm">
      <div className="absolute top-2 left-2 z-10 flex gap-2">
        <button onClick={() => { setYaw(Math.PI / 4); setPitch(Math.PI / 6); setZoom(1); }} className="px-2 py-1 bg-[#EAEAEA] border border-[#C0C0C0] text-[10px] text-[#003366] hover:bg-gray-200 shadow-sm rounded-sm">
          Reset View
        </button>
      </div>
      <canvas 
        ref={canvasRef} 
        width={600} 
        height={500} 
        className={`w-[600px] h-[500px] max-w-full max-h-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setIsDragging(false); setHoveredPoint(null); }}
        onWheel={(e) => {
          // e.preventDefault();
          setZoom(z => Math.max(0.2, Math.min(5, z - e.deltaY * 0.001)));
        }}
      />
      
      {hoveredPoint && (
        <div 
          className="absolute bg-white border border-[#C0C0C0] p-2 shadow-md text-[11px] pointer-events-none rounded-sm z-50 font-sans"
          style={{ left: mousePos.x + 15, top: mousePos.y - 15 }}
        >
          <div className="font-bold text-[#003366] mb-1">Run {hoveredPoint.data.runOrder}</div>
          <div className="grid grid-cols-2 gap-x-3">
            <span className="text-gray-600">X1:</span>
            <span className="font-mono">{hoveredPoint.x.toFixed(3)}</span>
            <span className="text-gray-600">X2:</span>
            <span className="font-mono">{hoveredPoint.y.toFixed(3)}</span>
            <span className="text-gray-600">Observed:</span>
            <span className="font-mono text-[#B30000]">{hoveredPoint.data.observed.toFixed(3)}</span>
            <span className="text-gray-600">Predicted:</span>
            <span className="font-mono">{hoveredPoint.data.predicted.toFixed(3)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
