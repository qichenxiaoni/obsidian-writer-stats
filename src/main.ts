/**
 * 字数统计插件主文件
 */

import { App, Plugin, Notice, TFile } from 'obsidian';
import { WordCountSettings, DEFAULT_SETTINGS } from './types';
import { TextAnalyzer, StatsManager, CacheService } from './services';
import { StatisticsModal, WordCountSettingTab } from './ui';
import { registerCommands } from './commands';
import { debounce, getTodayString, formatNumber, calculatePercentage } from './utils';

export class WordCountPlugin extends Plugin {
	settings: WordCountSettings;
	statusBarItem: HTMLElement | undefined;
	
	// 服务实例
	private textAnalyzer: TextAnalyzer;
	private statsManager: StatsManager;
	private cacheService: CacheService;
	
	// 防抖函数
	private debouncedUpdateWordCount: () => void;

	async onload() {
		await this.loadSettings();
		
		// 初始化服务
		this.initializeServices();
		
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

		// 注册文件更改监听（使用防抖）
		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				if (file instanceof TFile && this.isMarkdownFile(file)) {
					this.debouncedUpdateWordCount();
				}
			})
		);

		// 注册文件创建监听
		this.registerEvent(
			this.app.vault.on('create', (file) => {
				if (file instanceof TFile && this.isMarkdownFile(file)) {
					this.debouncedUpdateWordCount();
				}
			})
		);

		// 加载历史数据
		await this.loadHistoricalData();
	}

	onunload() {
		// 清理状态栏
		if (this.statusBarItem) {
			this.statusBarItem.remove();
		}
		
		// 清理缓存
		this.cacheService.clear();
	}

	/**
	 * 初始化服务
	 */
	private initializeServices(): void {
		this.textAnalyzer = new TextAnalyzer(this.settings);
		this.statsManager = new StatsManager(this.app, this.settings);
		this.cacheService = new CacheService();
		
		// 创建防抖函数
		this.debouncedUpdateWordCount = debounce(this.updateWordCount.bind(this), 500);
	}

	/**
	 * 检查文件是否为Markdown文件
	 */
	private isMarkdownFile(file: TFile): boolean {
		return file.extension === 'md';
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		// 更新服务中的设置
		this.textAnalyzer = new TextAnalyzer(this.settings);
		this.statsManager.updateSettings(this.settings);
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

		const todayStats = this.statsManager.getTodayStats();
		const total = todayStats ? (todayStats.total || 0) : 0;
		const goal = this.settings.dailyGoal;
		const percentage = goal > 0 ? Math.min(100, Math.round((total / goal) * 100)) : 0;

		this.statusBarItem.setText(`📝 ${formatNumber(total)}/${formatNumber(goal)} (${percentage}%)`);
		this.statusBarItem.setAttribute('aria-label', `今日字数: ${formatNumber(total)}/${formatNumber(goal)}`);
	}

	/**
	 * 更新字数统计
	 */
	async updateWordCount() {
		try {
			const activeFile = this.app.workspace.getActiveFile();
			if (!activeFile || !this.isMarkdownFile(activeFile)) return;

			// 检查缓存
			const cacheKey = `file_${activeFile.path}`;
			let content: string;
			
			if (this.settings.enableCache && this.cacheService.has(cacheKey)) {
				content = this.cacheService.get(cacheKey)!;
			} else {
				content = await this.app.vault.read(activeFile);
				if (this.settings.enableCache) {
					this.cacheService.set(cacheKey, content);
				}
			}

			// 分析文本
			const analysisResult = this.textAnalyzer.analyzeText(content);
			
			// 更新统计数据
			await this.statsManager.updateWordCount(activeFile.name, analysisResult);
			
			// 更新状态栏
			this.updateStatusBar();
		} catch (error) {
			console.error('更新字数统计失败:', error);
			new Notice('更新字数统计失败，请查看控制台获取详细信息');
		}
	}

	/**
	 * 加载历史数据
	 */
	async loadHistoricalData() {
		try {
			await this.statsManager.loadData();
			this.updateStatusBar();
		} catch (error) {
			console.error('加载历史数据失败:', error);
			new Notice('加载历史数据失败，请查看控制台获取详细信息');
		}
	}

	/**
	 * 显示统计信息
	 */
	showStatistics() {
		const modal = new StatisticsModal(
			this.app, 
			this.statsManager.getAllStats(), 
			this.statsManager.getStreakData(), 
			this.settings
		);
		modal.open();
	}

	/**
	 * 重置数据
	 */
	async resetData() {
		const confirmed = await this.showResetConfirmation();
		if (confirmed) {
			try {
				await this.statsManager.resetData();
				this.updateStatusBar();
				new Notice('统计数据已重置');
			} catch (error) {
				console.error('重置数据失败:', error);
				new Notice('重置数据失败，请查看控制台获取详细信息');
			}
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
			const pluginStats = this.textAnalyzer.analyzeText(content);
			
			// 计算插件统计的总字数
			let pluginTotal = 0;
			if (this.settings.trackChinese) pluginTotal += pluginStats.chinese;
			if (this.settings.trackEnglish) pluginTotal += pluginStats.english;
			if (this.settings.trackPunctuation) pluginTotal += pluginStats.punctuation;
			if (this.settings.trackNumbers) pluginTotal += pluginStats.numbers;
			if (this.settings.trackSpaces) pluginTotal += pluginStats.spaces;
			
			// 计算简单统计（用于对比）
			const simpleChinese = (content.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length;
			const simpleEnglish = (content.match(/[a-zA-Z]/g) || []).length;
			const simplePunctuation = (content.match(/[^\w\s\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length;
			const simpleNumbers = (content.match(/[0-9]/g) || []).length;
			const simpleSpaces = (content.match(/ /g) || []).length;
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

简单统计结果（无预处理）：
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
	 * 导出数据
	 */
	async exportData() {
		try {
			const data = {
				settings: this.settings,
				dailyStats: Array.from(this.statsManager.getAllStats().entries()),
				streakData: this.statsManager.getStreakData(),
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
}

export default WordCountPlugin;
