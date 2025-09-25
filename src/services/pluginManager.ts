/**
 * 插件管理服务 - 统一管理插件的核心业务逻辑
 */

import { App, Notice, TFile, MarkdownView } from 'obsidian';
import { WordCountSettings, TextAnalysisResult } from '../types';
import { TextAnalyzer, StatsManager, CacheService, BatchService, MemoryManager, GoalManager, errorHandler, ErrorLevel, VersionManager, MigrationResult } from './index';
import { debounce, getTodayString, formatNumber, CONSTANTS } from '../utils';

export interface PluginManagerConfig {
	app: App;
	settings: WordCountSettings;
	loadData: () => Promise<any>;
	saveData: (data: any) => Promise<void>;
}

export class PluginManager {
	private app: App;
	private settings: WordCountSettings;
	private loadDataFn: () => Promise<any>;
	private saveDataFn: (data: any) => Promise<void>;
	
	// 服务实例
	private textAnalyzer: TextAnalyzer;
	private statsManager: StatsManager;
	private cacheService: CacheService;
	private batchService: BatchService;
	private memoryManager: MemoryManager;
	private goalManager: GoalManager;
	
	// 防抖函数
	private debouncedUpdateWordCount: () => void;
	private debouncedUpdateRealTime: () => void;
	private debouncedUpdateAfterComposition: () => void;
	
	// 性能监控
	private memoryCleanupInterval: number | null = null;

	constructor(config: PluginManagerConfig) {
		this.app = config.app;
		this.settings = config.settings;
		this.loadDataFn = config.loadData;
		this.saveDataFn = config.saveData;
		
		this.initializeServices();
	}

	/**
	 * 初始化所有服务
	 */
	private initializeServices(): void {
		this.textAnalyzer = new TextAnalyzer(this.settings);
		this.statsManager = new StatsManager(this.app, this.settings);
		this.cacheService = new CacheService({
			maxSize: this.settings.cacheMaxSize,
			defaultTTL: this.settings.cacheDefaultTTL
		});
		this.batchService = new BatchService({
			batchSize: CONSTANTS.BATCH_SIZE,
			concurrency: CONSTANTS.BATCH_CONCURRENCY,
			timeout: CONSTANTS.BATCH_TIMEOUT,
			retryCount: CONSTANTS.BATCH_RETRY_COUNT
		});
		this.memoryManager = new MemoryManager({
			warningThreshold: CONSTANTS.MEMORY_WARNING_THRESHOLD,
			dangerThreshold: CONSTANTS.MEMORY_DANGER_THRESHOLD,
			maxCharChanges: CONSTANTS.MAX_CHAR_CHANGES,
			maxCacheItems: CONSTANTS.MAX_CACHE_ITEMS
		});
		this.goalManager = new GoalManager(this.app, this.settings);
		
		// 创建防抖函数 - 使用可配置的防抖时间
		this.debouncedUpdateWordCount = debounce(this.updateWordCount.bind(this), this.settings.debounceDelay);
		this.debouncedUpdateRealTime = debounce(this.updateWordCountRealTime.bind(this), this.settings.realTimeDebounceDelay);
		this.debouncedUpdateAfterComposition = debounce(this.updateWordCountRealTime.bind(this), this.settings.compositionDebounceDelay);
		
		// 启动内存监控
		this.startMemoryMonitoring();
	}

	/**
	 * 更新设置
	 */
	updateSettings(newSettings: WordCountSettings): void {
		this.settings = newSettings;
		this.textAnalyzer = new TextAnalyzer(this.settings);
		this.statsManager.updateSettings(this.settings);
		this.goalManager.updateSettings(this.settings);
		
		this.cacheService.updateConfig({
			maxSize: this.settings.cacheMaxSize,
			defaultTTL: this.settings.cacheDefaultTTL
		});
		
		// 重新创建防抖函数以应用新的防抖时间
		this.debouncedUpdateWordCount = debounce(this.updateWordCount.bind(this), this.settings.debounceDelay);
		this.debouncedUpdateRealTime = debounce(this.updateWordCountRealTime.bind(this), this.settings.realTimeDebounceDelay);
		this.debouncedUpdateAfterComposition = debounce(this.updateWordCountRealTime.bind(this), this.settings.compositionDebounceDelay);
	}

	/**
	 * 检查文件是否为Markdown文件
	 */
	isMarkdownFile(file: TFile): boolean {
		return file.extension === 'md';
	}

	/**
	 * 计算内容哈希值（改进版本 - 使用更好的哈希算法）
	 */
	private getContentHash(content: string): string {
		// 使用更好的哈希算法，减少冲突
		let hash = 5381;
		for (let i = 0; i < content.length; i++) {
			hash = ((hash << 5) + hash) + content.charCodeAt(i);
		}
		return (hash >>> 0).toString(16); // 确保为正数并转换为16进制
	}

	/**
	 * 实时更新字数统计（快速版本）
	 */
	async updateWordCountRealTime(): Promise<void> {
		await errorHandler.wrapAsync(async () => {
			const activeFile = this.app.workspace.getActiveFile();
			if (!activeFile || !this.isMarkdownFile(activeFile)) return;

			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!activeView?.editor) return;

			const content = activeView.editor.getValue();
			
			// 改进的缓存策略
			let analysisResult: TextAnalysisResult;
			const contentHash = this.getContentHash(content);
			const cacheKey = `realtime_${contentHash}`;
			
			const isComposing = this.settings.enableIMEDetection && this.textAnalyzer.shouldDelayCount();
			
			if (!isComposing && this.settings.enableCache && this.cacheService.has(cacheKey)) {
				const cached = this.cacheService.get<TextAnalysisResult>(cacheKey);
				if (cached) {
					analysisResult = cached;
				} else {
					analysisResult = this.textAnalyzer.analyzeText(content, false);
					if (this.settings.enableCache) {
						this.cacheService.set(cacheKey, analysisResult, 3000); // 3秒缓存
					}
				}
			} else {
				analysisResult = this.textAnalyzer.analyzeText(content, false);
				if (!isComposing && this.settings.enableCache) {
					this.cacheService.set(cacheKey, analysisResult, 3000); // 3秒缓存
				}
			}
			
			// 计算总字数
			const totalWords = this.calculateTotalWords(analysisResult);
			
			// 触发状态栏更新回调
			this.onRealTimeStatsUpdate?.(analysisResult, totalWords);
		}, {
			component: 'PluginManager',
			operation: 'updateWordCountRealTime'
		});
	}

	/**
	 * 更新字数统计（完整版本，包含数据保存）
	 */
	async updateWordCount(): Promise<void> {
		await errorHandler.wrapAsync(async () => {
			const activeFile = this.app.workspace.getActiveFile();
			if (!activeFile || !this.isMarkdownFile(activeFile)) return;

			const content = await this.app.vault.read(activeFile);
			const contentHash = this.getContentHash(content);
			const cacheKey = `analysis_${contentHash}`;
			let analysisResult: TextAnalysisResult;

			if (this.settings.enableCache && this.cacheService.has(cacheKey)) {
				const cached = this.cacheService.get<TextAnalysisResult>(cacheKey);
				if (cached) {
					analysisResult = cached;
				} else {
					analysisResult = this.textAnalyzer.analyzeText(content);
					if (this.settings.enableCache) {
						this.cacheService.set(cacheKey, analysisResult, 300000); // 5分钟
					}
				}
			} else {
				analysisResult = this.textAnalyzer.analyzeText(content);
				if (this.settings.enableCache) {
					this.cacheService.set(cacheKey, analysisResult, 300000); // 5分钟
				}
			}
			
			const totalWords = this.calculateTotalWords(analysisResult);

			// 检查字数是否有变化
			const todayStats = this.statsManager.getTodayStats();
			const previousChange = todayStats?.charChanges
				.filter(change => change.fileName === activeFile.name)
				.pop();
			
			const previousTotal = previousChange?.total || 0;
			const wordCountChange = totalWords - previousTotal;

			// 只有当字数变化超过阈值时才保存数据
			if (Math.abs(wordCountChange) >= 1) {
				await this.statsManager.updateWordCount(activeFile.name, analysisResult);
				
				// 更新写作目标进度
				if (this.settings.enableWritingGoals) {
					const updatedTodayStats = this.statsManager.getTodayStats();
					if (updatedTodayStats) {
						await this.goalManager.updateGoalProgress(updatedTodayStats);
					}
				}
			}
			
			// 触发状态栏更新回调
			this.onStatsUpdate?.();
		}, {
			component: 'PluginManager',
			operation: 'updateWordCount'
		});
	}

	/**
	 * 计算总字数
	 */
	private calculateTotalWords(analysisResult: TextAnalysisResult): number {
		let totalWords = 0;
		if (this.settings.trackChinese) totalWords += analysisResult.chinese;
		if (this.settings.trackEnglish) totalWords += analysisResult.english;
		if (this.settings.trackPunctuation) totalWords += analysisResult.punctuation;
		if (this.settings.trackNumbers) totalWords += analysisResult.numbers;
		if (this.settings.trackSpaces) totalWords += analysisResult.spaces;
		return totalWords;
	}

	/**
	 * 加载历史数据（包含版本检查和迁移）
	 */
	async loadHistoricalData(): Promise<void> {
		await errorHandler.wrapAsync(async () => {
			// 先加载原始数据
			const rawData = await this.loadDataFn();
			
			// 检查版本并执行迁移
			const { data: migratedData, migrationResult } = await VersionManager.checkAndMigrate(rawData);
			
			// 如果有迁移结果，显示通知
			if (migrationResult) {
				this.handleMigrationResult(migrationResult);
				
				// 如果迁移成功，保存迁移后的数据
				if (migrationResult.success) {
					await this.saveDataFn(migratedData);
				}
			}
			
			// 验证数据完整性
			const validation = VersionManager.validateDataIntegrity(migratedData || rawData);
			if (!validation.isValid) {
				errorHandler.handleError(
					`数据完整性验证失败: ${validation.issues.join(', ')}`,
					{
						component: 'PluginManager',
						operation: 'loadHistoricalData'
					},
					ErrorLevel.WARNING
				);
			}
			
			// 加载数据到各个管理器
			await this.statsManager.loadData();
			await this.goalManager.loadGoalStats();
		}, {
			component: 'PluginManager',
			operation: 'loadHistoricalData'
		});
	}

	/**
	 * 处理迁移结果
	 */
	private handleMigrationResult(migrationResult: MigrationResult): void {
		if (migrationResult.success) {
			if (migrationResult.migratedItems > 0) {
				new Notice(
					`数据迁移成功！已迁移 ${migrationResult.migratedItems} 项数据从版本 ${migrationResult.fromVersion} 到 ${migrationResult.toVersion}`,
					8000
				);
			}
		} else {
			new Notice(
				`数据迁移失败: ${migrationResult.errors.join(', ')}`,
				10000
			);
			
			errorHandler.handleError(
				`数据迁移失败: ${migrationResult.errors.join(', ')}`,
				{
					component: 'PluginManager',
					operation: 'handleMigrationResult',
					details: migrationResult
				},
				ErrorLevel.ERROR
			);
		}
	}

	/**
	 * 重置数据
	 */
	async resetData(): Promise<void> {
		await errorHandler.wrapAsync(async () => {
			await this.statsManager.resetData();
			await this.goalManager.resetGoalStats();
			errorHandler.handleError(
				'统计数据已重置',
				{
					component: 'PluginManager',
					operation: 'resetData'
				},
				ErrorLevel.INFO
			);
		}, {
			component: 'PluginManager',
			operation: 'resetData'
		});
	}

	/**
	 * 启动内存监控
	 */
	private startMemoryMonitoring(): void {
		this.memoryCleanupInterval = window.setInterval(() => {
			this.performMemoryCleanup();
		}, CONSTANTS.CLEANUP_INTERVAL);
	}

	/**
	 * 停止内存监控
	 */
	stopMemoryMonitoring(): void {
		if (this.memoryCleanupInterval) {
			clearInterval(this.memoryCleanupInterval);
			this.memoryCleanupInterval = null;
		}
	}

	/**
	 * 执行内存清理
	 */
	private async performMemoryCleanup(): Promise<void> {
		await errorHandler.wrapAsync(async () => {
			const report = this.getMemoryReport();
			
			if (report.thresholdCheck.isDanger) {
				errorHandler.handleError(
					'内存使用过高，执行自动清理',
					{
						component: 'PluginManager',
						operation: 'performMemoryCleanup'
					},
					ErrorLevel.WARNING,
					false // 不显示用户通知
				);
				await this.cleanupMemory();
			} else if (report.thresholdCheck.isWarning) {
				errorHandler.handleError(
					'内存使用较高，执行轻量清理',
					{
						component: 'PluginManager',
						operation: 'performMemoryCleanup'
					},
					ErrorLevel.INFO,
					false // 不显示用户通知
				);
				this.cacheService.cleanup();
			}
		}, {
			component: 'PluginManager',
			operation: 'performMemoryCleanup'
		});
	}

	/**
	 * 清理资源
	 */
	cleanup(): void {
		this.cacheService.clear();
		this.stopMemoryMonitoring();
		this.batchService.clearProgressCallbacks();
	}

	// 获取器方法
	get textAnalyzerInstance() { return this.textAnalyzer; }
	get statsManagerInstance() { return this.statsManager; }
	get cacheServiceInstance() { return this.cacheService; }
	get batchServiceInstance() { return this.batchService; }
	get goalManagerInstance() { return this.goalManager; }

	// 代理方法
	getMemoryReport() { return this.statsManager.getMemoryReport(); }
	async cleanupMemory() { return this.statsManager.cleanupMemory(); }
	
	// 版本管理方法
	getCurrentVersion() { return VersionManager.getCurrentVersion(); }
	
	/**
	 * 创建数据备份
	 */
	async createDataBackup(): Promise<string> {
		const rawData = await this.loadDataFn();
		return VersionManager.createBackup(rawData);
	}
	
	/**
	 * 从备份恢复数据
	 */
	async restoreFromBackup(backupData: string): Promise<{ success: boolean; error?: string }> {
		const result = await VersionManager.restoreFromBackup(backupData);
		
		if (result.success && result.data) {
			await this.saveDataFn(result.data);
			// 重新加载数据
			await this.loadHistoricalData();
		}
		
		return {
			success: result.success,
			error: result.error
		};
	}

	// 回调函数
	onStatsUpdate?: () => void;
	onRealTimeStatsUpdate?: (analysisResult: TextAnalysisResult, totalWords: number) => void;
	
	// 防抖函数获取器
	get debouncedUpdateWordCountFn() { return this.debouncedUpdateWordCount; }
	get debouncedUpdateRealTimeFn() { return this.debouncedUpdateRealTime; }
	get debouncedUpdateAfterCompositionFn() { return this.debouncedUpdateAfterComposition; }
}
