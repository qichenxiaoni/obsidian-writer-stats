/**
 * 内存管理服务 - 监控和优化内存使用
 */

import { DailyStats, CharChange } from '../types';

export interface MemoryConfig {
	warningThreshold: number; // 警告阈值（字节）
	dangerThreshold: number;  // 危险阈值（字节）
	maxCharChanges: number;   // 最大字符变化记录数
	maxCacheItems: number;    // 最大缓存项数
}

export interface MemoryReport {
	currentUsage: {
		dailyStatsSize: number;
		charChangesSize: number;
		totalEstimated: number;
	};
	thresholdCheck: {
		isWarning: boolean;
		isDanger: boolean;
	};
	recommendations: string[];
}

export class MemoryManager {
	private config: MemoryConfig;

	constructor(config: MemoryConfig) {
		this.config = config;
	}

	/**
	 * 获取内存使用报告
	 */
	getMemoryReport(dailyStats: Map<string, DailyStats>): MemoryReport {
		const usage = this.calculateMemoryUsage(dailyStats);
		const thresholdCheck = this.checkThresholds(usage.totalEstimated);
		const recommendations = this.generateRecommendations(usage, thresholdCheck);

		return {
			currentUsage: usage,
			thresholdCheck,
			recommendations
		};
	}

	/**
	 * 计算内存使用量
	 */
	private calculateMemoryUsage(dailyStats: Map<string, DailyStats>) {
		let dailyStatsSize = 0;
		let charChangesSize = 0;

		for (const stats of dailyStats.values()) {
			// 估算每日统计数据的大小
			dailyStatsSize += this.estimateObjectSize(stats, ['charChanges']);
			
			// 估算字符变化记录的大小
			if (stats.charChanges) {
				charChangesSize += this.estimateArraySize(stats.charChanges);
			}
		}

		return {
			dailyStatsSize,
			charChangesSize,
			totalEstimated: dailyStatsSize + charChangesSize
		};
	}

	/**
	 * 检查阈值
	 */
	private checkThresholds(totalSize: number) {
		return {
			isWarning: totalSize > this.config.warningThreshold,
			isDanger: totalSize > this.config.dangerThreshold
		};
	}

	/**
	 * 生成优化建议
	 */
	private generateRecommendations(usage: any, thresholdCheck: any): string[] {
		const recommendations: string[] = [];

		if (thresholdCheck.isDanger) {
			recommendations.push('内存使用过高，建议立即清理数据');
			recommendations.push('删除超过30天的字符变化记录');
			recommendations.push('限制每日字符变化记录数量');
		} else if (thresholdCheck.isWarning) {
			recommendations.push('内存使用较高，建议定期清理');
			recommendations.push('考虑压缩历史数据');
		}

		if (usage.charChangesSize > usage.dailyStatsSize * 0.5) {
			recommendations.push('字符变化记录占用过多内存，建议减少保存数量');
		}

		if (recommendations.length === 0) {
			recommendations.push('内存使用正常');
		}

		return recommendations;
	}

	/**
	 * 估算对象大小（字节）
	 */
	private estimateObjectSize(obj: any, excludeKeys: string[] = []): number {
		// 简单的内存估算，基于JSON字符串长度
		const filteredObj = { ...obj };
		excludeKeys.forEach(key => delete filteredObj[key]);
		return JSON.stringify(filteredObj).length * 2; // 乘以2估算实际内存占用
	}

	/**
	 * 估算数组大小（字节）
	 */
	private estimateArraySize(arr: any[]): number {
		return JSON.stringify(arr).length * 2; // 乘以2估算实际内存占用
	}

	/**
	 * 清理过期的字符变化记录
	 */
	cleanupOldCharChanges(charChanges: CharChange[], maxAge: number): CharChange[] {
		const cutoffTime = Date.now() - maxAge;
		return charChanges.filter(change => change.timestamp > cutoffTime);
	}

	/**
	 * 限制字符变化记录数量
	 */
	limitCharChanges(charChanges: CharChange[]): CharChange[] {
		if (charChanges.length <= this.config.maxCharChanges) {
			return charChanges;
		}
		
		// 保留最新的记录
		return charChanges.slice(-this.config.maxCharChanges);
	}

	/**
	 * 执行内存清理
	 */
	performCleanup(dailyStats: Map<string, DailyStats>): {
		cleaned: number;
		sizeBefore: number;
		sizeAfter: number;
	} {
		const sizeBefore = this.calculateMemoryUsage(dailyStats).totalEstimated;
		let cleanedItems = 0;

		for (const [date, stats] of dailyStats) {
			if (stats.charChanges) {
				const originalLength = stats.charChanges.length;
				
				// 清理过期记录
				stats.charChanges = this.cleanupOldCharChanges(
					stats.charChanges, 
					30 * 24 * 60 * 60 * 1000 // 30天
				);
				
				// 限制数量
				stats.charChanges = this.limitCharChanges(stats.charChanges);
				
				cleanedItems += originalLength - stats.charChanges.length;
			}
		}

		const sizeAfter = this.calculateMemoryUsage(dailyStats).totalEstimated;

		return {
			cleaned: cleanedItems,
			sizeBefore,
			sizeAfter
		};
	}

	/**
	 * 获取内存使用摘要
	 */
	getMemorySummary(dailyStats: Map<string, DailyStats>): string {
		const usage = this.calculateMemoryUsage(dailyStats);
		const mb = (usage.totalEstimated / (1024 * 1024)).toFixed(2);
		
		return `内存使用: ${mb}MB (每日统计: ${(usage.dailyStatsSize / 1024).toFixed(1)}KB, 变化记录: ${(usage.charChangesSize / 1024).toFixed(1)}KB)`;
	}

	/**
	 * 更新配置
	 */
	updateConfig(newConfig: Partial<MemoryConfig>): void {
		this.config = { ...this.config, ...newConfig };
	}
}