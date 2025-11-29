/**
 * 持仓盈亏管理 Composable
 */
import { storage, STORAGE_KEYS } from '../utils/storage.js';
import { formatCurrency, formatDateTime, getProfitClass as utilGetProfitClass } from '../utils/formatter.js';
import { fetchStockPrices, refreshStockPrices } from '../utils/api.js';

export function usePosition(Vue, records) {
    const { ref, computed, watch } = Vue;
    
    const priceLoading = ref(false);
    const stockPrices = ref({});
    const lastUpdateTime = ref('');
    
    // 持仓汇总计算
    const positionSummary = computed(() => {
        const summary = {};
        
        records.value.forEach(record => {
            const symbol = record.name.toUpperCase();
            if (!summary[symbol]) {
                summary[symbol] = {
                    symbol: symbol,
                    displayName: record.name,
                    totalShares: 0,
                    totalCost: 0,
                    avgCost: 0,
                    currentPrice: 0,
                    marketValue: 0,
                    totalProfit: 0,
                    totalProfitNum: 0,
                    profitRate: 0,
                    profitRateNum: 0,
                    priceLoading: false
                };
            }
            
            summary[symbol].totalShares += Number(record.shares);
            summary[symbol].totalCost += Number(record.total);
        });
        
        Object.keys(summary).forEach(symbol => {
            const pos = summary[symbol];
            const totalShares = Number(pos.totalShares);
            const totalCost = Number(pos.totalCost);
            
            pos.totalShares = formatCurrency(totalShares);
            pos.avgCost = (totalCost / totalShares).toFixed(3);
            
            const price = stockPrices.value[symbol];
            if (price && price > 0) {
                pos.currentPrice = Number(price).toFixed(3);
                const marketValue = totalShares * Number(price);
                pos.marketValue = formatCurrency(marketValue);
                const totalProfit = marketValue - totalCost;
                pos.totalProfit = formatCurrency(Math.abs(totalProfit));
                pos.totalProfitNum = totalProfit;
                const profitRate = (totalProfit / totalCost) * 100;
                pos.profitRate = Math.abs(profitRate).toFixed(2);
                pos.profitRateNum = profitRate;
            } else {
                pos.currentPrice = '--';
                pos.marketValue = '--';
                pos.totalProfit = '--';
                pos.totalProfitNum = 0;
                pos.profitRate = '--';
                pos.profitRateNum = 0;
            }
        });
        
        return Object.values(summary);
    });
    
    // 总持仓成本
    const totalCost = computed(() => {
        const sum = positionSummary.value.reduce((acc, pos) => {
            const cost = pos.totalCost || 0;
            return acc + Number(cost);
        }, 0);
        return formatCurrency(sum);
    });
    
    // 总市值
    const totalMarketValue = computed(() => {
        const sum = positionSummary.value.reduce((acc, pos) => {
            if (pos.marketValue === '--') return acc;
            const val = Number(pos.marketValue.replace(/,/g, ''));
            return acc + val;
        }, 0);
        return formatCurrency(sum);
    });
    
    // 总盈亏
    const totalProfit = computed(() => {
        const sum = positionSummary.value.reduce((acc, pos) => {
            return acc + Number(pos.totalProfitNum || 0);
        }, 0);
        return formatCurrency(Math.abs(sum));
    });
    
    const totalProfitNum = computed(() => {
        return positionSummary.value.reduce((acc, pos) => {
            return acc + Number(pos.totalProfitNum || 0);
        }, 0);
    });
    
    // 总收益率
    const totalProfitRate = computed(() => {
        const costSum = positionSummary.value.reduce((acc, pos) => {
            const cost = pos.totalCost || 0;
            return acc + Number(cost);
        }, 0);
        if (costSum === 0) return '0.00';
        return Math.abs((totalProfitNum.value / costSum) * 100).toFixed(2);
    });
    
    // 加载价格数据
    function loadPrices() {
        const savedPrices = storage.get(STORAGE_KEYS.STOCK_PRICES, {});
        const savedUpdateTime = storage.get(STORAGE_KEYS.LAST_UPDATE_TIME, '');
        stockPrices.value = savedPrices;
        lastUpdateTime.value = savedUpdateTime;
    }
    
    // 刷新所有价格（使用后端服务）
    async function refreshPrices() {
        if (positionSummary.value.length === 0) {
            ElementPlus.ElMessage.warning('暂无持仓数据');
            return;
        }
        
        priceLoading.value = true;
        const symbols = positionSummary.value.map(pos => pos.symbol);
        
        try {
            const results = await refreshStockPrices(symbols);
            
            if (results) {
                let successCount = 0;
                let failCount = 0;
                
                Object.entries(results).forEach(([symbol, data]) => {
                    if (data.price !== null) {
                        stockPrices.value[symbol] = data.price;
                        successCount++;
                    } else {
                        failCount++;
                    }
                });
                
                lastUpdateTime.value = formatDateTime();
                
                if (failCount === 0) {
                    ElementPlus.ElMessage.success(`价格已更新 (${successCount}个)`);
                } else {
                    ElementPlus.ElMessage.warning(`部分更新成功 (成功: ${successCount}, 失败: ${failCount})`);
                }
            } else {
                throw new Error('无法连接到价格服务');
            }
        } catch (error) {
            console.error('价格更新失败:', error);
            ElementPlus.ElMessage.error('价格更新失败，请确保后端服务已启动');
        } finally {
            priceLoading.value = false;
        }
    }
    
    // 自动加载价格（使用缓存）
    async function autoLoadPrices() {
        if (positionSummary.value.length === 0) {
            return;
        }
        
        const symbols = positionSummary.value.map(pos => pos.symbol);
        
        try {
            const results = await fetchStockPrices(symbols, false); // 使用缓存
            
            if (results) {
                Object.entries(results).forEach(([symbol, data]) => {
                    if (data.price !== null) {
                        stockPrices.value[symbol] = data.price;
                    }
                });
                
                lastUpdateTime.value = formatDateTime();
                console.log('价格数据已自动加载');
            }
        } catch (error) {
            console.error('自动加载价格失败:', error);
        }
    }
    
    // 获取盈亏样式类名
    function getProfitClass(value) {
        return utilGetProfitClass(value);
    }
    
    // 监听价格变化，自动保存
    watch(stockPrices, (newPrices) => {
        storage.set(STORAGE_KEYS.STOCK_PRICES, newPrices);
    }, { deep: true });
    
    watch(lastUpdateTime, (newTime) => {
        storage.set(STORAGE_KEYS.LAST_UPDATE_TIME, newTime);
    });
    
    return {
        priceLoading,
        stockPrices,
        lastUpdateTime,
        positionSummary,
        totalCost,
        totalMarketValue,
        totalProfit,
        totalProfitNum,
        totalProfitRate,
        loadPrices,
        refreshPrices,
        autoLoadPrices,
        getProfitClass
    };
}