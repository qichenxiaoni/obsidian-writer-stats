/**
 * 简化的缓存服务 - 专注于字数统计优化
 */

import { CONSTANTS } from '../utils';

interface CacheItem<T> {
	value: T;
	timestamp: number;
	ttl: number;
	accessCount: number; // 添加访问计数
	lastAccess: number;  // 最后访问时间
}

interface CacheStats {
	hits: number;
	misses: number;
	totalRequests: number;
	hitRate: number;
	itemCount: number;
}

interface CacheConfig {
	maxSize: number;
	defaultTTL: number;
}

export class CacheService {
	private cache = new Map<string, CacheItem<any>>();
	private stats: CacheStats = {
		hits: 0,
		misses: 0,
		totalRequests: 0,
		hitRate: 0,
		itemCount: 0
	};
	
	private config: CacheConfig = {
		maxSize: CONSTANTS.MAX_CACHE_ITEMS,
		defaultTTL: CONSTANTS.CACHE_TTL
	};

	constructor(config?: Partial<CacheConfig>) {
		if (config) {
			this.config = { ...this.config, ...config };
		}
	}

	/**
	 * 设置缓存
	 * @param key 缓存键
	 * @param value 缓存值
	 * @param ttl 生存时间（毫秒），默认使用配置中的值
	 */
	set<T>(key: string, value: T, ttl: number = this.config.defaultTTL): void {
		// 检查是否需要清理空间
		this.ensureCapacity();
		
		const now = Date.now();
		
		// 创建缓存项
		const item: CacheItem<T> = {
			value,
			timestamp: now,
			ttl,
			accessCount: 1,
			lastAccess: now
		};
		
		this.cache.set(key, item);
		this.updateStats();
	}

	/**
	 * 获取缓存
	 * @param key 缓存键
	 * @returns 缓存值或undefined
	 */
	get<T>(key: string): T | undefined {
		this.stats.totalRequests++;
		
		const item = this.cache.get(key);
		if (!item) {
			this.stats.misses++;
			this.updateHitRate();
			return undefined;
		}

		const now = Date.now();
		
		// 检查是否过期
		if (now - item.timestamp > item.ttl) {
			this.cache.delete(key);
			this.stats.misses++;
			this.updateHitRate();
			return undefined;
		}

		// 更新访问信息（LRU策略）
		item.accessCount++;
		item.lastAccess = now;
		
		this.stats.hits++;
		this.updateHitRate();
		this.updateStats();
		
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
		if (Date.now() - item.timestamp > item.ttl) {
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
		if (this.cache.has(key)) {
			this.cache.delete(key);
			this.updateStats();
		}
	}

	/**
	 * 清空所有缓存
	 */
	clear(): void {
		this.cache.clear();
		this.resetStats();
	}

	/**
	 * 清理过期的缓存
	 */
	cleanup(): void {
		const now = Date.now();
		const keysToDelete: string[] = [];
		
		for (const [key, item] of this.cache.entries()) {
			if (now - item.timestamp > item.ttl) {
				keysToDelete.push(key);
			}
		}
		
		keysToDelete.forEach(key => {
			this.cache.delete(key);
		});
		
		this.updateStats();
	}

	/**
	 * 获取缓存统计信息
	 */
	getStats(): CacheStats {
		this.updateStats();
		return { ...this.stats };
	}

	/**
	 * 获取缓存配置
	 */
	getConfig(): CacheConfig {
		return { ...this.config };
	}

	/**
	 * 更新缓存配置
	 */
	updateConfig(newConfig: Partial<CacheConfig>): void {
		this.config = { ...this.config, ...newConfig };
		
		// 如果新的最大大小更小，触发清理
		if (newConfig.maxSize && newConfig.maxSize < this.cache.size) {
			this.cleanup();
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

	/**
	 * 确保缓存容量 - 改进的LRU策略
	 */
	private ensureCapacity(): void {
		if (this.cache.size >= this.config.maxSize) {
			// 智能清理策略：优先删除最少使用且最久未访问的项目
			let targetKey: string | null = null;
			let lowestScore = Number.MAX_SAFE_INTEGER;
			const now = Date.now();
			
			for (const [key, item] of this.cache.entries()) {
				// 计算综合分数：访问频率 + 最近访问时间
				const timeSinceLastAccess = now - item.lastAccess;
				const frequency = item.accessCount;
				
				// 分数越低越应该被删除
				const score = frequency * 1000 - timeSinceLastAccess;
				
				if (score < lowestScore) {
					lowestScore = score;
					targetKey = key;
				}
			}
			
			if (targetKey) {
				this.cache.delete(targetKey);
			}
		}
	}

	/**
	 * 更新命中率
	 */
	private updateHitRate(): void {
		this.stats.hitRate = this.stats.totalRequests > 0 
			? (this.stats.hits / this.stats.totalRequests) * 100 
			: 0;
	}

	/**
	 * 更新统计信息
	 */
	private updateStats(): void {
		this.stats.itemCount = this.cache.size;
	}

	/**
	 * 重置统计信息
	 */
	private resetStats(): void {
		this.stats = {
			hits: 0,
			misses: 0,
			totalRequests: 0,
			hitRate: 0,
			itemCount: 0
		};
	}
}

