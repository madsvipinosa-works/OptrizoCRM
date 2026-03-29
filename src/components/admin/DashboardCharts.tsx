"use client";

import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const salesData = [
  { name: "01", value: 30 },
  { name: "02", value: 55 },
  { name: "03", value: 35 },
  { name: "04", value: 15 },
  { name: "05", value: 45 },
  { name: "06", value: 25 },
  { name: "07", value: 32 },
  { name: "08", value: 30 },
  { name: "09", value: 10 },
  { name: "10", value: 45 },
  { name: "11", value: 38 },
  { name: "12", value: 32 },
];

export function SalesPerformanceChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={salesData} barSize={12} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} dy={10} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} dx={-10} domain={[0, 60]} ticks={[0, 20, 40, 60]} />
        <Tooltip cursor={{ fill: "rgba(255,255,255,0.05)" }} contentStyle={{ backgroundColor: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "white" }} itemStyle={{ color: "var(--primary)" }} />
        <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 4, 4]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const trafficData = [
  { name: "Jan", organic: 3000, paid: 2400 },
  { name: "Feb", organic: 15000, paid: 1398 },
  { name: "Mar", organic: 8000, paid: 9800 },
  { name: "Apr", organic: 14000, paid: 3908 },
  { name: "May", organic: 15000, paid: 4800 },
  { name: "Jun", organic: 8000, paid: 13800 },
  { name: "Jul", organic: 18000, paid: 10300 },
  { name: "Aug", organic: 19000, paid: 5300 },
  { name: "Sep", organic: 20000, paid: 8300 },
  { name: "Oct", organic: 23000, paid: 13300 },
  { name: "Nov", organic: 25000, paid: 17300 },
  { name: "Dec", organic: 16000, paid: 9300 },
];

export function TrafficSourceChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={trafficData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} dy={10} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} dx={-10} ticks={[0, 5000, 10000, 20000]} tickFormatter={(val) => val === 0 ? "0" : `${val / 1000}k`} />
        <Tooltip cursor={false} contentStyle={{ backgroundColor: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "white" }} />
        <Line type="monotone" dataKey="organic" stroke="var(--primary)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="paid" stroke="#52525b" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
