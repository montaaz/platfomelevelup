"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const MONTHS = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];

export function RevenueChart({ data }: { data: { month: string; total: number }[] }) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const rows = data.map((d) => {
    const date = new Date(d.month);
    return { label: MONTHS[date.getMonth()], value: Math.round(d.total / 1000 * 10) / 10 };
  });

  return (
    <div className="h-48 w-full sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 8, left: mobile ? -30 : -18, bottom: 0 }}>
          <defs>
            <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1687ff" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#8527ff" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="revStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#1687ff" />
              <stop offset="100%" stopColor="#8527ff" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="rgba(7,17,46,0.12)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#4a5680" }}
            dy={6}
            interval={mobile ? 1 : 0}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#4a5680" }}
            width={46}
            hide={mobile}
            tickFormatter={(v: number) => `${v}`}
          />
          <Tooltip
            formatter={(value) => [`${Number(value).toLocaleString("fr-TN")} k DT`, "Facturé"]}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid rgba(0,0,36,0.08)",
              boxShadow: "0 8px 24px rgba(0,0,36,0.12)",
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="url(#revStroke)"
            strokeWidth={2.5}
            fill="url(#revFill)"
            dot={false}
            activeDot={{ r: 4, fill: "#8527ff", strokeWidth: 2, stroke: "#fff" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
