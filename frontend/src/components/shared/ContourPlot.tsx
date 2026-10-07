import React, { useEffect, useRef, useState } from 'react';
import { Point } from './ScatterPlot';

export interface ContourPlotProps {
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

export function ContourPlot({ gridData, designPoints, xLabel, yLabel, title }: ContourPlotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    
    // Margins
    const mTop = 40, mRight = 40, mBottom = 60, mLeft = 60;
    const innerW = width - mLeft - mRight;
    const innerH = height - mTop - mBottom;

    ctx.clearRect(0, 0, width, height);

    if (!gridData || gridData.x.length === 0) return;

    // Helper: color map (Blue -> Cyan/Green -> Yellow -> Red)
    const getColor = (z: number) => {
      if (gridData.maxZ === gridData.minZ) return 'rgb(0,255,0)';
      const ratio = Math.max(0, Math.min(1, (z - gridData.minZ) / (gridData.maxZ - gridData.minZ)));
      const hue = 240 - ratio * 240; 
      return `hsl(${hue}, 100%, 50%)`;
    };

    const scaleX = (x: number) => mLeft + ((x - gridData.x[0]) / (gridData.x[gridData.x.length - 1] - gridData.x[0])) * innerW;
    const scaleY = (y: number) => height - mBottom - ((y - gridData.y[0]) / (gridData.y[gridData.y.length - 1] - gridData.y[0])) * innerH;

    // 1. Draw color field
    const xLen = gridData.x.length;
    const yLen = gridData.y.length;
    
    for (let i = 0; i < xLen - 1; i++) {
      for (let j = 0; j < yLen - 1; j++) {
        const cx1 = scaleX(gridData.x[i]);
        const cx2 = scaleX(gridData.x[i+1]);
        const cy1 = scaleY(gridData.y[j]); // Note: SVG/Canvas Y is inverted
        const cy2 = scaleY(gridData.y[j+1]);
        
        // Use average Z for color
        const zAvg = (gridData.z[i][j] + gridData.z[i+1][j] + gridData.z[i][j+1] + gridData.z[i+1][j+1]) / 4;
        
        ctx.fillStyle = getColor(zAvg);
        // cy2 is smaller than cy1 because Y goes up
        ctx.fillRect(cx1, cy2, cx2 - cx1 + 1, cy1 - cy2 + 1);
      }
    }

    // 2. Draw Contour Lines (marching squares simplified or just sampled)
    const numLevels = 10;
    const levels = [];
    for (let l = 1; l < numLevels; l++) {
      levels.push(gridData.minZ + (gridData.maxZ - gridData.minZ) * (l / numLevels));
    }
    
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillStyle = '#000';
    ctx.font = '9px sans-serif';
    
    // Very basic marching squares
    for (const lvl of levels) {
      ctx.beginPath();
      for (let i = 0; i < xLen - 1; i++) {
        for (let j = 0; j < yLen - 1; j++) {
           const zbl = gridData.z[i][j] - lvl; // bottom-left
           const ztl = gridData.z[i][j+1] - lvl; // top-left (wait, y array maps j=0 to bottom if we do it that way. In our array gridData.y[0] is min value which is bottom. Yes)
           // Actually, z is z[xIndex][yIndex].
           const zbr = gridData.z[i+1][j] - lvl; // bottom-right
           const ztr = gridData.z[i+1][j+1] - lvl; // top-right
           
           const x1 = scaleX(gridData.x[i]), x2 = scaleX(gridData.x[i+1]);
           const y1 = scaleY(gridData.y[j]), y2 = scaleY(gridData.y[j+1]); // y2 < y1
           
           let pts = [];
           // bottom edge
           if (zbl * zbr < 0) pts.push({ x: x1 + (x2 - x1) * Math.abs(zbl / (zbr - zbl)), y: y1 });
           // top edge
           if (ztl * ztr < 0) pts.push({ x: x1 + (x2 - x1) * Math.abs(ztl / (ztr - ztl)), y: y2 });
           // left edge
           if (zbl * ztl < 0) pts.push({ x: x1, y: y1 + (y2 - y1) * Math.abs(zbl / (ztl - zbl)) });
           // right edge
           if (zbr * ztr < 0) pts.push({ x: x2, y: y1 + (y2 - y1) * Math.abs(zbr / (ztr - zbr)) });
           
           if (pts.length === 2) {
             ctx.moveTo(pts[0].x, pts[0].y);
             ctx.lineTo(pts[1].x, pts[1].y);
             
             // Draw label sometimes
             if (i === Math.floor(xLen/2) && j % 10 === 0) {
                // ctx.fillText(lvl.toFixed(2), pts[0].x, pts[0].y);
             }
           }
        }
      }
      ctx.stroke();
    }

    // 3. Axes & Labels
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mLeft, mTop);
    ctx.lineTo(mLeft, height - mBottom);
    ctx.lineTo(width - mRight, height - mBottom);
    ctx.stroke();

    ctx.fillStyle = '#003366';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, mTop / 2);

    ctx.fillStyle = '#4a5568';
    ctx.font = '600 12px sans-serif';
    ctx.fillText(xLabel, width / 2, height - 15);
    
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();

    // Ticks
    ctx.fillStyle = '#4a5568';
    ctx.font = '11px sans-serif';
    const numTicks = 6;
    for (let i = 0; i < numTicks; i++) {
      const tx = gridData.x[0] + (gridData.x[xLen-1] - gridData.x[0]) * (i / (numTicks - 1));
      const px = scaleX(tx);
      ctx.fillText(tx.toFixed(2), px, height - mBottom + 16);
      
      const ty = gridData.y[0] + (gridData.y[yLen-1] - gridData.y[0]) * (i / (numTicks - 1));
      const py = scaleY(ty);
      ctx.textAlign = 'right';
      ctx.fillText(ty.toFixed(2), mLeft - 8, py + 4);
      ctx.textAlign = 'center';
    }

    // 4. Design Points
    designPoints.forEach(pt => {
       const px = scaleX(pt.x);
       const py = scaleY(pt.y);
       ctx.beginPath();
       ctx.arc(px, py, 4, 0, 2 * Math.PI);
       ctx.fillStyle = pt.color || '#E04A26';
       ctx.fill();
       ctx.lineWidth = 1;
       ctx.strokeStyle = '#000';
       ctx.stroke();

       if (pt.data?.runOrder) {
         ctx.fillStyle = '#333';
         ctx.textAlign = 'left';
         ctx.fillText(String(pt.data.runOrder), px + 6, py + 3);
       }
    });

  }, [gridData, designPoints, xLabel, yLabel, title]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    setMousePos({ x: mx, y: my });

    // Check hit test on points
    const mTop = 40, mBottom = 60, mLeft = 60;
    const innerW = rect.width - mLeft - 40;
    const innerH = rect.height - mTop - mBottom;

    const scaleX = (x: number) => mLeft + ((x - gridData.x[0]) / (gridData.x[gridData.x.length - 1] - gridData.x[0])) * innerW;
    const scaleY = (y: number) => rect.height - mBottom - ((y - gridData.y[0]) / (gridData.y[gridData.y.length - 1] - gridData.y[0])) * innerH;

    let found = null;
    for (const pt of designPoints) {
      const px = scaleX(pt.x);
      const py = scaleY(pt.y);
      if (Math.hypot(px - mx, py - my) < 8) {
        found = pt;
        break;
      }
    }
    
    if (found) {
      setHoveredPoint(found);
    } else {
      // Find predicted value at mouse
      if (mx >= mLeft && mx <= rect.width - 40 && my >= mTop && my <= rect.height - mBottom) {
         const xVal = gridData.x[0] + ((mx - mLeft) / innerW) * (gridData.x[gridData.x.length - 1] - gridData.x[0]);
         const yVal = gridData.y[0] + ((rect.height - mBottom - my) / innerH) * (gridData.y[gridData.y.length - 1] - gridData.y[0]);
         
         // Interpolate Z
         let zVal = gridData.minZ; // fallback
         // Simple nearest neighbor:
         const i = Math.round(((xVal - gridData.x[0]) / (gridData.x[gridData.x.length - 1] - gridData.x[0])) * (gridData.x.length - 1));
         const j = Math.round(((yVal - gridData.y[0]) / (gridData.y[gridData.y.length - 1] - gridData.y[0])) * (gridData.y.length - 1));
         if (gridData.z[i] && gridData.z[i][j] !== undefined) {
           zVal = gridData.z[i][j];
         }
         
         setHoveredPoint({
           isSurfaceHover: true,
           x: xVal,
           y: yVal,
           z: zVal
         });
      } else {
         setHoveredPoint(null);
      }
    }
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <canvas 
        ref={canvasRef} 
        width={600} 
        height={500} 
        className="w-[600px] h-[500px] max-w-full max-h-full cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredPoint(null)}
      />
      
      {hoveredPoint && (
        <div 
          className="absolute bg-white border border-[#C0C0C0] p-2 shadow-md text-[11px] pointer-events-none rounded-sm z-50 font-sans"
          style={{ left: mousePos.x + 15, top: mousePos.y - 15 }}
        >
          {hoveredPoint.isSurfaceHover ? (
            <>
              <div className="font-bold text-[#003366] mb-1">Prediction</div>
              <div className="grid grid-cols-2 gap-x-3">
                <span className="text-gray-600">X1:</span>
                <span className="font-mono">{hoveredPoint.x.toFixed(3)}</span>
                <span className="text-gray-600">X2:</span>
                <span className="font-mono">{hoveredPoint.y.toFixed(3)}</span>
                <span className="text-gray-600">Predicted:</span>
                <span className="font-mono text-[#E04A26] font-bold">{hoveredPoint.z.toFixed(3)}</span>
              </div>
            </>
          ) : (
            <>
              <div className="font-bold text-[#003366] mb-1">Run {hoveredPoint.data.runOrder}</div>
              <div className="grid grid-cols-2 gap-x-3">
                <span className="text-gray-600">X1:</span>
                <span className="font-mono">{hoveredPoint.x.toFixed(3)}</span>
                <span className="text-gray-600">X2:</span>
                <span className="font-mono">{hoveredPoint.y.toFixed(3)}</span>
                <span className="text-gray-600">Observed:</span>
                <span className="font-mono">{hoveredPoint.data.observed.toFixed(3)}</span>
                <span className="text-gray-600">Predicted:</span>
                <span className="font-mono">{hoveredPoint.data.predicted.toFixed(3)}</span>
                <span className="text-gray-600">Residual:</span>
                <span className="font-mono">{hoveredPoint.data.residual > 0 ? '+' : ''}{hoveredPoint.data.residual.toFixed(3)}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
