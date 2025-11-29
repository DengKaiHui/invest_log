/**
 * API 调用工具
 */

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

// 后端API基础地址
const API_BASE_URL = 'http://localhost:3001/api';

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