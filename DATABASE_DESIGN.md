# 数据库设计文档

## 概述

InvestLog 使用 SQLite 作为本地数据库，采用 `better-sqlite3` 库进行操作。数据库文件位于 `data/investlog.db`。

## 设计原则

1. **单一数据源** - 避免数据重复存储
2. **计算字段不存储** - 可实时计算的数据不单独存储
3. **规范化设计** - 分离股票信息、交易记录、价格快照
4. **性能优化** - 合理使用索引，启用 WAL 模式

## 数据库表结构

### 1. stocks - 股票信息表

存储所有股票的基本信息。

```sql
CREATE TABLE stocks (
    symbol TEXT PRIMARY KEY,           -- 股票代码（主键）
    name TEXT NOT NULL,                -- 股票名称
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- 创建时间
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP   -- 更新时间
);
```

**字段说明：**
- `symbol`: 股票代码，如 "NVDA", "TSLA"
- `name`: 股票名称，如 "NVIDIA", "Tesla"

**索引：**
- 主键索引：`symbol`

---

### 2. transactions - 交易记录表

存储所有买入交易记录。

```sql
CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,  -- 自增主键
    symbol TEXT NOT NULL,                  -- 股票代码（外键）
    date TEXT NOT NULL,                    -- 交易日期 (YYYY-MM-DD)
    price REAL NOT NULL CHECK(price > 0),  -- 单价（美元）
    shares REAL NOT NULL CHECK(shares > 0), -- 股数
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- 创建时间
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- 更新时间
    FOREIGN KEY (symbol) REFERENCES stocks(symbol)
);
```

**字段说明：**
- `id`: 交易记录唯一ID
- `symbol`: 关联的股票代码
- `date`: 交易日期，格式为 YYYY-MM-DD
- `price`: 买入单价（美元）
- `shares`: 买入股数
- **注意**: `total`（总投入）不存储，通过 `price * shares` 计算得出

**索引：**
```sql
CREATE INDEX idx_transactions_symbol ON transactions(symbol);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_symbol_date ON transactions(symbol, date);
```

---

### 3. daily_price_snapshots - 每日价格快照表

存储每日收盘价格快照，作为**唯一价格数据源**。

```sql
CREATE TABLE daily_price_snapshots (
    symbol TEXT NOT NULL,              -- 股票代码
    date TEXT NOT NULL,                -- 日期 (YYYY-MM-DD)
    price REAL NOT NULL CHECK(price > 0), -- 价格（美元）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- 创建时间
    PRIMARY KEY (symbol, date),        -- 复合主键
    FOREIGN KEY (symbol) REFERENCES stocks(symbol)
);
```

**字段说明：**
- `symbol`: 股票代码
- `date`: 快照日期
- `price`: 当日价格（通常为收盘价）

**索引：**
```sql
CREATE INDEX idx_daily_snapshots_date ON daily_price_snapshots(date);
CREATE INDEX idx_daily_snapshots_symbol ON daily_price_snapshots(symbol);
```

**用途：**
- 作为价格缓存的数据来源
- 用于计算每日总市值
- 用于绘制市值走势图

---

### 4. daily_profits - 每日收益表

存储每日收益计算结果。

```sql
CREATE TABLE daily_profits (
    date TEXT PRIMARY KEY,             -- 日期 (YYYY-MM-DD)
    profit REAL NOT NULL DEFAULT 0,    -- 当日收益（美元）
    profit_rate REAL NOT NULL DEFAULT 0, -- 收益率（百分比）
    total_value REAL NOT NULL DEFAULT 0, -- 总市值（美元）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- 创建时间
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP   -- 更新时间
);
```

**字段说明：**
- `date`: 日期
- `profit`: 当日收益 = 当日总市值 - 前一日总市值 - 当日新增投入
- `profit_rate`: 收益率 = 当日收益 / 前一日总市值 * 100
- `total_value`: 当日总市值

**注意移除的字段：**
- ~~`new_investment`~~: 当日新增投入，改为从 `transactions` 表实时计算
- ~~`is_market_closed`~~: 是否休市，改为根据日期实时判断

---

### 5. config - 配置表

存储系统配置信息。

```sql
CREATE TABLE config (
    key TEXT PRIMARY KEY,              -- 配置键
    value TEXT NOT NULL,               -- 配置值（JSON格式）
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP   -- 更新时间
);
```

**字段说明：**
- `key`: 配置项名称
- `value`: 配置值，以 JSON 字符串形式存储

**常用配置项：**
- `exchangeRate`: 汇率（USD/CNY）
- `apiKey`: API密钥
- `provider`: AI服务商
- 其他用户自定义配置

---

## 虚拟表（实时计算）

以下数据不单独存储，而是通过查询实时计算。

### monthly_profits - 月度收益（虚拟）

通过聚合 `daily_profits` 表计算得出：

```javascript
// 伪代码示例
SELECT 
    substr(date, 1, 7) as month,
    SUM(profit) as profit,
    // 其他计算字段
FROM daily_profits
WHERE date LIKE '2025-11%'
GROUP BY month
```

### yearly_profits - 年度收益（虚拟）

通过聚合 `daily_profits` 表计算得出：

```javascript
// 伪代码示例
SELECT 
    substr(date, 1, 4) as year,
    SUM(profit) as profit,
    // 其他计算字段
FROM daily_profits
WHERE date LIKE '2025%'
GROUP BY year
```

### price_cache - 价格缓存（虚拟）

从 `daily_price_snapshots` 派生，获取最新价格：

```sql
SELECT symbol, price, date as updated_at
FROM daily_price_snapshots
WHERE (symbol, date) IN (
    SELECT symbol, MAX(date)
    FROM daily_price_snapshots
    GROUP BY symbol
)
```

---

## 数据流转图

```
┌─────────────┐
│ 用户添加交易 │
└──────┬──────┘
       │
       ▼
┌──────────────┐        ┌─────────────┐
│ transactions │───────▶│   stocks    │
│   (交易记录)  │ 外键   │  (股票信息)  │
└──────────────┘        └─────────────┘
       │
       │ 定时任务/手动触发
       ▼
┌─────────────────────┐
│ 获取股票价格 (API)    │
└──────────┬──────────┘
           │
           ▼
┌───────────────────────┐
│ daily_price_snapshots │
│    (每日价格快照)      │
└──────────┬────────────┘
           │
           │ 计算收益
           ▼
┌──────────────────┐
│  daily_profits   │
│   (每日收益)      │
└──────────────────┘
           │
           │ 实时聚合
           ▼
┌──────────────────────┐
│ monthly/yearly       │
│ profits (虚拟)        │
└──────────────────────┘
```

---

## 收益计算逻辑

### 日收益计算

```javascript
// T日收益
profit_T = marketValue_T - marketValue_(T-1) - newInvestment_T

// 其中：
// marketValue_T = Σ(shares_i × price_i) 从 daily_price_snapshots 获取
// marketValue_(T-1) 从 daily_profits 获取前一日的 total_value
// newInvestment_T 从 transactions 表实时计算当日新增投入
```

### 月收益计算

```javascript
// M月收益 = M月所有日收益之和
profit_M = Σ(profit_i) where date_i LIKE 'YYYY-MM%'

// M月收益率
profit_rate_M = profit_M / marketValue_(M初-1) × 100%
```

### 年收益计算

```javascript
// Y年收益 = Y年所有日收益之和
profit_Y = Σ(profit_i) where date_i LIKE 'YYYY%'

// Y年收益率
profit_rate_Y = profit_Y / marketValue_(Y初-1) × 100%
```

---

## 索引策略

### 为什么需要这些索引？

1. **idx_transactions_symbol**: 加速按股票代码查询交易记录
2. **idx_transactions_date**: 加速按日期查询（计算当日新增投入）
3. **idx_transactions_symbol_date**: 加速复合查询
4. **idx_daily_snapshots_date**: 加速按日期获取所有价格快照
5. **idx_daily_snapshots_symbol**: 加速获取单个股票的价格历史

---

## 数据完整性约束

### CHECK 约束

```sql
-- 价格必须大于0
CHECK(price > 0)

-- 股数必须大于0
CHECK(shares > 0)
```

### FOREIGN KEY 约束

```sql
-- transactions.symbol → stocks.symbol
FOREIGN KEY (symbol) REFERENCES stocks(symbol)

-- daily_price_snapshots.symbol → stocks.symbol
FOREIGN KEY (symbol) REFERENCES stocks(symbol)
```

---

## 性能优化

### 1. WAL 模式

```javascript
db.pragma('journal_mode = WAL');
```

**优势：**
- 提高并发读写性能
- 减少锁定时间
- 更好的崩溃恢复

### 2. 事务批处理

```javascript
const insertMany = db.transaction((records) => {
    for (const record of records) {
        stmt.run(record);
    }
});
```

**优势：**
- 批量操作性能提升 10-100 倍
- 保证原子性

### 3. 预编译语句

```javascript
const stmt = db.prepare('SELECT * FROM stocks WHERE symbol = ?');
```

**优势：**
- 避免重复解析SQL
- 防止SQL注入

---

## 数据迁移指南

如果从旧版本升级，需要注意以下迁移：

### 1. 新增 stocks 表

```sql
-- 从 transactions 中提取唯一的股票信息
INSERT INTO stocks (symbol, name)
SELECT DISTINCT symbol, name 
FROM transactions
ON CONFLICT(symbol) DO NOTHING;
```

### 2. 移除 transactions 表的 total 和 name 字段

```sql
-- 创建新表
CREATE TABLE transactions_new (...);

-- 迁移数据
INSERT INTO transactions_new (id, symbol, date, price, shares)
SELECT id, symbol, date, price, shares FROM transactions;

-- 替换表
DROP TABLE transactions;
ALTER TABLE transactions_new RENAME TO transactions;
```

### 3. 合并价格缓存到快照表

价格缓存不再单独存储，而是从 `daily_price_snapshots` 派生。

---

## API 接口示例

### 获取持仓汇总

```javascript
transactionDB.getSummary()
// 返回每只股票的总成本、总股数、均价等
```

### 获取某日收益

```javascript
dailyProfitDB.get('2025-12-03')
// 返回该日的 profit, profit_rate, total_value
```

### 获取某月收益

```javascript
monthlyProfitDB.get('2025-12')
// 实时计算该月的总收益和收益率
```

### 保存价格快照

```javascript
dailyPriceSnapshotDB.setBatch('2025-12-03', {
    'NVDA': 123.45,
    'TSLA': 234.56
})
```

---

## 备份与恢复

### 备份

```bash
# 简单复制（确保没有写操作）
cp data/investlog.db data/investlog_backup_$(date +%Y%m%d).db
```

### 恢复

```bash
# 从备份恢复
cp data/investlog_backup_20251203.db data/investlog.db
```

### 导出为 CSV

```javascript
// 使用内置的 CSV 导出功能
await exportToCSV()
```

---

## 常见查询示例

### 1. 获取某只股票的所有交易记录

```javascript
transactionDB.getBySymbol('NVDA')
```

### 2. 计算截至某日的总成本

```javascript
transactionDB.getTotalCostUpToDate('2025-12-03')
```

### 3. 获取某日的新增投入

```javascript
transactionDB.getNewInvestmentByDate('2025-12-03')
```

### 4. 获取某个股票的价格历史

```javascript
dailyPriceSnapshotDB.getRange('NVDA', '2025-12-01', '2025-12-31')
```

### 5. 获取某年的所有年收益

```javascript
yearlyProfitDB.getAll()
```

---

## 注意事项

1. **日期格式统一**: 所有日期使用 `YYYY-MM-DD` 格式
2. **货币单位**: 所有金额以美元（USD）为单位
3. **时区**: 使用本地时区，定时任务设置为 Asia/Shanghai
4. **精度**: 价格和金额保留2位小数，收益率保留2位小数
5. **外键级联**: 删除股票时需要先删除相关交易记录

---

## 版本历史

- **v1.0**: 初始版本，基于 localStorage
- **v2.0**: 引入 SQLite 数据库
- **v2.1**: 优化数据库结构，遵循单一数据源原则，实现月收益和年收益实时计算

---

## 技术栈

- **数据库**: SQLite 3
- **Node.js 库**: better-sqlite3
- **ORM**: 无（直接使用 SQL）
- **数据验证**: SQL CHECK 约束
- **备份策略**: 文件复制 + CSV 导出

---

最后更新: 2025-12-03
