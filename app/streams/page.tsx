"use client";

import { useState, useEffect, useCallback } from "react";
import { Radio } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import clsx from "clsx";

interface Topic {
  name: string;
  partitions: number;
  consumerGroup: string;
  throughput: number;
  lag: number;
  partitionDetail: Array<{ partition: number; lag: number }>;
}

interface KafkaData {
  topics: Topic[];
  history: Array<Record<string, number | string>>;
}

export default function StreamsPage() {
  const [data, setData] = useState<KafkaData | null>(null);

  const fetch_ = useCallback(async () => {
    const res = await fetch("/api/kafka");
    setData(await res.json());
  }, []);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, 3000);
    return () => clearInterval(id);
  }, [fetch_]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-[#e6edf3]">
            Kafka Event Streams
          </h1>
          <p className="text-xs text-[#8b949e] mt-0.5">
            Consumer group lag & throughput · Refresh: 3s
          </p>
        </div>
        <div className="flex items-center gap-2 bg-[#161b22] border border-[#30363d] rounded px-3 py-1.5">
          <Radio className="w-3 h-3 text-[#3fb950] pulse-green" />
          <span className="text-xs text-[#3fb950]">Streaming</span>
        </div>
      </div>

      {/* Topic Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {data?.topics.map((topic) => (
          <div
            key={topic.name}
            className={clsx(
              "bg-[#161b22] border rounded-lg p-4",
              topic.lag > 10
                ? "border-[#d29922]/40"
                : topic.lag > 0
                ? "border-[#d29922]/20"
                : "border-[#30363d]"
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-medium text-[#e6edf3] font-mono">
                  {topic.name}
                </h3>
                <p className="text-[10px] text-[#8b949e] mt-0.5">
                  {topic.consumerGroup}
                </p>
              </div>
              <span
                className={clsx(
                  "text-[10px] border rounded px-1.5 py-0.5 font-medium",
                  topic.lag === 0
                    ? "text-[#3fb950] bg-[#3fb950]/10 border-[#3fb950]/30"
                    : "text-[#d29922] bg-[#d29922]/10 border-[#d29922]/30"
                )}
              >
                lag: {topic.lag}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-[#8b949e]">Throughput</p>
                <p className="text-[#58a6ff] font-mono font-semibold">
                  {topic.throughput.toLocaleString()}
                  <span className="text-[#484f58] text-[10px]"> msg/s</span>
                </p>
              </div>
              <div>
                <p className="text-[#8b949e]">Partitions</p>
                <p className="text-[#e6edf3] font-mono font-semibold">
                  {topic.partitions}
                </p>
              </div>
            </div>
            {topic.lag > 0 && (
              <div className="mt-3 pt-3 border-t border-[#21262d]">
                <p className="text-[10px] text-[#8b949e] mb-1.5">
                  Partition lag
                </p>
                <div className="flex gap-1">
                  {topic.partitionDetail.map((p) => (
                    <div
                      key={p.partition}
                      className="flex-1 h-5 rounded-sm text-[8px] flex items-center justify-center font-mono"
                      style={{
                        backgroundColor:
                          p.lag > 0
                            ? "rgba(210,153,34,0.2)"
                            : "rgba(63,185,80,0.15)",
                        color: p.lag > 0 ? "#d29922" : "#3fb950",
                      }}
                    >
                      {p.lag}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Throughput History */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
        <h3 className="text-sm font-medium text-[#e6edf3] mb-1">
          Throughput History
        </h3>
        <p className="text-xs text-[#8b949e] mb-4">Top 3 topics by volume (msg/s)</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart
            data={data?.history ?? []}
            margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
          >
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
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#21262d",
                border: "1px solid #30363d",
                borderRadius: 4,
                fontSize: 11,
              }}
              labelStyle={{ color: "#8b949e" }}
            />
            <Legend
              formatter={(v) => (
                <span style={{ color: "#8b949e", fontSize: 11 }}>{v}</span>
              )}
            />
            <Line
              type="monotone"
              dataKey="market-data"
              stroke="#58a6ff"
              strokeWidth={1.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="order-events"
              stroke="#3fb950"
              strokeWidth={1.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="trade-executions"
              stroke="#bc8cff"
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
