/**
 * CSV 导入导出处理模块
 */
import csvParser from 'csv-parser';
import { format } from 'fast-csv';
import { Readable } from 'stream';
import { transactionDB } from './database.js';

/**
 * 解析 CSV 内容
 * @param {string} csvContent - CSV 文件内容
 * @returns {Promise<Array>} 解析后的记录数组
 */
export function parseCSV(csvContent) {
    return new Promise((resolve, reject) => {
        const records = [];
        const stream = Readable.from([csvContent]);
        
        stream
            .pipe(csvParser())
            .on('data', (row) => {
                // 验证必填字段
                if (row.name && row.date && row.total && row.price) {
                    const record = {
                        name: row.name.trim(),
                        symbol: row.symbol?.trim() || row.name.trim(),
                        date: row.date.trim(),
                        total: parseFloat(row.total),
                        price: parseFloat(row.price),
                        shares: parseFloat(row.shares) || (parseFloat(row.total) / parseFloat(row.price))
                    };
                    
                    // 验证数值有效性
                    if (!isNaN(record.total) && !isNaN(record.price) && !isNaN(record.shares)) {
                        records.push(record);
                    }
                }
            })
            .on('end', () => {
                resolve(records);
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}

/**
 * 生成 CSV 内容
 * @param {Array} records - 记录数组
 * @returns {Promise<string>} CSV 字符串
 */
export function generateCSV(records) {
    return new Promise((resolve, reject) => {
        const csvRows = [];
        
        const csvStream = format({ headers: true });
        
        csvStream.on('data', (row) => {
            csvRows.push(row);
        });
        
        csvStream.on('end', () => {
            resolve(csvRows.join(''));
        });
        
        csvStream.on('error', (error) => {
            reject(error);
        });
        
        // 写入数据
        records.forEach(record => {
            csvStream.write({
                id: record.id || '',
                name: record.name,
                symbol: record.symbol || record.name,
                date: record.date,
                total: record.total,
                price: record.price,
                shares: record.shares,
                created_at: record.created_at || '',
                updated_at: record.updated_at || ''
            });
        });
        
        csvStream.end();
    });
}

/**
 * 导入 CSV 数据到数据库
 * @param {string} csvContent - CSV 文件内容
 * @param {boolean} append - 是否追加模式（false 为覆盖模式）
 * @returns {Promise<Object>} 导入结果统计
 */
export async function importCSV(csvContent, append = true) {
    try {
        // 解析 CSV
        const records = await parseCSV(csvContent);
        
        if (records.length === 0) {
            throw new Error('CSV 文件中没有有效的数据记录');
        }
        
        // 如果是覆盖模式，先清空现有数据
        let deletedCount = 0;
        if (!append) {
            deletedCount = transactionDB.deleteAll();
        }
        
        // 批量插入记录
        const insertedCount = transactionDB.createBatch(records);
        
        return {
            success: true,
            imported: insertedCount,
            deleted: deletedCount,
            mode: append ? 'append' : 'replace'
        };
    } catch (error) {
        throw new Error(`CSV 导入失败: ${error.message}`);
    }
}

/**
 * 导出数据库数据为 CSV
 * @returns {Promise<string>} CSV 字符串
 */
export async function exportCSV() {
    try {
        // 从数据库获取所有记录
        const records = transactionDB.getAll();
        
        if (records.length === 0) {
            throw new Error('没有可导出的数据');
        }
        
        // 生成 CSV
        const csv = await generateCSV(records);
        
        return csv;
    } catch (error) {
        throw new Error(`CSV 导出失败: ${error.message}`);
    }
}

/**
 * 验证 CSV 格式
 * @param {string} csvContent - CSV 文件内容
 * @returns {Promise<Object>} 验证结果
 */
export async function validateCSV(csvContent) {
    try {
        const records = await parseCSV(csvContent);
        
        return {
            valid: true,
            recordCount: records.length,
            records: records.slice(0, 5), // 返回前5条预览
            message: `发现 ${records.length} 条有效记录`
        };
    } catch (error) {
        return {
            valid: false,
            recordCount: 0,
            message: error.message
        };
    }
}
