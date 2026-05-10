"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  ResponsiveContainer,
} from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

// Dados simulados de faturamento da semana
const chartData = [
  { day: "Seg", revenue: 450 },
  { day: "Ter", revenue: 850 },
  { day: "Qua", revenue: 1200 },
  { day: "Qui", revenue: 950 },
  { day: "Sex", revenue: 1800 },
  { day: "Sab", revenue: 2400 },
  { day: "Dom", revenue: 1100 },
];

const chartConfig = {
  revenue: {
    label: "Faturamento (R$)",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function DashboardChart() {
  return (
    <div className="h-[300px] w-full pt-4">
      <ChartContainer config={chartConfig} className="h-full w-full">
        <AreaChart
          accessibilityLayer
          data={chartData}
          margin={{
            top: 24, // <-- Adicionado espaço extra no topo para a curva não cortar
            left: 12,
            right: 12,
          }}
        >
          <CartesianGrid
            vertical={false}
            strokeDasharray="3 3"
            stroke="#e4e4e7"
          />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => value}
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="dot" />}
          />
          <defs>
            <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="var(--color-revenue)"
                stopOpacity={0.3}
              />
              <stop
                offset="95%"
                stopColor="var(--color-revenue)"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <Area
            dataKey="revenue"
            type="natural"
            fill="url(#fillRevenue)"
            fillOpacity={0.4}
            stroke="var(--color-revenue)"
            stackId="a"
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
