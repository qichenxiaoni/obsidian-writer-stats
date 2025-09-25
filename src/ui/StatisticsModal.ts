/**
 * 统计信息模态框
 */

import { App, Modal, Notice } from 'obsidian';
import { WordCountSettings } from '../types';
import { DailyStats, StreakData, GoalStats } from '../types/stats';
import { formatNumber, calculatePercentage } from '../utils';
import { HeatmapComponent } from './HeatmapComponent';

export class StatisticsModal extends Modal {
	private dailyStats: Map<string, DailyStats>;
	private streakData: StreakData;
	private settings: WordCountSettings;
	private goalStats: GoalStats;
	private cacheStats: any;
	private heatmapComponent: HeatmapComponent | null = null;

	constructor(
		app: App,
		dailyStats: Map<string, DailyStats>,
		streakData: StreakData,
		settings: WordCountSettings,
		goalStats: GoalStats,
		cacheStats: any
	) {
		super(app);
		this.dailyStats = dailyStats;
		this.streakData = streakData;
		this.settings = settings;
		this.goalStats = goalStats;
		this.cacheStats = cacheStats;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass('word-count-modal');
		contentEl.createEl('h2', { text: '写作统计', cls: 'word-count-modal-title' });

		this.displayTodayStats(contentEl);
		this.displayStreakStats(contentEl);
		
		// 显示写作目标统计
		if (this.settings.enableWritingGoals) {
			this.displayGoalStats(contentEl);
		}
		
		
		// 显示缓存统计
		if (this.settings.enableCache) {
			this.displayCacheStats(contentEl);
		}
		
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
	 * 显示写作目标统计
	 */
	private displayGoalStats(container: HTMLElement) {
		const goalDiv = container.createDiv({ cls: 'word-count-goals' });
		goalDiv.createEl('h3', { text: '写作目标' });

		// 今日目标
		const todayGoal = this.settings.dailyWordGoal;
		if (todayGoal > 0) {
			const todayStats = this.dailyStats.get(new Date().toISOString().split('T')[0]);
			const todayWords = todayStats ? todayStats.total : 0;
			const completionRate = Math.round((todayWords / todayGoal) * 100);
			const completed = todayWords >= todayGoal;

			goalDiv.createEl('p', { 
				text: `今日目标: ${formatNumber(todayWords)}/${formatNumber(todayGoal)} (${completionRate}%)`,
				cls: completed ? 'goal-completed' : 'goal-incomplete'
			});
		}

		// 目标完成率统计
		goalDiv.createEl('p', { text: `每日目标完成率: ${this.goalStats.dailyCompletionRate.toFixed(1)}%` });
		goalDiv.createEl('p', { text: `连续完成目标: ${this.goalStats.consecutiveGoalDays} 天` });
		goalDiv.createEl('p', { text: `最长连续完成: ${this.goalStats.longestConsecutiveGoalDays} 天` });
	}


	/**
	 * 显示缓存统计
	 */
	private displayCacheStats(container: HTMLElement) {
		const cacheDiv = container.createDiv({ cls: 'word-count-cache' });
		cacheDiv.createEl('h3', { text: '缓存性能' });

		if (!this.cacheStats) {
			cacheDiv.createEl('p', { text: '暂无缓存统计数据' });
			return;
		}

		// 基本统计
		const basicStats = cacheDiv.createDiv({ cls: 'cache-basic-stats' });
		basicStats.createEl('h4', { text: '基本指标' });
		
		const statsContainer = basicStats.createDiv({ cls: 'cache-stats-grid' });
		statsContainer.style.display = 'grid';
		statsContainer.style.gridTemplateColumns = '1fr 1fr';
		statsContainer.style.gap = '10px';
		statsContainer.style.marginBottom = '15px';

		const leftColumn = statsContainer.createDiv();
		const rightColumn = statsContainer.createDiv();

		leftColumn.createEl('p', { 
			text: `命中率: ${this.cacheStats.hitRate.toFixed(1)}%`,
			cls: 'cache-stat-item'
		});
		leftColumn.createEl('p', { 
			text: `缓存项数: ${this.cacheStats.itemCount}`,
			cls: 'cache-stat-item'
		});

		rightColumn.createEl('p', { 
			text: `总请求: ${this.cacheStats.totalRequests}`,
			cls: 'cache-stat-item'
		});
		rightColumn.createEl('p', { 
			text: `命中次数: ${this.cacheStats.hits}`,
			cls: 'cache-stat-item'
		});
		rightColumn.createEl('p', { 
			text: `未命中次数: ${this.cacheStats.misses}`,
			cls: 'cache-stat-item'
		});

		// 性能分析
		if (this.cacheStats.totalRequests > 0) {
			const performanceDiv = cacheDiv.createDiv({ cls: 'cache-performance' });
			performanceDiv.createEl('h4', { text: '性能分析' });

			const hitRateColor = this.cacheStats.hitRate >= 80 ? '#10b981' : 
								 this.cacheStats.hitRate >= 60 ? '#f59e0b' : '#ef4444';
			
			const performanceBar = performanceDiv.createDiv({ cls: 'performance-bar' });
			performanceBar.style.backgroundColor = '#f3f4f6';
			performanceBar.style.borderRadius = '6px';
			performanceBar.style.overflow = 'hidden';
			performanceBar.style.height = '20px';
			performanceBar.style.marginBottom = '10px';

			const progressFill = performanceBar.createDiv();
			progressFill.style.backgroundColor = hitRateColor;
			progressFill.style.height = '100%';
			progressFill.style.width = `${this.cacheStats.hitRate}%`;
			progressFill.style.transition = 'width 0.3s ease';

			performanceDiv.createEl('p', {
				text: `缓存效率: ${this.getPerformanceText(this.cacheStats.hitRate)}`,
				cls: 'performance-text'
			});
		}
	}

	/**
	 * 获取性能文本描述
	 */
	private getPerformanceText(hitRate: number): string {
		if (hitRate >= 90) return '优秀';
		if (hitRate >= 80) return '良好';
		if (hitRate >= 60) return '一般';
		if (hitRate >= 40) return '较差';
		return '很差';
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
