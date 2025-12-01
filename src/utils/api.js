/**
 * API 调用工具
 */

// 后端API基础地址
const API_BASE_URL = 'window.location.origin';

// 获取汇率
export async function fetchExchangeRate() {
    try {
        const response = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await response.json();
        if (data && data.rates && data.rates.CNY) {
            return data.rates.CNY;
        }
        throw new Error('汇率数据格式错误');
    } catch (error) {
        console.error('获取汇率失败:', error);
        throw error;
    }
}

// ================== 交易记录 API ==================

// 获取所有交易记录
export async function fetchAllTransactions() {
    try {
        const response = await fetch(`${API_BASE_URL}/transactions`);
        const data = await response.json();
        
        if (data.success) {
            return data.data;
        }
        throw new Error(data.message || '获取交易记录失败');
    } catch (error) {
        console.error('获取交易记录失败:', error);
        throw error;
    }
}

// 添加交易记录
export async function createTransaction(record) {
    try {
        const response = await fetch(`${API_BASE_URL}/transactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(record)
        });
        
        const data = await response.json();
        
        if (data.success) {
            return data.id;
        }
        throw new Error(data.message || '添加交易记录失败');
    } catch (error) {
        console.error('添加交易记录失败:', error);
        throw error;
    }
}

// 批量添加交易记录
export async function createTransactionsBatch(records) {
    try {
        const response = await fetch(`${API_BASE_URL}/transactions/batch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ records })
        });
        
        const data = await response.json();
        
        if (data.success) {
            return data.count;
        }
        throw new Error(data.message || '批量添加失败');
    } catch (error) {
        console.error('批量添加交易记录失败:', error);
        throw error;
    }
}

// 删除交易记录
export async function deleteTransaction(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/transactions/${id}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            return true;
        }
        throw new Error(data.message || '删除交易记录失败');
    } catch (error) {
        console.error('删除交易记录失败:', error);
        throw error;
    }
}

// 清空所有交易记录
export async function deleteAllTransactions() {
    try {
        const response = await fetch(`${API_BASE_URL}/transactions`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            return data.count;
        }
        throw new Error(data.message || '清空交易记录失败');
    } catch (error) {
        console.error('清空交易记录失败:', error);
        throw error;
    }
}

// ================== CSV 导入导出 API ==================

// 导出 CSV
export async function exportToCSV() {
    try {
        const response = await fetch(`${API_BASE_URL}/export/csv`);
        
        if (!response.ok) {
            throw new Error('导出失败');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `investlog_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        return true;
    } catch (error) {
        console.error('导出 CSV 失败:', error);
        throw error;
    }
}

// 导入 CSV
export async function importFromCSV(file, append = true) {
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('append', append);
        
        const response = await fetch(`${API_BASE_URL}/import/csv`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            return data;
        }
        throw new Error(data.message || '导入失败');
    } catch (error) {
        console.error('导入 CSV 失败:', error);
        throw error;
    }
}

// 验证 CSV
export async function validateCSV(file) {
    try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${API_BASE_URL}/import/csv/validate`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('验证 CSV 失败:', error);
        throw error;
    }
}

// ================== 配置 API ==================

// 获取配置
export async function getConfig(key) {
    try {
        const response = await fetch(`${API_BASE_URL}/config/${key}`);
        const data = await response.json();
        
        if (data.success) {
            return data.data;
        }
        return null;
    } catch (error) {
        console.error('获取配置失败:', error);
        return null;
    }
}

// 保存配置
export async function saveConfig(key, value) {
    try {
        const response = await fetch(`${API_BASE_URL}/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ key, value })
        });
        
        const data = await response.json();
        
        if (data.success) {
            return true;
        }
        throw new Error(data.message || '保存配置失败');
    } catch (error) {
        console.error('保存配置失败:', error);
        throw error;
    }
}

// ================== 股票价格 API ==================

// 获取单个股票价格
export async function fetchStockPrice(symbol, force = false) {
    try {
        const url = `${API_BASE_URL}/price/${symbol}${force ? '?force=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.price) {
            console.log(`${symbol} 价格: $${data.price}${data.cached ? ' (缓存)' : ''}`);
            return data.price;
        }
        
        console.warn(`无法获取 ${symbol} 的价格数据`);
        return null;
    } catch (error) {
        console.error(`获取 ${symbol} 价格失败:`, error);
        return null;
    }
}

// 批量获取股票价格
export async function fetchStockPrices(symbols, force = false) {
    try {
        const response = await fetch(`${API_BASE_URL}/prices`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ symbols, force })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            return data.results;
        }
        
        throw new Error(data.message || '批量获取价格失败');
    } catch (error) {
        console.error('批量获取股票价格失败:', error);
        return null;
    }
}

// 手动刷新价格
export async function refreshStockPrices(symbols) {
    try {
        const response = await fetch(`${API_BASE_URL}/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ symbols })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            return data.results;
        }
        
        throw new Error(data.message || '刷新价格失败');
    } catch (error) {
        console.error('刷新股票价格失败:', error);
        return null;
    }
}

// 获取Gemini模型列表
export async function fetchGeminiModels(baseUrl, apiKey) {
    try {
        const cleanUrl = baseUrl.replace(/\/+$/, '');
        const url = `${cleanUrl}/v1beta/models?key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.models) {
            return data.models
                .filter(m => m.name.includes('gemini'))
                .map(m => m.name.replace('models/', ''));
        }
        return [];
    } catch (error) {
        console.error('获取模型列表失败:', error);
        throw error;
    }
}

// AI图片识别 - Gemini
export async function analyzeImageWithGemini(base64Data, config) {
    const cleanModel = config.model.replace('models/', '').trim();
    const baseUrl = config.geminiBaseUrl.replace(/\/+$/, '');
    const url = `${baseUrl}/v1beta/models/${cleanModel}:generateContent?key=${config.apiKey}`;
    
    const promptText = "Analyze image. Extract investment records: assetName, date (YYYY-MM-DD), totalAmount (number, assume USD), unitPrice (number, assume USD). Return ONLY valid JSON array.";
    
    const payload = {
        contents: [{
            parts: [
                { text: promptText },
                { inline_data: { mime_type: "image/jpeg", data: base64Data } }
            ]
        }]
    };
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    
    return data.candidates[0].content.parts[0].text;
}

// AI图片识别 - OpenAI
export async function analyzeImageWithOpenAI(base64Full, config) {
    const promptText = "Analyze image. Extract investment records: assetName, date (YYYY-MM-DD), totalAmount (number, assume USD), unitPrice (number, assume USD). Return ONLY valid JSON array.";
    
    const payload = {
        model: config.model,
        messages: [{
            role: "user",
            content: [
                { type: "text", text: promptText },
                { type: "image_url", image_url: { url: base64Full } }
            ]
        }]
    };
    
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    return data.choices[0].message.content;
}