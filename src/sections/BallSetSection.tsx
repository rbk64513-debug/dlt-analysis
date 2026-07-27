import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Draw, NumberStat } from "@/types/dlt";
import { equipStats, fmtInt, pad2 } from "@/lib/stats";
import type { EquipStat } from "@/lib/stats";

const SET_COLORS = ["#7c3aed", "#0891b2", "#ea580c"];

/** 偏离度 -> 单元格底色 */
function ratioBg(ratio: number): string {
  if (ratio >= 1.15) return "bg-red-500 text-white";
  if (ratio >= 1.05) return "bg-red-200 text-red-900";
  if (ratio <= 0.85) return "bg-blue-500 text-white";
  if (ratio <= 0.95) return "bg-blue-200 text-blue-900";
  return "bg-slate-50 text-slate-600";
}

function NumBadge({ n, zone }: { n: number; zone: "front" | "back" }) {
  const cls = zone === "front" ? "bg-red-600" : "bg-blue-600";
  return (
    <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-white text-[11px] font-bold ${cls}`}>
      {pad2(n)}
    </span>
  );
}

/** 单套球的热号/冷号排行 */
function SetHotColdCard({ s, color }: { s: EquipStat; color: string }) {
  const mk = (stats: NumberStat[], take: number) => {
    const hot = [...stats].sort((a, b) => b.count - a.count).slice(0, take);
    const cold = [...stats].sort((a, b) => a.count - b.count).slice(0, take);
    return { hot, cold };
  };
  const f = mk(s.front, 6);
  const b = mk(s.back, 3);
  const Row = ({ list, zone, hot }: { list: NumberStat[]; zone: "front" | "back"; hot: boolean }) => (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={`text-[11px] w-8 shrink-0 font-medium ${hot ? "text-red-600" : "text-blue-600"}`}>
        {hot ? "热号" : "冷号"}
      </span>
      {list.map((x) => (
        <span key={x.n} className="flex items-center gap-0.5" title={`${x.count} 次 / 期望 ${x.expected.toFixed(1)}（${((x.ratio - 1) * 100).toFixed(1)}%）`}>
          <NumBadge n={x.n} zone={zone} />
          <span className="text-[11px] text-muted-foreground">{x.count}</span>
        </span>
      ))}
    </div>
  );
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base" style={{ color }}>第 {s.equip} 套球 · {fmtInt(s.draws)} 期</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <div className="text-xs text-muted-foreground mb-1">前区（期望 {s.front[0]?.expected.toFixed(1)} 次）</div>
          <div className="space-y-1.5">
            <Row list={f.hot} zone="front" hot />
            <Row list={f.cold} zone="front" hot={false} />
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">后区（期望 {s.back[0]?.expected.toFixed(1)} 次）</div>
          <div className="space-y-1.5">
            <Row list={b.hot} zone="back" hot />
            <Row list={b.cold} zone="back" hot={false} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** 跨球套对比热力表（行=号码，列=球套，值=出现次数，底色=相对期望偏离） */
function CrossSetTable({ stats, zone }: { stats: EquipStat[]; zone: "front" | "back" }) {
  const max = zone === "front" ? 35 : 12;
  const rows = [];
  for (let n = 1; n <= max; n++) {
    rows.push(stats.map((s) => (zone === "front" ? s.front : s.back)[n - 1]));
  }
  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="p-1 text-left text-muted-foreground font-medium">{zone === "front" ? "前区号码" : "后区号码"}</th>
            {stats.map((s, i) => (
              <th key={s.equip} className="p-1 font-medium" style={{ color: SET_COLORS[i] }}>
                第{s.equip}套
              </th>
            ))}
            <th className="p-1 text-muted-foreground font-medium">最偏球套</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, ri) => {
            const ratios = cells.map((c) => c.ratio);
            const spread = Math.max(...ratios) - Math.min(...ratios);
            const maxIdx = ratios.indexOf(Math.max(...ratios));
            return (
              <tr key={ri}>
                <td className="p-0.5 pr-2"><NumBadge n={ri + 1} zone={zone} /></td>
                {cells.map((c, ci) => (
                  <td key={ci} className={`p-0.5`}>
                    <div
                      className={`w-11 text-center rounded px-1 py-0.5 font-mono ${ratioBg(c.ratio)}`}
                      title={`${c.count} 次 / 期望 ${c.expected.toFixed(1)}（${((c.ratio - 1) * 100).toFixed(1)}%）`}
                    >
                      {c.count}
                    </div>
                  </td>
                ))}
                <td className="p-0.5 pl-2 text-muted-foreground whitespace-nowrap">
                  {spread >= 0.3 ? (
                    <span className="text-amber-700 font-medium">
                      第{stats[maxIdx].equip}套偏多 {(spread * 100).toFixed(0)}%
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function BallSetSection({ draws }: { draws: Draw[] }) {
  const stats = useMemo(() => equipStats(draws), [draws]);
  const unknown = draws.filter((d) => d.equip === 0).length;
  const firstKnown = draws.find((d) => d.equip > 0);
  const totalKnown = draws.length - unknown;

  const pieData = stats.map((s, i) => ({
    name: `第 ${s.equip} 套球`,
    value: s.draws,
    fill: SET_COLORS[i],
  }));

  /** 自动总结：跨套一致热号 / 冷号 / 分歧最大的号码 */
  const summary = useMemo(() => {
    const pick = (get: (s: EquipStat) => NumberStat[], label: string) => {
      const consistentHot: number[] = [];
      const consistentCold: number[] = [];
      let maxSpread = { n: 0, spread: 0, hotSet: 0, coldSet: 0 };
      const max = get(stats[0]).length;
      for (let n = 1; n <= max; n++) {
        const rs = stats.map((s) => get(s)[n - 1].ratio);
        if (rs.every((r) => r >= 1.05)) consistentHot.push(n);
        if (rs.every((r) => r <= 0.95)) consistentCold.push(n);
        const spread = Math.max(...rs) - Math.min(...rs);
        if (spread > maxSpread.spread) {
          maxSpread = {
            n, spread,
            hotSet: stats[rs.indexOf(Math.max(...rs))].equip,
            coldSet: stats[rs.indexOf(Math.min(...rs))].equip,
          };
        }
      }
      return { label, consistentHot, consistentCold, maxSpread };
    };
    return [pick((s) => s.front, "前区"), pick((s) => s.back, "后区")];
  }, [stats]);

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">球套使用分布（有记录期数）</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} label={(p) => `${(p.percent * 100).toFixed(1)}%`} />
                <Tooltip formatter={(v: number) => [fmtInt(v) + " 期", "使用期数"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">数据说明</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>· 官方每期随机启用 3 套摇奖球中的 1 套。本数据来自官方开奖公告字段。</p>
            <p>· 球套记录自第 {firstKnown?.num} 期（{firstKnown?.date}）起有数据，此前 {fmtInt(unknown)} 期无记录；有记录期数共 {fmtInt(totalKnown)} 期。</p>
            <p>· 三套球使用次数：第 1 套 {fmtInt(stats[0].draws)} 期、第 2 套 {fmtInt(stats[1].draws)} 期、第 3 套 {fmtInt(stats[2].draws)} 期——三套使用率基本接近 1/3，符合随机抽套机制。</p>
            <p>· 热号 / 冷号按「该套球内的实际次数 vs 该套期望次数（= 该套使用期数 × 单球概率）」判定，每套球独立计算。</p>
          </CardContent>
        </Card>
      </div>

      {/* 每套球热号冷号排行 */}
      <div>
        <h3 className="font-semibold mb-2">每套球的热号 / 冷号排行（数字旁为出现次数）</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {stats.map((s, i) => (
            <SetHotColdCard key={s.equip} s={s} color={SET_COLORS[i]} />
          ))}
        </div>
      </div>

      {/* 跨球套对比 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">跨球套冷热对比总结</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 text-[11px]">
            <Badge className="bg-red-500">≥ +15% 明显偏热</Badge>
            <Badge className="bg-red-200 text-red-900">+5% ~ +15% 偏热</Badge>
            <Badge className="bg-slate-100 text-slate-600">±5% 正常波动</Badge>
            <Badge className="bg-blue-200 text-blue-900">-5% ~ -15% 偏冷</Badge>
            <Badge className="bg-blue-500">≤ -15% 明显偏冷</Badge>
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <div className="text-xs text-muted-foreground mb-1">前区 1-35 × 3 套球</div>
              <CrossSetTable stats={stats} zone="front" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">后区 1-12 × 3 套球</div>
              <CrossSetTable stats={stats} zone="back" />
              <div className="mt-4 space-y-1.5 text-sm">
                {summary.map((sm) => (
                  <div key={sm.label} className="rounded-lg border p-3 bg-muted/30">
                    <div className="font-medium mb-1">{sm.label}结论</div>
                    <ul className="text-muted-foreground space-y-1 text-[13px]">
                      <li>
                        · 三套球一致偏热：
                        {sm.consistentHot.length
                          ? sm.consistentHot.map((n) => pad2(n)).join("、")
                          : "无（没有任何号码在三套球中都稳定偏热）"}
                      </li>
                      <li>
                        · 三套球一致偏冷：
                        {sm.consistentCold.length
                          ? sm.consistentCold.map((n) => pad2(n)).join("、")
                          : "无（没有任何号码在三套球中都稳定偏冷）"}
                      </li>
                      <li>
                        · 跨套分歧最大：号码 {pad2(sm.maxSpread.n)}（第 {sm.maxSpread.hotSet} 套偏多 vs 第 {sm.maxSpread.coldSet} 套偏少，相差 {(sm.maxSpread.spread * 100).toFixed(0)}%）
                      </li>
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-amber-700">· 提醒：跨球套之间的冷热差异是抽样波动的正常表现，差异越大并不代表某套球「有偏向」——摇奖球套每期随机启用且经官方检测。</p>
        </CardContent>
      </Card>

      {/* 每套球完整分布图 */}
      {stats.map((s, i) => (
        <Card key={s.equip}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base" style={{ color: SET_COLORS[i] }}>
              第 {s.equip} 套摇奖球 · {fmtInt(s.draws)} 期 · 前区期望 {s.front[0]?.expected.toFixed(1)} 次 / 后区期望 {s.back[0]?.expected.toFixed(1)} 次
            </CardTitle>
          </CardHeader>
          <CardContent className="grid lg:grid-cols-2 gap-6">
            <div>
              <div className="text-xs text-muted-foreground mb-1">前区（1-35）</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={s.front} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="n" tickFormatter={(v) => pad2(v)} tick={{ fontSize: 9 }} interval={0} angle={-45} textAnchor="end" height={36} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [v, "出现次数"]} labelFormatter={(l) => `号码 ${pad2(l as number)}`} />
                  <ReferenceLine y={s.front[0]?.expected ?? 0} stroke="#f59e0b" strokeDasharray="6 3" />
                  <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                    {s.front.map((x) => (
                      <Cell key={x.n} fill={x.ratio >= 1 ? SET_COLORS[i] : "#cbd5e1"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">后区（1-12）</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={s.back} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="n" tickFormatter={(v) => pad2(v)} tick={{ fontSize: 9 }} interval={0} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [v, "出现次数"]} labelFormatter={(l) => `号码 ${pad2(l as number)}`} />
                  <ReferenceLine y={s.back[0]?.expected ?? 0} stroke="#f59e0b" strokeDasharray="6 3" />
                  <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                    {s.back.map((x) => (
                      <Cell key={x.n} fill={x.ratio >= 1 ? SET_COLORS[i] : "#cbd5e1"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
