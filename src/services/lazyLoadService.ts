/**
 * 懒加载服务 - 按需加载历史数据以优化性能
 */

import { DailyStats } from '../types';
import { getTodayString, CONSTANTS } from '../utils';

export interface LazyLoadConfig {
	initialDays: number;    // 初始加载天数
	incrementDays: number;  // 增量加载天数
	maxDays: number;        // 最大加载天数
	preloadDays: number;    // 预加载天数
}

export interface LoadResult {
	loaded: DailyStats[];
	hasMore: boolean;
	totalAvailable: number;
}

export class LazyLoadService {
	private config: LazyLoadConfig;
	private loadedDays = new Set<string>();
	private allAvailableDays: string[] = [];
	private dataUpdateCallbacks: Array<(data: Map<string, DailyStats>) => void> = [];

	constructor(config?: Partial<LazyLoadConfig>) {
		this.config = {
			initialDays: CONSTANTS.LAZY_LOAD_INITIAL_DAYS,
			incrementDays: CONSTANTS.LAZY_LOAD_INCREMENT_DAYS,
			maxDays: CONSTANTS.LAZY_LOAD_MAX_DAYS,
			preloadDays: CONSTANTS.LAZY_LOAD_PRELOAD_DAYS,
			...config
		};
	}

	/**
	 * 初始化 - 获取所有可用的日期
	 */
	async initialize(getAllAvailableDays: () => Promise<string[]>): Promise<void> {
		this.allAvailableDays = await getAllAvailableDays();
		this.allAvailableDays.sort().reverse(); // 最新的在前
	}

	/**
	 * 初始加载 - 加载最近的数据
	 */
	async loadInitial(
		loadDataFunction: (dates: string[]) => Promise<DailyStats[]>
	): Promise<LoadResult> {
		const today = getTodayString();
		const targetDates = this.getDateRange(today, this.config.initialDays);
		
		const availableDates = this.getAvailableDates(targetDates);
		const loaded = await loadDataFunction(availableDates);
		
		// 记录已加载的日期
		availableDates.forEach(date => this.loadedDays.add(date));
		
		// 通知数据更新
		if (loaded.length > 0) {
			this.notifyDataUpdate(loaded);
		}
		
		return {
			loaded,
			hasMore: this.hasMoreData(),
			totalAvailable: this.allAvailableDays.length
		};
	}

	/**
	 * 增量加载 - 加载更多历史数据
	 */
	async loadMore(
		loadDataFunction: (dates: string[]) => Promise<DailyStats[]>
	): Promise<LoadResult> {
		if (!this.hasMoreData()) {
			return {
				loaded: [],
				hasMore: false,
				totalAvailable: this.allAvailableDays.length
			};
		}

		// 找到下一批要加载的日期
		const nextDates = this.getNextDatesToLoad();
		const loaded = await loadDataFunction(nextDates);
		
		// 记录已加载的日期
		nextDates.forEach(date => this.loadedDays.add(date));
		
		// 通知数据更新
		if (loaded.length > 0) {
			this.notifyDataUpdate(loaded);
		}
		
		return {
			loaded,
			hasMore: this.hasMoreData(),
			totalAvailable: this.allAvailableDays.length
		};
	}

	/**
	 * 预加载 - 在后台预加载数据
	 */
	async preload(
		loadDataFunction: (dates: string[]) => Promise<DailyStats[]>
	): Promise<DailyStats[]> {
		const preloadDates = this.getPreloadDates();
		
		if (preloadDates.length === 0) {
			return [];
		}

		try {
			const loaded = await loadDataFunction(preloadDates);
			preloadDates.forEach(date => this.loadedDays.add(date));
			return loaded;
		} catch (error) {
			console.warn('预加载失败:', error);
			return [];
		}
	}

	/**
	 * 获取日期范围
	 */
	private getDateRange(startDate: string, days: number): string[] {
		const dates: string[] = [];
		const start = new Date(startDate);
		
		for (let i = 0; i < days; i++) {
			const date = new Date(start);
			date.setDate(start.getDate() - i);
			dates.push(date.toISOString().split('T')[0]);
		}
		
		return dates;
	}

	/**
	 * 获取可用的日期（存在于allAvailableDays中）
	 */
	private getAvailableDates(targetDates: string[]): string[] {
		return targetDates.filter(date => 
			this.allAvailableDays.includes(date) && 
			!this.loadedDays.has(date)
		);
	}

	/**
	 * 获取下一批要加载的日期
	 */
	private getNextDatesToLoad(): string[] {
		const unloadedDates = this.allAvailableDays.filter(date => 
			!this.loadedDays.has(date)
		);
		
		return unloadedDates.slice(0, this.config.incrementDays);
	}

	/**
	 * 获取预加载的日期
	 */
	private getPreloadDates(): string[] {
		const unloadedDates = this.allAvailableDays.filter(date => 
			!this.loadedDays.has(date)
		);
		
		return unloadedDates.slice(0, this.config.preloadDays);
	}

	/**
	 * 检查是否还有更多数据可以加载
	 */
	hasMoreData(): boolean {
		if (this.loadedDays.size >= this.config.maxDays) {
			return false;
		}
		
		return this.allAvailableDays.some(date => !this.loadedDays.has(date));
	}

	/**
	 * 获取加载统计信息
	 */
	getLoadStats(): {
		loaded: number;
		available: number;
		canLoadMore: boolean;
		loadedPercentage: number;
	} {
		const loaded = this.loadedDays.size;
		const available = this.allAvailableDays.length;
		
		return {
			loaded,
			available,
			canLoadMore: this.hasMoreData(),
			loadedPercentage: available > 0 ? (loaded / available) * 100 : 0
		};
	}

	/**
	 * 检查特定日期是否已加载
	 */
	isDateLoaded(date: string): boolean {
		return this.loadedDays.has(date);
	}

	/**
	 * 获取已加载的日期列表
	 */
	getLoadedDates(): string[] {
		return Array.from(this.loadedDays).sort().reverse();
	}

	/**
	 * 清除加载记录（用于重置）
	 */
	reset(): void {
		this.loadedDays.clear();
		this.allAvailableDays = [];
	}

	/**
	 * 更新配置
	 */
	updateConfig(newConfig: Partial<LazyLoadConfig>): void {
		this.config = { ...this.config, ...newConfig };
	}

	/**
	 * 获取配置
	 */
	getConfig(): LazyLoadConfig {
		return { ...this.config };
	}

	/**
	 * 智能预测下次需要的数据
	 */
	predictNextLoad(): string[] {
		// 基于访问模式预测下次可能需要的数据
		// 这里实现一个简单的预测逻辑
		
		const recentLoaded = Array.from(this.loadedDays)
			.sort()
			.slice(-7); // 最近7天
		
		if (recentLoaded.length === 0) {
			return [];
		}

		// 预测下一周的数据
		const lastDate = new Date(recentLoaded[recentLoaded.length - 1]);
		const predictedDates: string[] = [];
		
		for (let i = 1; i <= 7; i++) {
			const nextDate = new Date(lastDate);
			nextDate.setDate(lastDate.getDate() - i);
			const dateString = nextDate.toISOString().split('T')[0];
			
			if (this.allAvailableDays.includes(dateString) && 
				!this.loadedDays.has(dateString)) {
				predictedDates.push(dateString);
			}
		}
		
		return predictedDates;
	}

	/**
	 * 注册数据更新回调
	 */
	onDataUpdate(callback: (data: Map<string, DailyStats>) => void): void {
		this.dataUpdateCallbacks.push(callback);
	}

	/**
	 * 触发数据更新通知
	 */
	private notifyDataUpdate(data: DailyStats[]): void {
		const dataMap = new Map<string, DailyStats>();
		data.forEach(stats => dataMap.set(stats.date, stats));
		
		this.dataUpdateCallbacks.forEach(callback => {
			try {
				callback(dataMap);
			} catch (error) {
				console.error('数据更新回调执行失败:', error);
			}
		});
	}

	/**
	 * 清除数据更新回调
	 */
	clearDataUpdateCallbacks(): void {
		this.dataUpdateCallbacks = [];
	}
}