"use client";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** One measure per chart, one colour, values labelled on the bars. */
export function SimpleBar({
  data,
  dataKey,
  color = "#167C70",
  unit = "",
  height = 220,
  highlightAbove,
}: {
  data: Record<string, any>[];
  dataKey: string;
  color?: string;
  unit?: string;
  height?: number;
  highlightAbove?: number;
}) {
  if (!data.length) return <p className="py-10 text-center text-sm text-navy/50">Not enough data yet.</p>;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#142D3A14" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#142D3A99" }} tickLine={false} axisLine={false} interval={0} />
          <YAxis tick={{ fontSize: 11, fill: "#142D3A99" }} tickLine={false} axisLine={false} allowDecimals={false} unit={unit} />
          <Tooltip
            cursor={{ fill: "#E8F4F0" }}
            formatter={(v: any) => [`${v}${unit}`, ""]}
            separator=""
            contentStyle={{ borderRadius: 12, border: "1px solid #142D3A14", fontSize: 12 }}
          />
          <Bar dataKey={dataKey} radius={[8, 8, 0, 0]} maxBarSize={56}>
            {data.map((d, i) => (
              <Cell key={i} fill={highlightAbove !== undefined && d[dataKey] > highlightAbove ? "#C94C55" : color} />
            ))}
            <LabelList dataKey={dataKey} position="top" formatter={(v: any) => `${v}${unit}`} style={{ fontSize: 11, fill: "#142D3A", fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
