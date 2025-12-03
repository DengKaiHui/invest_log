/**
 * 主应用逻辑
 */
import { useConfig } from './composables/useConfig.js';
import { useRecords } from './composables/useRecords.js';
import { usePosition } from './composables/usePosition.js';
import { useChart } from './composables/useChart.js';
import { useProfitCalendar } from './composables/useProfitCalendar.js';
import { useMarketValueChart } from './composables/useMarketValueChart.js';
import { storage, STORAGE_KEYS } from './utils/storage.js';
import { formatCurrency } from './utils/formatter.js';
import { recalculateAllProfits } from './utils/api.js';

const { createApp, ref, computed, onMounted, nextTick } = Vue;

const App = {
    setup() {
        // 隐私模式
        const isPrivacyMode = ref(false);
        
        // 记一笔弹框控制
        const showAddRecordDialog = ref(false);
        
        // 重新计算收益的加载状态
        const recalculating = ref(false);
        
        // 配置管理
        const configModule = useConfig(Vue);
        
        // 临时存储回调函数
        let updateChartCallback = null;
        let refreshPricesCallback = null;
        
        // 记录管理
        const recordsModule = useRecords(
            Vue,
            configModule.config,
            () => updateChartCallback && updateChartCallback(),
            () => refreshPricesCallback && refreshPricesCallback()
        );
        
        // 图表管理
        const chartModule = useChart(Vue, recordsModule.records, isPrivacyMode);
        updateChartCallback = chartModule.updateChart;
        
        // 持仓盈亏管理
        const positionModule = usePosition(Vue, recordsModule.records);
        refreshPricesCallback = positionModule.refreshPrices;
        
        // 收益日历管理
        const profitCalendarModule = useProfitCalendar(Vue);
        
        // 总市值图表管理
        const marketValueChartModule = useMarketValueChart(Vue);
        
        // 计算持仓盈亏的人民币金额
        const totalCostCNY = computed(() => {
            const costNum = positionModule.positionSummary.value.reduce((acc, pos) => {
                const cost = pos.totalCost || 0;
                return acc + Number(cost);
            }, 0);
            return formatCurrency(costNum * (configModule.config.value.exchangeRate || 7.25));
        });
        
        const totalMarketValueCNY = computed(() => {
            const sum = positionModule.positionSummary.value.reduce((acc, pos) => {
                if (pos.marketValue === '--') return acc;
                const val = Number(pos.marketValue.replace(/,/g, ''));
                return acc + val;
            }, 0);
            return formatCurrency(sum * (configModule.config.value.exchangeRate || 7.25));
        });
        
        const totalProfitCNY = computed(() => {
            const profitNum = positionModule.totalProfitNum.value;
            const profitCNY = profitNum * (configModule.config.value.exchangeRate || 7.25);
            return formatCurrency(Math.abs(profitCNY));
        });
        
        // 切换隐私模式
        function togglePrivacy() {
            isPrivacyMode.value = !isPrivacyMode.value;
            chartModule.updateChart();
        }
        
        // 添加记录并关闭弹框
        function addRecordAndClose() {
            recordsModule.addRecord();
            showAddRecordDialog.value = false;
        }
        
        // 处理数据操作命令
        function handleDataCommand(command) {
            switch (command) {
                case 'export':
                    recordsModule.exportCSV();
                    break;
                case 'import':
                    recordsModule.showImportDialog.value = true;
                    break;
                case 'clear':
                    recordsModule.clearAll();
                    break;
            }
        }
        
        // 重新计算所有收益
        async function recalculateProfits() {
            try {
                recalculating.value = true;
                
                const result = await recalculateAllProfits();
                
                ElementPlus.ElMessage.success({
                    message: `收益重新计算完成！已计算 ${result.calculated} 天的数据`,
                    duration: 3000
                });
                
                // 重新加载收益日历和总市值图表
                await profitCalendarModule.loadData();
                await marketValueChartModule.loadMarketValueData();
                
            } catch (error) {
                console.error('重新计算收益失败:', error);
                ElementPlus.ElMessage.error('重新计算收益失败: ' + error.message);
            } finally {
                recalculating.value = false;
            }
        }
        
        // 卡片拖动排序
        function initDraggable() {
            const leftColumn = document.querySelector('[data-card="left"]');
            const rightColumn = document.querySelector('[data-card="right"]');
            
            if (!leftColumn || !rightColumn) {
                console.error('未找到拖动容器');
                return;
            }
            
            // 恢复保存的顺序
            const savedLeftOrder = storage.get(STORAGE_KEYS.CARD_ORDER_LEFT);
            const savedRightOrder = storage.get(STORAGE_KEYS.CARD_ORDER_RIGHT);
            
            // 过滤掉已经不存在的卡片ID（例如被移除的记录表单 left-0）
            if (savedLeftOrder && savedLeftOrder.length > 0) {
                savedLeftOrder.forEach(cardId => {
                    const card = leftColumn.querySelector(`[data-card-id="${cardId}"]`);
                    if (card) {
                        leftColumn.appendChild(card);
                    }
                });
            }
            
            if (savedRightOrder && savedRightOrder.length > 0) {
                savedRightOrder.forEach(cardId => {
                    const card = rightColumn.querySelector(`[data-card-id="${cardId}"]`);
                    if (card) {
                        rightColumn.appendChild(card);
                    }
                });
            }
            
            // 初始化左侧拖动
            Sortable.create(leftColumn, {
                animation: 150,
                handle: '.drag-handle',
                ghostClass: 'sortable-ghost',
                draggable: '.modern-card',
                onEnd: function() {
                    const cards = leftColumn.querySelectorAll('.modern-card');
                    const order = Array.from(cards).map(card => card.dataset.cardId);
                    storage.set(STORAGE_KEYS.CARD_ORDER_LEFT, order);
                }
            });
            
            // 初始化右侧拖动
            Sortable.create(rightColumn, {
                animation: 150,
                handle: '.drag-handle',
                ghostClass: 'sortable-ghost',
                draggable: '.modern-card',
                onEnd: function() {
                    const cards = rightColumn.querySelectorAll('.modern-card');
                    const order = Array.from(cards).map(card => card.dataset.cardId);
                    storage.set(STORAGE_KEYS.CARD_ORDER_RIGHT, order);
                }
            });
        }
        
        // 生命周期
        onMounted(async () => {
            // 加载数据（汇率会在 loadConfig 中自动处理）
            configModule.loadConfig();
            await recordsModule.loadRecords();
            
            // 初始化图表和拖动
            nextTick(() => {
                chartModule.initChart();
                
                // 数据加载后更新图表
                setTimeout(() => {
                    chartModule.updateChart();
                }, 100);
                
                initDraggable();
                
                // 加载价格数据（从数据库读取）
                if (recordsModule.records.value.length > 0) {
                    setTimeout(() => positionModule.loadPrices(), 500);
                }
                
                // 加载收益日历数据
                setTimeout(() => profitCalendarModule.loadData(), 800);
                
                // 初始化并加载总市值图表
                setTimeout(() => {
                    marketValueChartModule.initMarketValueChart();
                    marketValueChartModule.loadMarketValueData();
                }, 1000);
            });
        });
        
        return {
            // 配置相关
            ...configModule,
            
            // 记录相关
            ...recordsModule,
            
            // 持仓相关
            ...positionModule,
            
            // 图表相关
            ...chartModule,
            
            // 收益日历相关
            ...profitCalendarModule,
            profitLoading: profitCalendarModule.loading,
            recalculating,
            recalculateProfits,
            
            // 总市值图表相关
            ...marketValueChartModule,
            
            // 其他
            isPrivacyMode,
            togglePrivacy,
            showAddRecordDialog,
            addRecordAndClose,
            handleDataCommand,
            totalCostCNY,
            totalMarketValueCNY,
            totalProfitCNY
        };
    }
};

// 创建并挂载应用
const app = createApp(App);
app.use(ElementPlus);

// 注册Element Plus图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component);
}

app.mount('#app');