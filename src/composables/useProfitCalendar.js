/**
 * 收益日历管理 Composable
 */
import { 
    fetchMonthlyDailyProfits, 
    fetchMonthlyProfit,
    fetchYearlyMonthlyProfits, 
    fetchYearlyProfit 
} from '../utils/api.js';

export function useProfitCalendar(Vue) {
    const { ref, computed } = Vue;
    
    const viewMode = ref('month'); // 'month' or 'year'
    const currentDate = ref(new Date());
    const loading = ref(false);
    
    // 月视图数据
    const dailyProfits = ref([]);
    const monthlyProfit = ref(null);
    
    // 年视图数据
    const monthlyProfits = ref([]);
    const yearlyProfit = ref(null);
    
    // 当前年月
    const currentYear = computed(() => currentDate.value.getFullYear());
    const currentMonth = computed(() => currentDate.value.getMonth() + 1);
    const currentYearMonth = computed(() => {
        const y = currentYear.value;
        const m = String(currentMonth.value).padStart(2, '0');
        return `${y}-${m}`;
    });
    
    // 切换到上一个月/年
    function prevPeriod() {
        const newDate = new Date(currentDate.value);
        if (viewMode.value === 'month') {
            newDate.setMonth(newDate.getMonth() - 1);
        } else {
            newDate.setFullYear(newDate.getFullYear() - 1);
        }
        currentDate.value = newDate;
        loadData();
    }
    
    // 切换到下一个月/年
    function nextPeriod() {
        const newDate = new Date(currentDate.value);
        if (viewMode.value === 'month') {
            newDate.setMonth(newDate.getMonth() + 1);
        } else {
            newDate.setFullYear(newDate.getFullYear() + 1);
        }
        currentDate.value = newDate;
        loadData();
    }
    
    // 切换视图模式
    function switchViewMode(mode) {
        viewMode.value = mode;
        loadData();
    }
    
    // 加载数据
    async function loadData() {
        loading.value = true;
        
        try {
            if (viewMode.value === 'month') {
                await loadMonthData();
            } else {
                await loadYearData();
            }
        } catch (error) {
            console.error('加载收益数据失败:', error);
            ElementPlus.ElMessage.error('加载收益数据失败');
        } finally {
            loading.value = false;
        }
    }
    
    // 加载月视图数据
    async function loadMonthData() {
        const yearMonth = currentYearMonth.value;
        
        // 获取月度汇总
        monthlyProfit.value = await fetchMonthlyProfit(yearMonth);
        
        // 获取每日数据
        const dailyData = await fetchMonthlyDailyProfits(yearMonth);
        
        // 生成完整的月份日历
        const year = currentYear.value;
        const month = currentMonth.value;
        const daysInMonth = new Date(year, month, 0).getDate();
        const firstDay = new Date(year, month - 1, 1).getDay();
        
        const calendar = [];
        const dailyMap = {};
        dailyData.forEach(item => {
            dailyMap[item.date] = item;
        });
        
        // 填充日历
        for (let i = 0; i < firstDay; i++) {
            calendar.push(null); // 空白占位
        }
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const data = dailyMap[dateStr];
            
            // 判断是否为周末
            const dayOfWeek = new Date(year, month - 1, day).getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            calendar.push({
                day,
                date: dateStr,
                profit: data ? data.profit : 0,
                profitRate: data ? data.profit_rate : 0,
                isMarketClosed: data ? data.is_market_closed : isWeekend,
                hasData: !!data
            });
        }
        
        dailyProfits.value = calendar;
    }
    
    // 加载年视图数据
    async function loadYearData() {
        const year = String(currentYear.value);
        
        // 获取年度汇总
        yearlyProfit.value = await fetchYearlyProfit(year);
        
        // 获取每月数据
        const monthlyData = await fetchYearlyMonthlyProfits(year);
        
        const monthlyMap = {};
        monthlyData.forEach(item => {
            const month = item.month.substring(5); // 提取 MM
            monthlyMap[month] = item;
        });
        
        // 生成12个月的数据
        const months = [];
        for (let m = 1; m <= 12; m++) {
            const monthStr = String(m).padStart(2, '0');
            const data = monthlyMap[monthStr];
            
            months.push({
                month: m,
                monthStr: `${m}月`,
                profit: data ? data.profit : 0,
                profitRate: data ? data.profit_rate : 0,
                hasData: !!data
            });
        }
        
        monthlyProfits.value = months;
    }
    
    // 格式化金额
    function formatAmount(amount) {
        const abs = Math.abs(amount);
        if (abs >= 10000) {
            return `${(amount / 10000).toFixed(2)}万`;
        }
        return amount.toFixed(2);
    }
    
    // 获取盈亏样式类
    function getProfitClass(value) {
        if (value > 0) return 'profit-positive';
        if (value < 0) return 'profit-negative';
        return 'profit-neutral';
    }
    
    return {
        viewMode,
        currentDate,
        loading,
        currentYear,
        currentMonth,
        currentYearMonth,
        dailyProfits,
        monthlyProfit,
        monthlyProfits,
        yearlyProfit,
        prevPeriod,
        nextPeriod,
        switchViewMode,
        loadData,
        formatAmount,
        getProfitClass
    };
}
