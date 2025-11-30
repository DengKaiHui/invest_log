#!/bin/bash

# 投资看板 V10 开发环境启动脚本

echo "🚀 启动投资看板 V10..."
echo ""

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js"
    echo "请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

# 检查依赖是否安装
if [ ! -d "node_modules" ]; then
    echo "📦 正在安装依赖..."
    npm install
    echo ""
fi

# 创建数据目录
mkdir -p data

echo "📡 启动后端服务 (http://localhost:3001)..."
echo ""

# 启动后端服务
node server.js
