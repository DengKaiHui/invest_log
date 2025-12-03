/**
 * 总市值折线图管理 Composable
 */
import { fetchMarketValueHistory } from '../utils/api.js';

export function useMarketValueChart(Vue) {
    const { ref, onMounted, nextTick } = Vue;
    
    const marketValueChartDom = ref(null);
    const marketValueLoading = ref(false);
    let marketValueChart = null;
    
    // 初始化图表
    function initMarketValueChart() {
        if (!marketValueChartDom.value) {
            console.error('总市值图表容器未找到');
            return;
        }
        
        marketValueChart = echarts.init(marketValueChartDom.value);
        
        // 设置初始配置
        const option = {
            title: {
                // text: '总市值走势',
                left: 'center',
                top: 5,
                textStyle: {
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#374151'
                }
            },
            tooltip: {
                trigger: 'axis',
                formatter: function(params) {
                    const item = params[0];
                    return `${item.axisValue}<br/>总市值: $${item.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                }
            },
            grid: {
                left: '3%',
                right: '3%',
                top: '40',
                bottom: '10%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: [],
                axisLabel: {
                    fontSize: 11,
                    color: '#6b7280',
                    formatter: function(value) {
                        // 只显示月-日
                        return value.substring(5);
                    }
                }
            },
            yAxis: {
                type: 'value',
                axisLabel: {
                    fontSize: 11,
                    color: '#6b7280',
                    formatter: function(value) {
                        // 格式化为千位分隔
                        return '$' + (value / 1000).toFixed(0) + 'k';
                    }
                },
                splitLine: {
                    lineStyle: {
                        color: '#e5e7eb'
                    }
                }
            },
            series: [{
                name: '总市值',
                type: 'line',
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
                lineStyle: {
                    width: 3,
                    color: {
                        type: 'linear',
                        x: 0,
                        y: 0,
                        x2: 1,
                        y2: 0,
                        colorStops: [
                            { offset: 0, color: '#3b82f6' },
                            { offset: 1, color: '#8b5cf6' }
                        ]
                    }
                },
                itemStyle: {
                    color: '#3b82f6',
                    borderWidth: 2,
                    borderColor: '#fff'
                },
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0,
                        y: 0,
                        x2: 0,
                        y2: 1,
                        colorStops: [
                            { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
                            { offset: 1, color: 'rgba(139, 92, 246, 0.05)' }
                        ]
                    }
                },
                data: []
            }]
        };
        
        marketValueChart.setOption(option);
        
        // 响应式调整
        window.addEventListener('resize', () => {
            marketValueChart && marketValueChart.resize();
        });
    }
    
    // 加载并更新图表数据
    async function loadMarketValueData() {
        marketValueLoading.value = true;
        
        try {
            const history = await fetchMarketValueHistory('2025-12-03');
            
            if (history && history.length > 0) {
                const dates = history.map(item => item.date);
                const values = history.map(item => item.totalValue);
                
                marketValueChart.setOption({
                    xAxis: {
                        data: dates
                    },
                    series: [{
                        data: values
                    }]
                });
            } else {
                console.log('暂无总市值数据');
            }
        } catch (error) {
            console.error('加载总市值数据失败:', error);
            ElementPlus.ElMessage.error('加载总市值数据失败');
        } finally {
            marketValueLoading.value = false;
        }
    }
    
    return {
        marketValueChartDom,
        marketValueLoading,
        initMarketValueChart,
        loadMarketValueData
    };
}
