import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Draw } from "@/types/dlt";
import { detectRuleEras, detectPromoCampaigns, fmtMoney, fmtInt } from "@/lib/stats";

const FACTORS = [
  {
    title: "奖池滚存",
    body: "一等奖等浮动奖直接从奖池按比例计提。奖池越高，单注奖金越有保障；头奖空开或少人中时奖池持续滚存，反之被快速消耗。本工具「走势」页签可查看 2901 期完整奖池曲线。",
  },
  {
    title: "中奖注数均摊",
    body: "浮动奖奖金按中奖注数均分。同样的奖池，中出 1 注与中出 20 注，单注奖金可相差十几倍。奖级表中的「注数」列就是这一因素的量化。",
  },
  {
    title: "当期销量",
    body: "销量决定奖池注入速度和浮动奖计提基数。派奖活动期销量通常显著放大，间接抬高奖级成色。",
  },
  {
    title: "派奖活动",
    body: "官方每年春季前后开展大派奖（数据中已识别 6 轮、共 141 期）。派奖期间一、二等奖有额外派奖奖金，固定奖级也常加码，奖级表中含「派奖」字样的行即为活动专属奖金。",
  },
  {
    title: "追加投注",
    body: "追加投注（每注 3 元）可参与追加奖级分配，历史规则下追加奖金为基本奖金的一定比例，是改变单注回报的直接因素。",
  },
  {
    title: "游戏规则调整",
    body: "历史上奖级结构发生过 3 次重大变化（下方时间线，由开奖数据自动识别）：奖级数量、固定奖金额、追加范围均随之改变，直接改变各奖级期望回报。",
  },
  {
    title: "摇奖球套",
    body: "每期随机启用 3 套摇奖球之一（自 2011 年第 11006 期起有记录）。球套本身不改变奖金，但「球套分析」页签可检验各套球的号码均匀性。",
  },
  {
    title: "奖级规则（固定 / 浮动）",
    body: "低奖级为固定奖金（如 2026 规则下三等奖单注数千元浮动、七等奖 5 元等，以当期公告为准），高奖级为浮动奖金。固定奖不受注数影响，浮动奖完全由分配机制决定。",
  },
];

export default function PrizeRuleSection({ draws }: { draws: Draw[] }) {
  const eras = useMemo(() => detectRuleEras(draws), [draws]);
  const campaigns = useMemo(() => detectPromoCampaigns(draws), [draws]);

  return (
    <div className="space-y-4">
      {/* 规则时代时间线 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">规则时代时间线（由 {fmtInt(draws.length)} 期开奖数据自动识别）</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-3">
          {eras.map((e, i) => (
            <div key={i} className="rounded-lg border p-4 bg-muted/30">
              <Badge className="mb-2">{e.label}</Badge>
              <div className="text-sm font-semibold">第 {e.from} 期 ~ 第 {e.to} 期</div>
              <div className="text-xs text-muted-foreground mb-2">{e.fromDate} ~ {e.toDate}</div>
              <div className="text-sm mb-2">{e.desc}</div>
              <div className="flex flex-wrap gap-1">
                {e.levels.map((l) => (
                  <span key={l} className="text-[11px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">{l}</span>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 派奖活动 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">历年派奖活动（{campaigns.length} 轮，共 {campaigns.reduce((s, c) => s + c.draws, 0)} 期）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs border-b">
                  <th className="text-left py-2 font-medium">活动区间</th>
                  <th className="text-left font-medium">日期</th>
                  <th className="text-right font-medium">期数</th>
                  <th className="text-right font-medium">一等奖中出</th>
                  <th className="text-right font-medium">一等奖派发总额</th>
                  <th className="text-right font-medium">专项派奖总额</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-2 font-medium">
                      <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50">
                        {c.from} ~ {c.to}
                      </Badge>
                    </td>
                    <td className="text-muted-foreground">{c.fromDate} ~ {c.toDate}</td>
                    <td className="text-right">{c.draws}</td>
                    <td className="text-right">{fmtInt(c.firstPrizeCount)} 注</td>
                    <td className="text-right">{fmtMoney(c.firstPrizeTotal)}</td>
                    <td className="text-right font-semibold text-amber-700">{fmtMoney(c.promoPrizeTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">· 「专项派奖总额」为奖级名称含「派奖」的活动专属奖金合计；一等奖派发总额含基本+追加+派奖部分。</p>
        </CardContent>
      </Card>

      {/* 影响奖金的因素 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">可能改变奖金的全部因素（归纳）</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3">
          {FACTORS.map((f) => (
            <div key={f.title} className="rounded-lg border p-4">
              <div className="font-semibold text-sm mb-1">{f.title}</div>
              <div className="text-sm text-muted-foreground leading-relaxed">{f.body}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
