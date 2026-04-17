"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface Props {
  data: Array<{ time: string; throughput: number }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#21262d] border border-[#30363d] rounded p-2 text-xs shadow-lg">
        <p className="text-[#8b949e] mb-1">{label}</p>
        <p className="text-[#58a6ff]">
          Orders/s: {payload[0]?.value?.toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

export default function ThroughputChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={data}
        margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#21262d"
          vertical={false}
        />
        <XAxis
          dataKey="time"
          tick={{ fill: "#484f58", fontSize: 10 }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fill: "#484f58", fontSize: 10 }} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine
          y={1247}
          stroke="#30363d"
          strokeDasharray="4 4"
          label={{ value: "baseline", fill: "#484f58", fontSize: 9 }}
        />
        <Bar
          dataKey="throughput"
          fill="#58a6ff"
          fillOpacity={0.8}
          radius={[2, 2, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
