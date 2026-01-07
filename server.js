/**
 * 投资看板后端服务
 * - 股票价格查询
 * - 数据库操作（SQLite）
 * - CSV 导入导出
 */

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import multer from 'multer';
import path from 'path';
import cron from 'node-cron';
import { fileURLToPath } from 'url';
import { initDatabase, transactionDB, configDB, priceCacheDB, dailyProfitDB, monthlyProfitDB, yearlyProfitDB, dailyPriceSnapshotDB } from './database.js';
import { importCSV, exportCSV, validateCSV } from './csv-handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Finnhub API Key
const FINNHUB_KEY = process.env.FINNHUB_KEY || '';

// 配置 multer 用于文件上传
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('只支持 CSV 文件'));
        }
    }
});

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// 初始化数据库
initDatabase();

console.log('✓ 后端服务初始化完成');

// ================== 健康检查 ==================
app.get('/api/health', (req, res) => {
    const transactionCount = transactionDB.getAll().length;
    res.json({
        success: true,
        status: 'running',
        uptime: process.uptime(),
        database: 'connected',
        transactionCount,
        message: '服务运行正常'
    });
});

// ================== 交易记录 API ==================

// 获取所有交易记录
app.get('/api/transactions', (req, res) => {
    try {
        const records = transactionDB.getAll();
        res.json({
            success: true,
            data: records,
            count: records.length
        });
    } catch (error) {
        console.error('获取交易记录失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 获取持仓汇总
app.get('/api/transactions/summary', (req, res) => {
    try {
        const summary = transactionDB.getSummary();
        res.json({
            success: true,
            data: summary
        });
    } catch (error) {
        console.error('获取持仓汇总失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 根据 ID 获取交易记录
app.get('/api/transactions/:id', (req, res) => {
    try {
        const record = transactionDB.getById(req.params.id);
        if (record) {
            res.json({
                success: true,
                data: record
            });
        } else {
            res.status(404).json({
                success: false,
                message: '记录不存在'
            });
        }
    } catch (error) {
        console.error('获取交易记录失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 添加交易记录
app.post('/api/transactions', (req, res) => {
    try {
        const { name, symbol, date, total, price, shares } = req.body;
        
        // 验证必填字段
        if (!name || !date || !total || !price) {
            return res.status(400).json({
                success: false,
                message: '缺少必填字段'
            });
        }
        
        const record = {
            name,
            symbol: symbol || name,
            date,
            total: parseFloat(total),
            price: parseFloat(price),
            shares: shares !== undefined ? parseFloat(shares) : (parseFloat(total) / parseFloat(price))
        };
        
        const id = transactionDB.create(record);
        
        res.json({
            success: true,
            id,
            message: '记录添加成功'
        });
    } catch (error) {
        console.error('添加交易记录失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 批量添加交易记录
app.post('/api/transactions/batch', (req, res) => {
    try {
        const { records } = req.body;
        
        if (!Array.isArray(records) || records.length === 0) {
            return res.status(400).json({
                success: false,
                message: '记录数组不能为空'
            });
        }
        
        const count = transactionDB.createBatch(records);
        
        res.json({
            success: true,
            count,
            message: `成功添加 ${count} 条记录`
        });
    } catch (error) {
        console.error('批量添加交易记录失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 更新交易记录
app.put('/api/transactions/:id', (req, res) => {
    try {
        const { name, symbol, date, total, price, shares } = req.body;
        
        const record = {
            name,
            symbol: symbol || name,
            date,
            total: parseFloat(total),
            price: parseFloat(price),
            shares: shares !== undefined ? parseFloat(shares) : (parseFloat(total) / parseFloat(price))
        };
        
        const success = transactionDB.update(req.params.id, record);
        
        if (success) {
            res.json({
                success: true,
                message: '记录更新成功'
            });
        } else {
            res.status(404).json({
                success: false,
                message: '记录不存在'
            });
        }
    } catch (error) {
        console.error('更新交易记录失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 删除交易记录
app.delete('/api/transactions/:id', (req, res) => {
    try {
        const success = transactionDB.delete(req.params.id);
        
        if (success) {
            res.json({
                success: true,
                message: '记录删除成功'
            });
        } else {
            res.status(404).json({
                success: false,
                message: '记录不存在'
            });
        }
    } catch (error) {
        console.error('删除交易记录失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 清空所有交易记录
app.delete('/api/transactions', (req, res) => {
    try {
        const count = transactionDB.deleteAll();
        res.json({
            success: true,
            count,
            message: `已清空 ${count} 条记录`
        });
    } catch (error) {
        console.error('清空交易记录失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ================== CSV 导入导出 API ==================

// 导出 CSV
app.get('/api/export/csv', async (req, res) => {
    try {
        const csv = await exportCSV();
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="investlog_${Date.now()}.csv"`);
        res.send('\ufeff' + csv); // 添加 BOM 以支持中文
    } catch (error) {
        console.error('导出 CSV 失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 导入 CSV（验证）
app.post('/api/import/csv/validate', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: '请上传 CSV 文件'
            });
        }
        
        const csvContent = req.file.buffer.toString('utf-8');
        const result = await validateCSV(csvContent);
        
        res.json(result);
    } catch (error) {
        console.error('验证 CSV 失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 导入 CSV（执行）
app.post('/api/import/csv', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: '请上传 CSV 文件'
            });
        }
        
        const csvContent = req.file.buffer.toString('utf-8');
        const append = req.body.append === 'true' || req.body.append === true;
        
        const result = await importCSV(csvContent, append);
        
        res.json(result);
    } catch (error) {
        console.error('导入 CSV 失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ================== 配置 API ==================

// 获取配置
app.get('/api/config/:key', (req, res) => {
    try {
        const value = configDB.get(req.params.key);
        res.json({
            success: true,
            data: value
        });
    } catch (error) {
        console.error('获取配置失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 获取所有配置
app.get('/api/config', (req, res) => {
    try {
        const config = configDB.getAll();
        res.json({
            success: true,
            data: config
        });
    } catch (error) {
        console.error('获取配置失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 设置配置
app.post('/api/config', (req, res) => {
    try {
        const { key, value } = req.body;
        
        if (!key) {
            return res.status(400).json({
                success: false,
                message: '缺少配置键'
            });
        }
        
        configDB.set(key, value);
        
        res.json({
            success: true,
            message: '配置保存成功'
        });
    } catch (error) {
        console.error('设置配置失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ================== 股票价格 API ==================

/**
 * 判断是否为美股休市日
 * 简化版：周末休市
 */
function isMarketClosed(dateStr) {
    const date = new Date(dateStr);
    const day = date.getDay();
    // 0 = Sunday, 6 = Saturday
    return day === 0 || day === 6;
}

/**
 * 计算当天收益
 * 优化逻辑：
 * 1. 使用每日价格快照计算总市值
 * 2. 公式：T日收益 = T日总市值 - (T-1)日总市值 - T日新增投入
 * 3. 收益率 = T日收益 / (T-1)日总市值 * 100%
 */
async function calculateDailyProfit(date) {
    // 使用截至该日期的持仓汇总（重要：不包含未来的交易）
    const summary = transactionDB.getSummaryUpToDate(date);
    
    if (summary.length === 0) {
        return { profit: 0, profitRate: 0, totalValue: 0 };
    }
    
    // 1. 计算当日总市值（使用当日价格快照）
    let totalMarketValue = 0;
    const priceSnapshots = dailyPriceSnapshotDB.getByDate(date);
    const priceMap = {};
    priceSnapshots.forEach(item => {
        priceMap[item.symbol] = item.price;
    });
    
    // 计算截至该日期的持仓总市值
    for (const item of summary) {
        const symbol = item.symbol;
        const shares = item.total_shares;
        
        // 优先使用当日价格快照
        if (priceMap[symbol]) {
            totalMarketValue += shares * priceMap[symbol];
        } else {
            // 如果没有快照，使用最近的价格快照或成本价
            const priceCache = priceCacheDB.get(symbol);
            totalMarketValue += shares * (priceCache?.price || item.avg_price);
        }
    }
    
    // 2. 计算当天新增投入（从 transactions 表实时计算）
    const newInvestment = transactionDB.getNewInvestmentByDate(date);
    
    // 3. 获取前一日总市值
    const prevDayData = dailyProfitDB.getLatestBefore(date);
    let prevTotalValue = 0;
    
    if (prevDayData) {
        // 有历史收益记录，使用前一日的总市值
        prevTotalValue = prevDayData.total_value;
    } else {
        // 第一条记录，前一日市值 = 截至前一日的总成本
        const prevDate = getPreviousDate(date);
        const costUpToPrevDate = transactionDB.getTotalCostUpToDate(prevDate);
        prevTotalValue = costUpToPrevDate;
    }
    
    // 4. 计算收益和收益率
    const profit = totalMarketValue - prevTotalValue - newInvestment;
    const profitRate = prevTotalValue > 0 ? (profit / prevTotalValue) * 100 : 0;
    
    return {
        profit: parseFloat(profit.toFixed(2)),
        profitRate: parseFloat(profitRate.toFixed(2)),
        totalValue: parseFloat(totalMarketValue.toFixed(2))
    };
}

/**
 * 获取前一天的日期
 */
function getPreviousDate(dateStr) {
    const date = new Date(dateStr);
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
}

/**
 * 获取总市值历史数据（从12.3开始）
 */
app.get('/api/marketvalue/history', (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const start = startDate || '2025-12-03';
        const end = endDate || new Date().toISOString().split('T')[0];
        
        const records = dailyProfitDB.getRange(start, end);
        
        const history = records.map(record => ({
            date: record.date,
            totalValue: record.total_value
        }));
        
        res.json({
            success: true,
            data: history
        });
    } catch (error) {
        console.error('获取总市值历史失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 计算并保存当天收益
 */
async function saveDailyProfit(date) {
    const { profit, profitRate, totalValue } = await calculateDailyProfit(date);
    
    dailyProfitDB.set(date, profit, profitRate, totalValue);
    
    return { profit, profitRate, totalValue };
}

// 月收益和年收益已改为实时计算，不再需要 updateMonthlyProfit 和 updateYearlyProfit 函数

/**
 * 判断缓存是否在今天早上8点之前
 * @returns {boolean} true表示需要刷新
 */
function shouldRefreshCache(cachedTime) {
    const now = new Date();
    const cached = new Date(cachedTime);
    
    // 获取今天早上8点的时间戳
    const today8am = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
    
    // 如果缓存时间在今天8点之前，需要刷新
    if (cached < today8am && now >= today8am) {
        return true;
    }
    
    // 如果现在还没到今天8点，但缓存是昨天的，也需要刷新
    if (now < today8am && cached < new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 8, 0, 0)) {
        return true;
    }
    
    return false;
}

/**
 * 从 Finnhub 获取股票价格
 */
async function fetchStockPrice(symbol, retries = 1) {
    console.log(`📊 获取 ${symbol} 价格...`);
    
    // 验证 API Key
    if (!FINNHUB_KEY || FINNHUB_KEY === '') {
        console.error('✗ Finnhub API Key 未配置');
        return null;
    }
    
    // 先检查数据库缓存
    const cached = priceCacheDB.get(symbol);
    if (cached) {
        // 如果不需要刷新（今天8点后已更新过），使用缓存
        if (!shouldRefreshCache(cached.updated_at)) {
            console.log(`↻ 使用缓存: ${symbol} = $${cached.price} (更新于 ${new Date(cached.updated_at).toLocaleString('zh-CN')})`);
            return cached.price;
        }
    }
    
    // 重试逻辑
    for (let attempt = 0; attempt <= retries; attempt++) {
        if (attempt > 0) {
            const waitTime = attempt * 2;
            console.log(`⏳ 等待 ${waitTime} 秒后重试...`);
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        }
        
        try {
            const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            // Finnhub 返回格式: { c: 当前价, h: 最高价, l: 最低价, o: 开盘价, pc: 昨收价, t: 时间戳 }
            const price = data.c;
            
            if (price && price > 0) {
                console.log(`✓ ${symbol} = $${price} (Finnhub)`);
                // 更新数据库缓存
                priceCacheDB.set(symbol, price);
                return price;
            }
        } catch (error) {
            console.error(`  Finnhub API 失败: ${error.message}`);
        }
    }
    
    console.error(`✗ ${symbol} 获取失败`);
    return null;
}

// 获取单个股票价格
app.get('/api/price/:symbol', async (req, res) => {
    const { symbol } = req.params;
    const { force } = req.query;
    
    try {
        // 如果不强制刷新，先查缓存
        if (!force) {
            const cached = priceCacheDB.get(symbol);
            if (cached && !shouldRefreshCache(cached.updated_at)) {
                return res.json({
                    success: true,
                    symbol,
                    price: cached.price,
                    cached: true,
                    lastUpdate: cached.updated_at
                });
            }
        }
        
        const price = await fetchStockPrice(symbol);
        
        if (price !== null) {
            res.json({
                success: true,
                symbol,
                price,
                cached: false,
                lastUpdate: new Date().toISOString()
            });
        } else {
            res.status(404).json({
                success: false,
                message: `无法获取 ${symbol} 的价格`
            });
        }
    } catch (error) {
        console.error('获取价格失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 批量获取股票价格
app.post('/api/prices', async (req, res) => {
    const { symbols, force } = req.body;
    
    if (!Array.isArray(symbols) || symbols.length === 0) {
        return res.status(400).json({
            success: false,
            message: '请提供股票代码数组'
        });
    }
    
    try {
        const results = {};
        
        for (const symbol of symbols) {
            const price = await fetchStockPrice(symbol, 2);
            if (price !== null) {
                results[symbol] = {
                    price,
                    lastUpdate: new Date().toISOString()
                };
            } else {
                results[symbol] = {
                    price: null,
                    error: '获取失败'
                };
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        res.json({
            success: true,
            results
        });
    } catch (error) {
        console.error('批量获取价格失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 手动刷新价格（强制从API获取）
app.post('/api/refresh', async (req, res) => {
    const { symbols } = req.body;
    
    if (!Array.isArray(symbols) || symbols.length === 0) {
        return res.status(400).json({
            success: false,
            message: '请提供股票代码数组'
        });
    }
    
    try {
        const results = {};
        
        for (const symbol of symbols) {
            const price = await fetchStockPrice(symbol, 2);
            if (price !== null) {
                results[symbol] = {
                    price,
                    lastUpdate: new Date().toISOString()
                };
            } else {
                results[symbol] = {
                    price: null,
                    error: '获取失败'
                };
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        res.json({
            success: true,
            results
        });
    } catch (error) {
        console.error('刷新价格失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ================== 收益日历 API ==================

// 获取某一天的收益
app.get('/api/profits/daily/:date', (req, res) => {
    try {
        const { date } = req.params;
        const profit = dailyProfitDB.get(date);
        
        res.json({
            success: true,
            data: profit || { date, profit: 0, profit_rate: 0, total_value: 0 }
        });
    } catch (error) {
        console.error('获取日收益失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 获取某个月的所有日收益
app.get('/api/profits/daily/month/:yearMonth', (req, res) => {
    try {
        const { yearMonth } = req.params;
        const profits = dailyProfitDB.getByMonth(yearMonth);
        
        res.json({
            success: true,
            data: profits
        });
    } catch (error) {
        console.error('获取月度日收益失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 获取某个月的收益汇总
app.get('/api/profits/monthly/:month', (req, res) => {
    try {
        const { month } = req.params;
        const profit = monthlyProfitDB.get(month);
        
        res.json({
            success: true,
            data: profit || { month, profit: 0, profit_rate: 0, total_value: 0 }
        });
    } catch (error) {
        console.error('获取月收益失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 获取某一年的所有月收益
app.get('/api/profits/monthly/year/:year', (req, res) => {
    try {
        const { year } = req.params;
        const profits = monthlyProfitDB.getByYear(year);
        
        res.json({
            success: true,
            data: profits
        });
    } catch (error) {
        console.error('获取年度月收益失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 获取某一年的收益汇总
app.get('/api/profits/yearly/:year', (req, res) => {
    try {
        const { year } = req.params;
        const profit = yearlyProfitDB.get(year);
        
        res.json({
            success: true,
            data: profit || { year, profit: 0, profit_rate: 0, total_value: 0 }
        });
    } catch (error) {
        console.error('获取年收益失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 获取所有年收益
app.get('/api/profits/yearly', (req, res) => {
    try {
        const profits = yearlyProfitDB.getAll();
        
        res.json({
            success: true,
            data: profits
        });
    } catch (error) {
        console.error('获取所有年收益失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 手动计算并保存当天收益
app.post('/api/profits/calculate', async (req, res) => {
    try {
        const { date } = req.body;
        const targetDate = date || new Date().toISOString().split('T')[0];
        
        const result = await saveDailyProfit(targetDate);
        
        res.json({
            success: true,
            data: result,
            message: '收益计算完成'
        });
    } catch (error) {
        console.error('计算收益失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 清空所有收益数据
app.delete('/api/profits', (req, res) => {
    try {
        const dailyCount = dailyProfitDB.deleteAll();
        
        res.json({
            success: true,
            message: '收益数据已清空',
            deleted: {
                daily: dailyCount
            }
        });
    } catch (error) {
        console.error('清空收益数据失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 手动保存价格快照（用于初始化或补充数据）
app.post('/api/prices/snapshot', async (req, res) => {
    try {
        const { date } = req.body;
        const targetDate = date || new Date().toISOString().split('T')[0];
        
        const symbols = getAllSymbols();
        if (symbols.length === 0) {
            return res.json({
                success: false,
                message: '暂无持仓数据'
            });
        }
        
        console.log(`保存 ${targetDate} 的价格快照...`);
        
        const priceSnapshot = {};
        let successCount = 0;
        let failCount = 0;
        
        for (const symbol of symbols) {
            // 先尝试从价格缓存获取
            const cached = priceCacheDB.get(symbol);
            if (cached && cached.price > 0) {
                priceSnapshot[symbol] = cached.price;
                successCount++;
                console.log(`  ✓ ${symbol}: $${cached.price} (缓存)`);
            } else {
                // 如果缓存没有，从API获取
                const price = await fetchStockPrice(symbol, 2);
                if (price !== null) {
                    priceSnapshot[symbol] = price;
                    successCount++;
                } else {
                    failCount++;
                }
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        // 保存快照
        if (Object.keys(priceSnapshot).length > 0) {
            dailyPriceSnapshotDB.setBatch(targetDate, priceSnapshot);
        }
        
        res.json({
            success: true,
            message: '价格快照保存完成',
            date: targetDate,
            saved: successCount,
            failed: failCount,
            snapshot: priceSnapshot
        });
    } catch (error) {
        console.error('保存价格快照失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 重新计算所有收益（从第一笔交易开始到今天）
app.post('/api/profits/recalculate', async (req, res) => {
    try {
        // 1. 清空现有数据
        dailyProfitDB.deleteAll();
        
        // 2. 设置计算起始日期为 2025-12-03
        const startDate = new Date('2025-12-03');
        const endDate = new Date(); // 今天
        
        console.log(`重新计算收益：2025-12-03 ~ ${endDate.toISOString().split('T')[0]}`);
        
        // 3. 逐日计算收益
        const calculatedDates = [];
        let currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            
            try {
                await saveDailyProfit(dateStr);
                calculatedDates.push(dateStr);
                console.log(`  ✓ ${dateStr}`);
            } catch (error) {
                console.error(`  ✗ ${dateStr}: ${error.message}`);
            }
            
            // 下一天
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        res.json({
            success: true,
            message: '收益重新计算完成',
            calculated: calculatedDates.length,
            dateRange: {
                start: '2025-12-03',
                end: endDate.toISOString().split('T')[0]
            }
        });
    } catch (error) {
        console.error('重新计算收益失败:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ================== 启动服务器 ==================

/**
 * 获取所有持仓的股票代码
 */
function getAllSymbols() {
    const summary = transactionDB.getSummary();
    return summary.map(item => item.symbol);
}

/**
 * 定时任务：每天早上7点自动刷新所有持仓股票价格、保存快照并计算收益
 */
async function scheduledPriceRefresh() {
    const startTime = Date.now();
    console.log('\n' + '='.repeat(60));
    console.log('📊 定时任务：刷新股票价格并计算收益');
    console.log('='.repeat(60));
    console.log(`⏰ 执行时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
    
    const symbols = getAllSymbols();
    
    if (symbols.length === 0) {
        console.log('⚠️  暂无持仓数据，跳过刷新');
        console.log('='.repeat(60) + '\n');
        return;
    }
    
    console.log(`📈 持仓股票 (${symbols.length}): ${symbols.join(', ')}`);
    console.log('');
    
    // 第一步：刷新价格
    console.log('【步骤 1/4】刷新股票价格...');
    let successCount = 0;
    let failCount = 0;
    const today = new Date().toISOString().split('T')[0];
    const priceSnapshot = {};
    
    for (const symbol of symbols) {
        const price = await fetchStockPrice(symbol, 2);
        if (price !== null) {
            successCount++;
            priceSnapshot[symbol] = price;
        } else {
            failCount++;
        }
        // 每个请求间隔1秒，避免API限流
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`✓ 价格刷新完成: 成功 ${successCount}/${symbols.length}, 失败 ${failCount}/${symbols.length}`);
    console.log('');
    
    // 第二步：保存价格快照
    console.log('【步骤 2/4】保存价格快照...');
    if (Object.keys(priceSnapshot).length > 0) {
        dailyPriceSnapshotDB.setBatch(today, priceSnapshot);
        console.log(`✓ 已保存价格快照到数据库: ${today}`);
        console.log(`  - 快照数量: ${Object.keys(priceSnapshot).length}`);
    } else {
        console.log('⚠️  无价格数据可保存');
    }
    console.log('');
    
    // 第三步：计算并保存当天收益
    const startDate = new Date('2025-12-03');
    const currentDate = new Date(today);
    
    if (currentDate >= startDate) {
        console.log('【步骤 3/4】计算并保存当天收益...');
        try {
            const profitResult = await saveDailyProfit(today);
            const marketClosed = isMarketClosed(today);
            
            console.log(`✓ 收益计算完成并已保存到数据库`);
            console.log(`  - 日期: ${today} ${marketClosed ? '(休市)' : '(开市)'}`);
            console.log(`  - 收益: $${profitResult.profit} (${profitResult.profitRate >= 0 ? '+' : ''}${profitResult.profitRate}%)`);
            console.log(`  - 总市值: $${profitResult.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
        } catch (error) {
            console.error('✗ 计算收益失败:', error);
        }
    } else {
        console.log('【步骤 3/4】跳过收益计算');
        console.log(`⏸  收益计算从2025-12-03开始，当前日期 ${today} 早于起始日期`);
    }
    
    // 第四步：通知前端刷新（通过广播事件或轮询机制）
    console.log('');
    console.log('【步骤 4/4】完成');
    console.log('💡 提示: 前端将自动检测并刷新收益日历和总市值图表');
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('');
    console.log(`⏱️  总耗时: ${duration}秒`);
    console.log('='.repeat(60) + '\n');
}

// 初始化定时任务：每天早上7点（北京时间）
cron.schedule('0 7 * * *', scheduledPriceRefresh, {
    scheduled: true,
    timezone: "Asia/Shanghai"
});

console.log('✓ 定时任务已启动: 每天早上7:00自动刷新股票价格');

app.listen(PORT, () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 投资看板服务已启动`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📡 服务地址: http://localhost:${PORT}`);
    console.log(`💾 数据存储: SQLite (data/investlog.db)`);
    console.log(`📊 功能模块:`);
    console.log(`  - 交易记录管理 (CRUD)`);
    console.log(`  - CSV 导入/导出`);
    console.log(`  - 股票价格查询`);
    console.log(`  - 配置管理`);
    console.log(`${'='.repeat(60)}\n`);
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('收到终止信号，正在关闭服务器...');
    process.exit(0);
});
