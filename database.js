/**
 * SQLite 数据库管理模块
 */
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
 * 初始化数据库表结构
 */
export function initDatabase() {
    // 交易记录表
    db.exec(`
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            symbol TEXT,
            date TEXT NOT NULL,
            total REAL NOT NULL,
            price REAL NOT NULL,
            shares REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 配置表
    db.exec(`
        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 股票价格缓存表
    db.exec(`
        CREATE TABLE IF NOT EXISTS price_cache (
            symbol TEXT PRIMARY KEY,
            price REAL NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 创建索引
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_transactions_name ON transactions(name);
        CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
        CREATE INDEX IF NOT EXISTS idx_transactions_symbol ON transactions(symbol);
    `);

    console.log('✓ 数据库初始化完成');
}

/**
 * 交易记录 CRUD 操作
 */
export const transactionDB = {
    // 获取所有交易记录
    getAll() {
        const stmt = db.prepare('SELECT * FROM transactions ORDER BY date DESC, id DESC');
        return stmt.all();
    },

    // 根据 ID 获取交易记录
    getById(id) {
        const stmt = db.prepare('SELECT * FROM transactions WHERE id = ?');
        return stmt.get(id);
    },

    // 根据资产名称获取记录
    getByName(name) {
        const stmt = db.prepare('SELECT * FROM transactions WHERE name = ? ORDER BY date DESC');
        return stmt.all(name);
    },

    // 添加交易记录
    create(record) {
        const stmt = db.prepare(`
            INSERT INTO transactions (name, symbol, date, total, price, shares)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            record.name,
            record.symbol || record.name,
            record.date,
            record.total,
            record.price,
            record.shares
        );
        return result.lastInsertRowid;
    },

    // 批量添加交易记录
    createBatch(records) {
        const insert = db.prepare(`
            INSERT INTO transactions (name, symbol, date, total, price, shares)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        const insertMany = db.transaction((records) => {
            for (const record of records) {
                insert.run(
                    record.name,
                    record.symbol || record.name,
                    record.date,
                    record.total,
                    record.price,
                    record.shares
                );
            }
        });
        
        insertMany(records);
        return records.length;
    },

    // 更新交易记录
    update(id, record) {
        const stmt = db.prepare(`
            UPDATE transactions 
            SET name = ?, symbol = ?, date = ?, total = ?, price = ?, shares = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        const result = stmt.run(
            record.name,
            record.symbol || record.name,
            record.date,
            record.total,
            record.price,
            record.shares,
            id
        );
        return result.changes > 0;
    },

    // 删除交易记录
    delete(id) {
        const stmt = db.prepare('DELETE FROM transactions WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    },

    // 清空所有交易记录
    deleteAll() {
        const stmt = db.prepare('DELETE FROM transactions');
        const result = stmt.run();
        return result.changes;
    },

    // 获取持仓汇总（按资产名称分组）
    getSummary() {
        const stmt = db.prepare(`
            SELECT 
                name,
                symbol,
                SUM(total) as total_cost,
                SUM(shares) as total_shares,
                SUM(total) / SUM(shares) as avg_price,
                COUNT(*) as transaction_count
            FROM transactions
            GROUP BY name
            ORDER BY total_cost DESC
        `);
        return stmt.all();
    }
};

/**
 * 配置 CRUD 操作
 */
export const configDB = {
    // 获取配置
    get(key, defaultValue = null) {
        const stmt = db.prepare('SELECT value FROM config WHERE key = ?');
        const result = stmt.get(key);
        return result ? JSON.parse(result.value) : defaultValue;
    },

    // 设置配置
    set(key, value) {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO config (key, value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `);
        stmt.run(key, JSON.stringify(value));
    },

    // 删除配置
    delete(key) {
        const stmt = db.prepare('DELETE FROM config WHERE key = ?');
        const result = stmt.run(key);
        return result.changes > 0;
    },

    // 获取所有配置
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
 * 价格缓存操作
 */
export const priceCacheDB = {
    // 获取缓存价格
    get(symbol) {
        const stmt = db.prepare('SELECT price, updated_at FROM price_cache WHERE symbol = ?');
        return stmt.get(symbol);
    },

    // 设置缓存价格
    set(symbol, price) {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO price_cache (symbol, price, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `);
        stmt.run(symbol, price);
    },

    // 批量设置缓存价格
    setBatch(prices) {
        const insert = db.prepare(`
            INSERT OR REPLACE INTO price_cache (symbol, price, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `);
        
        const insertMany = db.transaction((prices) => {
            for (const [symbol, price] of Object.entries(prices)) {
                insert.run(symbol, price);
            }
        });
        
        insertMany(prices);
    },

    // 获取所有缓存
    getAll() {
        const stmt = db.prepare('SELECT symbol, price, updated_at FROM price_cache');
        return stmt.all();
    },

    // 清除过期缓存（超过30分钟）
    clearExpired(minutes = 30) {
        const stmt = db.prepare(`
            DELETE FROM price_cache 
            WHERE datetime(updated_at) < datetime('now', '-' || ? || ' minutes')
        `);
        const result = stmt.run(minutes);
        return result.changes;
    }
};

// 导出数据库实例（用于备份等操作）
export { db };

// 优雅关闭
process.on('exit', () => db.close());
process.on('SIGINT', () => {
    db.close();
    process.exit(0);
});
