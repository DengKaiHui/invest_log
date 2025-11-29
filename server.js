/**
 * 股票价格服务后端
 * 多数据源支持：Yahoo Finance + Alpha Vantage
 * 增强的容错和重试机制
 */

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = 3001;

// Alpha Vantage API Key (免费的，可以注册获取)
// 访问 https://www.alphavantage.co/support/#api-key 获取免费 API Key
const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_KEY || 'demo';

// Finnhub API Key (免费，注册获取: https://finnhub.io/)
const FINNHUB_KEY = process.env.FINNHUB_KEY || 'demo';

// 价格缓存
const priceCache = new Map();
// 最后更新时间缓存
const lastUpdateCache = new Map();
// 缓存过期时间（30分钟）
const CACHE_EXPIRY = 30 * 60 * 1000;

// 中间件
app.use(cors());
app.use(express.json());

// 健康检查端点
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'running',
        uptime: process.uptime(),
        cacheSize: priceCache.size,
        message: '服务运行正常'
    });
});

/**
 * 方法1: Yahoo Finance 直接 API (推荐)
 */
async function fetchPriceFromYahooWeb(symbol) {
    try {
        // 添加随机延迟避免被识别为爬虫
        await new Promise(resolve => setTimeout(resolve, Math.random() * 500));
        
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': 'https://finance.yahoo.com/',
                'Origin': 'https://finance.yahoo.com',
                'Connection': 'keep-alive',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-site',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.chart && data.chart.result && data.chart.result[0]) {
            const result = data.chart.result[0];
            const meta = result.meta;
            const price = meta.regularMarketPrice || meta.previousClose;
            
            if (price && price > 0) {
                return { price, source: 'Yahoo Web' };
            }
        }
        
        return null;
    } catch (error) {
        console.error(`  Yahoo Web API 失败: ${error.message}`);
        return null;
    }
}

/**
 * 方法2: Yahoo Finance v10 API (备选)
 */
async function fetchPriceFromYahooV10(symbol) {
    try {
        const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=price`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache'
            },
            timeout: 10000
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.quoteSummary && data.quoteSummary.result && data.quoteSummary.result[0]) {
            const priceData = data.quoteSummary.result[0].price;
            const price = priceData.regularMarketPrice?.raw || priceData.regularMarketPrice;
            
            if (price && price > 0) {
                return { price, source: 'Yahoo V10' };
            }
        }
        
        return null;
    } catch (error) {
        console.error(`  Yahoo V10 API 失败: ${error.message}`);
        return null;
    }
}

/**
 * 方法3: Finnhub API (推荐作为主要备选)
 */
async function fetchPriceFromFinnhub(symbol) {
    try {
        if (FINNHUB_KEY === 'demo') {
            return null;
        }
        
        const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.c && data.c > 0) {
            return { price: data.c, source: 'Finnhub' };
        }
        
        return null;
    } catch (error) {
        console.error(`  Finnhub API 失败: ${error.message}`);
        return null;
    }
}

/**
 * 方法4: Alpha Vantage API (最后备选)
 */
async function fetchPriceFromAlphaVantage(symbol) {
    try {
        if (ALPHA_VANTAGE_KEY === 'demo' && symbol !== 'IBM') {
            // demo key 只支持 IBM
            return null;
        }
        
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`;
        const response = await fetch(url, {
            timeout: 10000
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data['Global Quote'] && data['Global Quote']['05. price']) {
            const price = parseFloat(data['Global Quote']['05. price']);
            
            if (price && price > 0) {
                return { price, source: 'Alpha Vantage' };
            }
        }
        
        return null;
    } catch (error) {
        console.error(`  Alpha Vantage API 失败: ${error.message}`);
        return null;
    }
}

/**
 * 智能获取股票价格（多数据源 + 重试）
 */
async function fetchStockPrice(symbol, retries = 2) {
    console.log(`\n📊 正在获取 ${symbol} 的价格...`);
    
    for (let attempt = 0; attempt <= retries; attempt++) {
        if (attempt > 0) {
            const waitTime = attempt * 3;
            console.log(`⏳ 等待 ${waitTime} 秒后重试 (第${attempt}次)...`);
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        }
        
        // 方法1: Yahoo Finance Web API (主要)
        console.log(`  [1/4] 尝试 Yahoo Web API...`);
        let result = await fetchPriceFromYahooWeb(symbol);
        if (result) {
            console.log(`✓ ${symbol} 价格: $${result.price} (来源: ${result.source})`);
            return result.price;
        }
        
        // 方法2: Yahoo Finance V10 API (备选)
        console.log(`  [2/4] 尝试 Yahoo V10 API...`);
        result = await fetchPriceFromYahooV10(symbol);
        if (result) {
            console.log(`✓ ${symbol} 价格: $${result.price} (来源: ${result.source})`);
            return result.price;
        }
        
        // 方法3: Finnhub (推荐备选)
        if (FINNHUB_KEY !== 'demo') {
            console.log(`  [3/4] 尝试 Finnhub API...`);
            result = await fetchPriceFromFinnhub(symbol);
            if (result) {
                console.log(`✓ ${symbol} 价格: $${result.price} (来源: ${result.source})`);
                return result.price;
            }
        }
        
        // 方法4: Alpha Vantage (最后备选)
        if (ALPHA_VANTAGE_KEY !== 'demo' || symbol === 'IBM') {
            console.log(`  [4/4] 尝试 Alpha Vantage API...`);
            result = await fetchPriceFromAlphaVantage(symbol);
            if (result) {
                console.log(`✓ ${symbol} 价格: $${result.price} (来源: ${result.source})`);
                return result.price;
            }
        }
        
        if (attempt < retries) {
            console.log(`⚠ 第 ${attempt + 1} 次尝试失败，准备重试...`);
        }
    }
    
    console.error(`✗ ${symbol} 获取失败 (已尝试所有方法和重试)`);
    return null;
}

/**
 * 检查缓存是否有效
 */
function isCacheValid(symbol) {
    const lastUpdate = lastUpdateCache.get(symbol);
    if (!lastUpdate) return false;
    return Date.now() - lastUpdate < CACHE_EXPIRY;
}

/**
 * 获取缓存的价格
 */
function getCachedPrice(symbol) {
    if (isCacheValid(symbol)) {
        return priceCache.get(symbol);
    }
    return null;
}

/**
 * 更新缓存
 */
function updateCache(symbol, price) {
    priceCache.set(symbol, price);
    lastUpdateCache.set(symbol, Date.now());
}

/**
 * 后台刷新价格
 */
async function backgroundRefreshPrice(symbol) {
    const price = await fetchStockPrice(symbol);
    if (price !== null) {
        updateCache(symbol, price);
    }
}

// API: 获取单个股票价格
app.get('/api/price/:symbol', async (req, res) => {
    const { symbol } = req.params;
    const { force } = req.query;
    
    try {
        // 检查缓存
        if (!force) {
            const cachedPrice = getCachedPrice(symbol);
            if (cachedPrice !== null) {
                console.log(`↻ 使用缓存: ${symbol} = $${cachedPrice}`);
                return res.json({
                    success: true,
                    symbol,
                    price: cachedPrice,
                    cached: true,
                    lastUpdate: lastUpdateCache.get(symbol)
                });
            }
        }
        
        // 获取新价格
        const price = await fetchStockPrice(symbol);
        
        if (price !== null) {
            updateCache(symbol, price);
            res.json({
                success: true,
                symbol,
                price,
                cached: false,
                lastUpdate: Date.now()
            });
        } else {
            res.status(404).json({
                success: false,
                message: `无法获取 ${symbol} 的价格，请检查股票代码或稍后重试`
            });
        }
    } catch (error) {
        console.error('API错误:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// API: 批量获取股票价格
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
            // 检查缓存
            if (!force) {
                const cachedPrice = getCachedPrice(symbol);
                if (cachedPrice !== null) {
                    console.log(`↻ 使用缓存: ${symbol} = $${cachedPrice}`);
                    results[symbol] = {
                        price: cachedPrice,
                        cached: true,
                        lastUpdate: lastUpdateCache.get(symbol)
                    };
                    continue;
                }
            }
            
            // 获取新价格
            const price = await fetchStockPrice(symbol, 1); // 批量时减少重试
            if (price !== null) {
                updateCache(symbol, price);
                results[symbol] = {
                    price,
                    cached: false,
                    lastUpdate: Date.now()
                };
            } else {
                results[symbol] = {
                    price: null,
                    error: '获取失败'
                };
            }
            
            // 避免请求过快
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        res.json({
            success: true,
            results
        });
    } catch (error) {
        console.error('批量获取价格错误:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// API: 手动刷新价格
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
            const price = await fetchStockPrice(symbol);
            if (price !== null) {
                updateCache(symbol, price);
                results[symbol] = {
                    price,
                    lastUpdate: Date.now()
                };
            } else {
                results[symbol] = {
                    price: null,
                    error: '获取失败'
                };
            }
            
            // 避免请求过快
            await new Promise(resolve => setTimeout(resolve, 800));
        }
        
        res.json({
            success: true,
            results,
            message: '价格已刷新'
        });
    } catch (error) {
        console.error('刷新价格错误:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// API: 获取缓存状态
app.get('/api/cache/status', (req, res) => {
    const status = [];
    
    for (const [symbol, price] of priceCache.entries()) {
        const lastUpdate = lastUpdateCache.get(symbol);
        const age = Date.now() - lastUpdate;
        const valid = age < CACHE_EXPIRY;
        
        status.push({
            symbol,
            price,
            lastUpdate,
            age: Math.floor(age / 1000),
            valid
        });
    }
    
    res.json({
        success: true,
        cacheExpiry: CACHE_EXPIRY / 1000 / 60,
        items: status
    });
});

// API: 清除缓存
app.delete('/api/cache', (req, res) => {
    const count = priceCache.size;
    priceCache.clear();
    lastUpdateCache.clear();
    
    res.json({
        success: true,
        message: `已清除 ${count} 个缓存项`
    });
});

// 定时刷新任务
function startAutoRefresh() {
    setInterval(() => {
        const now = Date.now();
        const symbolsToRefresh = [];
        
        for (const [symbol, lastUpdate] of lastUpdateCache.entries()) {
            if (now - lastUpdate >= CACHE_EXPIRY) {
                symbolsToRefresh.push(symbol);
            }
        }
        
        if (symbolsToRefresh.length > 0) {
            console.log(`\n⏰ 定时刷新: ${symbolsToRefresh.join(', ')}`);
            symbolsToRefresh.forEach(symbol => {
                backgroundRefreshPrice(symbol).catch(err => {
                    console.error(`定时刷新 ${symbol} 失败:`, err.message);
                });
            });
        }
    }, 5 * 60 * 1000);
}

// 启动服务器
app.listen(PORT, () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 股票价格服务已启动`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📡 服务地址: http://localhost:${PORT}`);
    console.log(`⏱  缓存时间: ${CACHE_EXPIRY / 1000 / 60} 分钟`);
    console.log(`🔄 自动刷新: 每5分钟检查过期缓存`);
    console.log(`\n📊 数据源:`);
    console.log(`  1. Yahoo Finance Web API (主要)`);
    console.log(`  2. Yahoo Finance V10 API (备选1)`);
    console.log(`  3. Finnhub API (备选2${FINNHUB_KEY === 'demo' ? ' - 未配置' : ' - 已配置'})`);
    if (ALPHA_VANTAGE_KEY !== 'demo') {
        console.log(`  4. Alpha Vantage API (备选3 - 已配置)`);
    } else {
        console.log(`  4. Alpha Vantage API (备选3 - 未配置)`);
    }
    console.log(`\n🔑 配置 API Key (可选，提高成功率):`);
    console.log(`  export FINNHUB_KEY="your_key" (推荐)`);
    console.log(`  export ALPHA_VANTAGE_KEY="your_key"`);
    console.log(`\n  Finnhub 免费注册: https://finnhub.io/register`);
    console.log(`  Alpha Vantage 免费注册: https://www.alphavantage.co/support/#api-key`);
    console.log(`\n💡 提示:`);
    console.log(`  - 每个请求会尝试多个数据源`);
    console.log(`  - 失败会自动重试 2 次`);
    console.log(`  - 使用缓存可避免频繁请求`);
    console.log(`${'='.repeat(60)}\n`);
    
    startAutoRefresh();
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('收到终止信号，正在关闭服务器...');
    process.exit(0);
});
