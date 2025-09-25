/**
 * 字数统计插件主文件
 */

import { App, Plugin, Notice, TFile, MarkdownView } from 'obsidian';
import { WordCountSettings, DEFAULT_SETTINGS } from './types';
import { PluginManager, errorHandler, ErrorLevel } from './services';
import { StatisticsModal, WordCountSettingTab } from './ui';
import { registerCommands } from './commands';
import { formatNumber, getTodayString } from './utils';
import { TextAnalysisResult } from './types';

export class WordCountPlugin extends Plugin {
	settings: WordCountSettings;
	statusBarItem: HTMLElement | undefined;
	
	// 插件管理服务
	pluginManager: PluginManager;

	async onload() {
		await this.loadSettings();
		
		// 初始化插件管理服务
		this.pluginManager = new PluginManager({
			app: this.app,
			settings: this.settings,
			loadData: this.loadData.bind(this),
			saveData: this.saveData.bind(this)
		});

		// 设置回调函数
		this.pluginManager.onStatsUpdate = () => this.updateStatusBar();
		this.pluginManager.onRealTimeStatsUpdate = (analysisResult, totalWords) => 
			this.updateStatusBarWithStats(analysisResult, totalWords);
		
		// 初始化状态栏
		if (this.settings.showStatusBar) {
			this.initStatusBar();
		}

		// 添加左侧边栏图标
		this.addRibbonIcon('file-text', '字数统计', () => {
			this.showStatistics();
		});

		// 注册命令
		registerCommands(this);

		// 添加设置页面
		this.addSettingTab(new WordCountSettingTab(this.app, this));

		// 注册事件监听器
		this.registerEventListeners();

		// 加载历史数据
		await this.loadHistoricalData();
	}

	onunload() {
		// 清理状态栏
		if (this.statusBarItem) {
			this.statusBarItem.remove();
		}
		
		// 清理插件管理服务
		this.pluginManager?.cleanup();
	}

	/**
	 * 注册事件监听器
	 */
	private registerEventListeners(): void {
		// 注册文件更改监听（使用防抖）
		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				if (file instanceof TFile && this.pluginManager.isMarkdownFile(file)) {
					this.pluginManager.debouncedUpdateWordCountFn();
				}
			})
		);

		// 注册文件创建监听
		this.registerEvent(
			this.app.vault.on('create', (file) => {
				if (file instanceof TFile && this.pluginManager.isMarkdownFile(file)) {
					this.pluginManager.debouncedUpdateWordCountFn();
				}
			})
		);

		// 注册编辑器变化监听（实时更新）
		this.registerEvent(
			this.app.workspace.on('editor-change', (editor, view) => {
				const file = view.file;
				if (file && this.pluginManager.isMarkdownFile(file)) {
					// 检查是否启用输入法检测并且应该延迟统计
					if (this.settings.enableIMEDetection && this.pluginManager.textAnalyzerInstance.shouldDelayCount()) {
						// 如果正在组合输入，延迟更新
						this.pluginManager.debouncedUpdateAfterCompositionFn();
					} else {
						// 正常的实时更新
						this.pluginManager.debouncedUpdateRealTimeFn();
					}
				}
			})
		);

		// 注册组合事件监听器（如果启用输入法检测）
		if (this.settings.enableIMEDetection) {
			this.registerCompositionEvents();
		}

		// 注册活动文件变化监听
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile && this.pluginManager.isMarkdownFile(activeFile)) {
					this.pluginManager.debouncedUpdateWordCountFn();
				}
			})
		);
	}


	/**
	 * 注册组合事件监听器
	 */
	private registerCompositionEvents(): void {
		// 监听文档中的组合事件
		this.registerDomEvent(document, 'compositionstart', (evt: CompositionEvent) => {
			const target = evt.target as HTMLElement;
			if (this.isEditingMarkdown(target)) {
				this.pluginManager.textAnalyzerInstance.onCompositionStart(evt.data || '');
			}
		});

		this.registerDomEvent(document, 'compositionupdate', (evt: CompositionEvent) => {
			const target = evt.target as HTMLElement;
			if (this.isEditingMarkdown(target)) {
				this.pluginManager.textAnalyzerInstance.onCompositionUpdate(evt.data || '');
			}
		});

		this.registerDomEvent(document, 'compositionend', (evt: CompositionEvent) => {
			const target = evt.target as HTMLElement;
			if (this.isEditingMarkdown(target)) {
				this.pluginManager.textAnalyzerInstance.onCompositionEnd();
				// 组合结束后立即更新
				setTimeout(() => {
					this.pluginManager.debouncedUpdateRealTimeFn();
				}, 100); // 100ms延迟确保输入完成
			}
		});
	}

	/**
	 * 检查是否正在编辑Markdown文件
	 */
	private isEditingMarkdown(target: HTMLElement): boolean {
		// 检查是否在编辑器中
		const editorContainer = target.closest('.cm-editor, .markdown-source-view');
		if (!editorContainer) return false;

		// 检查当前活动文件是否为Markdown
		const activeFile = this.app.workspace.getActiveFile();
		return activeFile !== null && this.pluginManager.isMarkdownFile(activeFile);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		// 更新插件管理服务中的设置
		this.pluginManager.updateSettings(this.settings);
	}

	/**
	 * 初始化状态栏
	 */
	initStatusBar() {
		this.statusBarItem = this.addStatusBarItem();
		this.updateStatusBar();
	}

	/**
	 * 更新状态栏
	 */
	updateStatusBar() {
		if (!this.statusBarItem) return;

		const todayStats = this.pluginManager.statsManagerInstance.getTodayStats();
		const total = todayStats ? (todayStats.total || 0) : 0;

		let statusText = `📝 ${formatNumber(total)} 字`;
		
		// 如果启用了写作目标，显示目标完成情况
		if (this.settings.enableWritingGoals) {
			const goalProgress = this.pluginManager.goalManagerInstance.getTodayGoalProgress();
			if (goalProgress.goal > 0) {
				const completionRate = Math.round(goalProgress.completionRate);
				statusText += ` (${completionRate}%)`;
				
				// 添加目标完成状态图标
				if (goalProgress.completed) {
					statusText = `✅ ${statusText}`;
				} else if (goalProgress.completionRate >= 80) {
					statusText = `🔥 ${statusText}`;
				}
			}
		}

		this.statusBarItem.setText(statusText);
		this.statusBarItem.setAttribute('aria-label', `今日字数: ${formatNumber(total)}`);
	}

	/**
	 * 用指定统计数据更新状态栏（用于实时更新）
	 */
	private updateStatusBarWithStats(analysisResult: TextAnalysisResult, totalWords: number) {
		if (!this.statusBarItem) return;

		// 获取今日已保存的总字数
		const todayStats = this.pluginManager.statsManagerInstance.getTodayStats();
		const savedTotal = todayStats ? (todayStats.total || 0) : 0;
		
		// 计算实时总字数 = 已保存的总字数 + 当前文件的字数
		const realTimeTotal = savedTotal + totalWords;

		let statusText = `📝 ${formatNumber(realTimeTotal)} 字`;
		
		// 如果启用了写作目标，显示目标完成情况
		if (this.settings.enableWritingGoals) {
			const goalProgress = this.pluginManager.goalManagerInstance.getTodayGoalProgress();
			if (goalProgress.goal > 0) {
				const currentCompletion = (realTimeTotal / goalProgress.goal) * 100;
				const completionRate = Math.round(currentCompletion);
				statusText += ` (${completionRate}%)`;
				
				// 添加目标完成状态图标
				if (currentCompletion >= 100) {
					statusText = `✅ ${statusText}`;
				} else if (currentCompletion >= 80) {
					statusText = `🔥 ${statusText}`;
				}
			}
		}

		this.statusBarItem.setText(statusText);
		this.statusBarItem.setAttribute('aria-label', `实时字数: ${formatNumber(realTimeTotal)}`);
	}


	/**
	 * 加载历史数据
	 */
	async loadHistoricalData() {
		await errorHandler.wrapAsync(async () => {
			await this.pluginManager.loadHistoricalData();
			this.updateStatusBar();
		}, {
			component: 'WordCountPlugin',
			operation: 'loadHistoricalData'
		});
	}

	/**
	 * 显示统计信息
	 */
	showStatistics() {
		const modal = new StatisticsModal(
			this.app, 
			this.pluginManager.statsManagerInstance.getAllStats(), 
			this.pluginManager.statsManagerInstance.getStreakData(), 
			this.settings,
			this.pluginManager.goalManagerInstance.getGoalStats(),
			this.pluginManager.cacheServiceInstance.getStats()
		);
		modal.open();
	}

	/**
	 * 重置数据
	 */
	async resetData() {
		const confirmed = await this.showResetConfirmation();
		if (confirmed) {
			await errorHandler.wrapAsync(async () => {
				await this.pluginManager.resetData();
				this.updateStatusBar();
			}, {
				component: 'WordCountPlugin',
				operation: 'resetData'
			});
		}
	}

	/**
	 * 显示重置确认对话框
	 */
	private async showResetConfirmation(): Promise<boolean> {
		return new Promise((resolve) => {
			// 使用简单的确认对话框
			const confirmed = confirm('此操作将永久删除所有统计数据，包括：\n• 每日写作记录\n• 连续写作天数\n• 热力图数据\n\n此操作不可撤销，确定要继续吗？');
			resolve(confirmed);
		});
	}

	/**
	 * 测试字数统计准确性
	 */
	async testWordCountAccuracy() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice('请先打开一个Markdown文件');
			return;
		}

		try {
			const content = await this.app.vault.read(activeFile);
			
			// 使用插件统计
			const pluginStats = this.pluginManager.textAnalyzerInstance.analyzeText(content);
			
			// 计算插件统计的总字数
			let pluginTotal = 0;
			if (this.settings.trackChinese) pluginTotal += pluginStats.chinese;
			if (this.settings.trackEnglish) pluginTotal += pluginStats.english;
			if (this.settings.trackPunctuation) pluginTotal += pluginStats.punctuation;
			if (this.settings.trackNumbers) pluginTotal += pluginStats.numbers;
			if (this.settings.trackSpaces) pluginTotal += pluginStats.spaces;
			
			// 计算简单统计（用于对比）
			const simpleChinese = (content.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3300-\u33ff\ufe30-\ufe4f]/g) || []).length;
			const simpleEnglish = (content.match(/[a-zA-Z]/g) || []).length;
			const simplePunctuation = (content.match(/[^\w\s\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3300-\u33ff\ufe30-\ufe4f]/g) || []).length;
			const simpleNumbers = (content.match(/[0-9]/g) || []).length;
			const simpleSpaces = (content.match(/[\s\t\n\r]/g) || []).length;
			const simpleTotal = simpleChinese + simpleEnglish + simplePunctuation + simpleNumbers + simpleSpaces;
			
			// 显示对比结果
			const resultMessage = `
字数统计对比结果：

插件统计结果：
- 中文字符: ${formatNumber(pluginStats.chinese)}
- 英文字符: ${formatNumber(pluginStats.english)}
- 标点符号: ${formatNumber(pluginStats.punctuation)}
- 数字: ${formatNumber(pluginStats.numbers)}
- 空格: ${formatNumber(pluginStats.spaces)}
- 总字数: ${formatNumber(pluginTotal)}
- 词数: ${formatNumber(pluginStats.words)}

原始文本统计（无预处理）：
- 中文字符: ${formatNumber(simpleChinese)}
- 英文字符: ${formatNumber(simpleEnglish)}
- 标点符号: ${formatNumber(simplePunctuation)}
- 数字: ${formatNumber(simpleNumbers)}
- 空格: ${formatNumber(simpleSpaces)}
- 总字数: ${formatNumber(simpleTotal)}

文件原始长度: ${formatNumber(content.length)}
			`;
			
			new Notice(resultMessage);
			
			// 在控制台输出详细信息
			console.log('字数统计对比结果:');
			console.log('插件统计:', pluginStats);
			console.log('简单统计:', { simpleChinese, simpleEnglish, simplePunctuation, simpleNumbers, simpleSpaces, simpleTotal });
			console.log('文件原始长度:', content.length);
			
		} catch (error) {
			console.error('测试字数统计失败:', error);
			new Notice('测试失败，请查看控制台获取详细信息');
		}
	}

	/**
	 * 调试字数统计问题
	 */
	async debugWordCount() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice('请先打开一个Markdown文件');
			return;
		}

		try {
			console.log('=== 调试字数统计问题 ===');
			console.log('当前文件:', activeFile.name);
			console.log('当前设置:', this.settings);
			
			// 检查事件监听器
			console.log('事件监听器状态:');
			console.log('- modify事件: 已注册');
			console.log('- editor-change事件: 已注册');
			
			// 检查服务状态
			console.log('服务状态:');
			console.log('- PluginManager:', !!this.pluginManager);
			console.log('- TextAnalyzer:', !!this.pluginManager?.textAnalyzerInstance);
			console.log('- StatsManager:', !!this.pluginManager?.statsManagerInstance);
			console.log('- CacheService:', !!this.pluginManager?.cacheServiceInstance);
			
			// 测试文本分析
			const content = await this.app.vault.read(activeFile);
			console.log('文件内容长度:', content.length);
			
			const analysisResult = this.pluginManager.textAnalyzerInstance.analyzeText(content);
			console.log('分析结果:', analysisResult);
			
			// 计算总字数
			let totalWords = 0;
			if (this.settings.trackChinese) totalWords += analysisResult.chinese;
			if (this.settings.trackEnglish) totalWords += analysisResult.english;
			if (this.settings.trackPunctuation) totalWords += analysisResult.punctuation;
			if (this.settings.trackNumbers) totalWords += analysisResult.numbers;
			if (this.settings.trackSpaces) totalWords += analysisResult.spaces;
			
			console.log('计算的总字数:', totalWords);
			
			// 检查今日统计
			const todayStats = this.pluginManager.statsManagerInstance.getTodayStats();
			console.log('今日统计:', todayStats);
			
			// 检查状态栏
			console.log('状态栏内容:', this.statusBarItem?.textContent);
			
			new Notice('调试信息已输出到控制台，请查看');
			
		} catch (error) {
			console.error('调试失败:', error);
			new Notice('调试失败，请查看控制台获取详细信息');
		}
	}

	/**
	 * 测试字符识别功能
	 */
	async testCharacterRecognition() {
		try {
			console.log('=== 测试字符识别功能 ===');
			
			// 测试用例
			const testCases = [
				{ text: '现在', expected: { chinese: 2, english: 0, numbers: 0, punctuation: 0, spaces: 0 } },
				{ text: 'a', expected: { chinese: 0, english: 1, numbers: 0, punctuation: 0, spaces: 0 } },
				{ text: '1', expected: { chinese: 0, english: 0, numbers: 1, punctuation: 0, spaces: 0 } },
				{ text: '，', expected: { chinese: 0, english: 0, numbers: 0, punctuation: 1, spaces: 0 } },
				{ text: 'hello world', expected: { chinese: 0, english: 10, numbers: 0, punctuation: 0, spaces: 1 } },
				{ text: '你好世界！', expected: { chinese: 4, english: 0, numbers: 0, punctuation: 1, spaces: 0 } },
				{ text: '123abc，。', expected: { chinese: 0, english: 3, numbers: 3, punctuation: 2, spaces: 0 } }
			];
			
			for (const testCase of testCases) {
				console.log(`\n测试文本: "${testCase.text}"`);
				console.log('预期结果:', testCase.expected);
				
				const result = this.pluginManager.textAnalyzerInstance.analyzeText(testCase.text);
				console.log('实际结果:', result);
				
				// 检查结果
				const isCorrect = 
					result.chinese === testCase.expected.chinese &&
					result.english === testCase.expected.english &&
					result.numbers === testCase.expected.numbers &&
					result.punctuation === testCase.expected.punctuation &&
					result.spaces === testCase.expected.spaces;
				
				console.log('测试结果:', isCorrect ? '✅ 通过' : '❌ 失败');
				
				if (!isCorrect) {
					console.log('差异分析:');
					if (result.chinese !== testCase.expected.chinese) {
						console.log(`- 中文字符: 预期 ${testCase.expected.chinese}, 实际 ${result.chinese}`);
					}
					if (result.english !== testCase.expected.english) {
						console.log(`- 英文字符: 预期 ${testCase.expected.english}, 实际 ${result.english}`);
					}
					if (result.numbers !== testCase.expected.numbers) {
						console.log(`- 数字字符: 预期 ${testCase.expected.numbers}, 实际 ${result.numbers}`);
					}
					if (result.punctuation !== testCase.expected.punctuation) {
						console.log(`- 标点符号: 预期 ${testCase.expected.punctuation}, 实际 ${result.punctuation}`);
					}
					if (result.spaces !== testCase.expected.spaces) {
						console.log(`- 空格字符: 预期 ${testCase.expected.spaces}, 实际 ${result.spaces}`);
					}
				}
			}
			
			new Notice('字符识别测试完成，请查看控制台结果');
			
		} catch (error) {
			console.error('字符识别测试失败:', error);
			new Notice('测试失败，请查看控制台获取详细信息');
		}
	}

	/**
	 * 导出数据
	 */
	async exportData() {
		try {
			const data = {
				settings: this.settings,
				dailyStats: Array.from(this.pluginManager.statsManagerInstance.getAllStats().entries()),
				streakData: this.pluginManager.statsManagerInstance.getStreakData(),
				exportDate: new Date().toISOString()
			};
			
			const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `word-count-backup-${new Date().toISOString().split('T')[0]}.json`;
			a.click();
			URL.revokeObjectURL(url);
			
			new Notice('数据导出成功');
		} catch (error) {
			console.error('导出数据失败:', error);
			new Notice('导出数据失败，请查看控制台获取详细信息');
		}
	}

	/**
	 * 批量分析文件
	 */
	async batchAnalyzeFiles() {
		try {
			const files = this.app.vault.getMarkdownFiles();
			
			if (files.length === 0) {
				new Notice('没有找到Markdown文件');
				return;
			}

			new Notice(`开始批量分析 ${files.length} 个文件...`);
			
			const result = await this.pluginManager.batchServiceInstance.batchAnalyzeFiles(
				files,
				(content) => this.pluginManager.textAnalyzerInstance.analyzeText(content),
				(file) => this.app.vault.read(file)
			);
			
			new Notice(`批量分析完成: 成功 ${result.successCount} 个，失败 ${result.failureCount} 个`);
			
			if (result.errors.length > 0) {
				console.error('批量分析错误:', result.errors);
			}
		} catch (error) {
			console.error('批量分析失败:', error);
			new Notice('批量分析失败，请查看控制台获取详细信息');
		}
	}

	/**
	 * 获取内存使用报告
	 */
	getMemoryReport() {
		return this.pluginManager.getMemoryReport();
	}

	/**
	 * 手动清理内存
	 */
	async cleanupMemory() {
		try {
			await this.pluginManager.cleanupMemory();
			new Notice('内存清理完成');
		} catch (error) {
			console.error('内存清理失败:', error);
			new Notice('内存清理失败，请查看控制台获取详细信息');
		}
	}

	/**
	 * 显示目标进度
	 */
	showGoalProgress(): void {
		if (!this.settings.enableWritingGoals) {
			new Notice('写作目标功能未启用');
			return;
		}

		const goalProgress = this.pluginManager.goalManagerInstance.getTodayGoalProgress();
		const goalStats = this.pluginManager.goalManagerInstance.getGoalStats();

		const message = `
今日目标进度：
目标: ${formatNumber(goalProgress.goal)} 字
实际: ${formatNumber(goalProgress.actual)} 字
完成率: ${goalProgress.completionRate.toFixed(1)}%
状态: ${goalProgress.completed ? '✅ 已完成' : '❌ 未完成'}

总体统计：
每日目标完成率: ${goalStats.dailyCompletionRate.toFixed(1)}%
连续完成目标: ${goalStats.consecutiveGoalDays} 天
最长连续完成: ${goalStats.longestConsecutiveGoalDays} 天
		`.trim();

		new Notice(message);
	}

	/**
	 * 显示缓存统计
	 */
	showCacheStats(): void {
		if (!this.settings.enableCache) {
			new Notice('缓存功能未启用');
			return;
		}

		const cacheStats = this.pluginManager.cacheServiceInstance.getStats();

		let message = '缓存统计：\n\n';
		message += `缓存命中率: ${cacheStats.hitRate.toFixed(1)}%\n`;
		message += `缓存项数量: ${cacheStats.itemCount}\n`;
		message += `总请求数: ${cacheStats.totalRequests}\n`;
		message += `命中次数: ${cacheStats.hits}\n`;
		message += `未命中次数: ${cacheStats.misses}\n`;

		new Notice(message.trim());
	}

	/**
	 * 创建数据备份
	 */
	async createDataBackup(): Promise<void> {
		await errorHandler.wrapAsync(async () => {
			const backupData = await this.pluginManager.createDataBackup();
			
			const blob = new Blob([backupData], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `word-count-backup-${new Date().toISOString().split('T')[0]}.json`;
			a.click();
			URL.revokeObjectURL(url);
			
			new Notice('数据备份创建成功');
		}, {
			component: 'WordCountPlugin',
			operation: 'createDataBackup'
		});
	}

	/**
	 * 从备份恢复数据
	 */
	async restoreFromBackup(): Promise<void> {
		// 创建文件输入元素
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		
		input.onchange = async (event) => {
			const file = (event.target as HTMLInputElement).files?.[0];
			if (!file) return;
			
			try {
				const backupData = await file.text();
				const result = await this.pluginManager.restoreFromBackup(backupData);
				
				if (result.success) {
					new Notice('数据恢复成功！插件将重新加载数据');
					this.updateStatusBar();
				} else {
					new Notice(`数据恢复失败: ${result.error}`);
				}
			} catch (error) {
				new Notice(`读取备份文件失败: ${error instanceof Error ? error.message : String(error)}`);
			}
		};
		
		input.click();
	}

	/**
	 * 显示版本信息
	 */
	showVersionInfo(): void {
		const version = this.pluginManager.getCurrentVersion();
		const manifestVersion = this.manifest.version;
		
		const message = `
插件版本信息：

插件版本: ${manifestVersion}
数据版本: ${version}
最小 Obsidian 版本: ${this.manifest.minAppVersion}
		`.trim();
		
		new Notice(message);
	}

	/**
	 * 更新字数统计（供设置页面调用）
	 */
	async updateWordCount(): Promise<void> {
		await this.pluginManager.debouncedUpdateWordCountFn();
	}
}

export default WordCountPlugin;
