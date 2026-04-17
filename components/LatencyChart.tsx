"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface Props {
  data: Array<{ time: string; p50: number; p95: number; p99: number }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#21262d] border border-[#30363d] rounded p-2 text-xs shadow-lg">
        <p className="text-[#8b949e] mb-1">{label}</p>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {payload.map((entry: any) => (
          <p key={entry.name} style={{ color: entry.color }}>
            {entry.name}: {entry.value}ms
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function LatencyChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="p50G" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3fb950" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#3fb950" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="p95G" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#58a6ff" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#58a6ff" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="p99G" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f85149" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#f85149" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
        <XAxis
          dataKey="time"
          tick={{ fill: "#484f58", fontSize: 10 }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: "#484f58", fontSize: 10 }}
          tickLine={false}
          unit="ms"
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(v) => (
            <span style={{ color: "#8b949e", fontSize: 11 }}>{v}</span>
          )}
        />
        <Area
          type="monotone"
          dataKey="p50"
          stroke="#3fb950"
          fill="url(#p50G)"
          strokeWidth={1.5}
          dot={false}
          name="P50"
        />
        <Area
          type="monotone"
          dataKey="p95"
          stroke="#58a6ff"
          fill="url(#p95G)"
          strokeWidth={1.5}
          dot={false}
          name="P95"
        />
        <Area
          type="monotone"
          dataKey="p99"
          stroke="#f85149"
          fill="url(#p99G)"
          strokeWidth={1.5}
          dot={false}
          name="P99"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
