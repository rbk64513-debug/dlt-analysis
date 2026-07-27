import path from "path"
import fs from "fs"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

/**
 * 大乐透数据同步中间件：
 * 浏览器调用 /api/sync-draws -> 服务端直连中国体彩网官方接口（无 CORS 限制），
 * 增量抓取新期数并回写 public/data/dlt_clean.json。
 */

const API =
  "https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry" +
  "?gameNo=85&provinceId=0&pageSize=100&isVerify=1&termLimits=0&pageNo=";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Referer: "https://www.lottery.gov.cn/",
  Accept: "application/json",
};

function money(s: unknown): number | null {
  if (s === null || s === undefined || s === "" || s === "--") return null;
  const v = parseFloat(String(s).replace(/,/g, ""));
  return Number.isFinite(v) ? v : null;
}

interface RawRec { [k: string]: any }

function cleanRec(r: RawRec) {
  const parts = String(r.lotteryDrawResult || "").trim().split(/\s+/);
  if (parts.length !== 7) return null;
  const front = parts.slice(0, 5).map(Number);
  const back = parts.slice(5).map(Number);
  if (!front.every((n) => n >= 1 && n <= 35) || !back.every((n) => n >= 1 && n <= 12)) return null;
  const unsort = String(r.lotteryUnsortDrawresult || "").trim().split(/\s+/).filter(Boolean);
  return {
    num: String(r.lotteryDrawNum),
    date: String(r.lotteryDrawTime),
    front,
    back,
    order: unsort.length === 7 ? unsort.map(Number) : null,
    equip: Number(r.lotteryEquipmentCount) || 0,
    promo: Boolean(r.lotteryPromotionFlag),
    sales: money(r.totalSaleAmount),
    poolBefore: money(r.poolBalance),
    poolAfter: money(r.poolBalanceAfterdraw),
    prizes: (r.prizeLevelList || []).map((p: RawRec) => ({
      level: String(p.prizeLevel || ""),
      amount: money(p.stakeAmount),
      count: parseInt(String(p.stakeCount ?? "0").replace(/,/g, "")) || 0,
      total: money(p.totalPrizeamount),
      condition: String(p.lotteryCondition || ""),
    })),
  };
}

async function fetchPage(pageNo: number): Promise<RawRec[]> {
  const res = await fetch(API + pageNo, { headers: HEADERS, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error("官方接口 HTTP " + res.status);
  const json: any = await res.json();
  if (!json.success) throw new Error("官方接口错误: " + json.errorMessage);
  return json.value.list as RawRec[];
}

function dltSyncPlugin(): Plugin {
  return {
    name: "dlt-sync",
    configureServer(server) {
      server.middlewares.use("/api/sync-draws", async (_req, res) => {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        try {
          const dataPath = path.resolve(__dirname, "public/data/dlt_clean.json");
          const existing: any[] = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
          const have = new Set(existing.map((d) => d.num));
          const latestBefore = existing[existing.length - 1]?.num;

          // 增量抓取：最多 5 页（500 期），找到与本地衔接即停
          const fresh: any[] = [];
          let officialLatest = "";
          for (let page = 1; page <= 5; page++) {
            const list = await fetchPage(page);
            if (page === 1 && list.length > 0) officialLatest = String(list[0].lotteryDrawNum);
            let bridged = false;
            for (const r of list) {
              const num = String(r.lotteryDrawNum);
              if (have.has(num)) { bridged = true; continue; }
              const c = cleanRec(r);
              if (c) fresh.push(c);
            }
            if (bridged || list.length < 100) break;
          }

          fresh.sort((a, b) => a.num.localeCompare(b.num));
          if (fresh.length > 0) {
            const merged = existing.concat(fresh);
            fs.writeFileSync(dataPath, JSON.stringify(merged), "utf-8");
          }
          res.end(JSON.stringify({
            ok: true,
            added: fresh.length,
            latestBefore,
            latestAfter: fresh.length > 0 ? fresh[fresh.length - 1].num : latestBefore,
            officialLatest,
            addedDraws: fresh.map((d) => ({ num: d.num, date: d.date })),
          }));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [inspectAttr(), react(), dltSyncPlugin()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
