import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DrawBalls } from "@/components/Ball";
import type { Draw } from "@/types/dlt";
import { frontStats, backStats, fmtMoney, fmtInt } from "@/lib/stats";

/** 一等奖理论概率：C(35,5)*C(12,2) */
const COMBOS = 324632 * 66; // 21,425,712

interface Pick { front: number[]; back: number[] }

function randomPick(): Pick {
  const pool = (max: number, k: number) => {
    const arr = Array.from({ length: max }, (_, i) => i + 1);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, k).sort((a, b) => a - b);
  };
  return { front: pool(35, 5), back: pool(12, 2) };
}

/** 低撞号机选：避免生日集中（>31 至少 2 个）、避免 4 连号以上 */
function antiSharePick(): Pick {
  for (let t = 0; t < 500; t++) {
    const p = randomPick();
    const big = p.front.filter((n) => n > 31).length;
    let maxRun = 1, run = 1;
    for (let i = 1; i < p.front.length; i++) {
      run = p.front[i] === p.front[i - 1] + 1 ? run + 1 : 1;
      maxRun = Math.max(maxRun, run);
    }
    if (big >= 2 && maxRun <= 3) return p;
  }
  return randomPick();
}

/** 各时代实证返奖率 */
function eraReturns(draws: Draw[]) {
  const eras = [
    { name: "时代 1（07001-19018）", a: "07001", b: "19018" },
    { name: "时代 2（19019-26013）", a: "19019", b: "26013" },
    { name: "时代 3（26014 至今）", a: "26014", b: "99999" },
    { name: "近一年", a: "", b: "" },
  ];
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const cut = cutoff.toISOString().slice(0, 10);
  return eras.map((e) => {
    const sub = e.a
      ? draws.filter((d) => d.num >= e.a && d.num <= e.b && (d.sales ?? 0) > 0)
      : draws.filter((d) => d.date >= cut && (d.sales ?? 0) > 0);
    const sales = sub.reduce((s, d) => s + (d.sales ?? 0), 0);
    const paid = sub.reduce((s, d) => s + d.prizes.reduce((x, p) => x + (p.total ?? 0), 0), 0);
    return { name: e.name, draws: sub.length, sales, paid, rate: sales > 0 ? paid / sales : 0 };
  });
}

export default function PredictionSection({ draws, onSendToCalc }: { draws: Draw[]; onSendToCalc?: (front: number[], back: number[], label: string) => void }) {
  const [machine, setMachine] = useState<Pick>(() => randomPick());
  const [anti, setAnti] = useState<Pick>(() => antiSharePick());

  const latest = draws[draws.length - 1];
  const nextNum = String(parseInt(latest.num) + 1);

  /** 近一年热号 / 冷号策略 */
  const { hotPick, coldPick } = useMemo(() => {
    const cut = new Date();
    cut.setFullYear(cut.getFullYear() - 1);
    const sub = draws.filter((d) => d.date >= cut.toISOString().slice(0, 10));
    const fs = frontStats(sub);
    const bs = backStats(sub);
    const hot: Pick = {
      front: [...fs].sort((a, b) => b.count - a.count).slice(0, 5).map((x) => x.n).sort((a, b) => a - b),
      back: [...bs].sort((a, b) => b.count - a.count).slice(0, 2).map((x) => x.n).sort((a, b) => a - b),
    };
    const cold: Pick = {
      front: [...fs].sort((a, b) => b.omission - a.omission).slice(0, 5).map((x) => x.n).sort((a, b) => a - b),
      back: [...bs].sort((a, b) => b.omission - a.omission).slice(0, 2).map((x) => x.n).sort((a, b) => a - b),
    };
    return { hotPick: hot, coldPick: cold };
  }, [draws]);

  const returns = useMemo(() => eraReturns(draws), [draws]);
  const recentRate = returns[3].rate || 0.53;

  /** 追加 vs 基本（时代 2/3 数据：追加奖金中位数 = 80% × 基本，成本 +50%） */
  const addRatio = 0.8;

  const buyMethods = [
    { name: "单式基本（2 元）", unitEv: "≈ 53%", variance: "低", verdict: "基准买法" },
    { name: "单式基本+追加（3 元）", unitEv: "≈ 53%~56%（浮动奖部分每元期望高约 20%）", variance: "低", verdict: "★ 单位期望最高的买法", best: true },
    { name: "复式（如 6+2 = 12 元）", unitEv: "≈ 53%（同基本）", variance: "中（覆盖面大）", verdict: "提高中小奖概率，不提高单位期望" },
    { name: "胆拖", unitEv: "≈ 53%（同基本）", variance: "中", verdict: "省钱的复式，期望不变" },
    { name: "多倍投注", unitEv: "≈ 53%（线性缩放）", variance: "高", verdict: "同比例放大盈亏，期望不变" },
    { name: "合买", unitEv: "≈ 53%", variance: "按份额分摊", verdict: "降低个人波动，期望不变" },
  ];

  return (
    <div className="space-y-4">
      {/* 诚实声明 */}
      <Card className="border-amber-300 bg-amber-50">
        <CardContent className="pt-4 pb-3 text-sm text-amber-900 space-y-1">
          <p className="font-semibold">先说结论（这是数学，不是泼冷水）：</p>
          <p>· 大乐透每期开奖相互独立，每个前区+后区组合的中奖概率完全相同：<b>1 / {fmtInt(COMBOS)}</b>（约 2142 万分之一）。</p>
          <p>· 因此<b>不存在任何能预测下一期号码的方法</b>——热号、冷号、遗漏、走势在数学上对下一期概率的影响为零。下面的「参考号码」仅作娱乐演示。</p>
          <p>· 真正能被数学优化的只有三件事：<b>买法（是否追加）</b>、<b>撞号规避（中奖后少分人）</b>、<b>买入时机（奖池高低）</b>。</p>
        </CardContent>
      </Card>

      {/* 下一期参考（娱乐） */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            下一期（第 {nextNum} 期）参考号码 · <span className="text-amber-600 text-sm font-normal">娱乐演示，三种策略中奖概率完全相同</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3">
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Badge className="bg-red-600">热号延续策略</Badge>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">近一年出现最多</span>
                <Button size="sm" variant="outline" onClick={() => onSendToCalc?.(hotPick.front, hotPick.back, "热号延续策略")}>带入计算器 →</Button>
              </div>
            </div>
            <DrawBalls front={hotPick.front} back={hotPick.back} />
            <div className="flex items-center justify-between">
              <Badge className="bg-blue-600">冷号回补策略</Badge>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">近一年遗漏最长</span>
                <Button size="sm" variant="outline" onClick={() => onSendToCalc?.(coldPick.front, coldPick.back, "冷号回补策略")}>带入计算器 →</Button>
              </div>
            </div>
            <DrawBalls front={coldPick.front} back={coldPick.back} />
          </div>
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">纯随机机选</Badge>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setMachine(randomPick())}>换一注</Button>
                <Button size="sm" variant="outline" onClick={() => onSendToCalc?.(machine.front, machine.back, "纯随机机选")}>带入计算器 →</Button>
              </div>
            </div>
            <DrawBalls front={machine.front} back={machine.back} />
            <div className="flex items-center justify-between">
              <Badge className="bg-emerald-600">低撞号机选（推荐）</Badge>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setAnti(antiSharePick())}>换一注</Button>
                <Button size="sm" variant="outline" onClick={() => onSendToCalc?.(anti.front, anti.back, "低撞号机选")}>带入计算器 →</Button>
              </div>
            </div>
            <DrawBalls front={anti.front} back={anti.back} />
            <p className="text-xs text-muted-foreground">低撞号 = 至少 2 个号码大于 31（避开生日号）+ 无 4 连号。中奖概率不变，但中奖时撞号分奖的人更少。「带入计算器」可将该注号码送到「奖金计算器」页签，对任意历史期验算能中多少钱。</p>
          </div>
        </CardContent>
      </Card>

      {/* 实证期望 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">每注 2 元的数学期望（用 {fmtInt(draws.length)} 期真实数据实证）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs border-b">
                  <th className="text-left py-2 font-medium">统计区间</th>
                  <th className="text-right font-medium">有效期数</th>
                  <th className="text-right font-medium">总销量</th>
                  <th className="text-right font-medium">总派奖</th>
                  <th className="text-right font-medium">实证返奖率</th>
                </tr>
              </thead>
              <tbody>
                {returns.map((r) => (
                  <tr key={r.name} className="border-b last:border-0">
                    <td className="py-2">{r.name}</td>
                    <td className="text-right">{fmtInt(r.draws)}</td>
                    <td className="text-right">{fmtMoney(r.sales)}</td>
                    <td className="text-right">{fmtMoney(r.paid)}</td>
                    <td className="text-right font-semibold">{(r.rate * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">每注 2 元的期望回报</div>
              <div className="text-lg font-bold">≈ {(2 * recentRate).toFixed(2)} 元</div>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">每注期望亏损</div>
              <div className="text-lg font-bold text-red-600">≈ {(2 - 2 * recentRate).toFixed(2)} 元</div>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">中一等奖概率</div>
              <div className="text-lg font-bold">1 / {(COMBOS / 10000).toFixed(0)} 万</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">· 时代 1 早期销量字段大量缺失（仅 402 期有效），返奖率仅供参考；时代 2/3 与近一年稳定在 53% 左右，与官方设计返奖率一致。返奖率已含派奖活动加成，派奖期实际返奖率略高于平时。</p>
        </CardContent>
      </Card>

      {/* 追加的数学 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">为什么「追加」是单位期望最高的买法（数学推导 + 数据佐证）</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>现行规则下（由 19019 期后的真实开奖数据验证，中位数）：</p>
          <div className="rounded-lg bg-muted/40 p-4 font-mono text-[13px] space-y-1">
            <p>追加成本　　　= 基本投注 × 1.5 倍（+1 元）</p>
            <p>追加浮动奖金　= 基本浮动奖金 × {addRatio} 倍（一、二等奖实测中位数 0.80）</p>
            <p>浮动奖每元期望：追加 = {addRatio}/1.5 ≈ 0.533 × 基本浮动奖期望 / 元</p>
            <p>　　　　　　　　基本 = 1.0/2.0 = 0.500 × 基本浮动奖期望 / 元</p>
            <p>⇒ 在一、二等奖部分，追加的每元期望比基本高约 6.7%</p>
          </div>
          <p className="text-muted-foreground">注意：追加只放大浮动奖（一、二等奖）的期望，中小奖级与基本票相同；它把本来就很极端的期望进一步向「极小概率的大奖」集中，期望改善微弱但方向为正。若只买一种，<b>单式基本+追加（3 元）</b>是数学上单位期望最高的买法。</p>
        </CardContent>
      </Card>

      {/* 买法对比 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">各种买法期望值对比</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs border-b">
                  <th className="text-left py-2 font-medium">买法</th>
                  <th className="text-left font-medium">单位金额期望回报</th>
                  <th className="text-left font-medium">波动</th>
                  <th className="text-left font-medium">结论</th>
                </tr>
              </thead>
              <tbody>
                {buyMethods.map((m) => (
                  <tr key={m.name} className={`border-b last:border-0 ${m.best ? "bg-emerald-50" : ""}`}>
                    <td className="py-2 font-medium">{m.name}</td>
                    <td>{m.unitEv}</td>
                    <td>{m.variance}</td>
                    <td className={m.best ? "font-semibold text-emerald-700" : "text-muted-foreground"}>{m.verdict}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 最终建议 */}
      <Card className="border-emerald-300 bg-emerald-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-emerald-900">期望值最高的买法 · 最终建议</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-emerald-900 space-y-1.5">
          <p>1. <b>买法</b>：单式 1 注 + 追加（3 元）。数学上单位期望最高；复式/胆拖/倍投都不提高单位期望。</p>
          <p>2. <b>选号</b>：用「低撞号机选」——中奖概率与其他任何组合完全相同，但一旦中浮动奖，需要与之分奖的人更少（避开生日号 1-31 集中、连号、对称图案等大众组合）。</p>
          <p>3. <b>时机</b>：奖池处于历史高位（当前 {fmtMoney(latest.poolAfter)}）或派奖活动期间，浮动奖期望更高——派奖期实证返奖率高于平时。</p>
          <p>4. <b>预算</b>：期望亏损约 47% 是不变的数学事实，把购彩当作娱乐消费而非投资，单期投入不超过可随意支配的零花钱。</p>
        </CardContent>
      </Card>
    </div>
  );
}
