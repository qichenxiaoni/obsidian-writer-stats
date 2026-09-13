/**
 * 统计数据管理服务
 */

import { App } from 'obsidian';
import { DailyStats, StreakData, CharChange, WordCountSettings, TextAnalysisResult } from '../types';
import { getTodayString, getDaysDifference, CONSTANTS } from '../utils';

export class StatsManager {
	private dailyStats: Map<string, DailyStats> = new Map();
	private streakData: StreakData = { current: 0, longest: 0, lastDate: '' };

	constructor(private app: App, private settings: WordCountSettings) {}

	/**
	 * 更新字数统计
	 * @param fileName 文件名
	 * @param analysisResult 文本分析结果
	 */
	async updateWordCount(fileName: string, analysisResult: TextAnalysisResult): Promise<void> {
		try {
			const today = getTodayString();
			const existingStats = this.dailyStats.get(today) || this.createEmptyStats(today);

			// 计算总字数（根据用户设置）
			let charCount = 0;
			if (this.settings.trackChinese) charCount += analysisResult.chinese;
			if (this.settings.trackEnglish) charCount += analysisResult.english;
			if (this.settings.trackPunctuation) charCount += analysisResult.punctuation;
			if (this.settings.trackNumbers) charCount += analysisResult.numbers;
			if (this.settings.trackSpaces) charCount += analysisResult.spaces;

			const total = charCount || 0;
			const completed = total >= existingStats.goal;

			// 记录字符变化
			const charChange: CharChange = {
				timestamp: Date.now(),
				action: 'add',
				fileName,
				chinese: analysisResult.chinese,
				english: analysisResult.english,
				punctuation: analysisResult.punctuation,
				numbers: analysisResult.numbers,
				spaces: analysisResult.spaces,
				words: analysisResult.words,
				total: total
			};

			// 更新统计数据 - 增量更新而不是累加
			existingStats.chinese = analysisResult.chinese;
			existingStats.english = analysisResult.english;
			existingStats.punctuation = analysisResult.punctuation;
			existingStats.numbers = analysisResult.numbers;
			existingStats.spaces = analysisResult.spaces;
			existingStats.words = analysisResult.words;
			existingStats.total = total;
			existingStats.completed = completed;

			// 添加字符变化记录
			existingStats.charChanges.push(charChange);

			// 限制历史记录数量，避免数据过大
			if (existingStats.charChanges.length > CONSTANTS.MAX_CHAR_CHANGES) {
				existingStats.charChanges = existingStats.charChanges.slice(-CONSTANTS.MAX_CHAR_CHANGES);
			}

			this.dailyStats.set(today, existingStats);
			await this.saveData();

			// 更新连续写作数据
			this.updateStreakData(today);
		} catch (error) {
			console.error('更新字数统计失败:', error);
			throw error;
		}
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
			goal: this.settings.dailyGoal,
			completed: false,
			charChanges: []
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
		this.dailyStats.clear();
		this.streakData = { current: 0, longest: 0, lastDate: '' };
		await this.saveData();
	}

	/**
	 * 保存数据到插件存储
	 */
	private async saveData(): Promise<void> {
		try {
			// 通过插件实例保存数据
			const plugin = (this.app as any).plugins.plugins['word-count-plugin'];
			if (plugin) {
				await plugin.saveData(Array.from(this.dailyStats.values()));
			}
		} catch (error) {
			console.error('保存数据失败:', error);
			throw error;
		}
	}

	/**
	 * 从插件存储加载数据
	 */
	async loadData(): Promise<void> {
		try {
			// 通过插件实例加载数据
			const plugin = (this.app as any).plugins.plugins['word-count-plugin'];
			const historicalData = plugin ? await plugin.loadData() : null;
			
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
					goal: item.goal || this.settings.dailyGoal,
					completed: item.completed || false,
					charChanges: item.charChanges || []
				}));
				this.dailyStats = new Map(validatedData.map(item => [item.date, item]));
			}
		} catch (error) {
			console.error('加载历史数据失败:', error);
			throw error;
		}
	}

	/**
	 * 更新设置
	 * @param newSettings 新设置
	 */
	updateSettings(newSettings: WordCountSettings): void {
		this.settings = newSettings;
		// 更新所有现有统计数据的goal字段
		for (const stats of this.dailyStats.values()) {
			stats.goal = newSettings.dailyGoal;
			stats.completed = stats.total >= newSettings.dailyGoal;
		}
	}
}
