# 📡 API 文档

股票价格服务 REST API 完整文档

---

## 基础信息

- **Base URL**: `http://localhost:3001/api`
- **Content-Type**: `application/json`
- **CORS**: 已启用，支持跨域请求

---

## 接口列表

### 1. 健康检查

检查服务是否正常运行。

**请求**
```http
GET /api/health
```

**响应示例**
```json
{
  "success": true,
  "status": "running",
  "uptime": 3600,
  "cacheSize": 5,
  "message": "服务运行正常"
}
```

**字段说明**
- `uptime`: 服务运行时间（秒）
- `cacheSize`: 当前缓存项数量

---

### 2. 获取单个股票价格

获取指定股票的最新价格。

**请求**
```http
GET /api/price/:symbol?force=true
```

**路径参数**
- `symbol` (必需): 股票代码，如 `NVDA`, `AAPL`

**查询参数**
- `force` (可选): 是否强制刷新缓存，默认 `false`

**响应示例**
```json
{
  "success": true,
  "symbol": "NVDA",
  "price": 485.32,
  "cached": false,
  "lastUpdate": 1701234567890
}
```

**错误响应**
```json
{
  "success": false,
  "message": "无法获取 INVALID 的价格"
}
```

**示例**
```bash
# 使用缓存（如果有）
curl http://localhost:3001/api/price/NVDA

# 强制刷新
curl http://localhost:3001/api/price/NVDA?force=true
```

---

### 3. 批量获取股票价格

一次性获取多个股票的价格。

**请求**
```http
POST /api/prices
Content-Type: application/json

{
  "symbols": ["NVDA", "AAPL", "TSLA"],
  "force": false
}
```

**请求体参数**
- `symbols` (必需): 股票代码数组
- `force` (可选): 是否强制刷新，默认 `false`

**响应示例**
```json
{
  "success": true,
  "results": {
    "NVDA": {
      "price": 485.32,
      "cached": true,
      "lastUpdate": 1701234567890
    },
    "AAPL": {
      "price": 195.71,
      "cached": false,
      "lastUpdate": 1701234567890
    },
    "TSLA": {
      "price": null,
      "error": "获取失败"
    }
  }
}
```

**示例**
```bash
curl -X POST http://localhost:3001/api/prices \
  -H "Content-Type: application/json" \
  -d '{"symbols":["NVDA","AAPL"],"force":false}'
```

---

### 4. 手动刷新价格

强制刷新指定股票的价格（忽略缓存）。

**请求**
```http
POST /api/refresh
Content-Type: application/json

{
  "symbols": ["NVDA", "AAPL"]
}
```

**请求体参数**
- `symbols` (必需): 股票代码数组

**响应示例**
```json
{
  "success": true,
  "results": {
    "NVDA": {
      "price": 485.32,
      "lastUpdate": 1701234567890
    },
    "AAPL": {
      "price": 195.71,
      "lastUpdate": 1701234567890
    }
  },
  "message": "价格已刷新"
}
```

**示例**
```bash
curl -X POST http://localhost:3001/api/refresh \
  -H "Content-Type: application/json" \
  -d '{"symbols":["NVDA","AAPL"]}'
```

---

### 5. 查看缓存状态

查看所有缓存项的详细状态。

**请求**
```http
GET /api/cache/status
```

**响应示例**
```json
{
  "success": true,
  "cacheExpiry": 30,
  "items": [
    {
      "symbol": "NVDA",
      "price": 485.32,
      "lastUpdate": 1701234567890,
      "age": 600,
      "valid": true
    },
    {
      "symbol": "AAPL",
      "price": 195.71,
      "lastUpdate": 1701232000000,
      "age": 1800,
      "valid": false
    }
  ]
}
```

**字段说明**
- `cacheExpiry`: 缓存过期时间（分钟）
- `age`: 缓存年龄（秒）
- `valid`: 是否仍然有效

**示例**
```bash
curl http://localhost:3001/api/cache/status
```

---

### 6. 清除缓存

清除所有缓存项。

**请求**
```http
DELETE /api/cache
```

**响应示例**
```json
{
  "success": true,
  "message": "已清除 5 个缓存项"
}
```

**示例**
```bash
curl -X DELETE http://localhost:3001/api/cache
```

---

## 状态码说明

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 404 | 资源未找到（股票不存在） |
| 500 | 服务器内部错误 |

---

## 错误处理

所有错误响应都遵循以下格式：

```json
{
  "success": false,
  "message": "错误描述信息"
}
```

---

## 限流策略

为避免被 Yahoo Finance API 限流，系统实现了智能限流：

- **批量获取**: 每个股票间隔 100ms
- **手动刷新**: 每个股票间隔 200ms
- **自动刷新**: 后台任务，不影响主请求

---

## 缓存策略

### 缓存时间
- **默认**: 30 分钟
- **可配置**: 修改 `server.js` 中的 `CACHE_EXPIRY`

### 缓存逻辑
1. 请求到达时先检查缓存
2. 缓存有效 → 立即返回
3. 缓存过期 → 请求 Yahoo Finance → 更新缓存
4. 后台定时任务每 5 分钟检查并更新过期缓存

### 缓存优先级
- `force=true` → 强制刷新，忽略缓存
- `force=false` → 优先使用缓存

---

## 使用建议

### 📌 首次加载
使用 `/api/prices`，不设置 `force`，优先使用缓存：
```javascript
fetch('/api/prices', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    symbols: ['NVDA', 'AAPL'],
    force: false 
  })
})
```

### 📌 用户点击刷新
使用 `/api/refresh`，强制获取最新数据：
```javascript
fetch('/api/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    symbols: ['NVDA', 'AAPL'] 
  })
})
```

### 📌 监控系统状态
定期检查健康状态和缓存状态：
```javascript
// 健康检查
fetch('/api/health')

// 缓存状态
fetch('/api/cache/status')
```

---

## 集成示例

### JavaScript/Fetch
```javascript
async function getStockPrice(symbol) {
  try {
    const response = await fetch(`http://localhost:3001/api/price/${symbol}`);
    const data = await response.json();
    if (data.success) {
      console.log(`${symbol}: $${data.price}`);
      return data.price;
    }
  } catch (error) {
    console.error('获取价格失败:', error);
  }
}

getStockPrice('NVDA');
```

### Python/Requests
```python
import requests

def get_stock_price(symbol):
    try:
        response = requests.get(f'http://localhost:3001/api/price/{symbol}')
        data = response.json()
        if data['success']:
            print(f"{symbol}: ${data['price']}")
            return data['price']
    except Exception as e:
        print(f'获取价格失败: {e}')

get_stock_price('NVDA')
```

### cURL
```bash
# 获取单个股票
curl http://localhost:3001/api/price/NVDA

# 批量获取
curl -X POST http://localhost:3001/api/prices \
  -H "Content-Type: application/json" \
  -d '{"symbols":["NVDA","AAPL","TSLA"]}'

# 刷新价格
curl -X POST http://localhost:3001/api/refresh \
  -H "Content-Type: application/json" \
  -d '{"symbols":["NVDA"]}'
```

---

## 性能指标

### 响应时间
- **缓存命中**: < 10ms
- **API 请求**: 200-500ms
- **批量请求**: (数量 × 100ms) + API 时间

### 并发支持
- 支持多个并发请求
- 自动队列管理
- 智能限流

### 缓存效率
- 30 分钟内重复请求 0 API 调用
- 大幅降低被限流风险
- 显著提升响应速度

---

## 常见问题

### Q: 为什么价格返回 null？
A: 可能原因：
1. 股票代码错误（需要使用 Yahoo Finance 的代码）
2. 网络问题无法访问 Yahoo Finance
3. 该股票不在 Yahoo Finance 数据库中

### Q: 如何知道价格是否来自缓存？
A: 检查响应中的 `cached` 字段：
- `true`: 使用缓存
- `false`: 新获取

### Q: 缓存什么时候会被清除？
A: 
1. 超过 30 分钟自动失效（但不删除）
2. 手动调用 `/api/cache` DELETE 接口
3. 服务重启

### Q: 如何修改缓存时间？
A: 编辑 `server.js`：
```javascript
const CACHE_EXPIRY = 30 * 60 * 1000; // 改为你想要的时间（毫秒）
```

---

## 版本历史

### v1.0.0 (2025-11-29)
- ✅ 初始版本
- ✅ 支持单个/批量获取股票价格
- ✅ 实现 30 分钟缓存机制
- ✅ 支持手动刷新
- ✅ 后台自动更新过期缓存

---

**文档更新时间**: 2025-11-29
