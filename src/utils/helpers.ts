/**
 * 工具函数集合
 */

import { CONSTANTS } from './constants';

/**
 * 防抖函数
 * @param func 要防抖的函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
	func: T,
	delay: number
): (...args: Parameters<T>) => void {
	let timeoutId: NodeJS.Timeout;
	return (...args: Parameters<T>) => {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => func(...args), delay);
	};
}

/**
 * 节流函数
 * @param func 要节流的函数
 * @param delay 延迟时间（毫秒）
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: any[]) => any>(
	func: T,
	delay: number
): (...args: Parameters<T>) => void {
	let lastCall = 0;
	return (...args: Parameters<T>) => {
		const now = Date.now();
		if (now - lastCall >= delay) {
			lastCall = now;
			func(...args);
		}
	};
}

/**
 * 获取今天的日期字符串 (YYYY-MM-DD)
 * @returns 日期字符串
 */
export function getTodayString(): string {
	return new Date().toISOString().split('T')[0];
}

/**
 * 计算两个日期之间的天数差
 * @param date1 第一个日期
 * @param date2 第二个日期
 * @returns 天数差
 */
export function getDaysDifference(date1: string, date2: string): number {
	const d1 = new Date(date1);
	const d2 = new Date(date2);
	return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * 验证数字是否在指定范围内
 * @param value 要验证的值
 * @param min 最小值
 * @param max 最大值
 * @returns 是否在范围内
 */
export function isInRange(value: number, min: number, max: number): boolean {
	return value >= min && value <= max;
}

/**
 * 限制数字在指定范围内
 * @param value 要限制的值
 * @param min 最小值
 * @param max 最大值
 * @returns 限制后的值
 */
export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/**
 * 格式化数字，添加千位分隔符
 * @param num 要格式化的数字
 * @returns 格式化后的字符串
 */
export function formatNumber(num: number): string {
	return num.toLocaleString();
}

/**
 * 计算百分比
 * @param value 当前值
 * @param total 总值
 * @param decimals 小数位数
 * @returns 百分比字符串
 */
export function calculatePercentage(value: number, total: number, decimals: number = 1): string {
	if (total === 0) return '0%';
	return `${((value / total) * 100).toFixed(decimals)}%`;
}

/**
 * 生成唯一ID
 * @returns 唯一ID字符串
 */
export function generateId(): string {
	return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * 深度克隆对象
 * @param obj 要克隆的对象
 * @returns 克隆后的对象
 */
export function deepClone<T>(obj: T): T {
	if (obj === null || typeof obj !== 'object') return obj;
	if (obj instanceof Date) return new Date(obj.getTime()) as any;
	if (obj instanceof Array) return obj.map(item => deepClone(item)) as any;
	if (typeof obj === 'object') {
		const clonedObj = {} as any;
		for (const key in obj) {
			if (Object.prototype.hasOwnProperty.call(obj, key)) {
				clonedObj[key] = deepClone(obj[key]);
			}
		}
		return clonedObj;
	}
	return obj;
}

/**
 * 检查字符串是否为空或只包含空白字符
 * @param str 要检查的字符串
 * @returns 是否为空
 */
export function isEmpty(str: string): boolean {
	return !str || str.trim().length === 0;
}

/**
 * 安全地解析JSON字符串
 * @param jsonString JSON字符串
 * @param defaultValue 默认值
 * @returns 解析结果或默认值
 */
export function safeJsonParse<T>(jsonString: string, defaultValue: T): T {
	try {
		return JSON.parse(jsonString);
	} catch {
		return defaultValue;
	}
}

/**
 * 获取本周的日期字符串 (YYYY-WW)
 * @param date 日期对象
 * @returns 周字符串
 */
export function getWeekString(date: Date): string {
	const year = date.getFullYear();
	const week = getWeekNumber(date);
	return `${year}-W${week.toString().padStart(2, '0')}`;
}

/**
 * 获取日期是当年的第几周
 * @param date 日期对象
 * @returns 周数
 */
export function getWeekNumber(date: Date): number {
	const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
	const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
	return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

/**
 * 获取本月的日期字符串 (YYYY-MM)
 * @param date 日期对象
 * @returns 月字符串
 */
export function getMonthString(date: Date): string {
	const year = date.getFullYear();
	const month = (date.getMonth() + 1).toString().padStart(2, '0');
	return `${year}-${month}`;
}

/**
 * 格式化时长显示
 * @param seconds 秒数
 * @returns 格式化的时长字符串
 */
export function formatDuration(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remainingSeconds = seconds % 60;

	if (hours > 0) {
		return `${hours}小时${minutes}分钟`;
	} else if (minutes > 0) {
		return `${minutes}分钟${remainingSeconds}秒`;
	} else {
		return `${remainingSeconds}秒`;
	}
}

/**
 * 格式化效率显示
 * @param efficiency 效率（字数/分钟）
 * @returns 格式化的效率字符串
 */
export function formatEfficiency(efficiency: number): string {
	return `${efficiency.toFixed(1)} 字/分钟`;
}


/**
 * 获取文件路径的文件夹部分
 * @param filePath 文件路径
 * @returns 文件夹路径
 */
export function getFolderPath(filePath: string): string {
	const lastSlashIndex = filePath.lastIndexOf('/');
	return lastSlashIndex === -1 ? '/' : filePath.substring(0, lastSlashIndex);
}

/**
 * 获取文件路径的文件名部分
 * @param filePath 文件路径
 * @returns 文件名
 */
export function getFileName(filePath: string): string {
	const lastSlashIndex = filePath.lastIndexOf('/');
	return lastSlashIndex === -1 ? filePath : filePath.substring(lastSlashIndex + 1);
}

/**
 * 检查时间字符串是否有效
 * @param timeString 时间字符串 (HH:MM)
 * @returns 是否有效
 */
export function isValidTimeString(timeString: string): boolean {
	const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
	return timeRegex.test(timeString);
}
