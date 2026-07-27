import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Draw } from "@/types/dlt";
import OverviewSection from "@/sections/OverviewSection";
import TrendsSection from "@/sections/TrendsSection";
import BallSetSection from "@/sections/BallSetSection";
import PrizeRuleSection from "@/sections/PrizeRuleSection";
import RecordsSection from "@/sections/RecordsSection";
import PredictionSection from "@/sections/PredictionSection";
import PrizeCalculatorSection from "@/sections/PrizeCalculatorSection";

export interface CalcPrefill {
  front: number[];
  back: number[];
  label: string;
  ts: number;
}

export default function Home() {
  const [draws, setDraws] = useState<Draw[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("overview");
  const [calcPrefill, setCalcPrefill] = useState<CalcPrefill | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const loadData = (cacheBuster = false) =>
    fetch("./data/dlt_clean.json" + (cacheBuster ? `?t=${Date.now()}` : ""))
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then((d) => setDraws(d as Draw[]))
      .catch((e) => setError(String(e)));

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncDraws = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const r = await fetch("/api/sync-draws");
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "同步失败");
      if (j.added > 0) {
        await loadData(true);
        setSyncMsg(`✅ 已同步 ${j.added} 期新数据：${j.addedDraws[0].num} ~ ${j.addedDraws[j.addedDraws.length - 1].num} 期`);
      } else {
        setSyncMsg(`✅ 已是最新（官方最新 ${j.officialLatest} 期 / 本地 ${j.latestBefore} 期）`);
      }
    } catch (e) {
      setSyncMsg("⚠️ 同步失败：" + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSyncing(false);
    }
  };

  const sendToCalc = (front: number[], back: number[], label: string) => {
    setCalcPrefill({ front, back, label, ts: Date.now() });
    setTab("calc");
  };

  if (error) {
    return <div className="p-10 text-center text-red-600">数据加载失败：{error}</div>;
  }
  if (!draws) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        正在加载 2901 期开奖数据…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-r from-red-700 to-red-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">超级大乐透 · 历史数据统计分析</h1>
              <p className="text-red-100 text-sm mt-1">
                基于中国体彩网官方开奖数据 · 第 {draws[0].num} 期（{draws[0].date}）至第 {draws[draws.length - 1].num} 期（{draws[draws.length - 1].date}）· 共 {draws.length} 期
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <button
                onClick={syncDraws}
                disabled={syncing}
                className="px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 border border-white/30 text-sm font-medium transition-colors disabled:opacity-60"
              >
                {syncing ? "正在同步官方数据…" : "🔄 同步最新开奖数据"}
              </button>
              {syncMsg && <span className="text-xs text-red-100 max-w-xs text-right">{syncMsg}</span>}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap h-auto gap-1 mb-4">
            <TabsTrigger value="overview">号码期望总览</TabsTrigger>
            <TabsTrigger value="trends">奖池 / 销量 / 奖金走势</TabsTrigger>
            <TabsTrigger value="ballset">球套分析</TabsTrigger>
            <TabsTrigger value="rules">规则 / 派奖 / 影响因素</TabsTrigger>
            <TabsTrigger value="records">全部开奖记录</TabsTrigger>
            <TabsTrigger value="predict">预测与期望值</TabsTrigger>
            <TabsTrigger value="calc">奖金计算器</TabsTrigger>
          </TabsList>

          <TabsContent value="overview"><OverviewSection draws={draws} /></TabsContent>
          <TabsContent value="trends"><TrendsSection draws={draws} /></TabsContent>
          <TabsContent value="ballset"><BallSetSection draws={draws} /></TabsContent>
          <TabsContent value="rules"><PrizeRuleSection draws={draws} /></TabsContent>
          <TabsContent value="records"><RecordsSection draws={draws} /></TabsContent>
          <TabsContent value="predict"><PredictionSection draws={draws} onSendToCalc={sendToCalc} /></TabsContent>
          <TabsContent value="calc"><PrizeCalculatorSection draws={draws} prefill={calcPrefill} /></TabsContent>
        </Tabs>

        <footer className="mt-8 pb-6 text-center text-xs text-muted-foreground space-y-1">
          <p>数据来源：中国体彩网官方开奖公告接口（当前数据截至第 {draws[draws.length - 1].num} 期 {draws[draws.length - 1].date}，可点击右上角按钮同步）· 本工具仅作历史数据统计展示，不构成任何投注建议</p>
          <p>彩票每期开奖相互独立随机，历史出现频率与「期望值」偏离不预示未来结果 · 理性购彩，量力而行</p>
        </footer>
      </main>
    </div>
  );
}
