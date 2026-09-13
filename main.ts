import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, Modal } from 'obsidian';

// 字数统计插件设置接口
interface WordCountSettings {
	dailyGoal: number;           // 每日目标字数
	enableHeatmap: boolean;      // 是否启用热力图
	heatmapColors: string[];    // 热力图颜色
	trackChinese: boolean;      // 是否统计中文字符
	trackEnglish: boolean;      // 是否统计英文字符
	trackPunctuation: boolean;  // 是否统计标点符号
	showStatusBar: boolean;     // 是否显示状态栏
	resetWeekly: boolean;       // 是否每周重置数据
}

// 每日统计数据
interface DailyStats {
	date: string;               // 日期 YYYY-MM-DD
	chinese: number;            // 中文字符数
	english: number;            // 英文字符数
	punctuation: number;        // 标点符号数
	total: number;              // 总字数
	goal: number;               // 当日目标
	completed: boolean;         // 是否完成目标
}

// 连续写作数据
interface StreakData {
	current: number;            // 当前连续天数
	longest: number;            // 最长连续天数
	lastDate: string;           // 最后写作日期
}

// 默认设置
const DEFAULT_SETTINGS: WordCountSettings = {
	dailyGoal: 1000,
	enableHeatmap: true,
	heatmapColors: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
	trackChinese: true,
	trackEnglish: true,
	trackPunctuation: true,
	showStatusBar: true,
	resetWeekly: false
};

export default class WordCountPlugin extends Plugin {
	settings: WordCountSettings;
	statusBarItem: HTMLElement;
	dailyStats: Map<string, DailyStats>;
	streakData: StreakData;

	async onload() {
		await this.loadSettings();
		this.dailyStats = new Map();
		this.streakData = { current: 0, longest: 0, lastDate: '' };

		// 初始化状态栏
		if (this.settings.showStatusBar) {
			this.initStatusBar();
		}

		// 添加左侧边栏图标
		this.addRibbonIcon('file-text', '字数统计', (evt: MouseEvent) => {
			this.showStatistics();
		});

		// 添加命令
		this.addCommand({
			id: 'show-word-count-statistics',
			name: '显示字数统计',
			callback: () => this.showStatistics()
		});

		this.addCommand({
			id: 'reset-word-count-data',
			name: '重置统计数据',
			callback: () => this.resetData()
		});

		// 添加设置页面
		this.addSettingTab(new WordCountSettingTab(this.app, this));

		// 注册文件更改监听
		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				if ((file as any).extension === 'md') {
					this.updateWordCount();
				}
			})
		);

		// 注册文件创建监听
		this.registerEvent(
			this.app.vault.on('create', (file) => {
				if ((file as any).extension === 'md') {
					this.updateWordCount();
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
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// 初始化状态栏
	initStatusBar() {
		this.statusBarItem = this.addStatusBarItem();
		this.updateStatusBar();
	}

	// 更新状态栏
	updateStatusBar() {
		if (!this.statusBarItem) return;

		const today = new Date().toISOString().split('T')[0];
		const todayStats = this.dailyStats.get(today);
		const total = todayStats ? todayStats.total : 0;
		const goal = this.settings.dailyGoal;
		const percentage = Math.min(100, Math.round((total / goal) * 100));

		this.statusBarItem.setText(`📝 ${total}/${goal} (${percentage}%)`);
		this.statusBarItem.setAttribute('aria-label', `今日字数: ${total}/${goal}`);
	}

	// 更新字数统计
	async updateWordCount() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile || activeFile.extension !== 'md') return;

		try {
			const content = await this.app.vault.read(activeFile);
			const stats = this.analyzeText(content);
			
			const today = new Date().toISOString().split('T')[0];
			const existingStats = this.dailyStats.get(today) || {
				date: today,
				chinese: 0,
				english: 0,
				punctuation: 0,
				total: 0,
				goal: this.settings.dailyGoal,
				completed: false
			};

			// 更新统计数据
			existingStats.chinese += stats.chinese;
			existingStats.english += stats.english;
			existingStats.punctuation += stats.punctuation;
			existingStats.total = existingStats.chinese + existingStats.english + existingStats.punctuation;
			existingStats.completed = existingStats.total >= existingStats.goal;

			this.dailyStats.set(today, existingStats);
			await this.saveData(Array.from(this.dailyStats.values()));
			
			// 更新连续写作数据
			this.updateStreakData(today);
			
			// 更新状态栏
			this.updateStatusBar();
		} catch (error) {
			console.error('更新字数统计失败:', error);
		}
	}

	// 分析文本内容 - 与Obsidian字数统计保持一致
	analyzeText(text: string): { chinese: number; english: number; punctuation: number } {
		// 移除Markdown语法元素，但保留实际内容
		let cleanText = text
			// 移除Frontmatter
			.replace(/^---[\s\S]*?---\s*/gm, '')
			// 移除代码块（保留代码内容）
			.replace(/```[\s\S]*?```/g, (match) => {
				// 保留代码块内的内容，移除```标记
				return match.replace(/```/g, '');
			})
			// 移除行内代码标记（保留内容）
			.replace(/`([^`]+)`/g, '$1')
			// 移除HTML标签（保留内容）
			.replace(/<[^>]+>/g, '')
			// 移除Markdown链接标记（保留链接文本）
			.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
			// 移除Markdown图片（保留alt文本）
			.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
			// 移除Markdown标题标记（保留标题内容）
			.replace(/^#{1,6}\s*/gm, '')
			// 移除Markdown引用标记（保留引用内容）
			.replace(/^>\s*/gm, '')
			// 移除Markdown列表标记（保留列表内容）
			.replace(/^[-*+]\s+/gm, '')
			// 移除Markdown任务列表标记（保留任务内容）
			.replace(/^\[ \]\s+/gm, '')
			.replace(/^\[x\]\s+/gm, '')
			// 移除Markdown水平线
			.replace(/^[-*_]{3,}$/gm, '')
			// 移除多余的空白字符，但保留换行
			.replace(/[ \t]+/g, ' ')
			.replace(/\n\s*\n/g, '\n\n')
			.trim();

		let chinese = 0;
		let english = 0;
		let punctuation = 0;

		if (this.settings.trackChinese) {
			// 中文字符（包括中文标点）
			chinese = (cleanText.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length;
		}

		if (this.settings.trackEnglish) {
			// 英文单词统计 - 与Obsidian保持一致
			// 移除所有非字母字符，但保留单词间的空格
			const wordsText = cleanText.replace(/[^a-zA-Z\s]/g, ' ');
			const words = wordsText.split(/\s+/).filter(word => word.length > 0);
			
			english = 0;
			for (const word of words) {
				// 排除单独的罗马数字（通常用于章节编号）
				if (!/^[IVXLCDM]+$/i.test(word)) {
					english++;
				}
			}
		}

		if (this.settings.trackPunctuation) {
			// 标点符号统计（排除中文字符和空格）
			punctuation = (cleanText.match(/[^\w\s\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length;
		}

		return { chinese, english, punctuation };
	}

	// 更新连续写作数据
	updateStreakData(today: string) {
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

	// 加载历史数据
	async loadHistoricalData() {
		try {
			const historicalData = await this.loadData();
			if (Array.isArray(historicalData)) {
				this.dailyStats = new Map(historicalData.map(item => [item.date, item]));
			}
			this.updateStatusBar();
		} catch (error) {
			console.error('加载历史数据失败:', error);
		}
	}

	// 显示统计信息
	showStatistics() {
		const modal = new StatisticsModal(this.app, this.dailyStats, this.streakData, this.settings);
		modal.open();
	}

	// 重置数据
	async resetData() {
		new Notice('确定要重置所有统计数据吗？此操作不可撤销。');
		
		// 延迟执行以允许用户看到提示
		setTimeout(async () => {
			try {
				this.dailyStats.clear();
				this.streakData = { current: 0, longest: 0, lastDate: '' };
				await this.saveData([]);
				this.updateStatusBar();
				new Notice('统计数据已重置');
			} catch (error) {
				console.error('重置数据失败:', error);
				new Notice('重置数据失败');
			}
		}, 1000);
	}
}

// 统计信息模态框
class StatisticsModal extends Modal {
	dailyStats: Map<string, DailyStats>;
	streakData: StreakData;
	settings: WordCountSettings;

	constructor(app: App, dailyStats: Map<string, DailyStats>, streakData: StreakData, settings: WordCountSettings) {
		super(app);
		this.dailyStats = dailyStats;
		this.streakData = streakData;
		this.settings = settings;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: '字数统计' });

		// 显示今日统计
		this.displayTodayStats(contentEl);
		
		// 显示连续写作统计
		this.displayStreakStats(contentEl);
		
		// 显示热力图
		if (this.settings.enableHeatmap) {
			this.displayHeatmap(contentEl);
		}

		// 关闭按钮
		const closeBtn = contentEl.createEl('button', { text: '关闭' });
		closeBtn.onclick = () => this.close();
		closeBtn.style.marginTop = '20px';
		closeBtn.style.padding = '8px 16px';
		closeBtn.style.cursor = 'pointer';
	}

	displayTodayStats(container: HTMLElement) {
		const today = new Date().toISOString().split('T')[0];
		const todayStats = this.dailyStats.get(today);

		const statsContainer = container.createDiv({ cls: 'word-count-stats' });
		statsContainer.createEl('h3', { text: '今日统计' });

		if (todayStats) {
			statsContainer.createEl('p', {
				text: `总字数: ${todayStats.total} / ${todayStats.goal} (${todayStats.completed ? '✅' : '❌'})`
			});
			statsContainer.createEl('p', { text: `中文字符: ${todayStats.chinese}` });
			statsContainer.createEl('p', { text: `英文字符: ${todayStats.english}` });
			statsContainer.createEl('p', { text: `标点符号: ${todayStats.punctuation}` });
		} else {
			statsContainer.createEl('p', { text: '今日暂无写作记录' });
		}
	}

	displayStreakStats(container: HTMLElement) {
		const streakContainer = container.createDiv({ cls: 'word-count-streak' });
		streakContainer.createEl('h3', { text: '连续写作' });

		streakContainer.createEl('p', { text: `当前连续: ${this.streakData.current} 天` });
		streakContainer.createEl('p', { text: `最长连续: ${this.streakData.longest} 天` });
	}

	displayHeatmap(container: HTMLElement) {
		const heatmapContainer = container.createDiv({ cls: 'word-count-heatmap' });
		heatmapContainer.createEl('h3', { text: '写作热力图' });

		// 简单的热力图实现
		const heatmapGrid = heatmapContainer.createDiv({ cls: 'heatmap-grid' });
		
		// 获取最近30天的数据
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
		
		for (let i = 0; i < 30; i++) {
			const date = new Date(thirtyDaysAgo);
			date.setDate(date.getDate() + i);
			const dateStr = date.toISOString().split('T')[0];
			const stats = this.dailyStats.get(dateStr);
			
			const cell = heatmapGrid.createDiv({ cls: 'heatmap-cell' });
			const intensity = stats ? Math.min(1, stats.total / this.settings.dailyGoal) : 0;
			const colorIndex = Math.floor(intensity * (this.settings.heatmapColors.length - 1));
			cell.style.backgroundColor = this.settings.heatmapColors[colorIndex] || '#ebedf0';
			cell.setAttribute('title', `${dateStr}: ${stats ? stats.total : 0} 字`);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

// 设置页面
class WordCountSettingTab extends PluginSettingTab {
	plugin: WordCountPlugin;

	constructor(app: App, plugin: WordCountPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: '字数统计设置' });

		// 每日目标设置
		new Setting(containerEl)
			.setName('每日目标字数')
			.setDesc('设定每日写作目标字数')
			.addSlider(slider => {
				slider.setLimits(100, 10000, 100)
					.setValue(this.plugin.settings.dailyGoal)
					.onChange(async (value: number) => {
						this.plugin.settings.dailyGoal = value;
						await this.plugin.saveSettings();
					});
			});

		// 状态栏显示设置
		new Setting(containerEl)
			.setName('显示状态栏')
			.setDesc('在状态栏显示今日字数统计')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.showStatusBar)
					.onChange(async (value) => {
						this.plugin.settings.showStatusBar = value;
						if (value) {
							this.plugin.initStatusBar();
						} else if (this.plugin.statusBarItem) {
							this.plugin.statusBarItem.remove();
							this.plugin.statusBarItem = undefined as any;
						}
						await this.plugin.saveSettings();
					});
			});

		// 统计选项设置
		new Setting(containerEl)
			.setName('统计选项')
			.setDesc('选择要统计的字符类型')
			.setHeading();

		new Setting(containerEl)
			.setName('统计中文字符')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.trackChinese)
					.onChange(async (value) => {
						this.plugin.settings.trackChinese = value;
						await this.plugin.saveSettings();
						this.plugin.updateWordCount();
					});
			});

		new Setting(containerEl)
			.setName('统计英文字符')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.trackEnglish)
					.onChange(async (value) => {
						this.plugin.settings.trackEnglish = value;
						await this.plugin.saveSettings();
						this.plugin.updateWordCount();
					});
			});

		new Setting(containerEl)
			.setName('统计标点符号')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.trackPunctuation)
					.onChange(async (value) => {
						this.plugin.settings.trackPunctuation = value;
						await this.plugin.saveSettings();
						this.plugin.updateWordCount();
					});
			});

		// 热力图设置
		new Setting(containerEl)
			.setName('热力图设置')
			.setDesc('配置热力图显示选项')
			.setHeading();

		new Setting(containerEl)
			.setName('启用热力图')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.enableHeatmap)
					.onChange(async (value) => {
						this.plugin.settings.enableHeatmap = value;
						await this.plugin.saveSettings();
					});
			});
	}
}

