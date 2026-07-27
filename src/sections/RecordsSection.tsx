import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DrawBalls } from "@/components/Ball";
import type { Draw } from "@/types/dlt";
import { fmtMoney, fmtInt } from "@/lib/stats";

const PAGE_SIZE = 20;

export default function RecordsSection({ draws }: { draws: Draw[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim();
    const desc = [...draws].reverse();
    if (!q) return desc;
    return desc.filter(
      (d) =>
        d.num.includes(q) ||
        d.date.includes(q) ||
        d.front.concat(d.back).some((n) => String(n).padStart(2, "0") === q.padStart(2, "0"))
    );
  }, [draws, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const cur = Math.min(page, pages - 1);
  const rows = filtered.slice(cur * PAGE_SIZE, (cur + 1) * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="搜索期号 / 日期 / 号码（如 26083、2026-07、08）"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(0); }}
          className="max-w-sm"
        />
        <span className="text-sm text-muted-foreground">共 {fmtInt(filtered.length)} 期</span>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="space-y-2">
            {rows.map((d) => (
              <div key={d.num} className="rounded-lg border">
                <button
                  className="w-full px-3 py-2.5 flex items-center gap-3 flex-wrap text-left hover:bg-muted/50"
                  onClick={() => setExpanded(expanded === d.num ? null : d.num)}
                >
                  <span className="font-mono font-semibold w-14">{d.num}</span>
                  <span className="text-xs text-muted-foreground w-20">{d.date}</span>
                  <DrawBalls front={d.front} back={d.back} size="sm" />
                  <span className="ml-auto flex gap-1.5 items-center">
                    {d.equip > 0 && (
                      <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-[11px]">第{d.equip}套球</Badge>
                    )}
                    {d.promo && <Badge className="bg-amber-500 text-[11px]">派奖</Badge>}
                    <span className="text-xs text-muted-foreground hidden md:inline">奖池 {fmtMoney(d.poolAfter)}</span>
                  </span>
                </button>
                {expanded === d.num && (
                  <div className="px-4 pb-4 pt-1 border-t bg-muted/20">
                    <div className="grid md:grid-cols-3 gap-2 text-sm my-3">
                      <div>销量：<b>{fmtMoney(d.sales)}</b> 元</div>
                      <div>开奖前奖池：<b>{fmtMoney(d.poolBefore)}</b> 元</div>
                      <div>开奖后奖池：<b>{fmtMoney(d.poolAfter)}</b> 元</div>
                      {d.order && (
                        <div className="md:col-span-3 text-muted-foreground">
                          出球顺序：{d.order.slice(0, 5).map((n) => String(n).padStart(2, "0")).join(" ")} | {d.order.slice(5).map((n) => String(n).padStart(2, "0")).join(" ")}
                        </div>
                      )}
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-muted-foreground text-xs border-b">
                          <th className="text-left py-1.5 font-medium">奖级</th>
                          <th className="text-right font-medium">中奖注数</th>
                          <th className="text-right font-medium">单注奖金</th>
                          <th className="text-right font-medium">派奖总额</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.prizes.map((p) => (
                          <tr key={p.level} className={`border-b last:border-0 ${p.level.includes("派奖") ? "bg-amber-50/60" : ""}`}>
                            <td className="py-1.5">{p.level}</td>
                            <td className="text-right">{fmtInt(p.count)}</td>
                            <td className="text-right font-semibold">{p.amount === null ? "—" : fmtInt(p.amount) + " 元"}</td>
                            <td className="text-right text-muted-foreground">{fmtMoney(p.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-4">
            <Button variant="outline" size="sm" disabled={cur === 0} onClick={() => setPage(cur - 1)}>
              上一页
            </Button>
            <span className="text-sm text-muted-foreground">{cur + 1} / {pages} 页</span>
            <Button variant="outline" size="sm" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>
              下一页
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
