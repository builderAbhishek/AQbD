import React, { useRef, useEffect, useState, useMemo } from 'react';
import { FactorBounds, actualToCoded } from '../../../../lib/optimization/solver';
import {
  OverlayGridResult,
  SlicedDesignPoint,
  ResponseGraphicalLimit,
} from '../../../../lib/optimization/graphicalOptimization';
import { AlertTriangle } from 'lucide-react';

interface OverlayPlotCanvasProps {
  grid: OverlayGridResult;
  designPoints: SlicedDesignPoint[];
  fX: FactorBounds;
  fY: FactorBounds;
  allFactors: FactorBounds[];
  heldValues: Record<string, number>;
  limits: Record<string, ResponseGraphicalLimit>;
  codingMode: 'actual' | 'coded';
  showAllPointsProjected?: boolean;
}

export function OverlayPlotCanvas({
  grid,
  designPoints,
  fX,
  fY,
  allFactors,
  heldValues,
  limits,
  codingMode,
  showAllPointsProjected = false,
}: OverlayPlotCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Tooltip state
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    pixelX: number;
    pixelY: number;
    factorX: number;
    factorY: number;
    isFeasible: boolean;
    predictions: Record<string, number>;
    violations: string[];
    hoveredPoint?: SlicedDesignPoint;
  } | null>(null);

  // Held factors list for metadata sidebar
  const heldFactors = useMemo(() => {
    return allFactors.filter(f => f.id !== fX.id && f.id !== fY.id);
  }, [allFactors, fX.id, fY.id]);

  // Factor letters for Design-Expert notation (A, B, C...)
  const fXLetter = String.fromCharCode(65 + allFactors.findIndex(f => f.id === fX.id));
  const fYLetter = String.fromCharCode(65 + allFactors.findIndex(f => f.id === fY.id));

  // Canvas drawing dimensions
  const mTop = 45;
  const mRight = 35;
  const mBottom = 55;
  const mLeft = 65;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const innerW = width - mLeft - mRight;
    const innerH = height - mTop - mBottom;

    ctx.clearRect(0, 0, width, height);

    if (!grid || grid.xValues.length === 0 || grid.yValues.length === 0) return;

    const xMin = grid.xValues[0];
    const xMax = grid.xValues[grid.xValues.length - 1];
    const yMin = grid.yValues[0];
    const yMax = grid.yValues[grid.yValues.length - 1];

    const toPxX = (x: number) => mLeft + ((x - xMin) / (xMax - xMin)) * innerW;
    const toPxY = (y: number) => height - mBottom - ((y - yMin) / (yMax - yMin)) * innerH;

    const res = grid.feasibilityMatrix.length;

    // 1. Draw Feasible (Yellow #FFFF00) and Infeasible (Gray #D1D5DB) cells
    for (let i = 0; i < res - 1; i++) {
      for (let j = 0; j < res - 1; j++) {
        const x1 = toPxX(grid.xValues[i]);
        const x2 = toPxX(grid.xValues[i + 1]);
        const y1 = toPxY(grid.yValues[j]); // Bottom
        const y2 = toPxY(grid.yValues[j + 1]); // Top

        // Average feasibility of 4 cell corners
        const fSum =
          grid.feasibilityMatrix[i][j] +
          grid.feasibilityMatrix[i + 1][j] +
          grid.feasibilityMatrix[i][j + 1] +
          grid.feasibilityMatrix[i + 1][j + 1];

        if (fSum >= 3) {
          // Feasible cell -> Bright Yellow
          ctx.fillStyle = '#FFFF00';
        } else if (fSum >= 1) {
          // Boundary cell -> Light Yellow / Transition
          ctx.fillStyle = '#FFF86B';
        } else {
          // Infeasible cell -> Neutral gray
          ctx.fillStyle = '#E5E7EB';
        }

        ctx.fillRect(x1, y2, Math.max(1, x2 - x1 + 0.5), Math.max(1, y1 - y2 + 0.5));
      }
    }

    // 2. Draw sharp contour boundary between feasible and infeasible zones
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1.8;
    ctx.beginPath();

    for (let i = 0; i < res - 1; i++) {
      for (let j = 0; j < res - 1; j++) {
        const cBL = grid.feasibilityMatrix[i][j] - 0.5;
        const cBR = grid.feasibilityMatrix[i + 1][j] - 0.5;
        const cTL = grid.feasibilityMatrix[i][j + 1] - 0.5;
        const cTR = grid.feasibilityMatrix[i + 1][j + 1] - 0.5;

        const x1 = toPxX(grid.xValues[i]);
        const x2 = toPxX(grid.xValues[i + 1]);
        const y1 = toPxY(grid.yValues[j]);
        const y2 = toPxY(grid.yValues[j + 1]);

        const pts: Array<{ x: number; y: number }> = [];

        // Bottom edge
        if (cBL * cBR < 0) pts.push({ x: x1 + (x2 - x1) * Math.abs(cBL / (cBR - cBL)), y: y1 });
        // Top edge
        if (cTL * cTR < 0) pts.push({ x: x1 + (x2 - x1) * Math.abs(cTL / (cTR - cTL)), y: y2 });
        // Left edge
        if (cBL * cTL < 0) pts.push({ x: x1, y: y1 + (y2 - y1) * Math.abs(cBL / (cTL - cBL)) });
        // Right edge
        if (cBR * cTR < 0) pts.push({ x: x2, y: y1 + (y2 - y1) * Math.abs(cBR / (cTR - cBR)) });

        if (pts.length === 2) {
          ctx.moveTo(pts[0].x, pts[0].y);
          ctx.lineTo(pts[1].x, pts[1].y);
        }
      }
    }
    ctx.stroke();

    // 3. Draw Plot Boundary Box
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(mLeft, mTop, innerW, innerH);

    // 4. Draw Ticks & Numeric Labels
    ctx.fillStyle = '#000000';
    ctx.font = '11px Segoe UI, system-ui, sans-serif';

    // X Ticks (6 evenly spaced ticks)
    const numTicksX = 6;
    for (let k = 0; k < numTicksX; k++) {
      const frac = k / (numTicksX - 1);
      const val = xMin + frac * (xMax - xMin);
      const px = mLeft + frac * innerW;

      // Tick mark
      ctx.beginPath();
      ctx.moveTo(px, height - mBottom);
      ctx.lineTo(px, height - mBottom + 5);
      ctx.stroke();

      // Label
      const valStr = codingMode === 'coded' ? val.toFixed(1) : val >= 10 ? val.toFixed(0) : val.toFixed(1);
      ctx.textAlign = 'center';
      ctx.fillText(valStr, px, height - mBottom + 18);
    }

    // Y Ticks (6 evenly spaced ticks)
    const numTicksY = 6;
    for (let k = 0; k < numTicksY; k++) {
      const frac = k / (numTicksY - 1);
      const val = yMin + frac * (yMax - yMin);
      const py = height - mBottom - frac * innerH;

      // Tick mark
      ctx.beginPath();
      ctx.moveTo(mLeft, py);
      ctx.lineTo(mLeft - 5, py);
      ctx.stroke();

      // Label
      const valStr = codingMode === 'coded' ? val.toFixed(1) : val >= 10 ? val.toFixed(0) : val.toFixed(1);
      ctx.textAlign = 'right';
      ctx.fillText(valStr, mLeft - 8, py + 4);
    }

    // 5. Axis Titles
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 12px Segoe UI, system-ui, sans-serif';

    // X Axis Title: e.g. "A: A (Organic Phase (%))"
    const xUnitStr = fX.units ? ` (${fX.units})` : '';
    const xTitle = `${fXLetter}: ${fXLetter} (${fX.name}${xUnitStr})`;
    ctx.textAlign = 'center';
    ctx.fillText(xTitle, mLeft + innerW / 2, height - 12);

    // Y Axis Title: e.g. "B: B (pH)"
    const yUnitStr = fY.units ? ` (${fY.units})` : '';
    const yTitle = `${fYLetter}: ${fYLetter} (${fY.name}${yUnitStr})`;
    ctx.save();
    ctx.translate(16, mTop + innerH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(yTitle, 0, 0);
    ctx.restore();

    // Chart Title centered at top
    ctx.font = 'bold 13px Segoe UI, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Overlay Plot', mLeft + innerW / 2, mTop - 15);

    // 6. Draw Design Points
    const visiblePoints = showAllPointsProjected
      ? designPoints
      : designPoints.filter(p => p.inSlice);

    for (const pt of visiblePoints) {
      const px = toPxX(pt.x);
      const py = toPxY(pt.y);

      // Only draw if within plot bounds
      if (px < mLeft || px > width - mRight || py < mTop || py > height - mBottom) {
        continue;
      }

      ctx.save();
      // Circle marker
      ctx.beginPath();
      ctx.arc(px, py, pt.inSlice ? 5.5 : 4, 0, 2 * Math.PI);
      ctx.fillStyle = pt.inSlice ? '#B30000' : 'rgba(179, 0, 0, 0.35)'; // Dark red matching Design-Expert
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = pt.inSlice ? '#000000' : 'rgba(0, 0, 0, 0.4)';
      ctx.stroke();

      // Display Label (e.g. "6" for 6 center runs)
      if (pt.inSlice) {
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 10px Segoe UI, system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(pt.displayLabel, px - 7, py + 3);
      }
      ctx.restore();
    }
  }, [grid, designPoints, fX, fY, heldValues, allFactors, codingMode, showAllPointsProjected]);

  // Mouse move handler for interactive tooltip
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !grid) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const innerW = canvas.width - mLeft - mRight;
    const innerH = canvas.height - mTop - mBottom;

    if (
      mouseX < mLeft ||
      mouseX > canvas.width - mRight ||
      mouseY < mTop ||
      mouseY > canvas.height - mBottom
    ) {
      setTooltip(null);
      return;
    }

    const xMin = grid.xValues[0];
    const xMax = grid.xValues[grid.xValues.length - 1];
    const yMin = grid.yValues[0];
    const yMax = grid.yValues[grid.yValues.length - 1];

    const fracX = (mouseX - mLeft) / innerW;
    const fracY = (canvas.height - mBottom - mouseY) / innerH;

    const factorX = xMin + fracX * (xMax - xMin);
    const factorY = yMin + fracY * (yMax - yMin);

    const res = grid.feasibilityMatrix.length;
    const gridIdxX = Math.max(0, Math.min(res - 1, Math.round(fracX * (res - 1))));
    const gridIdxY = Math.max(0, Math.min(res - 1, Math.round(fracY * (res - 1))));

    const isFeasible = grid.feasibilityMatrix[gridIdxX][gridIdxY] === 1;
    const violations = grid.violatedResponsesMatrix[gridIdxX][gridIdxY] || [];

    const preds: Record<string, number> = {};
    for (const rId of Object.keys(grid.responsePredictions)) {
      preds[rId] = grid.responsePredictions[rId][gridIdxX][gridIdxY];
    }

    // Check if mouse is hovering over a design point
    const hoveredPt = designPoints.find(pt => {
      const px = mLeft + ((pt.x - xMin) / (xMax - xMin)) * innerW;
      const py = canvas.height - mBottom - ((pt.y - yMin) / (yMax - yMin)) * innerH;
      const dist = Math.hypot(px - mouseX, py - mouseY);
      return dist <= 8;
    });

    setTooltip({
      visible: true,
      pixelX: e.clientX - rect.left,
      pixelY: e.clientY - rect.top,
      factorX,
      factorY,
      isFeasible,
      predictions: preds,
      violations,
      hoveredPoint: hoveredPt,
    });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  return (
    <div className="flex-1 flex w-full h-full bg-white select-none overflow-hidden">
      {/* Left Metadata Column (Matching Design-Expert Screenshot 1) */}
      <div className="w-48 border-r border-[#E5E7EB] p-4 flex flex-col justify-start space-y-4 shrink-0 text-xs">
        <div>
          <h3 className="font-bold text-gray-900 text-sm mb-2">Overlay Plot</h3>

          {/* Design Points Legend */}
          <div className="flex items-center gap-2 mb-2">
            <span className="w-3.5 h-3.5 rounded-full bg-[#B30000] border border-black inline-block shrink-0 shadow-xs" />
            <span className="font-semibold text-gray-800">Design Points</span>
          </div>

          {/* Sweet Spot / Feasible Legend */}
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-3.5 h-3.5 bg-[#FFFF00] border border-gray-400 inline-block shrink-0 shadow-xs" />
            <span className="text-gray-700">Sweet Spot (Feasible)</span>
          </div>

          {/* Infeasible Legend */}
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 bg-[#E5E7EB] border border-gray-400 inline-block shrink-0 shadow-xs" />
            <span className="text-gray-700">Infeasible</span>
          </div>
        </div>

        {/* Axis Assignments */}
        <div className="border-t border-gray-200 pt-3 space-y-1">
          <div className="font-mono font-semibold text-gray-800">
            X1 = {fXLetter} ({fX.name})
          </div>
          <div className="font-mono font-semibold text-gray-800">
            X2 = {fYLetter} ({fY.name})
          </div>
        </div>

        {/* Fixed / Actual Factors */}
        {heldFactors.length > 0 && (
          <div className="border-t border-gray-200 pt-3 space-y-1.5">
            <div className="font-bold text-gray-800">
              {codingMode === 'coded' ? 'Coded Factor' : 'Actual Factor'}
            </div>
            {heldFactors.map(hf => {
              const hfLetter = String.fromCharCode(65 + allFactors.findIndex(f => f.id === hf.id));
              const val = heldValues[hf.id] ?? (hf.low + hf.high) / 2;
              const displayVal = codingMode === 'coded'
                ? actualToCoded(val, hf.low, hf.high).toFixed(2)
                : val.toFixed(3);
              return (
                <div key={hf.id} className="font-mono text-gray-700 flex justify-between">
                  <span>{hfLetter} = {displayVal}</span>
                  <span className="text-gray-400">{codingMode === 'actual' ? hf.units : ''}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Feasibility Area Summary */}
        <div className="border-t border-gray-200 pt-3 text-[11px] text-gray-500">
          <div>Feasible Space: <strong className="text-gray-800">{grid.feasiblePercent.toFixed(1)}%</strong></div>
          {grid.isEmptyFeasible && (
            <div className="text-red-600 font-bold mt-1">Empty Sweet Spot</div>
          )}
        </div>
      </div>

      {/* Center Plot Area */}
      <div
        ref={containerRef}
        className="flex-1 flex flex-col items-center justify-center p-3 relative overflow-hidden bg-white"
      >
        <canvas
          ref={canvasRef}
          width={720}
          height={540}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="max-w-full max-h-full cursor-crosshair"
        />

        {/* Empty Feasible Region Overlay Notice */}
        {grid.isEmptyFeasible && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/95 border-2 border-amber-400 p-4 rounded shadow-lg max-w-sm text-center select-none pointer-events-none">
            <div className="flex items-center justify-center gap-1.5 text-amber-700 font-bold text-sm mb-1">
              <AlertTriangle size={18} />
              No Feasible Region (Empty Sweet Spot)
            </div>
            <p className="text-xs text-gray-600 mb-2">
              No factor settings in the currently displayed slice satisfy all active response limits.
            </p>
            {Object.keys(grid.unmetConstraintsSummary).length > 0 && (
              <div className="text-[11px] text-left bg-gray-50 p-2 rounded border border-gray-200 text-gray-700 space-y-0.5">
                <span className="font-semibold block text-gray-800">Unmet Constraints:</span>
                {Object.keys(grid.unmetConstraintsSummary).map(name => (
                  <div key={name} className="flex justify-between">
                    <span>• {name}</span>
                    <span className="text-red-600 font-medium">Violated</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Hover Tooltip */}
        {tooltip && tooltip.visible && (
          <div
            className="absolute z-20 pointer-events-none bg-white/95 border border-gray-300 shadow-md p-2 rounded text-[11px] font-sans"
            style={{
              left: `${Math.min(tooltip.pixelX + 15, containerRef.current ? containerRef.current.clientWidth - 220 : 500)}px`,
              top: `${Math.min(tooltip.pixelY + 15, containerRef.current ? containerRef.current.clientHeight - 180 : 350)}px`,
              minWidth: '190px',
            }}
          >
            {tooltip.hoveredPoint ? (
              <div>
                <div className="font-bold text-[#003366] border-b border-gray-200 pb-1 mb-1">
                  Design Run {tooltip.hoveredPoint.stdOrders.join(', ')}
                  {tooltip.hoveredPoint.replicateCount > 1 && ` (${tooltip.hoveredPoint.replicateCount} Replicates)`}
                </div>
                <div className="space-y-0.5 text-gray-700">
                  <div>{fX.name}: {tooltip.hoveredPoint.actualFactors[fX.id]?.toFixed(3)} {fX.units}</div>
                  <div>{fY.name}: {tooltip.hoveredPoint.actualFactors[fY.id]?.toFixed(3)} {fY.units}</div>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between border-b border-gray-200 pb-1 mb-1">
                  <span className="font-bold text-gray-800">Factor Coordinates</span>
                  <span
                    className={`font-bold px-1 py-0.2 rounded text-[10px] ${
                      tooltip.isFeasible ? 'bg-yellow-200 text-yellow-900' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {tooltip.isFeasible ? 'FEASIBLE' : 'INFEASIBLE'}
                  </span>
                </div>
                <div className="space-y-0.5 text-gray-700">
                  <div>{fX.name}: <strong className="font-mono">{tooltip.factorX.toFixed(3)}</strong> {fX.units}</div>
                  <div>{fY.name}: <strong className="font-mono">{tooltip.factorY.toFixed(3)}</strong> {fY.units}</div>
                </div>

                {Object.keys(tooltip.predictions).length > 0 && (
                  <div className="mt-1.5 pt-1 border-t border-gray-100">
                    <span className="font-semibold text-gray-600 block text-[10px] mb-0.5">Predicted Responses:</span>
                    {Object.keys(tooltip.predictions).map(rId => {
                      const lim = limits[rId];
                      const val = tooltip.predictions[rId];
                      const isViolated = tooltip.violations.includes(lim?.responseName || '');
                      return (
                        <div key={rId} className="flex justify-between items-center text-[10px]">
                          <span className="truncate mr-1">{lim?.responseName || rId}:</span>
                          <span className={`font-mono ${isViolated ? 'text-red-600 font-bold' : 'text-emerald-700'}`}>
                            {val.toFixed(3)} {isViolated ? '✗' : '✓'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
