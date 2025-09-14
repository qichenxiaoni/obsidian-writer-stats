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
	// 新增统计选项
	trackNumbers: boolean;      // 是否统计数字
	trackSpaces: boolean;       // 是否统计空格
	showWordCount: boolean;     // 是否显示词数统计
	enableCache: boolean;       // 是否启用缓存优化
}

// 每日统计数据
interface DailyStats {
	date: string;               // 日期 YYYY-MM-DD
	chinese: number;            // 中文字符数
	english: number;            // 英文字符数
	punctuation: number;        // 标点符号数
	numbers: number;            // 数字数量
	spaces: number;             // 空格数量
	words: number;              // 词数
	total: number;              // 总字数
	goal: number;               // 当日目标
	completed: boolean;         // 是否完成目标
	// 字符变化记录
	charChanges: Array<{
		timestamp: number;      // 时间戳
		action: 'add' | 'delete'; // 操作类型
		fileName: string;       // 文件名
		chinese: number;        // 中文字符变化
		english: number;        // 英文字符变化
		punctuation: number;    // 标点符号变化
		numbers: number;        // 数字变化
		spaces: number;         // 空格变化
		words: number;          // 词数变化
		total: number;          // 总字数变化
	}>;                       // 字符变化历史记录
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
	resetWeekly: false,
	trackNumbers: true,
	trackSpaces: false,
	showWordCount: true,
	enableCache: true
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

		this.addCommand({
			id: 'test-word-count-accuracy',
			name: '测试字数统计准确性',
			callback: () => this.testWordCountAccuracy()
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
		const total = todayStats ? (todayStats.total || 0) : 0;
		const goal = this.settings.dailyGoal || 1000;
		const percentage = goal > 0 ? Math.min(100, Math.round((total / goal) * 100)) : 0;

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
				numbers: 0,
				spaces: 0,
				words: 0,
				total: 0,
				goal: this.settings.dailyGoal || 1000,
				completed: false,
				charChanges: []
			};

			// 计算总字数（根据用户设置）
			let charCount = 0;
			if (this.settings.trackChinese) charCount += stats.chinese;
			if (this.settings.trackEnglish) charCount += stats.english;
			if (this.settings.trackPunctuation) charCount += stats.punctuation;
			if (this.settings.trackNumbers) charCount += stats.numbers;
			if (this.settings.trackSpaces) charCount += stats.spaces;
			
			// 确保总字数至少为0，避免null或undefined
			const total = charCount || 0;
			const completed = total >= existingStats.goal;
			
			// 记录字符变化
			const charChange = {
				timestamp: Date.now(),
				action: 'add' as const,
				fileName: activeFile.name,
				chinese: stats.chinese,
				english: stats.english,
				punctuation: stats.punctuation,
				numbers: stats.numbers,
				spaces: stats.spaces,
				words: stats.words,
				total: total
			};
			
			// 更新统计数据 - 增量更新而不是累加
			existingStats.chinese = stats.chinese;
			existingStats.english = stats.english;
			existingStats.punctuation = stats.punctuation;
			existingStats.numbers = stats.numbers;
			existingStats.spaces = stats.spaces;
			existingStats.words = stats.words;
			existingStats.total = total;
			existingStats.completed = completed;
			
			// 添加字符变化记录
			existingStats.charChanges.push(charChange);
			
			// 限制历史记录数量，避免数据过大
			if (existingStats.charChanges.length > 100) {
				existingStats.charChanges = existingStats.charChanges.slice(-100);
			}

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

	// 分析文本内容 - 优化后的高效统计
	analyzeText(text: string): { chinese: number; english: number; punctuation: number; numbers: number; spaces: number; words: number } {
		// 添加调试日志
		console.log('开始分析文本，原始长度:', text.length);
		
		// 预处理：移除不需要统计的内容
		const cleanText = this.preprocessText(text);
		
		console.log('预处理后文本长度:', cleanText.length);
		console.log('预处理后文本前100字符:', cleanText.substring(0, 100));
		
		// 使用单次遍历进行统计，提高性能
		const result = this.countCharacters(cleanText);
		
		console.log('统计结果:', result);
		
		return result;
	}

	// 预处理文本：移除Markdown语法但保留内容 - 优化版本
	private preprocessText(text: string): string {
		// 使用状态机方式处理，避免多层正则替换
		let result = '';
		let inCodeBlock = false;
		let inInlineCode = false;
		let inFrontmatter = false;
		let frontmatterEnd = 0;
		let inHtmlTag = false;
		let inMathBlock = false;
		
		// 检查是否有Frontmatter
		if (text.startsWith('---')) {
			const frontmatterEndMatch = text.indexOf('---', 3);
			if (frontmatterEndMatch !== -1) {
				inFrontmatter = true;
				frontmatterEnd = frontmatterEndMatch + 3;
			}
		}

		// 逐字符处理
		for (let i = 0; i < text.length; i++) {
			const char = text[i];
			
			// 跳过Frontmatter
			if (inFrontmatter && i < frontmatterEnd) {
				if (i === frontmatterEnd - 1) {
					inFrontmatter = false;
					result += '\n'; // 保留Frontmatter后的换行
				}
				continue;
			}
			
			// 处理数学公式块
			if (!inInlineCode && char === '$' && i + 1 < text.length && text[i + 1] === '$') {
				inMathBlock = !inMathBlock;
				i += 1; // 跳过第二个$
				continue;
			}
			
			// 处理行内数学公式
			if (!inCodeBlock && char === '$') {
				inInlineCode = !inInlineCode;
				continue;
			}
			
			// 处理代码块
			if (!inInlineCode && char === '`' && i + 2 < text.length && text[i + 1] === '`' && text[i + 2] === '`') {
				inCodeBlock = !inCodeBlock;
				i += 2; // 跳过后面的两个反引号
				continue;
			}
			
			// 处理行内代码
			if (!inMathBlock && char === '`') {
				inInlineCode = !inInlineCode;
				continue;
			}
			
			// 在代码块、行内代码或数学公式内，直接保留字符
			if (inCodeBlock || inInlineCode || inMathBlock) {
				result += char;
				continue;
			}
			
			// 处理HTML标签
			if (char === '<') {
				const closeTag = text.indexOf('>', i);
				if (closeTag !== -1) {
					// 检查是否是自闭合标签或注释
					const tagContent = text.substring(i + 1, closeTag);
					if (tagContent.startsWith('!--')) {
						// HTML注释，跳过
						i = closeTag;
						continue;
					} else if (!tagContent.includes('/') || tagContent.endsWith('/')) {
						// 自闭合标签或开始标签，跳过
						inHtmlTag = true;
						i = closeTag;
						continue;
					}
				}
			}
			
			// 在HTML标签内，跳过字符
			if (inHtmlTag) {
				if (char === '>') {
					inHtmlTag = false;
				}
				continue;
			}
			
			// 处理Markdown链接和图片
			if (char === '[' && !inInlineCode) {
				// 查找匹配的 ]
				const closeBracket = text.indexOf(']', i);
				if (closeBracket !== -1 && closeBracket + 1 < text.length && text[closeBracket + 1] === '(') {
					// 找到匹配的 )
					const closeParen = text.indexOf(')', closeBracket + 2);
					if (closeParen !== -1) {
						// 保留链接文本
						result += text.substring(i + 1, closeBracket);
						i = closeParen;
						continue;
					}
				}
			}
			
			// 处理Markdown图片
			if (char === '!' && i + 1 < text.length && text[i + 1] === '[' && !inInlineCode) {
				// 查找匹配的 ]
				const closeBracket = text.indexOf(']', i + 2);
				if (closeBracket !== -1 && closeBracket + 1 < text.length && text[closeBracket + 1] === '(') {
					// 找到匹配的 )
					const closeParen = text.indexOf(')', closeBracket + 2);
					if (closeParen !== -1) {
						// 保留alt文本
						result += text.substring(i + 2, closeBracket);
						i = closeParen;
						continue;
					}
				}
			}
			
			// 处理标题标记
			if (char === '#' && (i === 0 || text[i - 1] === '\n')) {
				// 跳过连续的#直到遇到空格或换行
				while (i < text.length && text[i] === '#') {
					i++;
				}
				// 跳过标题后的空格
				while (i < text.length && text[i] === ' ') {
					i++;
				}
				i--; // 因为循环末尾会i++
				continue;
			}
			
			// 处理引用标记
			if (char === '>' && (i === 0 || text[i - 1] === '\n')) {
				// 跳过>后的空格
				while (i < text.length && text[i] === ' ') {
					i++;
				}
				i--; // 因为循环末尾会i++
				continue;
			}
			
			// 处理列表标记
			if ((char === '-' || char === '*' || char === '+') &&
				(i === 0 || text[i - 1] === '\n') &&
				i + 1 < text.length && text[i + 1] === ' ') {
				i += 1; // 跳过空格
				continue;
			}
			
			// 处理任务列表标记
			if (char === '[' && (i === 0 || text[i - 1] === '\n')) {
				if (i + 1 < text.length) {
					const nextChar = text[i + 1];
					if (nextChar === ' ' || nextChar === 'x') {
						const closeBracket = text.indexOf(']', i + 2);
						if (closeBracket !== -1 && closeBracket + 1 < text.length && text[closeBracket + 1] === ' ') {
							i = closeBracket + 1;
							continue;
						}
					}
				}
			}
			
			// 处理水平线
			if (char === '-' && (i === 0 || text[i - 1] === '\n')) {
				let j = i;
				while (j < text.length && text[j] === '-') j++;
				if (j - i >= 3 && (j === text.length || text[j] === '\n')) {
					// 这是水平线，跳过整行
					while (j < text.length && text[j] !== '\n') j++;
					i = j;
					continue;
				}
			}
			
			// 处理表格
			if (char === '|' && (i === 0 || text[i - 1] === '\n')) {
				// 跳过整行表格
				let j = i;
				while (j < text.length && text[j] !== '\n') j++;
				// 如果是表格分隔行（包含-），跳过
				const line = text.substring(i, j);
				if (line.includes('-')) {
					i = j;
					continue;
				}
			}
			
			// 如果不是特殊处理的情况，保留字符
			result += char;
		}
		
		// 后处理：清理多余的空白
		return result
			.replace(/[ \t]+/g, ' ') // 合并多个空格
			.replace(/\n\s*\n/g, '\n\n') // 合并多个换行
			.trim();
	}

	// 单次遍历统计字符，提高性能 - 优化版本
	private countCharacters(text: string): { chinese: number; english: number; punctuation: number; numbers: number; spaces: number; words: number } {
		let chinese = 0;
		let english = 0;
		let punctuation = 0;
		let numbers = 0;
		let spaces = 0;
		let words = 0;
		
		// 预编译正则表达式，提高性能
		const chineseRegex = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3300-\u33ff\ufe30-\ufe4f\uf900-\ufaff\U00020000-\U0002a6df\U0002a700-\U0002b73f\U0002b740-\U0002b81f\U0002b820-\U0002ceaf]/;
		const englishRegex = /[a-zA-Z]/;
		const punctuationRegex = /[^\w\s\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3300-\u33ff\ufe30-\ufe4f\uf900-\ufaff\U00020000-\U0002a6df\U0002a700-\U0002b73f\U0002b740-\U0002b81f\U0002b820-\U0002ceaf]/;
		const numberRegex = /[0-9]/;
		const fullWidthNumberRegex = /[\uff10-\uff19]/;
		const fullWidthPunctuationRegex = /[\uff01-\uff0f\uff1a-\uff20\uff3b-\uff40\uff5b-\uff60\uff61-\uff65\uffe0-\uffe6]/;
		
		// 单次遍历统计
		for (let i = 0; i < text.length; i++) {
			const char = text[i];
			
			// 优先检查数字字符（包括全角数字）
			if (this.settings.trackNumbers && (numberRegex.test(char) || fullWidthNumberRegex.test(char))) {
				numbers++;
			}
			// 然后检查英文字符
			else if (this.settings.trackEnglish && englishRegex.test(char)) {
				// 检查是否是英文单词的一部分
				if (i === 0 || !englishRegex.test(text[i - 1])) {
					// 可能是英文单词的开始
					let j = i;
					while (j < text.length && englishRegex.test(text[j])) {
						j++;
					}
					const word = text.substring(i, j);
					
					// 排除单独的罗马数字
					if (!/^[IVXLCDM]+$/i.test(word)) {
						english++;
						if (this.settings.showWordCount) {
							words++;
						}
					}
					i = j - 1; // 因为循环末尾会i++
				}
			}
			// 然后检查中文字符
			else if (this.settings.trackChinese && chineseRegex.test(char)) {
				chinese++;
			}
			// 然后检查标点符号（包括全角标点）
			else if (this.settings.trackPunctuation && (punctuationRegex.test(char) || fullWidthPunctuationRegex.test(char))) {
				punctuation++;
			}
			// 最后检查空白字符
			else if (this.settings.trackSpaces && (char === ' ' || char === '\t' || char === '\n' || char === '\r')) {
				spaces++;
			}
		}
		
		return { chinese, english, punctuation, numbers, spaces, words };
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
				// 确保每个数据项都有必要的字段，并修复可能存在的null值
				const validatedData = historicalData.map(item => ({
					date: item.date || '',
					chinese: item.chinese || 0,
					english: item.english || 0,
					punctuation: item.punctuation || 0,
					numbers: item.numbers || 0,
					spaces: item.spaces || 0,
					words: item.words || 0,
					total: item.total || 0,
					goal: item.goal || this.settings.dailyGoal || 1000,
					completed: item.completed || false,
					charChanges: item.charChanges || []
				}));
				this.dailyStats = new Map(validatedData.map(item => [item.date, item]));
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

	// 计算简单词数统计
	private calculateSimpleWordCount(text: string): number {
		// 移除Markdown语法，计算简单词数
		const cleanText = text
			.replace(/#{1,6}\s*/g, '') // 移除标题标记
			.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1') // 移除加粗和斜体
			.replace(/`([^`]+)`/g, '$1') // 移除行内代码
			.replace(/!\[([^\]]+)\]\([^)]+\)/g, '$1') // 移除图片，保留alt文本
			.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 移除链接，保留链接文本
			.replace(/^>\s*/gm, '') // 移除引用标记
			.replace(/^[-*+]\s*/gm, '') // 移除列表标记
			.replace(/^\[ \]|\[x\]\s*/gm, '') // 移除任务列表标记
			.replace(/^---$/gm, '') // 移除水平线
			.replace(/<[^>]+>/g, '') // 移除HTML标签
			.replace(/^\s*[\r\n]/gm, '') // 移除空行
			.replace(/\s+/g, ' ') // 合并多个空格
			.trim();
		
		// 计算词数
		if (!cleanText) return 0;
		return cleanText.split(' ').filter(word => word.length > 0).length;
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

	// 测试字数统计准确性
	async testWordCountAccuracy() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice('请先打开一个Markdown文件');
			return;
		}

		try {
			const content = await this.app.vault.read(activeFile);
			
			// 使用插件统计
			const pluginStats = this.analyzeText(content);
			
			// 使用Obsidian原生统计
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!view) {
				new Notice('无法获取编辑器实例');
				return;
			}
			
			// 计算Obsidian原生统计
			const obsidianWordCount = this.calculateSimpleWordCount(content);
			const obsidianCharCount = content.length;
			
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
- 中文字符: ${pluginStats.chinese}
- 英文字符: ${pluginStats.english}
- 标点符号: ${pluginStats.punctuation}
- 数字: ${pluginStats.numbers}
- 空格: ${pluginStats.spaces}
- 总字数: ${pluginTotal}
- 词数: ${pluginStats.words}

Obsidian原生统计：
- 字数: ${obsidianWordCount}
- 字符数: ${obsidianCharCount}

简单统计结果（无预处理）：
- 中文字符: ${simpleChinese}
- 英文字符: ${simpleEnglish}
- 标点符号: ${simplePunctuation}
- 数字: ${simpleNumbers}
- 空格: ${simpleSpaces}
- 总字数: ${simpleTotal}

文件原始长度: ${content.length}
			`;
			
			new Notice(resultMessage);
			
			// 在控制台输出详细信息
			console.log('字数统计对比结果:');
			console.log('插件统计:', pluginStats);
			console.log('Obsidian原生统计:', { wordCount: obsidianWordCount, charCount: obsidianCharCount, pluginTotal: pluginTotal });
			console.log('简单统计:', { simpleChinese, simpleEnglish, simplePunctuation, simpleNumbers, simpleSpaces, simpleTotal });
			console.log('文件原始长度:', content.length);
			
		} catch (error) {
			console.error('测试字数统计失败:', error);
			new Notice('测试失败，请检查控制台获取详细信息');
		}
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
			// 确保 total 和 goal 是有效的数字
			const total = todayStats.total || 0;
			const goal = todayStats.goal || this.settings.dailyGoal || 1000;
			const completed = todayStats.completed || false;
			
			statsContainer.createEl('p', {
				text: `总字数: ${total} / ${goal} (${completed ? '✅' : '❌'})`
			});
			
			// 基础字符统计
			const basicStats = [];
			if (this.settings.trackChinese) basicStats.push(`中文字符: ${todayStats.chinese}`);
			if (this.settings.trackEnglish) basicStats.push(`英文字符: ${todayStats.english}`);
			if (this.settings.trackPunctuation) basicStats.push(`标点符号: ${todayStats.punctuation}`);
			if (this.settings.trackNumbers) basicStats.push(`数字: ${todayStats.numbers}`);
			if (this.settings.trackSpaces) basicStats.push(`空格: ${todayStats.spaces}`);
			
			basicStats.forEach(stat => {
				statsContainer.createEl('p', { text: stat });
			});
			
			// 词数统计（如果启用）
			if (this.settings.showWordCount && todayStats.words > 0) {
				statsContainer.createEl('p', {
					text: `词数: ${todayStats.words}`,
					cls: 'word-count-word'
				});
			}
			
			// 统计详情（点击展开）
			const detailsBtn = statsContainer.createEl('button', {
				text: '详细统计',
				cls: 'word-count-details'
			});
			
			const detailsContainer = statsContainer.createDiv({
				cls: 'word-count-details-container'
			});
			detailsContainer.style.display = 'none';
			
			detailsBtn.onclick = () => {
				if (detailsContainer.style.display === 'none') {
					detailsContainer.style.display = 'block';
					detailsBtn.textContent = '收起详情';
					
					// 显示详细统计
					const totalChars = todayStats.chinese + todayStats.english + todayStats.punctuation + todayStats.numbers;
					detailsContainer.createEl('p', {
						text: `总字符数: ${totalChars} (不含空格)`
					});
					detailsContainer.createEl('p', {
						text: `含空格总字符数: ${totalChars + todayStats.spaces}`
					});
					
					// 计算字符类型占比
					if (totalChars > 0) {
						const chinesePercent = ((todayStats.chinese / totalChars) * 100).toFixed(1);
						const englishPercent = ((todayStats.english / totalChars) * 100).toFixed(1);
						const punctuationPercent = ((todayStats.punctuation / totalChars) * 100).toFixed(1);
						const numbersPercent = ((todayStats.numbers / totalChars) * 100).toFixed(1);
						
						detailsContainer.createEl('p', {
							text: `字符类型占比: 中文${chinesePercent}% 英文${englishPercent}% 标点${punctuationPercent}% 数字${numbersPercent}%`
						});
					}
				} else {
					detailsContainer.style.display = 'none';
					detailsBtn.textContent = '详细统计';
				}
			};
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

		// 添加热力图控制选项
		const controlsContainer = heatmapContainer.createDiv({ cls: 'heatmap-controls' });
		
		// 时间范围选择
		const rangeSelect = controlsContainer.createEl('select', { cls: 'heatmap-range' });
		rangeSelect.innerHTML = `
			<option value="7">最近7天</option>
			<option value="30" selected>最近30天</option>
			<option value="90">最近90天</option>
			<option value="365">最近一年</option>
		`;
		rangeSelect.onchange = () => this.updateHeatmap(heatmapContainer, parseInt(rangeSelect.value));
		
		// 显示统计信息
		const statsInfo = controlsContainer.createEl('div', { cls: 'heatmap-stats' });
		statsInfo.textContent = '点击日期查看详情';
		
		// 初始化热力图
		this.updateHeatmap(heatmapContainer, 30);
	}
	
	// 更新热力图
	private updateHeatmap(container: HTMLElement, days: number) {
		// 移除旧的热力图
		const oldGrid = container.querySelector('.heatmap-grid');
		if (oldGrid) {
			oldGrid.remove();
		}
		
		const heatmapGrid = container.createDiv({ cls: 'heatmap-grid' });
		heatmapGrid.setAttribute('data-days', days.toString());
		
		// 获取指定天数的数据
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - days);
		
		// 计算完成目标的日期数量
		let completedDays = 0;
		let totalWords = 0;
		
		// 生成热力图
		for (let i = 0; i < days; i++) {
			const date = new Date(startDate);
			date.setDate(date.getDate() + i);
			const dateStr = date.toISOString().split('T')[0];
			const stats = this.dailyStats.get(dateStr);
			
			const cell = heatmapGrid.createDiv({ cls: 'heatmap-cell' });
			const intensity = stats ? Math.min(1, stats.total / this.settings.dailyGoal) : 0;
			const colorIndex = Math.floor(intensity * (this.settings.heatmapColors.length - 1));
			cell.style.backgroundColor = this.settings.heatmapColors[colorIndex] || '#ebedf0';
			
			// 设置提示信息
			const tooltip = stats
				? `${dateStr}: ${stats.total} 字 (${stats.completed ? '✅' : '❌'})`
				: `${dateStr}: 无数据`;
			cell.setAttribute('title', tooltip);
			
			// 添加点击事件
			cell.onclick = () => {
				this.showDayDetails(dateStr, stats);
			};
			
			// 统计数据
			if (stats) {
				totalWords += stats.total;
				if (stats.completed) {
					completedDays++;
				}
			}
		}
		
		// 更新统计信息
		const statsInfo = container.querySelector('.heatmap-stats');
		if (statsInfo) {
			const completionRate = days > 0 ? ((completedDays / days) * 100).toFixed(1) : '0';
			const avgWords = days > 0 ? Math.round(totalWords / days) : 0;
			statsInfo.textContent = `完成率: ${completionRate}% (${completedDays}/${days}) | 平均字数: ${avgWords}`;
		}
		
		// 添加月份标签
		this.addMonthLabels(heatmapGrid, startDate, days);
	}
	
	// 显示某日详情
	private showDayDetails(dateStr: string, stats: DailyStats | undefined) {
		if (!stats) {
			new Notice(`${dateStr}: 当日无写作记录`);
			return;
		}
		
		const message = `
${dateStr} 写作详情：

总字数: ${stats.total} / ${stats.goal} (${stats.completed ? '✅ 已完成' : '❌ 未完成'})

详细统计：
- 中文字符: ${stats.chinese}
- 英文字符: ${stats.english}
- 标点符号: ${stats.punctuation}
- 数字: ${stats.numbers}
- 空格: ${stats.spaces}
- 词数: ${stats.words}

字符类型占比:
${stats.chinese + stats.english + stats.punctuation + stats.numbers > 0
	? `- 中文: ${((stats.chinese / (stats.chinese + stats.english + stats.punctuation + stats.numbers)) * 100).toFixed(1)}%
- 英文: ${((stats.english / (stats.chinese + stats.english + stats.punctuation + stats.numbers)) * 100).toFixed(1)}%
- 标点: ${((stats.punctuation / (stats.chinese + stats.english + stats.punctuation + stats.numbers)) * 100).toFixed(1)}%
- 数字: ${((stats.numbers / (stats.chinese + stats.english + stats.punctuation + stats.numbers)) * 100).toFixed(1)}%`
	: '- 暂无数据'}
		`;
		
		new Notice(message);
	}
	
	// 添加月份标签
	private addMonthLabels(grid: HTMLElement, startDate: Date, days: number) {
		const monthLabels = grid.createDiv({ cls: 'heatmap-month-labels' });
		
		let currentDate = new Date(startDate);
		let currentMonth = currentDate.getMonth();
		let currentYear = currentDate.getFullYear();
		
		for (let i = 0; i < days; i++) {
			const date = new Date(currentDate);
			date.setDate(date.getDate() + i);
			
			if (date.getMonth() !== currentMonth || date.getFullYear() !== currentYear) {
				// 新月份，添加标签
				const label = monthLabels.createDiv({ cls: 'heatmap-month-label' });
				const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月',
								  '七月', '八月', '九月', '十月', '十一月', '十二月'];
				label.textContent = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
				
				currentMonth = date.getMonth();
				currentYear = date.getFullYear();
			}
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
		let goalValueSpan: HTMLElement;
		
		new Setting(containerEl)
			.setName('每日目标字数')
			.setDesc('设定每日写作目标字数')
			.addSlider(slider => {
				slider.setLimits(100, 10000, 100)
					.setValue(this.plugin.settings.dailyGoal)
					.onChange(async (value: number) => {
						this.plugin.settings.dailyGoal = value;
						// 更新显示当前数值的文本
						if (goalValueSpan) {
							goalValueSpan.setText(value.toString());
						}
						await this.plugin.saveSettings();
					});
			})
			// 添加显示当前数值的文本
			.settingEl.createSpan({ text: '当前目标: ' }, (span) => {
				goalValueSpan = span;
				goalValueSpan.setText(this.plugin.settings.dailyGoal.toString());
				goalValueSpan.style.fontWeight = 'bold';
				goalValueSpan.style.color = 'var(--text-accent)';
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

		new Setting(containerEl)
			.setName('统计数字')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.trackNumbers)
					.onChange(async (value) => {
						this.plugin.settings.trackNumbers = value;
						await this.plugin.saveSettings();
						this.plugin.updateWordCount();
					});
			});

		new Setting(containerEl)
			.setName('统计空格')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.trackSpaces)
					.onChange(async (value) => {
						this.plugin.settings.trackSpaces = value;
						await this.plugin.saveSettings();
						this.plugin.updateWordCount();
					});
			});

		new Setting(containerEl)
			.setName('显示词数统计')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.showWordCount)
					.onChange(async (value) => {
						this.plugin.settings.showWordCount = value;
						await this.plugin.saveSettings();
						this.plugin.updateWordCount();
					});
			});

		// 性能优化设置
		new Setting(containerEl)
			.setName('性能优化')
			.setDesc('启用缓存优化以提高统计性能')
			.setHeading();

		new Setting(containerEl)
			.setName('启用缓存优化')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.enableCache)
					.onChange(async (value) => {
						this.plugin.settings.enableCache = value;
						await this.plugin.saveSettings();
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

