// 大乐透数据类型
export interface PrizeLevel {
  level: string;
  amount: number | null; // 单注奖金（元）
  count: number;         // 中奖注数
  total: number | null;  // 派奖总额
  condition: string;
}

export interface Draw {
  num: string;            // 期号，如 26083
  date: string;           // 开奖日期
  front: number[];        // 前区 5 个号码（升序）
  back: number[];         // 后区 2 个号码（升序）
  order: number[] | null; // 出球顺序（7 个）
  equip: number;          // 摇奖球套号，0 = 官方无记录
  promo: boolean;         // 是否处于派奖活动期间
  sales: number | null;         // 当期销量
  poolBefore: number | null;    // 开奖前奖池
  poolAfter: number | null;     // 开奖后奖池
  prizes: PrizeLevel[];
}

export interface NumberStat {
  n: number;
  count: number;        // 实际出现次数
  expected: number;     // 理论期望次数
  ratio: number;        // count / expected
  omission: number;     // 当前遗漏期数
  maxOmission: number;  // 历史最大遗漏
}

export interface RuleEra {
  from: string;
  fromDate: string;
  to: string;
  toDate: string;
  levels: string[];
  label: string;
  desc: string;
}

export interface PromoCampaign {
  from: string;
  to: string;
  fromDate: string;
  toDate: string;
  draws: number;
  firstPrizeCount: number;
  firstPrizeTotal: number;
  promoPrizeTotal: number;
}
