import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库文件路径
const DB_PATH = path.join(__dirname, 'data', 'investlog.db');

// 创建数据库连接
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL'); // 性能优化

/**
 * 优化后的数据库表结构
 * 
 * 设计原则:
 * 1. 单一数据源 - 避免数据重复存储
 * 2. 计算字段不存储 - total = price * shares，monthly/yearly profits 可实时计算
 * 3. 价格统一管理 - 只保留 daily_price_snapshots，price_cache 可从中派生
 * 4. 规范化设计 - 分离股票信息、交易记录、价格快照
 */
export function initDatabase() {
    // ==================== 核心业务表 ====================
    
    // 1. 股票信息表（新增）
    db.exec(`
        CREATE TABLE IF NOT EXISTS stocks (
            symbol TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // 2. 交易记录表（优化）
    // 移除 total 字段（计算字段），移除冗余的 name（从 stocks 表关联）
    db.exec(`
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            date TEXT NOT NULL,
            price REAL NOT NULL CHECK(price > 0),
            shares REAL NOT NULL CHECK(shares > 0),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (symbol) REFERENCES stocks(symbol)
        )
    `);
    
    // 3. 每日价格快照表（保留，作为唯一价格数据源）
    db.exec(`
        CREATE TABLE IF NOT EXISTS daily_price_snapshots (
            symbol TEXT NOT NULL,
            date TEXT NOT NULL,
            price REAL NOT NULL CHECK(price > 0),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (symbol, date),
            FOREIGN KEY (symbol) REFERENCES stocks(symbol)
        )
    `);
    
    // 4. 每日收益表（优化）
    // 移除 new_investment（可从 transactions 实时计算）
    // 移除 is_market_closed（可从日期判断）
    db.exec(`
        CREATE TABLE IF NOT EXISTS daily_profits (
            date TEXT PRIMARY KEY,
            profit REAL NOT NULL DEFAULT 0,
            profit_rate REAL NOT NULL DEFAULT 0,
            total_value REAL NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // ==================== 辅助表 ====================
    
    // 5. 配置表（保留）
    db.exec(`
        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // ==================== 索引优化 ====================
    
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_transactions_symbol ON transactions(symbol);
        CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
        CREATE INDEX IF NOT EXISTS idx_transactions_symbol_date ON transactions(symbol, date);
        CREATE INDEX IF NOT EXISTS idx_daily_snapshots_date ON daily_price_snapshots(date);
        CREATE INDEX IF NOT EXISTS idx_daily_snapshots_symbol ON daily_price_snapshots(symbol);
    `);

    console.log('✓ 优化后的数据库初始化完成');
}

/**
 * 股票信息 CRUD 操作
 */
export const stockDB = {
    getAll() {
        const stmt = db.prepare('SELECT * FROM stocks ORDER BY symbol');
        return stmt.all();
    },

    get(symbol) {
        const stmt = db.prepare('SELECT * FROM stocks WHERE symbol = ?');
        return stmt.get(symbol);
    },

    create(symbol, name) {
        const stmt = db.prepare(`
            INSERT INTO stocks (symbol, name)
            VALUES (?, ?)
        `);
        stmt.run(symbol, name);
    },

    createOrUpdate(symbol, name) {
        const stmt = db.prepare(`
            INSERT INTO stocks (symbol, name, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(symbol) DO UPDATE SET 
                name = excluded.name,
                updated_at = CURRENT_TIMESTAMP
        `);
        stmt.run(symbol, name);
    },

    delete(symbol) {
        const stmt = db.prepare('DELETE FROM stocks WHERE symbol = ?');
        const result = stmt.run(symbol);
        return result.changes > 0;
    }
};

/**
 * 交易记录 CRUD 操作（优化版）
 */
export const transactionDB = {
    getAll() {
        const stmt = db.prepare(`
            SELECT 
                t.id, 
                t.symbol, 
                s.name,
                t.date, 
                t.price, 
                t.shares,
                t.price * t.shares as total,
                t.created_at,
                t.updated_at
            FROM transactions t
            JOIN stocks s ON t.symbol = s.symbol
            ORDER BY t.date DESC, t.id DESC
        `);
        return stmt.all();
    },

    getById(id) {
        const stmt = db.prepare(`
            SELECT 
                t.id, 
                t.symbol, 
                s.name,
                t.date, 
                t.price, 
                t.shares,
                t.price * t.shares as total,
                t.created_at,
                t.updated_at
            FROM transactions t
            JOIN stocks s ON t.symbol = s.symbol
            WHERE t.id = ?
        `);
        return stmt.get(id);
    },

    getBySymbol(symbol) {
        const stmt = db.prepare(`
            SELECT 
                t.id, 
                t.symbol, 
                s.name,
                t.date, 
                t.price, 
                t.shares,
                t.price * t.shares as total,
                t.created_at,
                t.updated_at
            FROM transactions t
            JOIN stocks s ON t.symbol = s.symbol
            WHERE t.symbol = ?
            ORDER BY t.date DESC
        `);
        return stmt.all(symbol);
    },

    create(record) {
        // 先确保 stock 存在
        stockDB.createOrUpdate(record.symbol, record.name || record.symbol);
        
        const stmt = db.prepare(`
            INSERT INTO transactions (symbol, date, price, shares)
            VALUES (?, ?, ?, ?)
        `);
        const result = stmt.run(
            record.symbol,
            record.date,
            record.price,
            record.shares
        );
        return result.lastInsertRowid;
    },

    createBatch(records) {
        const createStock = db.prepare(`
            INSERT INTO stocks (symbol, name, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(symbol) DO UPDATE SET 
                name = excluded.name,
                updated_at = CURRENT_TIMESTAMP
        `);
        
        const createTransaction = db.prepare(`
            INSERT INTO transactions (symbol, date, price, shares)
            VALUES (?, ?, ?, ?)
        `);
        
        const insertMany = db.transaction((records) => {
            for (const record of records) {
                createStock.run(record.symbol, record.name || record.symbol);
                createTransaction.run(
                    record.symbol,
                    record.date,
                    record.price,
                    record.shares
                );
            }
        });
        
        insertMany(records);
        return records.length;
    },

    update(id, record) {
        // 更新 stock 信息
        if (record.name) {
            stockDB.createOrUpdate(record.symbol, record.name);
        }
        
        const stmt = db.prepare(`
            UPDATE transactions 
            SET symbol = ?, date = ?, price = ?, shares = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        const result = stmt.run(
            record.symbol,
            record.date,
            record.price,
            record.shares,
            id
        );
        return result.changes > 0;
    },

    delete(id) {
        const stmt = db.prepare('DELETE FROM transactions WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    },

    deleteAll() {
        const stmt = db.prepare('DELETE FROM transactions');
        const result = stmt.run();
        return result.changes;
    },

    getSummary() {
        const stmt = db.prepare(`
            SELECT 
                t.symbol,
                s.name,
                SUM(t.price * t.shares) as total_cost,
                SUM(t.shares) as total_shares,
                SUM(t.price * t.shares) / SUM(t.shares) as avg_price,
                COUNT(*) as transaction_count
            FROM transactions t
            JOIN stocks s ON t.symbol = s.symbol
            GROUP BY t.symbol
            ORDER BY total_cost DESC
        `);
        return stmt.all();
    },
    
    // 计算某日的新增投入（替代存储在 daily_profits 中）
    getNewInvestmentByDate(date) {
        const stmt = db.prepare(`
            SELECT COALESCE(SUM(price * shares), 0) as new_investment
            FROM transactions
            WHERE date = ?
        `);
        const result = stmt.get(date);
        return result.new_investment;
    },
    
    // 计算截至某日的总成本
    getTotalCostUpToDate(date) {
        const stmt = db.prepare(`
            SELECT COALESCE(SUM(price * shares), 0) as total_cost
            FROM transactions
            WHERE date <= ?
        `);
        const result = stmt.get(date);
        return result.total_cost;
    }
};

/**
 * 配置 CRUD 操作（保持不变）
 */
export const configDB = {
    get(key, defaultValue = null) {
        const stmt = db.prepare('SELECT value FROM config WHERE key = ?');
        const result = stmt.get(key);
        return result ? JSON.parse(result.value) : defaultValue;
    },

    set(key, value) {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO config (key, value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `);
        stmt.run(key, JSON.stringify(value));
    },

    delete(key) {
        const stmt = db.prepare('DELETE FROM config WHERE key = ?');
        const result = stmt.run(key);
        return result.changes > 0;
    },

    getAll() {
        const stmt = db.prepare('SELECT key, value FROM config');
        const rows = stmt.all();
        const config = {};
        rows.forEach(row => {
            config[row.key] = JSON.parse(row.value);
        });
        return config;
    }
};

/**
 * 价格缓存操作（优化版：从 daily_price_snapshots 派生）
 */
export const priceCacheDB = {
    // 获取最新价格（从 daily_price_snapshots 中获取最近的记录）
    get(symbol) {
        const stmt = db.prepare(`
            SELECT price, date as updated_at
            FROM daily_price_snapshots
            WHERE symbol = ?
            ORDER BY date DESC
            LIMIT 1
        `);
        return stmt.get(symbol);
    },

    // 不再单独存储，而是直接存入 daily_price_snapshots
    set(symbol, price) {
        const today = new Date().toISOString().split('T')[0];
        dailyPriceSnapshotDB.set(symbol, today, price);
    },

    setBatch(prices) {
        const today = new Date().toISOString().split('T')[0];
        dailyPriceSnapshotDB.setBatch(today, prices);
    },

    // 获取所有股票的最新价格
    getAll() {
        const stmt = db.prepare(`
            SELECT 
                dps.symbol,
                dps.price,
                dps.date as updated_at
            FROM daily_price_snapshots dps
            INNER JOIN (
                SELECT symbol, MAX(date) as max_date
                FROM daily_price_snapshots
                GROUP BY symbol
            ) latest ON dps.symbol = latest.symbol AND dps.date = latest.max_date
        `);
        return stmt.all();
    }
};

/**
 * 每日价格快照操作（保持不变，作为唯一价格数据源）
 */
export const dailyPriceSnapshotDB = {
    set(symbol, date, price) {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO daily_price_snapshots (symbol, date, price, created_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `);
        stmt.run(symbol, date, price);
    },

    setBatch(date, prices) {
        const insert = db.prepare(`
            INSERT OR REPLACE INTO daily_price_snapshots (symbol, date, price, created_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `);
        
        const insertMany = db.transaction((prices) => {
            for (const [symbol, price] of Object.entries(prices)) {
                insert.run(symbol, date, price);
            }
        });
        
        insertMany(prices);
    },

    get(symbol, date) {
        const stmt = db.prepare('SELECT price FROM daily_price_snapshots WHERE symbol = ? AND date = ?');
        return stmt.get(symbol, date);
    },

    getByDate(date) {
        const stmt = db.prepare('SELECT symbol, price FROM daily_price_snapshots WHERE date = ?');
        return stmt.all(date);
    },

    getRange(symbol, startDate, endDate) {
        const stmt = db.prepare('SELECT date, price FROM daily_price_snapshots WHERE symbol = ? AND date BETWEEN ? AND ? ORDER BY date');
        return stmt.all(symbol, startDate, endDate);
    },

    deleteAll() {
        const stmt = db.prepare('DELETE FROM daily_price_snapshots');
        const result = stmt.run();
        return result.changes;
    },

    hasSnapshot(date) {
        const stmt = db.prepare('SELECT COUNT(*) as count FROM daily_price_snapshots WHERE date = ?');
        const result = stmt.get(date);
        return result.count > 0;
    }
};

/**
 * 每日收益操作（优化版）
 */
export const dailyProfitDB = {
    get(date) {
        const stmt = db.prepare('SELECT * FROM daily_profits WHERE date = ?');
        return stmt.get(date);
    },

    set(date, profit, profitRate, totalValue) {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO daily_profits (date, profit, profit_rate, total_value, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        stmt.run(date, profit, profitRate, totalValue);
    },

    getByMonth(yearMonth) {
        const stmt = db.prepare('SELECT * FROM daily_profits WHERE date LIKE ? ORDER BY date');
        return stmt.all(`${yearMonth}%`);
    },

    getByYear(year) {
        const stmt = db.prepare('SELECT * FROM daily_profits WHERE date LIKE ? ORDER BY date');
        return stmt.all(`${year}%`);
    },

    getRange(startDate, endDate) {
        const stmt = db.prepare('SELECT * FROM daily_profits WHERE date BETWEEN ? AND ? ORDER BY date');
        return stmt.all(startDate, endDate);
    },

    deleteAll() {
        const stmt = db.prepare('DELETE FROM daily_profits');
        const result = stmt.run();
        return result.changes;
    },

    getLatest() {
        const stmt = db.prepare('SELECT * FROM daily_profits ORDER BY date DESC LIMIT 1');
        return stmt.get();
    },

    getLatestBefore(date) {
        const stmt = db.prepare('SELECT * FROM daily_profits WHERE date < ? ORDER BY date DESC LIMIT 1');
        return stmt.get(date);
    }
};

/**
 * 月收益操作（实时计算版，不再单独存储）
 */
export const monthlyProfitDB = {
    get(month) {
        const dailyRecords = dailyProfitDB.getByMonth(month);
        
        if (dailyRecords.length === 0) {
            return { month, profit: 0, profit_rate: 0, total_value: 0 };
        }
        
        // 累加当月所有日收益
        let totalProfit = 0;
        let lastTotalValue = 0;
        
        dailyRecords.forEach((record) => {
            totalProfit += record.profit;
            lastTotalValue = record.total_value;
        });
        
        // 获取月初市值
        const firstDate = dailyRecords[0].date;
        const prevRecord = dailyProfitDB.getLatestBefore(firstDate);
        const firstTotalValue = prevRecord ? prevRecord.total_value : (lastTotalValue - totalProfit);
        
        // 月收益率
        const profitRate = firstTotalValue > 0 ? (totalProfit / firstTotalValue) * 100 : 0;
        
        return {
            month,
            profit: parseFloat(totalProfit.toFixed(2)),
            profit_rate: parseFloat(profitRate.toFixed(2)),
            total_value: parseFloat(lastTotalValue.toFixed(2))
        };
    },

    getByYear(year) {
        const results = [];
        for (let m = 1; m <= 12; m++) {
            const month = `${year}-${String(m).padStart(2, '0')}`;
            const data = this.get(month);
            if (data.profit !== 0 || data.total_value !== 0) {
                results.push(data);
            }
        }
        return results;
    },

    getAll() {
        // 获取所有有数据的月份
        const stmt = db.prepare(`
            SELECT DISTINCT substr(date, 1, 7) as month
            FROM daily_profits
            ORDER BY month DESC
        `);
        const months = stmt.all();
        return months.map(row => this.get(row.month));
    }
};

/**
 * 年收益操作（实时计算版，不再单独存储）
 */
export const yearlyProfitDB = {
    get(year) {
        const dailyRecords = dailyProfitDB.getByYear(year);
        
        if (dailyRecords.length === 0) {
            return { year, profit: 0, profit_rate: 0, total_value: 0 };
        }
        
        // 累加全年所有日收益
        let totalProfit = 0;
        let lastTotalValue = 0;
        
        dailyRecords.forEach((record) => {
            totalProfit += record.profit;
            lastTotalValue = record.total_value;
        });
        
        // 获取年初市值
        const firstDate = dailyRecords[0].date;
        const prevRecord = dailyProfitDB.getLatestBefore(firstDate);
        const firstTotalValue = prevRecord ? prevRecord.total_value : (lastTotalValue - totalProfit);
        
        // 年收益率
        const profitRate = firstTotalValue > 0 ? (totalProfit / firstTotalValue) * 100 : 0;
        
        return {
            year,
            profit: parseFloat(totalProfit.toFixed(2)),
            profit_rate: parseFloat(profitRate.toFixed(2)),
            total_value: parseFloat(lastTotalValue.toFixed(2))
        };
    },

    getAll() {
        // 获取所有有数据的年份
        const stmt = db.prepare(`
            SELECT DISTINCT substr(date, 1, 4) as year
            FROM daily_profits
            ORDER BY year DESC
        `);
        const years = stmt.all();
        return years.map(row => this.get(row.year));
    }
};

// 导出数据库实例
export { db };

// 优雅关闭
process.on('exit', () => db.close());
process.on('SIGINT', () => {
    db.close();
    process.exit(0);
});
