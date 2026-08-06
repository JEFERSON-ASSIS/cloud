"use client";

import { Box, useTheme } from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function DashboardActivityChart({
  data,
}: {
  data: { day: string; actions: number }[];
}) {
  const theme = useTheme();
  return (
    <Box sx={{ width: "100%", height: 260, mt: 2 }}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={theme.palette.divider}
            vertical={false}
          />
          <XAxis
            dataKey="day"
            tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
            interval={4}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
          />
          <Tooltip
            labelFormatter={(label) => `Data: ${label}`}
            formatter={(value) => [value, "Atividades"]}
          />
          <Bar
            dataKey="actions"
            fill={theme.palette.primary.main}
            radius={[5, 5, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
