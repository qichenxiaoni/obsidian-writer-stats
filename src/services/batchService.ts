/**
 * 批量处理服务 - 处理大量文件的分析任务
 */

import { TFile } from 'obsidian';
import { TextAnalysisResult } from '../types';

export interface BatchConfig {
	batchSize: number;     // 每批处理的文件数量
	concurrency: number;   // 并发数量
	timeout: number;       // 超时时间（毫秒）
	retryCount: number;    // 重试次数
}

export interface BatchResult {
	successCount: number;
	failureCount: number;
	errors: Array<{
		file: string;
		error: string;
	}>;
	totalProcessed: number;
	duration: number;
}

export interface BatchProgress {
	current: number;
	total: number;
	percentage: number;
	currentFile?: string;
}

export class BatchService {
	private config: BatchConfig;
	private progressCallbacks: Array<(progress: BatchProgress) => void> = [];

	constructor(config: BatchConfig) {
		this.config = config;
	}

	/**
	 * 批量分析文件
	 */
	async batchAnalyzeFiles(
		files: TFile[],
		analyzeFunction: (content: string) => TextAnalysisResult,
		readFunction: (file: TFile) => Promise<string>
	): Promise<BatchResult> {
		const startTime = Date.now();
		const result: BatchResult = {
			successCount: 0,
			failureCount: 0,
			errors: [],
			totalProcessed: 0,
			duration: 0
		};

		try {
			// 分批处理
			const batches = this.createBatches(files);
			
			for (let i = 0; i < batches.length; i++) {
				const batch = batches[i];
				
				// 更新进度
				this.updateProgress({
					current: i * this.config.batchSize,
					total: files.length,
					percentage: (i * this.config.batchSize / files.length) * 100
				});

				// 并发处理当前批次
				const batchResults = await this.processBatch(
					batch,
					analyzeFunction,
					readFunction
				);

				// 合并结果
				result.successCount += batchResults.successCount;
				result.failureCount += batchResults.failureCount;
				result.errors.push(...batchResults.errors);
				result.totalProcessed += batchResults.totalProcessed;

				// 添加小延迟避免阻塞UI
				await this.delay(10);
			}

			// 最终进度更新
			this.updateProgress({
				current: files.length,
				total: files.length,
				percentage: 100
			});

		} catch (error) {
			console.error('批量处理失败:', error);
			result.errors.push({
				file: 'batch_process',
				error: error instanceof Error ? error.message : String(error)
			});
		}

		result.duration = Date.now() - startTime;
		return result;
	}

	/**
	 * 创建批次
	 */
	private createBatches(files: TFile[]): TFile[][] {
		const batches: TFile[][] = [];
		
		for (let i = 0; i < files.length; i += this.config.batchSize) {
			batches.push(files.slice(i, i + this.config.batchSize));
		}
		
		return batches;
	}

	/**
	 * 处理单个批次
	 */
	private async processBatch(
		batch: TFile[],
		analyzeFunction: (content: string) => TextAnalysisResult,
		readFunction: (file: TFile) => Promise<string>
	): Promise<BatchResult> {
		const result: BatchResult = {
			successCount: 0,
			failureCount: 0,
			errors: [],
			totalProcessed: 0,
			duration: 0
		};

		// 控制并发数量
		const semaphore = new Semaphore(this.config.concurrency);
		
		const promises = batch.map(async (file) => {
			return semaphore.acquire(async () => {
				return this.processFile(file, analyzeFunction, readFunction);
			});
		});

		const results = await Promise.allSettled(promises);
		
		for (const promiseResult of results) {
			result.totalProcessed++;
			
			if (promiseResult.status === 'fulfilled') {
				if (promiseResult.value.success) {
					result.successCount++;
				} else {
					result.failureCount++;
					if (promiseResult.value.error) {
						result.errors.push(promiseResult.value.error);
					}
				}
			} else {
				result.failureCount++;
				result.errors.push({
					file: 'unknown',
					error: promiseResult.reason
				});
			}
		}

		return result;
	}

	/**
	 * 处理单个文件
	 */
	private async processFile(
		file: TFile,
		analyzeFunction: (content: string) => TextAnalysisResult,
		readFunction: (file: TFile) => Promise<string>
	): Promise<{ success: boolean; error?: { file: string; error: string } }> {
		let retryCount = 0;
		
		while (retryCount <= this.config.retryCount) {
			try {
				// 更新当前处理的文件
				this.updateProgress({
					current: 0,
					total: 1,
					percentage: 0,
					currentFile: file.name
				});

				// 带超时的文件读取和分析
				const content = await this.withTimeout(
					readFunction(file),
					this.config.timeout
				);

				// 分析文件内容
				const analysisResult = analyzeFunction(content);
				
				// 这里可以添加更多的处理逻辑，比如保存结果等
				
				return { success: true };
				
			} catch (error) {
				retryCount++;
				
				if (retryCount > this.config.retryCount) {
					return {
						success: false,
						error: {
							file: file.name,
							error: error instanceof Error ? error.message : String(error)
						}
					};
				}
				
				// 重试前等待
				await this.delay(1000 * retryCount);
			}
		}

		return {
			success: false,
			error: {
				file: file.name,
				error: '重试次数耗尽'
			}
		};
	}

	/**
	 * 带超时的Promise包装
	 */
	private withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
		return Promise.race([
			promise,
			new Promise<T>((_, reject) => {
				setTimeout(() => reject(new Error('操作超时')), timeout);
			})
		]);
	}

	/**
	 * 延迟函数
	 */
	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	/**
	 * 更新进度
	 */
	private updateProgress(progress: BatchProgress): void {
		this.progressCallbacks.forEach(callback => {
			try {
				callback(progress);
			} catch (error) {
				console.error('进度回调执行失败:', error);
			}
		});
	}

	/**
	 * 添加进度回调
	 */
	onProgress(callback: (progress: BatchProgress) => void): void {
		this.progressCallbacks.push(callback);
	}

	/**
	 * 清除进度回调
	 */
	clearProgressCallbacks(): void {
		this.progressCallbacks = [];
	}

	/**
	 * 更新配置
	 */
	updateConfig(newConfig: Partial<BatchConfig>): void {
		this.config = { ...this.config, ...newConfig };
	}

	/**
	 * 获取配置
	 */
	getConfig(): BatchConfig {
		return { ...this.config };
	}
}

/**
 * 信号量 - 控制并发数量
 */
class Semaphore {
	private tokens: number;
	private waitingQueue: Array<() => void> = [];

	constructor(tokens: number) {
		this.tokens = tokens;
	}

	async acquire<T>(task: () => Promise<T>): Promise<T> {
		return new Promise((resolve, reject) => {
			const tryAcquire = () => {
				if (this.tokens > 0) {
					this.tokens--;
					
					task()
						.then(resolve)
						.catch(reject)
						.finally(() => {
							this.tokens++;
							if (this.waitingQueue.length > 0) {
								const next = this.waitingQueue.shift();
								if (next) next();
							}
						});
				} else {
					this.waitingQueue.push(tryAcquire);
				}
			};
			
			tryAcquire();
		});
	}
}