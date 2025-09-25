/**
 * 统计数据管理服务
 */

import { App } from 'obsidian';
import { DailyStats, StreakData, CharChange, WordCountSettings, TextAnalysisResult } from '../types';
import { getTodayString, getDaysDifference, CONSTANTS, debounce } from '../utils';
import { CompressionService, CompressedDailyStats } from './compressionService';
import { MemoryManager } from './memoryManager';
import { DataAccessService } from './dataAccessService';
import { errorHandler, ErrorLevel } from './errorHandler';

export class StatsManager {
	private dailyStats: Map<string, DailyStats> = new Map();
	private streakData: StreakData = { current: 0, longest: 0, lastDate: '' };
	private compressionService: CompressionService;
	private memoryManager: MemoryManager;
	private debouncedSaveData: () => void;
	private dataAccess: DataAccessService;

	constructor(private app: App, private settings: WordCountSettings) {
		this.compressionService = new CompressionService();
		this.memoryManager = new MemoryManager({
			warningThreshold: CONSTANTS.MEMORY_WARNING_THRESHOLD,
			dangerThreshold: CONSTANTS.MEMORY_DANGER_THRESHOLD,
			maxCharChanges: CONSTANTS.MAX_CHAR_CHANGES,
			maxCacheItems: CONSTANTS.MAX_CACHE_ITEMS
		});
		this.dataAccess = DataAccessService.getInstance(app, 'obsidian-writer-stats');
		
		// 创建防抖保存函数
		this.debouncedSaveData = debounce(this.saveData.bind(this), 1000); // 1秒防抖
	}

	/**
	 * 更新字数统计
	 * @param fileName 文件名
	 * @param analysisResult 文本分析结果
	 */
	async updateWordCount(fileName: string, analysisResult: TextAnalysisResult): Promise<void> {
		await errorHandler.wrapAsync(async () => {
			const today = getTodayString();
			const existingStats = this.dailyStats.get(today) || this.createEmptyStats(today);

			// 计算当前文件的总字数（根据用户设置）
			let currentFileCharCount = 0;
			if (this.settings.trackChinese) currentFileCharCount += analysisResult.chinese;
			if (this.settings.trackEnglish) currentFileCharCount += analysisResult.english;
			if (this.settings.trackPunctuation) currentFileCharCount += analysisResult.punctuation;
			if (this.settings.trackNumbers) currentFileCharCount += analysisResult.numbers;
			if (this.settings.trackSpaces) currentFileCharCount += analysisResult.spaces;

			// 查找该文件之前的字数记录
			const previousChange = existingStats.charChanges
				.filter(change => change.fileName === fileName)
				.pop();

			// 计算字数变化
			const wordCountChange = currentFileCharCount - (previousChange?.total || 0);

			// 只有当字数发生变化时才记录
			if (wordCountChange !== 0) {
				// 记录字符变化
				const charChange: CharChange = {
					timestamp: Date.now(),
					action: wordCountChange > 0 ? 'add' : 'delete',
					fileName,
					chinese: analysisResult.chinese,
					english: analysisResult.english,
					punctuation: analysisResult.punctuation,
					numbers: analysisResult.numbers,
					spaces: analysisResult.spaces,
					words: analysisResult.words,
					total: currentFileCharCount
				};

				// 更新统计数据 - 累加字数变化
				existingStats.chinese += (analysisResult.chinese - (previousChange?.chinese || 0));
				existingStats.english += (analysisResult.english - (previousChange?.english || 0));
				existingStats.punctuation += (analysisResult.punctuation - (previousChange?.punctuation || 0));
				existingStats.numbers += (analysisResult.numbers - (previousChange?.numbers || 0));
				existingStats.spaces += (analysisResult.spaces - (previousChange?.spaces || 0));
				existingStats.words += (analysisResult.words - (previousChange?.words || 0));
				existingStats.total += wordCountChange;
				existingStats.completed = existingStats.total > 0; // 只要有字数就算完成

				// 添加字符变化记录
				existingStats.charChanges.push(charChange);

				// 限制历史记录数量，避免数据过大
				if (existingStats.charChanges.length > CONSTANTS.MAX_CHAR_CHANGES) {
					existingStats.charChanges = existingStats.charChanges.slice(-CONSTANTS.MAX_CHAR_CHANGES);
				}

				this.dailyStats.set(today, existingStats);
				
				// 使用防抖保存，避免频繁IO操作
				this.debouncedSaveData();

			// 更新连续写作数据
			this.updateStreakData(today);
		}
		}, {
			component: 'StatsManager',
			operation: 'updateWordCount'
		});
	}

	/**
	 * 创建空的统计数据
	 * @param date 日期
	 * @returns 空的统计数据
	 */
	private createEmptyStats(date: string): DailyStats {
		return {
			date,
			chinese: 0,
			english: 0,
			punctuation: 0,
			numbers: 0,
			spaces: 0,
			words: 0,
			total: 0,
			goal: 0, // 不再使用目标
			completed: false,
			charChanges: [],
		};
	}

	/**
	 * 更新连续写作数据
	 * @param today 今天的日期
	 */
	private updateStreakData(today: string): void {
		if (this.streakData.lastDate === '') {
			this.streakData.current = 1;
			this.streakData.longest = 1;
			this.streakData.lastDate = today;
			return;
		}

		const lastDate = new Date(this.streakData.lastDate);
		const currentDate = new Date(today);
		const diffDays = Math.floor((currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

		if (diffDays === 1) {
			// 连续写作
			this.streakData.current++;
			if (this.streakData.current > this.streakData.longest) {
				this.streakData.longest = this.streakData.current;
			}
			this.streakData.lastDate = today;
		} else if (diffDays > 1) {
			// 中断写作
			this.streakData.current = 1;
			this.streakData.lastDate = today;
		}
	}

	/**
	 * 获取今日统计数据
	 * @returns 今日统计数据
	 */
	getTodayStats(): DailyStats | undefined {
		const today = getTodayString();
		return this.dailyStats.get(today);
	}

	/**
	 * 获取所有统计数据
	 * @returns 统计数据Map
	 */
	getAllStats(): Map<string, DailyStats> {
		return this.dailyStats;
	}

	/**
	 * 获取连续写作数据
	 * @returns 连续写作数据
	 */
	getStreakData(): StreakData {
		return this.streakData;
	}

	/**
	 * 重置所有数据
	 */
	async resetData(): Promise<void> {
		await errorHandler.wrapAsync(async () => {
			this.dailyStats.clear();
			this.streakData = { current: 0, longest: 0, lastDate: '' };
			await this.saveData();
		}, {
			component: 'StatsManager',
			operation: 'resetData'
		});
	}

	/**
	 * 保存数据到插件存储（使用压缩）
	 */
	private async saveData(): Promise<void> {
		await errorHandler.wrapAsync(async () => {
			// 清理过期数据
			this.cleanupExpiredData();
			
			// 压缩数据
			const compressedData = this.compressionService.compressDailyStatsArray(
				Array.from(this.dailyStats.values())
			);
			
			// 通过数据访问服务保存压缩数据，保留其他数据
			const existingData = await this.dataAccess.loadData() || {};
			existingData.dailyStats = compressedData;
			await this.dataAccess.saveData(existingData);
			
			// 记录内存使用情况
			this.logMemoryUsage();
		}, {
			component: 'StatsManager',
			operation: 'saveData'
		});
	}

	/**
	 * 从插件存储加载数据 - 支持压缩数据
	 */
	async loadData(): Promise<void> {
		await errorHandler.wrapAsync(async () => {
			// 通过数据访问服务加载数据
			const pluginData = await this.dataAccess.loadData();
			
			// 获取每日统计数据
			const historicalData = pluginData?.dailyStats || pluginData;
			
			if (Array.isArray(historicalData)) {
				let validatedData: DailyStats[];
				
				// 检查是否为压缩数据
				if (historicalData.length > 0 && this.isCompressedData(historicalData[0])) {
					// 解压缩数据
					validatedData = this.compressionService.decompressDailyStatsArray(
						historicalData as CompressedDailyStats[]
					);
					console.log('加载并解压缩了数据');
				} else {
					// 兼容旧格式数据
					validatedData = historicalData.map(item => ({
						date: item.date || '',
						chinese: item.chinese || 0,
						english: item.english || 0,
						punctuation: item.punctuation || 0,
						numbers: item.numbers || 0,
						spaces: item.spaces || 0,
						words: item.words || 0,
						total: item.total || 0,
						goal: 0, // 不再使用目标
						completed: item.completed || false,
						charChanges: item.charChanges || [],
						categoryStats: item.categoryStats || []
					}));
					console.log('加载了旧格式数据');
				}
				
				// 只保留启用插件后的数据（从今天开始往前30天）
				const today = new Date();
				const thirtyDaysAgo = new Date(today);
				thirtyDaysAgo.setDate(today.getDate() - CONSTANTS.LAZY_LOAD_INITIAL_DAYS);
				
				const filteredData = validatedData.filter(item => {
					const itemDate = new Date(item.date);
					return itemDate >= thirtyDaysAgo && itemDate <= today;
				});
				
				this.dailyStats = new Map(filteredData.map(item => [item.date, item]));
				console.log(`加载了 ${filteredData.length} 条启用插件后的数据`);
				
			// 记录内存使用情况
			this.logMemoryUsage();
		}
		}, {
			component: 'StatsManager',
			operation: 'loadData'
		});
	}

	/**
	 * 更新设置
	 * @param newSettings 新设置
	 */
	updateSettings(newSettings: WordCountSettings): void {
		this.settings = newSettings;
		// 更新所有现有统计数据的completed字段
		for (const stats of this.dailyStats.values()) {
			stats.goal = 0; // 不再使用目标
			stats.completed = stats.total > 0; // 只要有字数就算完成
		}
	}

	/**
	 * 检查是否为压缩数据
	 * @param data 数据项
	 * @returns 是否为压缩数据
	 */
	private isCompressedData(data: any): boolean {
		return data && typeof data === 'object' && 'd' in data && 'c' in data && 'e' in data;
	}

	/**
	 * 清理过期数据
	 */
	private cleanupExpiredData(): void {
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - CONSTANTS.LAZY_LOAD_MAX_DAYS);
		
		for (const [date, stats] of this.dailyStats) {
			const statsDate = new Date(date);
			if (statsDate < cutoffDate) {
				this.dailyStats.delete(date);
			} else {
				// 清理过期的字符变化记录
				stats.charChanges = this.memoryManager.cleanupOldCharChanges(
					stats.charChanges,
					CONSTANTS.CHAR_CHANGES_MAX_AGE
				);
				
				// 限制字符变化记录数量
				stats.charChanges = this.memoryManager.limitCharChanges(stats.charChanges);
			}
		}
	}

	/**
	 * 记录内存使用情况
	 */
	private logMemoryUsage(): void {
		const report = this.memoryManager.getMemoryReport(this.dailyStats);
		
		if (report.thresholdCheck.isWarning) {
			console.warn('内存使用警告:', report);
		}
		
		if (report.thresholdCheck.isDanger) {
			console.error('内存使用危险:', report);
		}
	}

	/**
	 * 获取内存使用报告
	 * @returns 内存使用报告
	 */
	getMemoryReport() {
		return this.memoryManager.getMemoryReport(this.dailyStats);
	}

	/**
	 * 手动清理内存
	 */
	async cleanupMemory(): Promise<void> {
		this.cleanupExpiredData();
		await this.saveData();
		console.log('内存清理完成');
	}
}
