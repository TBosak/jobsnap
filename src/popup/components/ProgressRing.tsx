interface ProgressRingProps {
  percentage: number;           // 0-100
  size?: number;                // diameter in pixels (default: 64)
  strokeWidth?: number;         // stroke thickness (default: 6)
  gradientId?: string;          // unique ID for SVG gradient
}

export function ProgressRing({
  percentage,
  size = 64,
  strokeWidth = 6,
  gradientId = `progress-${Math.random().toString(36).slice(2, 9)}`
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--color-peach)" />
          <stop offset="100%" stopColor="var(--color-mint)" />
        </linearGradient>
      </defs>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#E2E8F0"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-500 ease-out"
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        className="text-sm font-bold fill-slate-800"
        transform={`rotate(90 ${size / 2} ${size / 2})`}
      >
        {percentage}%
      </text>
    </svg>
  );
}
