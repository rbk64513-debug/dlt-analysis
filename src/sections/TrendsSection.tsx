import { useMemo, useState } from "react";
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Bar,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Draw } from "@/types/dlt";
import { fmtMoney } from "@/lib/stats";

type Metric = "pool" | "sales" | "first";

interface Point {
  num: string;
  date: string;
  value: number | null;
  extra?: number | null;
  promo?: boolean;
}

export default function TrendsSection({ draws }: { draws: Draw[] }) {
  const [metric, setMetric] = useState<Metric>("pool");

  const data: Point[] = useMemo(() => {
    return draws.map((d) => {
      let value: number | null = null;
      let extra: number | null = null;
      if (metric === "pool") {
        value = d.poolAfter;
        extra = d.poolBefore;
      } else if (metric === "sales") {
        value = d.sales;
      } else {
        const p1 = d.prizes.find((p) => p.level === "一等奖");
        value = p1?.amount ?? null;
        extra = p1?.count ?? null;
      }
      return { num: d.num, date: d.date, value, extra, promo: d.promo };
    });
  }, [draws, metric]);

  const cfg = {
    pool: {
      title: "奖池滚存走势（开奖后，元）",
      lineName: "开奖后奖池",
      extraName: "开奖前奖池",
      color: "#dc2626",
      note: "奖池高低直接决定一等奖成色：奖池越高，一等奖单注奖金上限越有保障。派奖活动期（数据中以橙色高亮提示）常伴随奖池快速消耗。",
    },
    sales: {
      title: "单期销量走势（元）",
      lineName: "销量",
      extraName: "",
      color: "#2563eb",
      note: "销量决定浮动奖分配基数与奖池积累速度。派奖期间销量通常明显放大。",
    },
    first: {
      title: "一等奖单注奖金走势（元）",
      lineName: "一等奖单注奖金",
      extraName: "中奖注数",
      color: "#16a34a",
      note: "一等奖为浮动奖，由奖池/销量按比例分配并按中奖注数均摊：中奖注数越多，单注奖金越低。",
    },
  }[metric];

  // 降采样到约 800 点保证渲染流畅
  const sampled = useMemo(() => {
    const step = Math.max(1, Math.ceil(data.length / 800));
    return data.filter((_, i) => i % step === 0 || i === data.length - 1);
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">指标：</span>
        <ToggleGroup type="single" value={metric} onValueChange={(v) => v && setMetric(v as Metric)} size="sm">
          <ToggleGroupItem value="pool">奖池滚存</ToggleGroupItem>
          <ToggleGroupItem value="sales">销量</ToggleGroupItem>
          <ToggleGroupItem value="first">一等奖奖金</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{cfg.title} · 全部 {draws.length} 期</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={380}>
            <ComposedChart data={sampled} margin={{ top: 5, right: 12, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="num" tick={{ fontSize: 10 }} interval={Math.floor(sampled.length / 12)} />
              <YAxis tickFormatter={(v) => fmtMoney(v)} tick={{ fontSize: 11 }} width={70} />
              <Tooltip
                formatter={(v: number, name: string) => [name.includes("注数") ? v + " 注" : fmtMoney(v) + " 元", name]}
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload as Point | undefined;
                  return p ? `第 ${p.num} 期 · ${p.date}${p.promo ? " · 派奖期" : ""}` : "";
                }}
              />
              <Legend />
              {metric === "sales" ? (
                <Bar dataKey="value" name={cfg.lineName} fill={cfg.color} opacity={0.75} />
              ) : (
                <>
                  <Area type="monotone" dataKey="value" name={cfg.lineName} stroke={cfg.color} fill={cfg.color} fillOpacity={0.15} strokeWidth={1.5} dot={false} />
                  {cfg.extraName && metric === "pool" && (
                    <Line type="monotone" dataKey="extra" name={cfg.extraName} stroke="#94a3b8" strokeWidth={1} dot={false} />
                  )}
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 pb-3 text-sm text-muted-foreground">
          <p>{cfg.note}</p>
          {metric === "first" && (
            <p className="mt-1">提示：图表对长序列做了抽样显示，悬停可查看具体期号与日期；完整每期数据见「开奖记录」页签。</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
