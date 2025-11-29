/**
 * 主应用逻辑
 */
import { useConfig } from './composables/useConfig.js';
import { useRecords } from './composables/useRecords.js';
import { usePosition } from './composables/usePosition.js';
import { useChart } from './composables/useChart.js';
import { storage, STORAGE_KEYS } from './utils/storage.js';
import { formatCurrency } from './utils/formatter.js';

const { createApp, ref, computed, onMounted, nextTick } = Vue;

const App = {
    setup() {
        // 隐私模式
        const isPrivacyMode = ref(false);
        
        // 记一笔弹框控制
        const showAddRecordDialog = ref(false);
        
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
        
        // 计算总资产
        const totalAssetUSD = computed(() => {
            const sum = recordsModule.records.value.reduce((acc, item) => acc + item.total, 0);
            return formatCurrency(sum);
        });
        
        const totalAssetCNY = computed(() => {
            const sum = recordsModule.records.value.reduce((acc, item) => acc + item.total, 0);
            return formatCurrency(sum * (configModule.config.value.exchangeRate || 7.25));
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
        onMounted(() => {
            // 加载数据
            configModule.loadConfig();
            recordsModule.loadRecords();
            positionModule.loadPrices();
            
            // 获取汇率
            configModule.fetchExchangeRate();
            
            // 初始化图表和拖动
            nextTick(() => {
                chartModule.initChart();
                
                // 数据加载后更新图表
                setTimeout(() => {
                    chartModule.updateChart();
                }, 100);
                
                initDraggable();
                
                // 自动加载价格（优先使用缓存）
                if (recordsModule.records.value.length > 0) {
                    setTimeout(() => positionModule.autoLoadPrices(), 1000);
                }
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
            
            // 其他
            isPrivacyMode,
            togglePrivacy,
            showAddRecordDialog,
            addRecordAndClose,
            totalAssetUSD,
            totalAssetCNY
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