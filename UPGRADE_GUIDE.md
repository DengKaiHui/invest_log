# V9 到 V10 升级指南

本指南帮助你从 V9（localStorage）升级到 V10（SQLite 数据库）。

## 主要变化

### 数据存储
- **V9**: 浏览器 localStorage（单端）
- **V10**: SQLite 数据库（多端）

### 新增功能
- ✅ CSV 导入/导出
- ✅ 多端数据共享
- ✅ 完整的后端 API
- ✅ 数据库存储配置

## 升级步骤

### 步骤 1: 备份 V9 数据

在升级前，请先备份你的 V9 数据：

1. 打开浏览器开发者工具（F12）
2. 进入 Console 标签
3. 运行以下代码导出数据：

```javascript
// 导出交易记录
const records = JSON.parse(localStorage.getItem('investData') || '[]');
console.log('=== 交易记录 ===');
console.table(records);

// 导出配置
const config = JSON.parse(localStorage.getItem('aiConfigV9') || '{}');
console.log('=== AI 配置 ===');
console.log(config);

// 生成 CSV 格式（复制到文本编辑器）
const csv = 'name,symbol,date,total,price,shares\n' + 
    records.map(r => 
        `${r.name},${r.name},${r.date},${r.total},${r.price},${r.shares}`
    ).join('\n');
console.log('=== CSV 格式 ===');
console.log(csv);
```

4. 复制 CSV 输出并保存为 `backup.csv` 文件

### 步骤 2: 安装 V10

```bash
# 1. 进入项目目录
cd InvestLog

# 2. 安装依赖
npm install

# 3. 启动后端服务
npm start
```

### 步骤 3: 导入数据到 V10

有两种方式导入数据：

#### 方式 1: 使用 CSV 导入（推荐）

1. 访问 V10 前端页面
2. 点击"持仓明细"卡片中的"数据"→"导入 CSV"
3. 选择"覆盖模式"（首次导入）
4. 上传你在步骤 1 中保存的 `backup.csv` 文件

#### 方式 2: 使用 API 直接导入

如果你保存了 JSON 格式的数据，可以使用 API：

```bash
curl -X POST http://localhost:3001/api/transactions/batch \
  -H "Content-Type: application/json" \
  -d '{
    "records": [
      {
        "name": "NVDA",
        "symbol": "NVDA",
        "date": "2024-01-15",
        "total": 1000.50,
        "price": 125.50,
        "shares": 7.97
      }
    ]
  }'
```

### 步骤 4: 恢复配置

1. 打开 V10 设置页面（点击右上角⚙️）
2. 重新配置 AI 服务商和 API Key
3. 刷新汇率（系统会自动获取）
4. 保存配置

### 步骤 5: 验证数据

1. 检查"持仓明细"表格，确认所有记录已导入
2. 点击"刷新价格"获取最新股价
3. 验证"持仓盈亏"计算是否正确
4. 检查"资产分布"图表显示

## 数据迁移脚本

如果你有大量数据，可以使用以下 Node.js 脚本自动迁移：

```javascript
// migrate.js
import { transactionDB, initDatabase } from './database.js';

// 从 V9 localStorage 导出的数据
const v9Data = [
    {
        name: 'NVDA',
        date: '2024-01-15',
        total: 1000.50,
        price: 125.50,
        shares: 7.97
    },
    // ... 更多记录
];

// 初始化数据库
initDatabase();

// 批量导入
const count = transactionDB.createBatch(
    v9Data.map(record => ({
        ...record,
        symbol: record.name
    }))
);

console.log(`✓ 成功导入 ${count} 条记录`);
```

运行脚本：

```bash
node migrate.js
```

## 常见问题

### Q1: 升级后原来的数据会丢失吗？

A: 不会。V9 的 localStorage 数据仍然保留在浏览器中。但建议按照本指南导出并备份数据。

### Q2: 可以同时使用 V9 和 V10 吗？

A: 可以，但不建议。V9 和 V10 使用不同的存储方式，数据不会同步。

### Q3: 如何在多台设备上使用？

A: V10 支持多端访问：
- **局域网**: 后端绑定到 `0.0.0.0`，其他设备通过局域网 IP 访问
- **云端**: 部署到云平台，所有设备通过云端地址访问
- **手动同步**: 使用 CSV 导出/导入

### Q4: CSV 导入时选择追加还是覆盖？

A: 
- **首次导入**: 选择"覆盖模式"
- **后续追加**: 选择"追加模式"

### Q5: 数据库文件在哪里？

A: 数据库文件位于 `data/investlog.db`。你可以：
- 复制到其他设备
- 定期备份
- 使用 SQLite 工具查看

### Q6: 如何备份数据？

A: 有三种方式：
1. **CSV 导出**: 最简单，通过界面操作
2. **数据库文件**: 复制 `data/investlog.db`
3. **API 导出**: 使用 `GET /api/transactions` 获取 JSON 数据

## 回滚到 V9

如果你需要回滚到 V9：

1. 从 V10 导出 CSV
2. 使用在线工具将 CSV 转换为 JSON
3. 在浏览器控制台运行：

```javascript
const records = [ /* 你的 JSON 数据 */ ];
localStorage.setItem('investData', JSON.stringify(records));
```

4. 刷新页面

## 技术支持

如果在升级过程中遇到问题：

1. 检查浏览器控制台是否有错误信息
2. 检查后端服务日志（`server.log`）
3. 参考 `README.md` 中的故障排查章节
4. 提交 Issue 获取帮助

## 升级检查清单

- [ ] 备份 V9 数据（localStorage）
- [ ] 导出为 CSV 格式
- [ ] 安装 V10 依赖（npm install）
- [ ] 启动后端服务（npm start）
- [ ] 导入数据到 V10
- [ ] 恢复 AI 配置
- [ ] 验证数据完整性
- [ ] 测试所有功能
- [ ] 删除 V9 版本（可选）

## 升级后的优势

✅ **多端访问**: 不再局限于单个浏览器
✅ **数据安全**: 数据库存储更可靠
✅ **批量操作**: CSV 导入导出更方便
✅ **性能提升**: 数据库查询更快
✅ **扩展性**: 更容易添加新功能

祝升级顺利！🎉
