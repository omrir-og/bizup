"use client";

import { ResponsiveContainer, LineChart, Line } from "recharts";

interface Props {
  data: { value: number }[];
  positive?: boolean;
}

export default function SparklineChart({ data, positive = true }: Props) {
  if (!data || data.length < 2) return null;
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={positive ? "#22c55e" : "#ef4444"}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
