import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DrawBalls } from "@/components/Ball";
import type { Draw, NumberStat } from "@/types/dlt";
import { frontStats, backStats, chiSquare, fmtMoney, fmtInt, pad2 } from "@/lib/stats";

type RangeKey = "all" | "y3" | "y1" | "s1" | "s2" | "s3";
const RANGE_LABELS: Record<RangeKey, string> = {
  all: "全部期数",
  y3: "近 3 年",
  y1: "近 1 年",
  s1: "仅第 1 套球",
  s2: "仅第 2 套球",
  s3: "仅第 3 套球",
};

function filterDraws(draws: Draw[], key: RangeKey): Draw[] {
  if (key === "all") return draws;
  if (key === "s1" || key === "s2" || key === "s3") {
    const e = parseInt(key[1]);
    return draws.filter((d) => d.equip === e);
  }
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - (key === "y3" ? 3 : 1));
  const c = cutoff.toISOString().slice(0, 10);
  return draws.filter((d) => d.date >= c);
}

function FreqChart({ stats, color, title }: { stats: NumberStat[]; color: string; title: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={stats} margin={{ top: 5, right: 8, left: -14, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="n" tickFormatter={(v) => pad2(v)} tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={40} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(v: number, name: string) => [fmtInt(v), name === "count" ? "实际次数" : name]}
              labelFormatter={(l) => `号码 ${pad2(l as number)}`}
            />
            <ReferenceLine y={stats[0]?.expected ?? 0} stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 3" label={{ value: "理论期望", fill: "#b45309", fontSize: 11, position: "insideTopRight" }} />
            <Bar dataKey="count" name="实际次数" radius={[3, 3, 0, 0]}>
              {stats.map((s) => (
                <Cell key={s.n} fill={s.ratio >= 1 ? color : "#94a3b8"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function StatTable({ stats, zone }: { stats: NumberStat[]; zone: "front" | "back" }) {
  const [mode, setMode] = useState<"hot" | "cold" | "omit">("hot");
  const sorted = useMemo(() => {
    const arr = [...stats];
    if (mode === "hot") arr.sort((a, b) => b.count - a.count);
    if (mode === "cold") arr.sort((a, b) => a.count - b.count);
    if (mode === "omit") arr.sort((a, b) => b.omission - a.omission);
    return arr.slice(0, 10);
  }, [stats, mode]);
  const ballColor = zone === "front" ? "bg-red-600" : "bg-blue-600";
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">{zone === "front" ? "前区" : "后区"}号码排行</CardTitle>
          <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v as typeof mode)} size="sm">
            <ToggleGroupItem value="hot">热号</ToggleGroupItem>
            <ToggleGroupItem value="cold">冷号</ToggleGroupItem>
            <ToggleGroupItem value="omit">当前遗漏</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground text-xs border-b">
              <th className="text-left py-1.5 font-medium">号码</th>
              <th className="text-right font-medium">实际</th>
              <th className="text-right font-medium">期望</th>
              <th className="text-right font-medium">偏离</th>
              <th className="text-right font-medium">当前遗漏</th>
              <th className="text-right font-medium">最大遗漏</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.n} className="border-b last:border-0 hover:bg-muted/50">
                <td className="py-1.5">
                  <span className={`inline-flex w-7 h-7 items-center justify-center rounded-full text-white text-xs font-bold ${ballColor}`}>
                    {pad2(s.n)}
                  </span>
                </td>
                <td className="text-right font-semibold">{s.count}</td>
                <td className="text-right text-muted-foreground">{s.expected.toFixed(1)}</td>
                <td className={`text-right font-medium ${s.ratio >= 1 ? "text-red-600" : "text-blue-600"}`}>
                  {((s.ratio - 1) * 100).toFixed(1)}%
                </td>
                <td className="text-right">{s.omission}</td>
                <td className="text-right text-muted-foreground">{s.maxOmission}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export default function OverviewSection({ draws }: { draws: Draw[] }) {
  const [range, setRange] = useState<RangeKey>("all");
  const filtered = useMemo(() => filterDraws(draws, range), [draws, range]);
  const fs = useMemo(() => frontStats(filtered), [filtered]);
  const bs = useMemo(() => backStats(filtered), [filtered]);
  const latest = draws[draws.length - 1];
  const chiF = chiSquare(fs);
  const chiB = chiSquare(bs);

  return (
    <div className="space-y-4">
      {/* 最新一期 */}
      <Card className="border-red-200 bg-gradient-to-r from-red-50 to-amber-50">
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">最新一期 · 第 {latest.num} 期（{latest.date}）</div>
              <DrawBalls front={latest.front} back={latest.back} />
            </div>
            <div className="flex gap-2 flex-wrap">
              {latest.equip > 0 && <Badge variant="secondary" className="bg-purple-100 text-purple-700">第 {latest.equip} 套摇奖球</Badge>}
              {latest.promo && <Badge className="bg-amber-500">派奖活动期</Badge>}
              <Badge variant="outline">奖池 {fmtMoney(latest.poolAfter)}</Badge>
              <Badge variant="outline">销量 {fmtMoney(latest.sales)}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "统计期数", value: fmtInt(filtered.length) + " 期" },
          { label: "数据跨度", value: `${draws[0].date} ~ ${draws[draws.length - 1].date}`, small: true },
          { label: "前区单球期望", value: `每期 ${(5 / 35).toFixed(4)} 次`, small: true },
          { label: "后区单球期望", value: `每期 ${(2 / 12).toFixed(4)} 次`, small: true },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="pt-4 pb-3">
              <div className="text-xs text-muted-foreground">{k.label}</div>
              <div className={`font-bold mt-1 ${k.small ? "text-sm" : "text-xl"}`}>{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 范围切换 */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">统计范围：</span>
        <ToggleGroup type="single" value={range} onValueChange={(v) => v && setRange(v as RangeKey)} size="sm" className="flex-wrap">
          {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (
            <ToggleGroupItem key={k} value={k}>{RANGE_LABELS[k]}</ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <FreqChart stats={fs} color="#dc2626" title={`前区号码出现次数（${RANGE_LABELS[range]}，共 ${filtered.length} 期）`} />
        <FreqChart stats={bs} color="#2563eb" title={`后区号码出现次数（${RANGE_LABELS[range]}，共 ${filtered.length} 期）`} />
        <StatTable stats={fs} zone="front" />
        <StatTable stats={bs} zone="back" />
      </div>

      <Card>
        <CardContent className="pt-4 pb-3 text-sm text-muted-foreground space-y-1">
          <p>· 红色/蓝色柱表示出现次数 ≥ 理论期望（热），灰色表示低于期望（冷）。黄色虚线为理论期望次数 = 期数 × 单球概率。</p>
          <p>· 当前范围均匀性偏离度（卡方值）：前区 {chiF.toFixed(1)}（自由度 34），后区 {chiB.toFixed(1)}（自由度 11）。卡方值越小说明分布越接近均匀随机。</p>
          <p className="text-amber-700">· 提醒：每期开奖相互独立，历史频次不构成对未来的预测，本工具仅作数据统计展示。</p>
        </CardContent>
      </Card>
    </div>
  );
}
