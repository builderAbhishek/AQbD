import { useMemo } from 'react';
import { ResponseGraphicalLimit } from '../../../../lib/optimization/graphicalOptimization';

interface LimitsGraphProps {
  limit: ResponseGraphicalLimit;
  width?: number;
  height?: number;
}

export function LimitsGraph({ limit, width = 600, height = 180 }: LimitsGraphProps) {
  // Determine scale bounds
  const { axisMin, axisMax, lowerVal, upperVal, isReversed } = useMemo(() => {
    let min = limit.observedMin;
    let max = limit.observedMax;

    // Expand axis range if limits are configured beyond observed range
    if (Number.isFinite(limit.lowerLimit)) {
      min = Math.min(min, limit.lowerLimit);
    }
    if (Number.isFinite(limit.upperLimit)) {
      max = Math.max(max, limit.upperLimit);
    }

    // Safety padding
    const span = Math.max(1e-4, max - min);
    const paddedMin = min - span * 0.05;
    const paddedMax = max + span * 0.05;

    const lower = Number.isFinite(limit.lowerLimit) ? limit.lowerLimit : limit.observedMin;
    const upper = Number.isFinite(limit.upperLimit) ? limit.upperLimit : limit.observedMax;
    const reversed = !limit.isOneSided && lower > upper;

    return {
      axisMin: paddedMin,
      axisMax: paddedMax,
      lowerVal: lower,
      upperVal: upper,
      isReversed: reversed,
    };
  }, [limit]);

  // Coordinate mapping
  const mLeft = 60;
  const mRight = 60;
  const plotWidth = width - mLeft - mRight;
  const axisY = 95;

  const toX = (val: number) => {
    const ratio = (val - axisMin) / Math.max(1e-5, axisMax - axisMin);
    const clamped = Math.max(0, Math.min(1, ratio));
    return mLeft + clamped * plotWidth;
  };

  const xMin = toX(limit.observedMin);
  const xMax = toX(limit.observedMax);
  const xLower = toX(lowerVal);
  const xUpper = toX(upperVal);

  // Formatting helper
  const fmt = (v: number) => {
    if (!Number.isFinite(v)) return '-';
    if (Math.abs(v) >= 100) return v.toFixed(1);
    if (Math.abs(v) >= 10) return v.toFixed(2);
    return v.toFixed(3).replace(/\.?0+$/, '');
  };

  return (
    <div className="w-full bg-white border border-[#C0C0C0] p-4 flex flex-col items-center select-none shadow-xs">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full max-w-[700px] h-auto overflow-visible"
        style={{ fontFamily: 'Segoe UI, system-ui, sans-serif' }}
      >
        {/* Plot boundary box */}
        <rect
          x="1"
          y="1"
          width={width - 2}
          height={height - 2}
          fill="#FFFFFF"
          stroke="#D0D0D0"
          strokeWidth="1"
        />

        {/* Separator line dividing top information space and axis */}
        <line
          x1="1"
          y1={axisY - 55}
          x2={width - 1}
          y2={axisY - 55}
          stroke="#E5E7EB"
          strokeWidth="1"
        />

        {/* Status text in top section */}
        <text
          x={width / 2}
          y={axisY - 65}
          textAnchor="middle"
          fontSize="11"
          fontWeight="600"
          fill={!limit.isActive ? '#6B7280' : isReversed ? '#B91C1C' : '#0055A4'}
        >
          {!limit.isActive
            ? 'Response Unconstrained (Excluded from Graphical Sweet Spot)'
            : isReversed
            ? 'Invalid Limits: Lower Limit is greater than Upper Limit'
            : limit.isOneSided
            ? limit.oneSidedType === 'lower'
              ? `Acceptable Range: ≥ ${fmt(lowerVal)} (One-Sided Lower Limit)`
              : `Acceptable Range: ≤ ${fmt(upperVal)} (One-Sided Upper Limit)`
            : `Acceptable Range: [${fmt(lowerVal)}, ${fmt(upperVal)}] (Two-Sided Interval)`}
        </text>

        {/* Acceptable shaded band */}
        {limit.isActive && !isReversed && (
          <g>
            {limit.isOneSided ? (
              limit.oneSidedType === 'lower' ? (
                // Shaded from lower to right edge
                <rect
                  x={xLower}
                  y={axisY - 30}
                  width={Math.max(0, mLeft + plotWidth - xLower)}
                  height="30"
                  fill="#FEF08A"
                  fillOpacity="0.8"
                  stroke="#EAB308"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
              ) : (
                // Shaded from left edge to upper
                <rect
                  x={mLeft}
                  y={axisY - 30}
                  width={Math.max(0, xUpper - mLeft)}
                  height="30"
                  fill="#FEF08A"
                  fillOpacity="0.8"
                  stroke="#EAB308"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
              )
            ) : (
              // Two-sided shaded band
              <rect
                x={xLower}
                y={axisY - 30}
                width={Math.max(0, xUpper - xLower)}
                height="30"
                fill="#FEF08A"
                fillOpacity="0.8"
                stroke="#EAB308"
                strokeWidth="1"
              />
            )}
          </g>
        )}

        {/* Baseline horizontal scale axis */}
        <line
          x1={mLeft}
          y1={axisY}
          x2={mLeft + plotWidth}
          y2={axisY}
          stroke="#4B5563"
          strokeWidth="1.5"
        />

        {/* Minimum observed tick */}
        <line
          x1={xMin}
          y1={axisY - 14}
          x2={xMin}
          y2={axisY + 6}
          stroke="#374151"
          strokeWidth="1.5"
        />
        <text
          x={xMin}
          y={axisY + 22}
          textAnchor="middle"
          fontSize="11"
          fontWeight="500"
          fill="#374151"
        >
          {fmt(limit.observedMin)}
        </text>

        {/* Maximum observed tick */}
        <line
          x1={xMax}
          y1={axisY - 14}
          x2={xMax}
          y2={axisY + 6}
          stroke="#374151"
          strokeWidth="1.5"
        />
        <text
          x={xMax}
          y={axisY + 22}
          textAnchor="middle"
          fontSize="11"
          fontWeight="500"
          fill="#374151"
        >
          {fmt(limit.observedMax)}
        </text>

        {/* Lower Limit Marker & Value Label */}
        {limit.isActive && (!limit.isOneSided || limit.oneSidedType === 'lower') && (
          <g>
            <line
              x1={xLower}
              y1={axisY - 38}
              x2={xLower}
              y2={axisY}
              stroke="#B91C1C"
              strokeWidth="2"
            />
            <polygon
              points={`${xLower-4},${axisY-38} ${xLower+4},${axisY-38} ${xLower},${axisY-30}`}
              fill="#B91C1C"
            />
            <text
              x={xLower}
              y={axisY - 43}
              textAnchor="middle"
              fontSize="11"
              fontWeight="bold"
              fill="#B91C1C"
            >
              {fmt(lowerVal)}
            </text>
          </g>
        )}

        {/* Upper Limit Marker & Value Label */}
        {limit.isActive && (!limit.isOneSided || limit.oneSidedType === 'upper') && (
          <g>
            <line
              x1={xUpper}
              y1={axisY - 38}
              x2={xUpper}
              y2={axisY}
              stroke="#B91C1C"
              strokeWidth="2"
            />
            <polygon
              points={`${xUpper-4},${axisY-38} ${xUpper+4},${axisY-38} ${xUpper},${axisY-30}`}
              fill="#B91C1C"
            />
            <text
              x={xUpper}
              y={axisY - 43}
              textAnchor="middle"
              fontSize="11"
              fontWeight="bold"
              fill="#B91C1C"
            >
              {fmt(upperVal)}
            </text>
          </g>
        )}

        {/* Response Title centered at bottom */}
        <text
          x={width / 2}
          y={height - 20}
          textAnchor="middle"
          fontSize="14"
          fontWeight="600"
          fill="#111827"
        >
          {limit.responseName} {limit.units ? `(${limit.units})` : ''}
        </text>
      </svg>
    </div>
  );
}
