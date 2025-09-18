/**
 * 验证函数集合
 */

import { CONSTANTS } from './constants';

/**
 * 验证每日目标字数
 * @param value 要验证的值
 * @returns 验证结果
 */
export function validateDailyGoal(value: number): { isValid: boolean; message?: string } {
	if (isNaN(value)) {
		return { isValid: false, message: '请输入有效的数字' };
	}
	
	if (value < CONSTANTS.MIN_DAILY_GOAL) {
		return { isValid: false, message: `最小值为 ${CONSTANTS.MIN_DAILY_GOAL} 字` };
	}
	
	if (value > CONSTANTS.MAX_DAILY_GOAL) {
		return { isValid: false, message: `最大值为 ${CONSTANTS.MAX_DAILY_GOAL} 字` };
	}
	
	return { isValid: true };
}

/**
 * 验证日期字符串格式
 * @param dateString 日期字符串
 * @returns 验证结果
 */
export function validateDateString(dateString: string): { isValid: boolean; message?: string } {
	const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
	if (!dateRegex.test(dateString)) {
		return { isValid: false, message: '日期格式不正确，应为 YYYY-MM-DD' };
	}
	
	const date = new Date(dateString);
	if (isNaN(date.getTime())) {
		return { isValid: false, message: '无效的日期' };
	}
	
	return { isValid: true };
}

/**
 * 验证热力图颜色数组
 * @param colors 颜色数组
 * @returns 验证结果
 */
export function validateHeatmapColors(colors: string[]): { isValid: boolean; message?: string } {
	if (!Array.isArray(colors)) {
		return { isValid: false, message: '颜色配置必须是数组' };
	}
	
	if (colors.length === 0) {
		return { isValid: false, message: '至少需要一种颜色' };
	}
	
	const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
	for (const color of colors) {
		if (!colorRegex.test(color)) {
			return { isValid: false, message: `无效的颜色格式: ${color}` };
		}
	}
	
	return { isValid: true };
}

/**
 * 验证文件名
 * @param fileName 文件名
 * @returns 验证结果
 */
export function validateFileName(fileName: string): { isValid: boolean; message?: string } {
	if (!fileName || fileName.trim().length === 0) {
		return { isValid: false, message: '文件名不能为空' };
	}
	
	// 检查文件名长度
	if (fileName.length > 255) {
		return { isValid: false, message: '文件名过长' };
	}
	
	// 检查非法字符
	const invalidChars = /[<>:"/\\|?*]/;
	if (invalidChars.test(fileName)) {
		return { isValid: false, message: '文件名包含非法字符' };
	}
	
	return { isValid: true };
}

/**
 * 验证统计数据
 * @param stats 统计数据
 * @returns 验证结果
 */
export function validateStats(stats: any): { isValid: boolean; message?: string } {
	if (!stats || typeof stats !== 'object') {
		return { isValid: false, message: '统计数据格式不正确' };
	}
	
	const requiredFields = ['date', 'chinese', 'english', 'punctuation', 'numbers', 'spaces', 'words', 'total', 'goal', 'completed'];
	for (const field of requiredFields) {
		if (!(field in stats)) {
			return { isValid: false, message: `缺少必要字段: ${field}` };
		}
	}
	
	// 验证数值字段
	const numericFields = ['chinese', 'english', 'punctuation', 'numbers', 'spaces', 'words', 'total', 'goal'];
	for (const field of numericFields) {
		if (typeof stats[field] !== 'number' || isNaN(stats[field]) || stats[field] < 0) {
			return { isValid: false, message: `字段 ${field} 必须是有效的非负数` };
		}
	}
	
	// 验证布尔字段
	if (typeof stats.completed !== 'boolean') {
		return { isValid: false, message: 'completed 字段必须是布尔值' };
	}
	
	return { isValid: true };
}

