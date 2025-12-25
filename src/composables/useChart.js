/**
 * 图表管理 Composable
 */
export function useChart(Vue, records, isPrivacyMode, positionSummary) {
    const { ref, onMounted, nextTick } = Vue;
    
    const chartDom = ref(null);
    let myChart = null;
    
    // 初始化图表
    function initChart() {
        if (!chartDom.value) return;
        myChart = echarts.init(chartDom.value);
        updateChart();
        
        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            if (myChart) {
                myChart.resize();
            }
        });
    }
    
    // 更新图表数据（使用市值而非成本）
    function updateChart() {
        if (!myChart) return;
        if (!positionSummary || !positionSummary.value || positionSummary.value.length === 0) {
            // 如果没有持仓数据，显示空状态
            const option = {
                color: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'],
                tooltip: {
                    trigger: 'item'
                },
                legend: {
                    bottom: '0%',
                    left: 'center'
                },
                series: [{
                    type: 'pie',
                    radius: ['50%', '80%'],
                    center: ['50%', '45%'],
                    itemStyle: {
                        borderRadius: 8,
                        borderColor: '#fff',
                        borderWidth: 2
                    },
                    label: {
                        show: false
                    },
                    data: [{ name: '暂无数据', value: 1 }]
                }]
            };
            myChart.setOption(option, true);
            return;
        }
        
        // 从持仓汇总中提取市值数据
        const data = [];
        positionSummary.value.forEach(pos => {
            // 只有当市值存在且不是 '--' 时才添加
            if (pos.marketValue && pos.marketValue !== '--') {
                const marketValue = parseFloat(pos.marketValue.replace(/,/g, ''));
                if (!isNaN(marketValue) && marketValue > 0) {
                    data.push({
                        name: pos.displayName || pos.symbol,
                        value: marketValue
                    });
                }
            }
        });
        
        // 如果没有有效的市值数据，回退到成本数据
        if (data.length === 0) {
            positionSummary.value.forEach(pos => {
                if (pos.totalCost && pos.totalCost > 0) {
                    data.push({
                        name: pos.displayName || pos.symbol,
                        value: pos.totalCost
                    });
                }
            });
        }
        
        // 配置图表选项
        const option = {
            color: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'],
            tooltip: {
                trigger: 'item',
                formatter: (params) => {
                    if (isPrivacyMode.value) {
                        return `${params.name}: **** (${params.percent}%)`;
                    }
                    return `${params.name}: $${params.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${params.percent}%)`;
                }
            },
            legend: {
                bottom: '0%',
                left: 'center'
            },
            series: [{
                type: 'pie',
                radius: ['50%', '80%'],
                center: ['50%', '45%'],
                itemStyle: {
                    borderRadius: 8,
                    borderColor: '#fff',
                    borderWidth: 2
                },
                label: {
                    show: false
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 16,
                        fontWeight: 'bold'
                    }
                },
                data: data.length > 0 ? data : [{ name: '暂无数据', value: 1 }]
            }]
        };
        
        myChart.setOption(option, true);
    }
    
    // 复制资产分布（使用市值）
    function copyAssetDistribution() {
        if (!positionSummary || !positionSummary.value || positionSummary.value.length === 0) {
            ElementPlus.ElMessage.warning('暂无数据');
            return;
        }
        
        // 聚合市值数据
        const data = [];
        let total = 0;
        
        positionSummary.value.forEach(pos => {
            if (pos.marketValue && pos.marketValue !== '--') {
                const marketValue = parseFloat(pos.marketValue.replace(/,/g, ''));
                if (!isNaN(marketValue) && marketValue > 0) {
                    data.push({
                        name: pos.displayName || pos.symbol,
                        value: marketValue
                    });
                    total += marketValue;
                }
            }
        });
        
        if (data.length === 0 || total === 0) {
            ElementPlus.ElMessage.warning('暂无有效市值数据');
            return;
        }
        
        // 计算百分比并格式化
        const result = data
            .map(item => {
                const percentage = ((item.value / total) * 100).toFixed(2);
                return `${item.name} ${percentage}%`;
            })
            .join(', ');
        
        // 复制到剪贴板
        navigator.clipboard.writeText(result).then(() => {
            ElementPlus.ElMessage.success('已复制到剪贴板');
        }).catch(() => {
            ElementPlus.ElMessage.error('复制失败');
        });
    }
    
    return {
        chartDom,
        initChart,
        updateChart,
        copyAssetDistribution
    };
}