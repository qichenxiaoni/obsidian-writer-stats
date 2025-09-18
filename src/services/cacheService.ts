/**
 * 缓存服务
 */

import { CONSTANTS } from '../utils';

interface CacheItem<T> {
	value: T;
	timestamp: number;
}

export class CacheService {
	private cache = new Map<string, CacheItem<any>>();

	/**
	 * 设置缓存
	 * @param key 缓存键
	 * @param value 缓存值
	 * @param ttl 生存时间（毫秒），默认使用常量中的值
	 */
	set<T>(key: string, value: T, ttl: number = CONSTANTS.CACHE_TTL): void {
		this.cache.set(key, {
			value,
			timestamp: Date.now()
		});
	}

	/**
	 * 获取缓存
	 * @param key 缓存键
	 * @returns 缓存值或undefined
	 */
	get<T>(key: string): T | undefined {
		const item = this.cache.get(key);
		if (!item) return undefined;

		// 检查是否过期
		if (Date.now() - item.timestamp > CONSTANTS.CACHE_TTL) {
			this.cache.delete(key);
			return undefined;
		}

		return item.value as T;
	}

	/**
	 * 检查缓存是否存在且未过期
	 * @param key 缓存键
	 * @returns 是否存在
	 */
	has(key: string): boolean {
		const item = this.cache.get(key);
		if (!item) return false;

		// 检查是否过期
		if (Date.now() - item.timestamp > CONSTANTS.CACHE_TTL) {
			this.cache.delete(key);
			return false;
		}

		return true;
	}

	/**
	 * 删除缓存
	 * @param key 缓存键
	 */
	delete(key: string): void {
		this.cache.delete(key);
	}

	/**
	 * 清空所有缓存
	 */
	clear(): void {
		this.cache.clear();
	}

	/**
	 * 清理过期的缓存
	 */
	cleanup(): void {
		const now = Date.now();
		for (const [key, item] of this.cache.entries()) {
			if (now - item.timestamp > CONSTANTS.CACHE_TTL) {
				this.cache.delete(key);
			}
		}
	}

	/**
	 * 获取缓存大小
	 * @returns 缓存项数量
	 */
	size(): number {
		return this.cache.size;
	}

	/**
	 * 获取所有缓存键
	 * @returns 缓存键数组
	 */
	keys(): string[] {
		return Array.from(this.cache.keys());
	}
}

