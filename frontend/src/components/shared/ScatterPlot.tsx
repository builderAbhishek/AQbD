import React, { useState } from 'react';

export interface Point {
  id: string;
  x: number;
  y: number;
  color?: string;
  data: any;
}

export interface Curve {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  name?: string;
}

interface ScatterPlotProps {
  data: Point[];
  curveData?: { x: number; y: number }[];
  multiCurveData?: Curve[];
  xLabel: string;
  yLabel: string;
  title: string;
  referenceLine?: { type: 'horizontal' | 'vertical' | 'identity' | 'regression', value?: number, slope?: number, intercept?: number };
  renderTooltip?: (point: Point) => React.ReactNode;
}

export function ScatterPlot({ data, curveData, multiCurveData, xLabel, yLabel, title, referenceLine, renderTooltip }: ScatterPlotProps) {
  const [hoveredPoint, setHoveredPoint] = useState<Point | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  if (data.length === 0 && (!curveData || curveData.length === 0) && (!multiCurveData || multiCurveData.length === 0)) {
    return <div className="flex items-center justify-center h-full w-full bg-gray-50 border border-gray-200">No data</div>;
  }

  // Calculate bounds
  const xValues = [
    ...data.map(d => d.x),
    ...(curveData ? curveData.map(d => d.x) : []),
    ...(multiCurveData ? multiCurveData.flatMap(c => c.points.map(d => d.x)) : [])
  ];
  const yValues = [
    ...data.map(d => d.y),
    ...(curveData ? curveData.map(d => d.y) : []),
    ...(multiCurveData ? multiCurveData.flatMap(c => c.points.map(d => d.y)) : [])
  ];
  
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

  const isSquare = referenceLine?.type === 'identity';
  const plotWidth = 600;
  const plotHeight = isSquare ? 600 : 400;
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
      refLineEl = <line x1={margin.left} y1={yPos} x2={plotWidth - margin.right} y2={yPos} stroke="#0055A4" strokeWidth="1.5" strokeDasharray="6,4" />;
    } else if (referenceLine.type === 'identity') {
      const x1 = scaleX(domainMinX);
      const y1 = scaleY(domainMinX);
      const x2 = scaleX(domainMaxX);
      const y2 = scaleY(domainMaxX);
      refLineEl = <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#666" strokeWidth="1.5" strokeDasharray="4,4" />;
    } else if (referenceLine.type === 'regression' && referenceLine.slope !== undefined && referenceLine.intercept !== undefined) {
      const y1 = referenceLine.intercept + referenceLine.slope * domainMinX;
      const y2 = referenceLine.intercept + referenceLine.slope * domainMaxX;
      refLineEl = <line x1={scaleX(domainMinX)} y1={scaleY(y1)} x2={scaleX(domainMaxX)} y2={scaleY(y2)} stroke="#3b82f6" strokeWidth="2" />;
    } else if (referenceLine.type === 'vertical') {
      const xPos = scaleX(referenceLine.value || 0);
      refLineEl = <line x1={xPos} y1={margin.top} x2={xPos} y2={plotHeight - margin.bottom} stroke="#333" strokeWidth="1.5" strokeDasharray="4,4" />;
    }
  }

  // Ticks
  const numTicks = 6;
  const xTicks = Array.from({length: numTicks}).map((_, i) => domainMinX + (domainMaxX - domainMinX) * (i / (numTicks - 1)));
  const yTicks = Array.from({length: numTicks}).map((_, i) => domainMinY + (domainMaxY - domainMinY) * (i / (numTicks - 1)));

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <svg viewBox={`0 0 ${plotWidth} ${plotHeight}`} className="w-full h-full max-w-full max-h-full overflow-visible select-none">
        {/* Title */}
        <text x={plotWidth / 2} y={margin.top / 2} textAnchor="middle" className="text-[13px] font-bold fill-[#003366]">
          {title}
        </text>

        {/* Gridlines */}
        {yTicks.map((tick, i) => (
          <line key={`grid-y-${i}`} x1={margin.left} y1={scaleY(tick)} x2={plotWidth - margin.right} y2={scaleY(tick)} stroke="#EFEFEF" strokeWidth="1" />
        ))}
        {xTicks.map((tick, i) => (
          <line key={`grid-x-${i}`} x1={scaleX(tick)} y1={margin.top} x2={scaleX(tick)} y2={plotHeight - margin.bottom} stroke="#EFEFEF" strokeWidth="1" />
        ))}

        {/* Axes */}
        <line x1={margin.left} y1={plotHeight - margin.bottom} x2={plotWidth - margin.right} y2={plotHeight - margin.bottom} stroke="#333" strokeWidth="1.5" />
        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={plotHeight - margin.bottom} stroke="#333" strokeWidth="1.5" />

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

        {/* Curve */}
        {curveData && curveData.length > 0 && (
          <g>
            <path
              d={`M ${curveData.map(p => `${scaleX(p.x)},${scaleY(p.y)}`).join(' L ')}`}
              fill="none"
              stroke="#333333"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {/* Curve hover targets */}
            {curveData.map((pt, i) => (
              <circle
                key={`curve-hover-${i}`}
                cx={scaleX(pt.x)}
                cy={scaleY(pt.y)}
                r={6}
                fill="transparent"
                className="cursor-crosshair"
                onMouseEnter={(e) => {
                  const rect = (e.target as Element).closest('svg')?.getBoundingClientRect();
                  if (rect) setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                  setHoveredPoint({ ...pt, id: `curve-${i}`, data: { isCurve: true, xVal: pt.x, predicted: pt.y } });
                }}
                onMouseMove={(e) => {
                  const rect = (e.target as Element).closest('svg')?.getBoundingClientRect();
                  if (rect) setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            ))}
          </g>
        )}

        {/* Multiple Curves */}
        {multiCurveData && multiCurveData.map(curve => (
          <g key={curve.id}>
            <path
              d={`M ${curve.points.map(p => `${scaleX(p.x)},${scaleY(p.y)}`).join(' L ')}`}
              fill="none"
              stroke={curve.color}
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {/* Hover targets for multi curves */}
            {curve.points.map((pt, i) => (
              <circle
                key={`${curve.id}-hover-${i}`}
                cx={scaleX(pt.x)}
                cy={scaleY(pt.y)}
                r={6}
                fill="transparent"
                className="cursor-crosshair"
                onMouseEnter={(e) => {
                  const rect = (e.target as Element).closest('svg')?.getBoundingClientRect();
                  if (rect) setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                  setHoveredPoint({ ...pt, id: `${curve.id}-${i}`, data: { isCurve: true, curveId: curve.id, curveName: curve.name, xVal: pt.x, predicted: pt.y, realXVal: (pt as any).realXVal } });
                }}
                onMouseMove={(e) => {
                  const rect = (e.target as Element).closest('svg')?.getBoundingClientRect();
                  if (rect) setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            ))}
          </g>
        ))}

        {/* Points */}
        {data.map((pt, i) => (
          <g key={i}>
            <circle 
              cx={scaleX(pt.x)}
              cy={scaleY(pt.y)}
              r={hoveredPoint?.id === pt.id ? 6 : 4}
              fill={pt.color || "#E04A26"}
              stroke={hoveredPoint?.id === pt.id ? "#000" : "#333"}
              strokeWidth={hoveredPoint?.id === pt.id ? "1.5" : "0.5"}
              opacity={hoveredPoint && hoveredPoint.id !== pt.id ? "0.4" : "0.9"}
              className="cursor-crosshair transition-all duration-100"
              onMouseEnter={(e) => {
                const rect = (e.target as Element).closest('svg')?.getBoundingClientRect();
                if (rect) setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                setHoveredPoint(pt);
              }}
              onMouseMove={(e) => {
                const rect = (e.target as Element).closest('svg')?.getBoundingClientRect();
                if (rect) setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
              }}
              onMouseLeave={() => setHoveredPoint(null)}
            />
            {pt.data?.runOrder !== undefined && (
              <text x={scaleX(pt.x) + 6} y={scaleY(pt.y) + 3} className="text-[10px] fill-gray-700 font-sans pointer-events-none">
                {pt.data.runOrder}
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* Tooltip */}
      {hoveredPoint && (
        <div 
          className="absolute bg-white border border-[#C0C0C0] p-2 shadow-md text-[11px] pointer-events-none rounded-sm z-50 font-sans"
          style={{
            left: mousePos.x + 15,
            top: mousePos.y - 15,
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
