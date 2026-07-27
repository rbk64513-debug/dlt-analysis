# -*- coding: utf-8 -*-
"""下载大乐透全部历史开奖数据（中国体彩网官方接口）"""
import json, time, os, urllib.request

URL = ("https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry"
       "?gameNo=85&provinceId=0&pageSize=100&isVerify=1&pageNo={page}&termLimits=0")
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "Referer": "https://www.lottery.gov.cn/",
    "Accept": "application/json",
}

os.makedirs("data/raw", exist_ok=True)
all_records = {}
page = 1
total_pages = None
while True:
    path = f"data/raw/page_{page:03d}.json"
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
    else:
        req = urllib.request.Request(URL.format(page=page), headers=HEADERS)
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    d = json.loads(r.read().decode("utf-8"))
                break
            except Exception as e:
                print(f"page {page} attempt {attempt+1} failed: {e}")
                time.sleep(2 * (attempt + 1))
        else:
            raise SystemExit(f"page {page} failed permanently")
        if not d.get("success"):
            raise SystemExit(f"page {page} api error: {d.get('errorMessage')}")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False)
        time.sleep(0.4)
    v = d["value"]
    total_pages = v["pages"]
    for rec in v["list"]:
        all_records[rec["lotteryDrawNum"]] = rec
    print(f"page {page}/{total_pages} 累计 {len(all_records)} 期")
    if page >= total_pages:
        break
    page += 1

records = sorted(all_records.values(), key=lambda r: r["lotteryDrawNum"])
with open("data/dlt_history_raw.json", "w", encoding="utf-8") as f:
    json.dump(records, f, ensure_ascii=False, indent=1)
print(f"完成：共 {len(records)} 期，首期 {records[0]['lotteryDrawNum']}，末期 {records[-1]['lotteryDrawNum']}")
