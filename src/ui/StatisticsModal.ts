/**
 * 统计信息模态框组件
 */

import { App, Modal, Notice } from 'obsidian';
import { DailyStats, StreakData, WordCountSettings } from '../types';
import { formatNumber, calculatePercentage } from '../utils';

export class StatisticsModal extends Modal {
	private dailyStats: Map<string, DailyStats>;
	private streakData: StreakData;
	private settings: WordCountSettings;

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

	private displayTodayStats(container: HTMLElement) {
		const today = new Date().toISOString().split('T')[0];
		const todayStats = this.dailyStats.get(today);

		const statsContainer = container.createDiv({ cls: 'word-count-stats' });
		statsContainer.createEl('h3', { text: '今日统计' });

		if (todayStats) {
			// 确保 total 和 goal 是有效的数字
			const total = todayStats.total || 0;
			const goal = todayStats.goal || this.settings.dailyGoal;
			const completed = todayStats.completed || false;
			
			statsContainer.createEl('p', {
				text: `总字数: ${formatNumber(total)} / ${formatNumber(goal)} (${completed ? '✅' : '❌'})`
			});
			
			// 基础字符统计
			const basicStats = [];
			if (this.settings.trackChinese) basicStats.push(`中文字符: ${formatNumber(todayStats.chinese)}`);
			if (this.settings.trackEnglish) basicStats.push(`英文字符: ${formatNumber(todayStats.english)}`);
			if (this.settings.trackPunctuation) basicStats.push(`标点符号: ${formatNumber(todayStats.punctuation)}`);
			if (this.settings.trackNumbers) basicStats.push(`数字: ${formatNumber(todayStats.numbers)}`);
			if (this.settings.trackSpaces) basicStats.push(`空格: ${formatNumber(todayStats.spaces)}`);
			
			basicStats.forEach(stat => {
				statsContainer.createEl('p', { text: stat });
			});
			
			// 词数统计（如果启用）
			if (this.settings.showWordCount && todayStats.words > 0) {
				statsContainer.createEl('p', {
					text: `词数: ${formatNumber(todayStats.words)}`,
					cls: 'word-count-word'
				});
			}
			
			// 统计详情（点击展开）
			this.createDetailsSection(statsContainer, todayStats);
		} else {
			statsContainer.createEl('p', { text: '今日暂无写作记录' });
		}
	}

	private createDetailsSection(container: HTMLElement, todayStats: DailyStats) {
		const detailsBtn = container.createEl('button', {
			text: '详细统计',
			cls: 'word-count-details'
		});
		
		const detailsContainer = container.createDiv({
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
					text: `总字符数: ${formatNumber(totalChars)} (不含空格)`
				});
				detailsContainer.createEl('p', {
					text: `含空格总字符数: ${formatNumber(totalChars + todayStats.spaces)}`
				});
				
				// 计算字符类型占比
				if (totalChars > 0) {
					const chinesePercent = calculatePercentage(todayStats.chinese, totalChars);
					const englishPercent = calculatePercentage(todayStats.english, totalChars);
					const punctuationPercent = calculatePercentage(todayStats.punctuation, totalChars);
					const numbersPercent = calculatePercentage(todayStats.numbers, totalChars);
					
					detailsContainer.createEl('p', {
						text: `字符类型占比: 中文${chinesePercent} 英文${englishPercent} 标点${punctuationPercent} 数字${numbersPercent}`
					});
				}
			} else {
				detailsContainer.style.display = 'none';
				detailsBtn.textContent = '详细统计';
			}
		};
	}

	private displayStreakStats(container: HTMLElement) {
		const streakContainer = container.createDiv({ cls: 'word-count-streak' });
		streakContainer.createEl('h3', { text: '连续写作' });

		streakContainer.createEl('p', { text: `当前连续: ${this.streakData.current} 天` });
		streakContainer.createEl('p', { text: `最长连续: ${this.streakData.longest} 天` });
	}

	private displayHeatmap(container: HTMLElement) {
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
			const intensity = stats ? Math.min(1, stats.total / (this.settings.dailyGoal || 1000)) : 0;
			const colorIndex = Math.floor(intensity * (this.settings.heatmapColors.length - 1));
			cell.style.backgroundColor = this.settings.heatmapColors[colorIndex] || '#ebedf0';
			
			// 根据完成状态添加样式类
			if (stats && stats.completed) {
				cell.classList.add('completed');
			}
			
			// 设置提示信息
			const tooltip = stats
				? `${dateStr}: ${formatNumber(stats.total)} 字 (${stats.completed ? '✅ 已完成' : '❌ 未完成'})`
				: `${dateStr}: 无数据`;
			cell.setAttribute('title', tooltip);
			
			// 添加点击事件
			cell.onclick = () => {
				this.showDayDetails(dateStr, stats);
			};
			
			// 添加动画延迟
			cell.style.animationDelay = `${i * 0.01}s`;
			
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
			const completionRate = days > 0 ? calculatePercentage(completedDays, days) : '0%';
			const avgWords = days > 0 ? Math.round(totalWords / days) : 0;
			statsInfo.textContent = `完成率: ${completionRate} (${completedDays}/${days}) | 平均字数: ${formatNumber(avgWords)}`;
		}
		
		// 添加月份标签
		this.addMonthLabels(heatmapGrid, startDate, days);
	}
	
	private showDayDetails(dateStr: string, stats: DailyStats | undefined) {
		if (!stats) {
			new Notice(`${dateStr}: 当日无写作记录`);
			return;
		}
		
		const message = `
${dateStr} 写作详情：

总字数: ${formatNumber(stats.total)} / ${formatNumber(stats.goal)} (${stats.completed ? '✅ 已完成' : '❌ 未完成'})

详细统计：
- 中文字符: ${formatNumber(stats.chinese)}
- 英文字符: ${formatNumber(stats.english)}
- 标点符号: ${formatNumber(stats.punctuation)}
- 数字: ${formatNumber(stats.numbers)}
- 空格: ${formatNumber(stats.spaces)}
- 词数: ${formatNumber(stats.words)}

字符类型占比:
${stats.chinese + stats.english + stats.punctuation + stats.numbers > 0
	? `- 中文: ${calculatePercentage(stats.chinese, (stats.chinese + stats.english + stats.punctuation + stats.numbers))}
- 英文: ${calculatePercentage(stats.english, (stats.chinese + stats.english + stats.punctuation + stats.numbers))}
- 标点: ${calculatePercentage(stats.punctuation, (stats.chinese + stats.english + stats.punctuation + stats.numbers))}
- 数字: ${calculatePercentage(stats.numbers, (stats.chinese + stats.english + stats.punctuation + stats.numbers))}`
	: '- 暂无数据'}
		`;
		
		new Notice(message);
	}
	
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
