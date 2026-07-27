import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DrawBalls } from "@/components/Ball";
import type { Draw } from "@/types/dlt";
import { fmtInt, fmtMoney, pad2 } from "@/lib/stats";

type Mode = "single" | "multi" | "dantuo";
type Era = 2 | 3;

/** 中奖条件 -> 奖级（时代2：2019 规则 9 奖级；时代3：2026 规则 7 奖级） */
const COND_ERA2: Record<string, string> = {
  "5+2": "一等奖", "5+1": "二等奖", "5+0": "三等奖", "4+2": "四等奖",
  "4+1": "五等奖", "3+2": "六等奖", "4+0": "七等奖",
  "3+1": "八等奖", "2+2": "八等奖",
  "3+0": "九等奖", "2+1": "九等奖", "1+2": "九等奖", "0+2": "九等奖",
};
const COND_ERA3: Record<string, string> = {
  "5+2": "一等奖", "5+1": "二等奖",
  "5+0": "三等奖", "4+2": "三等奖",
  "4+1": "四等奖",
  "4+0": "五等奖", "3+2": "五等奖",
  "3+1": "六等奖", "2+2": "六等奖",
  "3+0": "七等奖", "2+1": "七等奖", "1+2": "七等奖", "0+2": "七等奖",
};
const ADDON_LEVELS = new Set(["一等奖", "二等奖"]);

function levelOf(f: number, b: number, era: Era): string | null {
  return (era === 3 ? COND_ERA3 : COND_ERA2)[`${f}+${b}`] ?? null;
}

function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return Math.round(r);
}

function* combosFrom(arr: number[], k: number): Generator<number[]> {
  if (k === 0) { yield []; return; }
  for (let i = 0; i <= arr.length - k; i++) {
    for (const rest of combosFrom(arr.slice(i + 1), k - 1)) {
      yield [arr[i], ...rest];
    }
  }
}

/** 号码选择按钮组 */
function NumberPicker({
  max, selected, onToggle, zone, disabled,
}: {
  max: number; selected: Set<number>; onToggle: (n: number) => void; zone: "front" | "back"; disabled?: Set<number>;
}) {
  const on = zone === "front" ? "bg-red-600 text-white border-red-600" : "bg-blue-600 text-white border-blue-600";
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${zone === "front" ? 7 : 6}, minmax(0,1fr))` }}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
        const sel = selected.has(n);
        const dis = disabled?.has(n);
        return (
          <button
            key={n}
            disabled={dis}
            onClick={() => onToggle(n)}
            className={`h-8 rounded-md border text-xs font-semibold transition-colors ${
              sel ? on : dis ? "opacity-25 cursor-not-allowed" : "bg-white hover:bg-muted"
            }`}
          >
            {pad2(n)}
          </button>
        );
      })}
    </div>
  );
}

function toggle(set: Set<number>, n: number): Set<number> {
  const s = new Set(set);
  if (s.has(n)) s.delete(n); else s.add(n);
  return s;
}

export default function PrizeCalculatorSection({
  draws,
  prefill,
}: {
  draws: Draw[];
  prefill?: { front: number[]; back: number[]; label: string; ts: number } | null;
}) {
  const supported = useMemo(() => draws.filter((d) => d.num >= "19019"), [draws]);
  const [drawNum, setDrawNum] = useState(supported[supported.length - 1].num);
  const draw = supported.find((d) => d.num === drawNum) ?? supported[supported.length - 1];
  const era: Era = draw.num >= "26014" ? 3 : 2;

  const [mode, setMode] = useState<Mode>("single");
  const [front, setFront] = useState<Set<number>>(new Set());
  const [back, setBack] = useState<Set<number>>(new Set());
  const [frontDan, setFrontDan] = useState<Set<number>>(new Set());
  const [frontTuo, setFrontTuo] = useState<Set<number>>(new Set());
  const [backDan, setBackDan] = useState<Set<number>>(new Set());
  const [backTuo, setBackTuo] = useState<Set<number>>(new Set());
  const [addOn, setAddOn] = useState(true);
  const [times, setTimes] = useState(1);
  const [prefillLabel, setPrefillLabel] = useState<string | null>(null);

  /** 从预测页带入号码 */
  useEffect(() => {
    if (!prefill) return;
    setMode("single");
    setFront(new Set(prefill.front));
    setBack(new Set(prefill.back));
    setPrefillLabel(prefill.label);
  }, [prefill]);

  /** 注数与合法性 */
  const { bets, error } = useMemo(() => {
    if (mode === "single") {
      if (front.size !== 5 || back.size !== 2)
        return { bets: 0, error: `单式需选 5 个前区 + 2 个后区（当前 ${front.size}+${back.size}）` };
      return { bets: 1, error: "" };
    }
    if (mode === "multi") {
      if (front.size < 5 || back.size < 2)
        return { bets: 0, error: "复式：前区至少 5 个、后区至少 2 个" };
      const n = comb(front.size, 5) * comb(back.size, 2);
      if (n > 20000) return { bets: 0, error: `复式注数 ${fmtInt(n)} 超出计算器上限 20,000 注` };
      return { bets: n, error: "" };
    }
    // 胆拖
    const fd = frontDan.size, ft = frontTuo.size, bd = backDan.size, bt = backTuo.size;
    if (fd < 1 || fd > 4) return { bets: 0, error: "前区胆码需 1-4 个" };
    if (ft < 2 || fd + ft < 6) return { bets: 0, error: "前区拖码至少 2 个且胆码+拖码 ≥ 6 个" };
    if (bd > 1) return { bets: 0, error: "后区胆码最多 1 个" };
    if (bt < 2 - bd) return { bets: 0, error: `后区拖码至少 ${2 - bd} 个` };
    if (bd === 1 && bt < 2) return { bets: 0, error: "后区设 1 个胆码时拖码至少 2 个" };
    const n = comb(ft, 5 - fd) * comb(bt, 2 - bd);
    if (n > 20000) return { bets: 0, error: `胆拖注数 ${fmtInt(n)} 超出计算器上限 20,000 注` };
    return { bets: n, error: "" };
  }, [mode, front, back, frontDan, frontTuo, backDan, backTuo]);

  /** 命中计算 */
  const result = useMemo(() => {
    if (!bets || error) return null;
    const prize = new Map(draw.prizes.map((p) => [p.level, p]));
    const counts = new Map<string, number>();

    const check = (f: number[], b: number[]) => {
      const fm = f.filter((n) => draw.front.includes(n)).length;
      const bm = b.filter((n) => draw.back.includes(n)).length;
      const lv = levelOf(fm, bm, era);
      if (lv) counts.set(lv, (counts.get(lv) ?? 0) + 1);
    };

    if (mode === "single") {
      check([...front], [...back]);
    } else if (mode === "multi") {
      for (const f of combosFrom([...front], 5))
        for (const b of combosFrom([...back], 2)) check(f, b);
    } else {
      for (const ft of combosFrom([...frontTuo], 5 - frontDan.size))
        for (const bt of combosFrom([...backTuo], 2 - backDan.size))
          check([...frontDan, ...ft], [...backDan, ...bt]);
    }

    let baseWin = 0, addWin = 0, promoWin = 0;
    const rows = [...counts.entries()].map(([lv, cnt]) => {
      const p = prize.get(lv);
      const unit = p?.amount ?? 0;
      const base = unit * cnt;
      baseWin += base;
      let add = 0, promo = 0;
      if (addOn && ADDON_LEVELS.has(lv)) {
        add = (prize.get(lv + "(追加)")?.amount ?? 0) * cnt;
        addWin += add;
        promo += (prize.get(lv + "追加派奖")?.amount ?? 0) * cnt;
      }
      promo += (prize.get(lv === "一等奖" ? "一等奖基本派奖" : lv + "派奖")?.amount ?? 0) * cnt;
      promoWin += promo;
      return { lv, cnt, unit, base, add, promo };
    });
    rows.sort((a, b) => b.base + b.add - (a.base + a.add));
    const totalWin = (baseWin + addWin + promoWin) * times;
    const cost = bets * (addOn ? 3 : 2) * times;
    return { rows, baseWin: baseWin * times, addWin: addWin * times, promoWin: promoWin * times, totalWin, cost, hits: [...counts.values()].reduce((a, b) => a + b, 0) * times };
  }, [bets, error, mode, front, back, frontDan, frontTuo, backDan, backTuo, draw, era, addOn, times]);

  const clearAll = () => {
    setFront(new Set()); setBack(new Set());
    setFrontDan(new Set()); setFrontTuo(new Set()); setBackDan(new Set()); setBackTuo(new Set());
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">① 选择期号（按该期官方公告金额计算）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Input
              value={drawNum}
              onChange={(e) => setDrawNum(e.target.value.trim())}
              className="w-32 font-mono"
              placeholder="期号"
            />
            <div className="flex gap-1.5 flex-wrap">
              {supported.slice(-8).reverse().map((d) => (
                <Button key={d.num} size="sm" variant={d.num === draw.num ? "default" : "outline"} onClick={() => setDrawNum(d.num)}>
                  {d.num}
                </Button>
              ))}
            </div>
          </div>
          {draw.num !== drawNum && (
            <p className="text-xs text-amber-700">期号 {drawNum} 无数据或不支持（仅支持 19019 期及以后，旧规则奖级条件不同），已回退到第 {draw.num} 期。</p>
          )}
          <div className="flex items-center gap-4 flex-wrap rounded-lg bg-muted/40 p-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">第 {draw.num} 期 · {draw.date} 开奖号码</div>
              <DrawBalls front={draw.front} back={draw.back} />
            </div>
            <div className="flex gap-2 flex-wrap">
              {draw.equip > 0 && <Badge variant="secondary" className="bg-purple-100 text-purple-700">第{draw.equip}套球</Badge>}
              {draw.promo && <Badge className="bg-amber-500">派奖期（含派奖奖金）</Badge>}
              <Badge variant="outline">{era === 3 ? "2026 规则 · 7 奖级" : "2019 规则 · 9 奖级"}</Badge>
              <Badge variant="outline">奖池 {fmtMoney(draw.poolBefore)}</Badge>
            </div>
          </div>
          {/* 当期公告奖级表 */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="text-left py-1 font-medium">奖级</th>
                  {draw.prizes.map((p) => <th key={p.level} className="text-right px-1 font-medium whitespace-nowrap">{p.level}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-1 text-muted-foreground">单注奖金</td>
                  {draw.prizes.map((p) => <td key={p.level} className="text-right px-1 font-semibold whitespace-nowrap">{p.amount === null ? "—" : fmtInt(p.amount)}</td>)}
                </tr>
                <tr>
                  <td className="py-1 text-muted-foreground">中奖注数</td>
                  {draw.prizes.map((p) => <td key={p.level} className="text-right px-1 text-muted-foreground whitespace-nowrap">{fmtInt(p.count)}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">② 选择玩法并选号</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {prefillLabel && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 flex items-center justify-between gap-2 flex-wrap">
              <span>已从「预测与期望值」带入：<b>{prefillLabel}</b> 的号码（单式 1 注），可直接计算或继续改号。</span>
              <button className="text-xs underline" onClick={() => setPrefillLabel(null)}>知道了</button>
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <ToggleGroup type="single" value={mode} onValueChange={(v) => { if (v) { setMode(v as Mode); } }} size="sm">
              <ToggleGroupItem value="single">单式</ToggleGroupItem>
              <ToggleGroupItem value="multi">复式</ToggleGroupItem>
              <ToggleGroupItem value="dantuo">胆拖</ToggleGroupItem>
            </ToggleGroup>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={addOn} onCheckedChange={setAddOn} /> 追加投注（每注 +1 元）
            </label>
            <label className="flex items-center gap-2 text-sm">
              倍数
              <Input type="number" min={1} max={99} value={times} onChange={(e) => setTimes(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))} className="w-16" />
              倍
            </label>
            <Button variant="outline" size="sm" onClick={clearAll}>清空选号</Button>
          </div>

          {mode !== "dantuo" ? (
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  前区（已选 {front.size} 个{mode === "single" ? " / 需 5 个" : " / 至少 5 个"}）
                </div>
                <NumberPicker max={35} selected={front} onToggle={(n) => setFront(toggle(front, n))} zone="front" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  后区（已选 {back.size} 个{mode === "single" ? " / 需 2 个" : " / 至少 2 个"}）
                </div>
                <NumberPicker max={12} selected={back} onToggle={(n) => setBack(toggle(back, n))} zone="back" />
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">前区胆码（{frontDan.size} 个 / 1-4 个）</div>
                  <NumberPicker max={35} selected={frontDan} disabled={frontTuo} onToggle={(n) => setFrontDan(toggle(frontDan, n))} zone="front" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">前区拖码（{frontTuo.size} 个 / ≥2 且胆+拖 ≥ 6）</div>
                  <NumberPicker max={35} selected={frontTuo} disabled={frontDan} onToggle={(n) => setFrontTuo(toggle(frontTuo, n))} zone="front" />
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">后区胆码（{backDan.size} 个 / 0-1 个）</div>
                  <NumberPicker max={12} selected={backDan} disabled={backTuo} onToggle={(n) => setBackDan(toggle(backDan, n))} zone="back" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">后区拖码（{backTuo.size} 个）</div>
                  <NumberPicker max={12} selected={backTuo} disabled={backDan} onToggle={(n) => setBackTuo(toggle(backTuo, n))} zone="back" />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap text-sm">
            {error ? (
              <span className="text-amber-700">{error}</span>
            ) : (
              <>
                <Badge variant="secondary">共 {fmtInt(bets)} 注</Badge>
                <Badge variant="secondary">投入 {fmtInt(bets * (addOn ? 3 : 2) * times)} 元（{addOn ? "3" : "2"} 元/注 × {fmtInt(bets)} 注 × {times} 倍）</Badge>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 结果 */}
      {result && (
        <Card className={result.totalWin > 0 ? "border-emerald-300" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">③ 计算结果（按第 {draw.num} 期公告金额）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">未中奖——所选号码在该期没有达到任何奖级的中奖条件。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground text-xs border-b">
                      <th className="text-left py-2 font-medium">奖级</th>
                      <th className="text-right font-medium">命中注数</th>
                      <th className="text-right font-medium">公告单注</th>
                      <th className="text-right font-medium">基本奖金</th>
                      {addOn && <th className="text-right font-medium">追加奖金</th>}
                      {result.promoWin > 0 && <th className="text-right font-medium">派奖奖金</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((r) => (
                      <tr key={r.lv} className="border-b last:border-0">
                        <td className="py-2 font-medium">{r.lv}</td>
                        <td className="text-right">{fmtInt(r.cnt)}{times > 1 ? ` × ${times} 倍` : ""}</td>
                        <td className="text-right text-muted-foreground">{fmtInt(r.unit)} 元</td>
                        <td className="text-right font-semibold">{fmtInt(r.base * times)} 元</td>
                        {addOn && <td className="text-right text-emerald-700">{r.add > 0 ? `+${fmtInt(r.add * times)} 元` : "—"}</td>}
                        {result.promoWin > 0 && <td className="text-right text-amber-700">{r.promo > 0 ? `+${fmtInt(r.promo * times)} 元` : "—"}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="rounded-lg bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">总投入</div>
                <div className="text-lg font-bold">{fmtInt(result.cost)} 元</div>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">命中注数（含复式拆分）</div>
                <div className="text-lg font-bold">{fmtInt(result.hits)} 注</div>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3">
                <div className="text-xs text-muted-foreground">总奖金{result.promoWin > 0 ? "（含派奖）" : ""}</div>
                <div className="text-lg font-bold text-emerald-700">{fmtInt(result.totalWin)} 元</div>
              </div>
              <div className={`rounded-lg p-3 ${result.totalWin - result.cost >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                <div className="text-xs text-muted-foreground">盈亏</div>
                <div className={`text-lg font-bold ${result.totalWin - result.cost >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                  {result.totalWin - result.cost >= 0 ? "+" : ""}{fmtInt(result.totalWin - result.cost)} 元
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              · 浮动奖（一、二等奖）按该期公告单注金额计算；若你的命中注数会使中奖注数增加，实际单注金额会被摊薄，实得略低于本结果。
              · 复式/胆拖命中多个奖级时已自动累计。2019 年前旧规则期号不支持计算（奖级条件不同）。奖金以投注站终端及官方公告为准。
            </p>
          </CardContent>
        </Card>
      )}

      {/* 玩法说明 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">大乐透玩法说明</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3 text-sm text-muted-foreground">
          <div className="rounded-lg border p-3"><b className="text-foreground">单式</b>：前区 5 个 + 后区 2 个 = 1 注，2 元。</div>
          <div className="rounded-lg border p-3"><b className="text-foreground">追加投注</b>：每注 +1 元，中一、二等奖时在基本奖金外再得追加奖金（实测约为基本的 80%）。</div>
          <div className="rounded-lg border p-3"><b className="text-foreground">复式</b>：前区选 5 个以上和/或后区选 2 个以上，自动组合成多注（前区复式 / 后区复式 / 双区复式）。</div>
          <div className="rounded-lg border p-3"><b className="text-foreground">胆拖</b>：选定"胆码"（每注必含）+ "拖码"（轮流搭配），前区胆码 1-4 个、后区胆码最多 1 个，比同覆盖面的复式更省注数。</div>
          <div className="rounded-lg border p-3"><b className="text-foreground">多倍投注</b>：同一注号码投 2-99 倍，奖金按倍数放大。</div>
          <div className="rounded-lg border p-3"><b className="text-foreground">中奖条件（{era === 3 ? "现行 2026 规则，13 种" : "2019 规则"}）</b>：
            {era === 3
              ? "一 5+2｜二 5+1｜三 5+0或4+2｜四 4+1｜五 4+0或3+2｜六 3+1或2+2｜七 3+0、2+1、1+2、0+2。奖池 ≥8 亿时三至七等奖固定奖金上浮 20%-40%（已体现在当期公告金额中）。"
              : "一 5+2｜二 5+1｜三 5+0｜四 4+2｜五 4+1｜六 3+2｜七 4+0｜八 3+1或2+2｜九 3+0、2+1、1+2、0+2。"}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
