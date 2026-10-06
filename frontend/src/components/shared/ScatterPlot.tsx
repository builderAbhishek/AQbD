import React, { useState } from 'react';

export interface Point {
  id: string;
  x: number;
  y: number;
  data: any; // original data object for tooltip
}

interface ScatterPlotProps {
  data: Point[];
  xLabel: string;
  yLabel: string;
  title: string;
  referenceLine?: { type: 'horizontal' | 'vertical' | 'identity' | 'regression', value?: number, slope?: number, intercept?: number };
  renderTooltip?: (point: Point) => React.ReactNode;
}

export function ScatterPlot({ data, xLabel, yLabel, title, referenceLine, renderTooltip }: ScatterPlotProps) {
  const [hoveredPoint, setHoveredPoint] = useState<Point | null>(null);

  if (data.length === 0) return <div className="flex items-center justify-center h-full w-full bg-gray-50 border border-gray-200">No data</div>;

  // Calculate bounds
  const xValues = data.map(d => d.x);
  const yValues = data.map(d => d.y);
  
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);

  const xRange = maxX - minX || 1;
  const yRange = maxY - minY || 1;

  // Add 10% padding
  const padX = xRange * 0.1;
  const padY = yRange * 0.1;

  let domainMinX = minX - padX;
  let domainMaxX = maxX + padX;
  let domainMinY = minY - padY;
  let domainMaxY = maxY + padY;

  // If we have an identity line or need 0 in the domain
  if (referenceLine?.type === 'identity') {
    const overallMin = Math.min(domainMinX, domainMinY);
    const overallMax = Math.max(domainMaxX, domainMaxY);
    domainMinX = overallMin;
    domainMaxX = overallMax;
    domainMinY = overallMin;
    domainMaxY = overallMax;
  } else if (referenceLine?.type === 'horizontal' && referenceLine.value === 0) {
    if (domainMinY > 0) domainMinY = -padY;
    if (domainMaxY < 0) domainMaxY = padY;
  }

  const plotWidth = 600;
  const plotHeight = 400;
  const margin = { top: 40, right: 40, bottom: 60, left: 60 };

  const innerWidth = plotWidth - margin.left - margin.right;
  const innerHeight = plotHeight - margin.top - margin.bottom;

  const scaleX = (val: number) => margin.left + ((val - domainMinX) / (domainMaxX - domainMinX)) * innerWidth;
  const scaleY = (val: number) => plotHeight - margin.bottom - ((val - domainMinY) / (domainMaxY - domainMinY)) * innerHeight;

  // Draw reference line
  let refLineEl = null;
  if (referenceLine) {
    if (referenceLine.type === 'horizontal') {
      const yPos = scaleY(referenceLine.value || 0);
      refLineEl = <line x1={margin.left} y1={yPos} x2={plotWidth - margin.right} y2={yPos} stroke="#ccc" strokeDasharray="4,4" />;
    } else if (referenceLine.type === 'identity') {
      const x1 = scaleX(domainMinX);
      const y1 = scaleY(domainMinX);
      const x2 = scaleX(domainMaxX);
      const y2 = scaleY(domainMaxX);
      refLineEl = <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ccc" strokeDasharray="4,4" />;
    } else if (referenceLine.type === 'regression' && referenceLine.slope !== undefined && referenceLine.intercept !== undefined) {
      const y1 = referenceLine.intercept + referenceLine.slope * domainMinX;
      const y2 = referenceLine.intercept + referenceLine.slope * domainMaxX;
      refLineEl = <line x1={scaleX(domainMinX)} y1={scaleY(y1)} x2={scaleX(domainMaxX)} y2={scaleY(y2)} stroke="#3b82f6" strokeWidth="2" />;
    }
  }

  // Ticks
  const numTicks = 6;
  const xTicks = Array.from({length: numTicks}).map((_, i) => domainMinX + (domainMaxX - domainMinX) * (i / (numTicks - 1)));
  const yTicks = Array.from({length: numTicks}).map((_, i) => domainMinY + (domainMaxY - domainMinY) * (i / (numTicks - 1)));

  return (
    <div className="relative inline-block border border-gray-300 bg-white shadow-sm mr-4 mb-4">
      <svg width={plotWidth} height={plotHeight} className="overflow-visible select-none">
        {/* Title */}
        <text x={plotWidth / 2} y={margin.top / 2} textAnchor="middle" className="text-sm font-semibold fill-gray-800">
          {title}
        </text>

        {/* Axes */}
        <line x1={margin.left} y1={plotHeight - margin.bottom} x2={plotWidth - margin.right} y2={plotHeight - margin.bottom} stroke="#333" />
        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={plotHeight - margin.bottom} stroke="#333" />

        {/* Reference Line */}
        {refLineEl}

        {/* X Ticks */}
        {xTicks.map((tick, i) => (
          <g key={`x-${i}`}>
            <line x1={scaleX(tick)} y1={plotHeight - margin.bottom} x2={scaleX(tick)} y2={plotHeight - margin.bottom + 4} stroke="#333" />
            <text x={scaleX(tick)} y={plotHeight - margin.bottom + 16} textAnchor="middle" className="text-xs fill-gray-600">
              {tick.toFixed(2)}
            </text>
          </g>
        ))}

        {/* Y Ticks */}
        {yTicks.map((tick, i) => (
          <g key={`y-${i}`}>
            <line x1={margin.left - 4} y1={scaleY(tick)} x2={margin.left} y2={scaleY(tick)} stroke="#333" />
            <text x={margin.left - 8} y={scaleY(tick) + 4} textAnchor="end" className="text-xs fill-gray-600">
              {tick.toFixed(2)}
            </text>
          </g>
        ))}

        {/* X Label */}
        <text x={plotWidth / 2} y={plotHeight - 15} textAnchor="middle" className="text-xs font-semibold fill-gray-700">
          {xLabel}
        </text>

        {/* Y Label */}
        <text 
          x={-plotHeight / 2} 
          y={20} 
          transform="rotate(-90)" 
          textAnchor="middle" 
          className="text-xs font-semibold fill-gray-700"
        >
          {yLabel}
        </text>

        {/* Points */}
        {data.map((pt, i) => (
          <circle 
            key={i}
            cx={scaleX(pt.x)}
            cy={scaleY(pt.y)}
            r={hoveredPoint?.id === pt.id ? 6 : 4}
            fill={hoveredPoint?.id === pt.id ? "#ef4444" : "#3b82f6"}
            stroke="#1e3a8a"
            strokeWidth="1"
            opacity="0.8"
            className="cursor-crosshair transition-all"
            onMouseEnter={() => setHoveredPoint(pt)}
            onMouseLeave={() => setHoveredPoint(null)}
          />
        ))}
      </svg>

      {/* Tooltip */}
      {hoveredPoint && (
        <div 
          className="absolute bg-white border border-gray-400 p-2 shadow-lg text-xs pointer-events-none rounded z-10"
          style={{
            left: scaleX(hoveredPoint.x) + 15,
            top: scaleY(hoveredPoint.y) - 15,
          }}
        >
          {renderTooltip ? renderTooltip(hoveredPoint) : (
            <>
              <div>x: {hoveredPoint.x.toFixed(4)}</div>
              <div>y: {hoveredPoint.y.toFixed(4)}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
