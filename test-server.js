/**
 * 后端服务测试脚本
 * 用于验证股票价格API是否正常工作
 */

const BASE_URL = 'http://localhost:3001/api';

// 测试颜色输出
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    blue: '\x1b[36m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// 测试健康检查
async function testHealth() {
    log('\n📡 测试 1: 健康检查', 'blue');
    try {
        const response = await fetch(`${BASE_URL}/health`);
        const data = await response.json();
        if (data.success) {
            log(`✓ 服务状态: ${data.status}`, 'green');
            log(`  运行时间: ${Math.floor(data.uptime)}秒`, 'green');
            log(`  缓存数量: ${data.cacheSize}`, 'green');
        }
    } catch (error) {
        log(`✗ 无法连接到服务: ${error.message}`, 'red');
        log('\n请确保后端服务已启动: npm start', 'yellow');
        process.exit(1);
    }
}

// 测试获取单个股票价格
async function testSinglePrice() {
    log('\n📈 测试 2: 获取单个股票价格 (NVDA)', 'blue');
    try {
        const response = await fetch(`${BASE_URL}/price/NVDA`);
        const data = await response.json();
        if (data.success && data.price) {
            log(`✓ NVDA 价格: $${data.price}`, 'green');
            log(`  缓存状态: ${data.cached ? '使用缓存' : '新获取'}`, 'green');
        } else {
            log(`✗ 获取失败: ${data.message}`, 'red');
        }
    } catch (error) {
        log(`✗ 错误: ${error.message}`, 'red');
    }
}

// 测试批量获取价格
async function testBatchPrices() {
    log('\n📊 测试 3: 批量获取股票价格', 'blue');
    try {
        const symbols = ['NVDA', 'AAPL', 'TSLA'];
        const response = await fetch(`${BASE_URL}/prices`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ symbols, force: false })
        });
        const data = await response.json();
        if (data.success) {
            log(`✓ 批量获取成功`, 'green');
            Object.entries(data.results).forEach(([symbol, result]) => {
                if (result.price) {
                    log(`  ${symbol}: $${result.price} ${result.cached ? '(缓存)' : ''}`, 'green');
                } else {
                    log(`  ${symbol}: 获取失败`, 'red');
                }
            });
        }
    } catch (error) {
        log(`✗ 错误: ${error.message}`, 'red');
    }
}

// 测试强制刷新
async function testRefresh() {
    log('\n🔄 测试 4: 强制刷新价格', 'blue');
    try {
        const symbols = ['NVDA'];
        const response = await fetch(`${BASE_URL}/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ symbols })
        });
        const data = await response.json();
        if (data.success) {
            log(`✓ 刷新成功`, 'green');
            Object.entries(data.results).forEach(([symbol, result]) => {
                if (result.price) {
                    log(`  ${symbol}: $${result.price}`, 'green');
                } else {
                    log(`  ${symbol}: 刷新失败`, 'yellow');
                }
            });
        }
    } catch (error) {
        log(`✗ 错误: ${error.message}`, 'red');
    }
}

// 测试缓存状态
async function testCacheStatus() {
    log('\n💾 测试 5: 查看缓存状态', 'blue');
    try {
        const response = await fetch(`${BASE_URL}/cache/status`);
        const data = await response.json();
        if (data.success) {
            log(`✓ 缓存有效期: ${data.cacheExpiry}分钟`, 'green');
            log(`  缓存项数量: ${data.items.length}`, 'green');
            if (data.items.length > 0) {
                data.items.forEach(item => {
                    const ageMin = Math.floor(item.age / 60);
                    const ageSec = item.age % 60;
                    log(`  - ${item.symbol}: $${item.price} (${ageMin}分${ageSec}秒前, ${item.valid ? '有效' : '已过期'})`, 'yellow');
                });
            }
        }
    } catch (error) {
        log(`✗ 错误: ${error.message}`, 'red');
    }
}

// 运行所有测试
async function runAllTests() {
    log('='.repeat(60), 'blue');
    log('🧪 股票价格服务测试开始', 'blue');
    log('='.repeat(60), 'blue');
    
    await testHealth();
    await testSinglePrice();
    await testBatchPrices();
    await testRefresh();
    await testCacheStatus();
    
    log('\n' + '='.repeat(60), 'blue');
    log('✅ 所有测试完成', 'green');
    log('='.repeat(60), 'blue');
}

// 执行测试
runAllTests().catch(error => {
    log(`\n❌ 测试失败: ${error.message}`, 'red');
    process.exit(1);
});
