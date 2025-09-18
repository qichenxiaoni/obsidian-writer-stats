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
