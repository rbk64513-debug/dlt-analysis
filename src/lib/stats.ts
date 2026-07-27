import type { Draw, NumberStat, RuleEra, PromoCampaign } from "@/types/dlt";

export const FRONT_MAX = 35;
export const BACK_MAX = 12;
export const FRONT_PICK = 5;
export const BACK_PICK = 2;

/** 单球理论概率：前区 5/35，后区 2/12 */
export const FRONT_P = FRONT_PICK / FRONT_MAX;
export const BACK_P = BACK_PICK / BACK_MAX;

function numberStats(draws: Draw[], max: number, pick: number, get: (d: Draw) => number[]): NumberStat[] {
  const counts = new Array(max + 1).fill(0);
  const lastSeen = new Array(max + 1).fill(-1);
  const maxOmit = new Array(max + 1).fill(0);
  const curOmit = new Array(max + 1).fill(0);
  draws.forEach((d, i) => {
    const hit = new Set(get(d));
    for (let n = 1; n <= max; n++) {
      if (hit.has(n)) {
        counts[n]++;
        lastSeen[n] = i;
        maxOmit[n] = Math.max(maxOmit[n], curOmit[n]);
        curOmit[n] = 0;
      } else {
        curOmit[n]++;
      }
    }
  });
  const N = draws.length;
  const expected = (N * pick) / max;
  const out: NumberStat[] = [];
  for (let n = 1; n <= max; n++) {
    out.push({
      n,
      count: counts[n],
      expected,
      ratio: expected > 0 ? counts[n] / expected : 0,
      omission: lastSeen[n] === -1 ? N : N - 1 - lastSeen[n],
      maxOmission: Math.max(maxOmit[n], curOmit[n]),
    });
  }
  return out;
}

export function frontStats(draws: Draw[]) {
  return numberStats(draws, FRONT_MAX, FRONT_PICK, (d) => d.front);
}
export function backStats(draws: Draw[]) {
  return numberStats(draws, BACK_MAX, BACK_PICK, (d) => d.back);
}

/** 卡方统计量（与均匀分布的偏离度） */
export function chiSquare(stats: NumberStat[]): number {
  return stats.reduce((s, x) => s + (x.count - x.expected) ** 2 / x.expected, 0);
}

/** 规则时代（由数据中奖级结构自动识别） */
export function detectRuleEras(draws: Draw[]): RuleEra[] {
  const eras: RuleEra[] = [];
  let prevKey = "";
  for (const d of draws) {
    const levels = d.prizes.filter((p) => !p.level.includes("派奖")).map((p) => p.level);
    const key = levels.join("|");
    if (key !== prevKey) {
      eras.push({
        from: d.num, fromDate: d.date, to: d.num, toDate: d.date,
        levels, label: "", desc: "",
      });
      prevKey = key;
    } else {
      eras[eras.length - 1].to = d.num;
      eras[eras.length - 1].toDate = d.date;
    }
  }
  const labels = ["6 个基本奖级 + 追加（一~五等奖可追加）", "9 个奖级（追加限一、二等奖）", "7 个奖级（2026 年新规则）"];
  eras.forEach((e, i) => {
    e.label = `规则时代 ${i + 1}`;
    e.desc = labels[i] ?? `${e.levels.length} 个奖级`;
  });
  return eras;
}

/** 派奖活动（连续 promo 期号合并） */
export function detectPromoCampaigns(draws: Draw[]): PromoCampaign[] {
  const campaigns: PromoCampaign[] = [];
  let cur: PromoCampaign | null = null;
  for (const d of draws) {
    if (d.promo) {
      if (!cur || parseInt(d.num) !== parseInt(cur.to) + 1) {
        cur = {
          from: d.num, to: d.num, fromDate: d.date, toDate: d.date,
          draws: 0, firstPrizeCount: 0, firstPrizeTotal: 0, promoPrizeTotal: 0,
        };
        campaigns.push(cur);
      }
      cur.to = d.num;
      cur.toDate = d.date;
      cur.draws++;
      for (const p of d.prizes) {
        if (p.level === "一等奖") {
          cur.firstPrizeCount += p.count;
          cur.firstPrizeTotal += p.total ?? 0;
        }
        if (p.level.includes("派奖")) cur.promoPrizeTotal += p.total ?? 0;
      }
    }
  }
  return campaigns;
}

/** 球套统计 */
export interface EquipStat {
  equip: number;
  draws: number;
  front: NumberStat[];
  back: NumberStat[];
}
export function equipStats(draws: Draw[]): EquipStat[] {
  const sets = [1, 2, 3];
  return sets.map((e) => {
    const sub = draws.filter((d) => d.equip === e);
    return { equip: e, draws: sub.length, front: frontStats(sub), back: backStats(sub) };
  });
}

export function fmtMoney(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (v >= 1e8) return (v / 1e8).toFixed(2) + " 亿";
  if (v >= 1e4) return (v / 1e4).toFixed(1) + " 万";
  return v.toLocaleString("zh-CN");
}

export function fmtInt(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("zh-CN");
}

export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}
