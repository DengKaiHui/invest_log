#!/usr/bin/env node

/**
 * 快速测试价格获取功能
 */

async function testPrice(symbol) {
    console.log(`\n测试获取 ${symbol} 的价格...`);
    console.log('='.repeat(50));
    
    try {
        const response = await fetch(`http://localhost:3001/api/price/${symbol}`);
        const data = await response.json();
        
        if (data.success) {
            console.log(`✓ 成功！`);
            console.log(`  股票: ${data.symbol}`);
            console.log(`  价格: $${data.price}`);
            console.log(`  缓存: ${data.cached ? '是' : '否'}`);
        } else {
            console.log(`✗ 失败: ${data.message}`);
        }
    } catch (error) {
        console.log(`✗ 错误: ${error.message}`);
        console.log(`\n请确保后端服务已启动: npm start`);
    }
    
    console.log('='.repeat(50));
}

// 测试 NVDA
testPrice('NVDA').then(() => {
    console.log('\n请查看后端日志了解详细信息');
    process.exit(0);
});
