/**
 * 统计信息模态框
 */

import { App, Modal, Notice } from 'obsidian';
import { WordCountSettings } from '../types';
import { DailyStats, StreakData } from '../types/stats';
import { formatNumber, calculatePercentage } from '../utils';
import { HeatmapComponent } from './HeatmapComponent';

export class StatisticsModal extends Modal {
	private dailyStats: Map<string, DailyStats>;
	private streakData: StreakData;
	private settings: WordCountSettings;
	private heatmapComponent: HeatmapComponent | null = null;

	constructor(
		app: App,
		dailyStats: Map<string, DailyStats>,
		streakData: StreakData,
		settings: WordCountSettings
	) {
		super(app);
		this.dailyStats = dailyStats;
		this.streakData = streakData;
		this.settings = settings;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass('word-count-modal');
		contentEl.createEl('h2', { text: '字数统计', cls: 'word-count-modal-title' });

		this.displayTodayStats(contentEl);
		this.displayStreakStats(contentEl);
		
		if (this.settings.enableHeatmap) {
			this.displayNewHeatmap(contentEl);
		}

		const closeButton = contentEl.createEl('button', { text: '关闭', cls: 'modal-button' });
		closeButton.onclick = () => this.close();
	}

	/**
	 * 显示今日统计
	 */
	private displayTodayStats(container: HTMLElement) {
		const today = new Date().toISOString().split('T')[0];
		const todayStats = this.dailyStats.get(today);
		const statsDiv = container.createDiv({ cls: 'word-count-stats' });

		statsDiv.createEl('h3', { text: '今日统计' });

		if (todayStats) {
			const total = todayStats.total || 0;
			const goal = 0; // 不再使用目标
			const completed = todayStats.completed || false;

			statsDiv.createEl('p', { 
				text: `总字数: ${formatNumber(total)} (${completed ? '✅ 已完成' : '❌ 未完成'})` 
			});

			// 显示详细统计
			const details: string[] = [];
			if (this.settings.trackChinese) details.push(`中文字符: ${formatNumber(todayStats.chinese)}`);
			if (this.settings.trackEnglish) details.push(`英文字符: ${formatNumber(todayStats.english)}`);
			if (this.settings.trackPunctuation) details.push(`标点符号: ${formatNumber(todayStats.punctuation)}`);
			if (this.settings.trackNumbers) details.push(`数字: ${formatNumber(todayStats.numbers)}`);
			if (this.settings.trackSpaces) details.push(`空格: ${formatNumber(todayStats.spaces)}`);

			details.forEach(detail => {
				statsDiv.createEl('p', { text: detail });
			});

			// 显示词数统计
			if (this.settings.showWordCount && todayStats.words > 0) {
				statsDiv.createEl('p', { 
					text: `词数: ${formatNumber(todayStats.words)}`, 
					cls: 'word-count-word' 
				});
			}

			// 添加详细统计按钮
			this.createDetailsSection(statsDiv, todayStats);
		} else {
			statsDiv.createEl('p', { text: '今日暂无写作记录' });
		}
	}

	/**
	 * 创建详细统计部分
	 */
	private createDetailsSection(container: HTMLElement, stats: DailyStats) {
		const detailsButton = container.createEl('button', { 
			text: '详细统计', 
			cls: 'word-count-details' 
		});
		
		const detailsContainer = container.createDiv({ cls: 'word-count-details-container' });
		detailsContainer.style.display = 'none';

		detailsButton.onclick = () => {
			if (detailsContainer.style.display === 'none') {
				detailsContainer.style.display = 'block';
				detailsButton.textContent = '收起详情';

				// 计算总字符数（不含空格）
				const totalChars = stats.chinese + stats.english + stats.punctuation + stats.numbers;
				
				detailsContainer.createEl('p', { 
					text: `总字符数: ${formatNumber(totalChars)} (不含空格)` 
				});
				
				detailsContainer.createEl('p', { 
					text: `含空格总字符数: ${formatNumber(totalChars + stats.spaces)}` 
				});

				// 显示字符类型占比
				if (totalChars > 0) {
					const chinesePercent = calculatePercentage(stats.chinese, totalChars);
					const englishPercent = calculatePercentage(stats.english, totalChars);
					const punctuationPercent = calculatePercentage(stats.punctuation, totalChars);
					const numbersPercent = calculatePercentage(stats.numbers, totalChars);

					detailsContainer.createEl('p', { 
						text: `字符类型占比: 中文${chinesePercent} 英文${englishPercent} 标点${punctuationPercent} 数字${numbersPercent}` 
					});
				}
			} else {
				detailsContainer.style.display = 'none';
				detailsButton.textContent = '详细统计';
			}
		};
	}

	/**
	 * 显示连续写作统计
	 */
	private displayStreakStats(container: HTMLElement) {
		const streakDiv = container.createDiv({ cls: 'word-count-streak' });
		streakDiv.createEl('h3', { text: '连续写作' });
		streakDiv.createEl('p', { text: `当前连续: ${this.streakData.current} 天` });
		streakDiv.createEl('p', { text: `最长连续: ${this.streakData.longest} 天` });
	}

	/**
	 * 显示新热力图
	 */
	private displayNewHeatmap(container: HTMLElement) {
		const heatmapWrapper = container.createDiv({ cls: 'word-count-heatmap' });
		const heatmapContainer = heatmapWrapper.createDiv({ cls: 'heatmap-container' });
		this.heatmapComponent = new HeatmapComponent(
			this.app,
			this.settings,
			this.dailyStats,
			heatmapContainer
		);
		this.heatmapComponent.render();
	}


	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
