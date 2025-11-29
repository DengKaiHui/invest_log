# 🔧 故障排除指南

## 常见问题与解决方案

---

## ❌ 问题 1: Yahoo Finance 403 错误

### 错误信息
```
Failed to get crumb, status 403, statusText: Forbidden
```

### 原因
Yahoo Finance API 有时会触发反爬虫机制，返回 403 错误。这通常是临时的限流措施。

### 解决方案

#### ✅ 方案 1: 等待重试（已自动实现）
系统已内置智能重试机制：
- 自动重试 2 次
- 每次重试间隔递增（3秒、6秒）
- 使用多种 API 方法（quote → quoteSummary → Web API）

**无需手动操作，系统会自动处理！**

#### ✅ 方案 2: 使用缓存
```javascript
// 优先使用缓存，避免频繁请求
// 前端会自动优先使用 30 分钟内的缓存数据
```

**建议：不要频繁点击"刷新价格"按钮**

#### ✅ 方案 3: 增加重试间隔
如果 403 错误持续出现，可以修改 `server.js`：

```javascript
// 找到这一行（约第 110 行）
async function fetchStockPrice(symbol, retries = 2) {

// 改为
async function fetchStockPrice(symbol, retries = 3) {

// 并增加等待时间（约第 170 行）
const waitTime = (attempt + 1) * 3; // 改为 5 或更大
```

#### ✅ 方案 4: 更新 yahoo-finance2
```bash
npm update yahoo-finance2
```

#### ✅ 方案 5: 使用代理（高级）
如果你有代理服务器：

```javascript
// 在 server.js 顶部添加
import { HttpsProxyAgent } from 'https-proxy-agent';

// 配置 yahoo-finance2
yahooFinance.setGlobalConfig({
    validation: {
        logErrors: false,
        logOptionsErrors: false
    },
    fetchOptions: {
        agent: new HttpsProxyAgent('http://your-proxy:port')
    }
});
```

---

## ❌ 问题 2: 无法连接到价格服务

### 错误信息
```
价格更新失败，请确保后端服务已启动
```

### 解决方案

#### 1. 检查后端是否运行
```bash
# 检查服务是否启动
curl http://localhost:3001/api/health

# 如果没有响应，启动服务
npm start
```

#### 2. 检查端口占用
```bash
# macOS/Linux
lsof -i :3001

# 如果端口被占用，修改端口号
# 编辑 server.js
const PORT = 3002; // 改为其他端口

# 同时修改 src/utils/api.js
const API_BASE_URL = 'http://localhost:3002/api';
```

#### 3. 检查防火墙
确保防火墙允许本地 3001 端口访问。

---

## ❌ 问题 3: 价格显示为 "--"

### 原因
- 股票代码错误
- 该股票在 Yahoo Finance 没有数据
- 网络问题

### 解决方案

#### 1. 确认股票代码
使用 Yahoo Finance 官网查询正确的代码：
- 访问 https://finance.yahoo.com
- 搜索股票
- 使用显示的代码（如 AAPL, NVDA）

#### 2. 测试单个股票
```bash
curl http://localhost:3001/api/price/AAPL
```

#### 3. 查看后端日志
后端控制台会显示详细的错误信息。

---

## ❌ 问题 4: 批量获取很慢

### 原因
为避免被限流，系统在每个股票请求之间添加了延迟。

### 这是正常的！

- 10 个股票约需 10-15 秒
- 使用缓存后，响应时间 < 1 秒

### 优化建议
1. 添加记录后一次性刷新，不要每次都刷新
2. 依赖自动刷新机制
3. 使用缓存（30分钟内无需重新获取）

---

## ❌ 问题 5: 缓存没有生效

### 检查缓存状态
```bash
curl http://localhost:3001/api/cache/status
```

### 清除并重建缓存
```bash
# 清除缓存
curl -X DELETE http://localhost:3001/api/cache

# 重新获取
# 在网页上点击"刷新价格"
```

---

## ❌ 问题 6: 依赖安装失败

### 错误信息
```
npm ERR! code ERESOLVE
```

### 解决方案

#### 方案 1: 清理并重装
```bash
rm -rf node_modules package-lock.json
npm install
```

#### 方案 2: 使用 --legacy-peer-deps
```bash
npm install --legacy-peer-deps
```

#### 方案 3: 使用指定版本
```bash
npm install express@4.18.2 cors@2.8.5 yahoo-finance2@2.11.3
```

---

## ❌ 问题 7: 前端无法访问后端（CORS）

### 错误信息
```
Access to fetch at 'http://localhost:3001' from origin 'http://localhost:8000' 
has been blocked by CORS policy
```

### 解决方案

#### 1. 确认 CORS 已启用
`server.js` 应该有：
```javascript
import cors from 'cors';
app.use(cors());
```

#### 2. 重启后端服务
```bash
# Ctrl+C 停止服务
npm start
```

#### 3. 清除浏览器缓存
- 打开开发者工具
- 右键刷新按钮
- 选择"清空缓存并硬性重新加载"

---

## ❌ 问题 8: 持仓盈亏计算不准确

### 检查点

#### 1. 确认价格已更新
看"最后更新"时间是否是最近的。

#### 2. 确认输入数据正确
- 总金额和单价是否正确
- 股数是否正确（总金额 / 单价）

#### 3. 刷新价格
点击"刷新价格"按钮获取最新价格。

---

## 🔍 调试技巧

### 1. 查看后端日志
后端控制台会显示所有请求和错误：
```
正在获取 NVDA 的价格...
✓ NVDA 价格: $485.32
```

### 2. 查看浏览器控制台
前端控制台会显示 API 调用：
```javascript
// 打开开发者工具 -> Console
// 查看 API 请求和响应
```

### 3. 使用测试脚本
```bash
npm test
```

### 4. 手动测试 API
```bash
# 健康检查
curl http://localhost:3001/api/health

# 获取价格
curl http://localhost:3001/api/price/NVDA

# 查看缓存
curl http://localhost:3001/api/cache/status
```

### 5. 检查网络连接
```bash
# 测试是否能访问 Yahoo Finance
curl -I https://finance.yahoo.com
```

---

## 📊 Yahoo Finance API 限制说明

### 限制情况
- **频率限制**: 短时间内大量请求可能触发 403
- **IP 限制**: 同一 IP 过多请求可能被暂时封禁
- **时间限制**: 通常持续几分钟到几小时

### 最佳实践
1. ✅ 使用缓存（30分钟）
2. ✅ 避免频繁刷新
3. ✅ 批量请求加延迟
4. ✅ 依赖自动刷新
5. ❌ 不要在短时间内多次点击刷新

---

## 🆘 仍然无法解决？

### 收集信息
1. 操作系统版本
2. Node.js 版本（`node -v`）
3. npm 版本（`npm -v`）
4. 错误的完整信息
5. 后端控制台输出
6. 浏览器控制台输出

### 临时解决方案
使用前端直接调用（不经过后端）：

编辑 `src/utils/api.js`，临时改回原来的方法：
```javascript
export async function fetchStockPrice(symbol) {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });
        const data = await response.json();
        // ... 解析数据
    } catch (error) {
        console.error(error);
    }
}
```

---

## 📝 报告问题

如果上述方法都无法解决，请提供：

1. **问题描述**
   - 详细的错误信息
   - 复现步骤

2. **环境信息**
   ```bash
   node -v
   npm -v
   # 操作系统
   ```

3. **日志输出**
   - 后端控制台完整输出
   - 浏览器控制台截图

4. **已尝试的解决方案**
   - 列出你已经尝试过的方法

---

## ✅ 预防措施

### 1. 合理使用
- 不要频繁刷新（依赖缓存和自动刷新）
- 添加记录后批量刷新一次

### 2. 监控服务
```bash
# 定期检查服务状态
curl http://localhost:3001/api/health

# 查看缓存情况
curl http://localhost:3001/api/cache/status
```

### 3. 保持更新
```bash
# 定期更新依赖
npm update
```

### 4. 备份数据
- 浏览器 LocalStorage 数据会保存
- 定期导出重要记录

---

**最后更新**: 2025-11-29  
**适用版本**: v2.0.0+
