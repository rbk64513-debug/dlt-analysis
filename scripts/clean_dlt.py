# -*- coding: utf-8 -*-
"""清洗大乐透历史数据 -> 应用可用的精简 JSON，并输出校验信息"""
import json, re
from collections import Counter

def money(s):
    if s in (None, "", "--"):
        return None
    try:
        return float(str(s).replace(",", ""))
    except ValueError:
        return None

raw = json.load(open("data/dlt_history_raw.json", encoding="utf-8"))
clean = []
issues = []
equip_counter = Counter()
promo_periods = []
level_names = Counter()

for r in raw:
    num = r["lotteryDrawNum"]
    date = r["lotteryDrawTime"]
    res = (r.get("lotteryDrawResult") or "").strip()
    parts = res.split()
    if len(parts) != 7:
        issues.append(f"{num}: 号码解析失败 '{res}'")
        continue
    front = [int(x) for x in parts[:5]]
    back = [int(x) for x in parts[5:]]
    if not (all(1 <= n <= 35 for n in front) and all(1 <= n <= 12 for n in back)):
        issues.append(f"{num}: 号码越界 {res}")
        continue
    # 出球顺序
    unsort = (r.get("lotteryUnsortDrawresult") or "").strip().split()
    draw_order = [int(x) for x in unsort] if len(unsort) == 7 else None
    equip = r.get("lotteryEquipmentCount") or 0
    equip_counter[equip] += 1
    promo = bool(r.get("lotteryPromotionFlag"))
    if promo:
        promo_periods.append(num)
    prizes = []
    for p in r.get("prizeLevelList") or []:
        if p.get("awardType") != 0:  # 仅基本奖级
            pass
        name = p.get("prizeLevel", "")
        level_names[name] += 1
        prizes.append({
            "level": name,
            "amount": money(p.get("stakeAmount")),
            "count": int(str(p.get("stakeCount", "0")).replace(",", "") or 0),
            "total": money(p.get("totalPrizeamount")),
            "condition": p.get("lotteryCondition") or "",
        })
    clean.append({
        "num": num, "date": date,
        "front": front, "back": back,
        "order": draw_order,
        "equip": equip,           # 摇奖球套号（0=无记录）
        "promo": promo,           # 派奖活动标记
        "sales": money(r.get("totalSaleAmount")),
        "poolBefore": money(r.get("poolBalance")),
        "poolAfter": money(r.get("poolBalanceAfterdraw")),
        "prizes": prizes,
    })

print("总期数:", len(clean))
print("问题记录:", len(issues), issues[:5])
print("球套分布:", dict(sorted(equip_counter.items())))
print("派奖期数:", len(promo_periods))
if promo_periods:
    # 合并连续区间
    groups, start, prev = [], promo_periods[0], promo_periods[0]
    for n in promo_periods[1:]:
        if int(n) != int(prev) + 1:
            groups.append((start, prev)); start = n
        prev = n
    groups.append((start, prev))
    print("派奖区间:", groups)
print("奖级名称统计:", dict(level_names.most_common(30)))

json.dump(clean, open("data/dlt_clean.json", "w", encoding="utf-8"), ensure_ascii=False)
print("已写出 data/dlt_clean.json")
