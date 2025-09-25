/**
 * 写作目标管理服务
 */

import { App } from 'obsidian';
import { WordCountSettings } from '../types/settings';
import { DailyStats, GoalStats, GoalRecord } from '../types/stats';
import { getTodayString, getWeekString, getMonthString } from '../utils';
import { DataAccessService } from './dataAccessService';
import { errorHandler, ErrorLevel } from './errorHandler';

export class GoalManager {
	private app: App;
	private settings: WordCountSettings;
	private goalStats: GoalStats;
	private dataAccess: DataAccessService;

	constructor(app: App, settings: WordCountSettings) {
		this.app = app;
		this.settings = settings;
		this.goalStats = this.createEmptyGoalStats();
		this.dataAccess = DataAccessService.getInstance(app, 'obsidian-writer-stats');
	}

	/**
	 * 创建空的目标统计数据
	 */
	private createEmptyGoalStats(): GoalStats {
		return {
			dailyCompletionRate: 0,
			weeklyCompletionRate: 0,
			monthlyCompletionRate: 0,
			consecutiveGoalDays: 0,
			longestConsecutiveGoalDays: 0,
			goalRecords: []
		};
	}

	/**
	 * 更新目标完成情况
	 * @param dailyStats 每日统计数据
	 */
	async updateGoalProgress(dailyStats: DailyStats): Promise<void> {
		await errorHandler.wrapAsync(async () => {
			if (!this.settings.enableWritingGoals) {
				return;
			}

			const today = getTodayString();
			const weekString = getWeekString(new Date());
			const monthString = getMonthString(new Date());

			// 更新每日目标
			await this.updateDailyGoal(dailyStats, today);

			// 更新每周目标
			await this.updateWeeklyGoal(dailyStats, weekString);

			// 更新每月目标
			await this.updateMonthlyGoal(dailyStats, monthString);

			// 更新连续完成目标天数
			this.updateConsecutiveGoalDays();

			// 保存目标统计数据
			await this.saveGoalStats();
		}, {
			component: 'GoalManager',
			operation: 'updateGoalProgress'
		});
	}

	/**
	 * 更新每日目标
	 */
	private async updateDailyGoal(dailyStats: DailyStats, date: string): Promise<void> {
		const goal = this.settings.dailyWordGoal;
		const actual = dailyStats.total;
		const completionRate = goal > 0 ? (actual / goal) * 100 : 0;
		const completed = actual >= goal;

		// 查找或创建目标记录
		let goalRecord = this.goalStats.goalRecords.find(
			record => record.date === date && record.type === 'daily'
		);

		if (!goalRecord) {
			goalRecord = {
				date,
				type: 'daily',
				goal,
				actual,
				completionRate,
				completed
			};
			this.goalStats.goalRecords.push(goalRecord);
		} else {
			goalRecord.actual = actual;
			goalRecord.completionRate = completionRate;
			goalRecord.completed = completed;
		}

		// 更新每日目标完成率
		this.updateDailyCompletionRate();
	}

	/**
	 * 更新每周目标
	 */
	private async updateWeeklyGoal(dailyStats: DailyStats, weekString: string): Promise<void> {
		const goal = this.settings.weeklyWordGoal;
		
		// 计算本周总字数
		const weekStart = new Date(weekString);
		const weekEnd = new Date(weekStart);
		weekEnd.setDate(weekStart.getDate() + 6);

		let weekTotal = 0;
		for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
			const dateString = d.toISOString().split('T')[0];
			const dayStats = await this.getDayStats(dateString);
			if (dayStats) {
				weekTotal += dayStats.total;
			}
		}

		const completionRate = goal > 0 ? (weekTotal / goal) * 100 : 0;
		const completed = weekTotal >= goal;

		// 查找或创建目标记录
		let goalRecord = this.goalStats.goalRecords.find(
			record => record.date === weekString && record.type === 'weekly'
		);

		if (!goalRecord) {
			goalRecord = {
				date: weekString,
				type: 'weekly',
				goal,
				actual: weekTotal,
				completionRate,
				completed
			};
			this.goalStats.goalRecords.push(goalRecord);
		} else {
			goalRecord.actual = weekTotal;
			goalRecord.completionRate = completionRate;
			goalRecord.completed = completed;
		}

		// 更新每周目标完成率
		this.updateWeeklyCompletionRate();
	}

	/**
	 * 更新每月目标
	 */
	private async updateMonthlyGoal(dailyStats: DailyStats, monthString: string): Promise<void> {
		const goal = this.settings.monthlyWordGoal;
		
		// 计算本月总字数
		const monthStart = new Date(monthString + '-01');
		const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

		let monthTotal = 0;
		for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
			const dateString = d.toISOString().split('T')[0];
			const dayStats = await this.getDayStats(dateString);
			if (dayStats) {
				monthTotal += dayStats.total;
			}
		}

		const completionRate = goal > 0 ? (monthTotal / goal) * 100 : 0;
		const completed = monthTotal >= goal;

		// 查找或创建目标记录
		let goalRecord = this.goalStats.goalRecords.find(
			record => record.date === monthString && record.type === 'monthly'
		);

		if (!goalRecord) {
			goalRecord = {
				date: monthString,
				type: 'monthly',
				goal,
				actual: monthTotal,
				completionRate,
				completed
			};
			this.goalStats.goalRecords.push(goalRecord);
		} else {
			goalRecord.actual = monthTotal;
			goalRecord.completionRate = completionRate;
			goalRecord.completed = completed;
		}

		// 更新每月目标完成率
		this.updateMonthlyCompletionRate();
	}

	/**
	 * 更新连续完成目标天数
	 */
	private updateConsecutiveGoalDays(): void {
		const today = new Date();
		let consecutiveDays = 0;
		let longestConsecutive = 0;
		let currentConsecutive = 0;

		// 从今天开始往前查找连续完成目标的天数
		for (let i = 0; i < 365; i++) {
			const date = new Date(today);
			date.setDate(today.getDate() - i);
			const dateString = date.toISOString().split('T')[0];

			const dailyRecord = this.goalStats.goalRecords.find(
				record => record.date === dateString && record.type === 'daily'
			);

			if (dailyRecord && dailyRecord.completed) {
				currentConsecutive++;
				if (i === 0) {
					// 今天完成了，连续天数就是当前连续天数
					consecutiveDays = currentConsecutive;
				}
				longestConsecutive = Math.max(longestConsecutive, currentConsecutive);
			} else {
				if (i === 0) {
					// 今天没完成，连续天数从0开始
					consecutiveDays = 0;
				}
				break;
			}
		}

		this.goalStats.consecutiveGoalDays = consecutiveDays;
		this.goalStats.longestConsecutiveGoalDays = longestConsecutive;
	}

	/**
	 * 更新每日目标完成率
	 */
	private updateDailyCompletionRate(): void {
		const dailyRecords = this.goalStats.goalRecords.filter(record => record.type === 'daily');
		if (dailyRecords.length === 0) {
			this.goalStats.dailyCompletionRate = 0;
			return;
		}

		const completedDays = dailyRecords.filter(record => record.completed).length;
		this.goalStats.dailyCompletionRate = (completedDays / dailyRecords.length) * 100;
	}

	/**
	 * 更新每周目标完成率
	 */
	private updateWeeklyCompletionRate(): void {
		const weeklyRecords = this.goalStats.goalRecords.filter(record => record.type === 'weekly');
		if (weeklyRecords.length === 0) {
			this.goalStats.weeklyCompletionRate = 0;
			return;
		}

		const completedWeeks = weeklyRecords.filter(record => record.completed).length;
		this.goalStats.weeklyCompletionRate = (completedWeeks / weeklyRecords.length) * 100;
	}

	/**
	 * 更新每月目标完成率
	 */
	private updateMonthlyCompletionRate(): void {
		const monthlyRecords = this.goalStats.goalRecords.filter(record => record.type === 'monthly');
		if (monthlyRecords.length === 0) {
			this.goalStats.monthlyCompletionRate = 0;
			return;
		}

		const completedMonths = monthlyRecords.filter(record => record.completed).length;
		this.goalStats.monthlyCompletionRate = (completedMonths / monthlyRecords.length) * 100;
	}

	/**
	 * 获取某天的统计数据
	 */
	private async getDayStats(date: string): Promise<DailyStats | null> {
		try {
			const statsManager = this.dataAccess.getStatsManager();
			if (!statsManager) return null;

			const allStats = statsManager.getAllStats();
			return allStats.get(date) || null;
		} catch (error) {
			console.error('获取每日统计数据失败:', error);
			return null;
		}
	}

	/**
	 * 获取目标统计数据
	 */
	getGoalStats(): GoalStats {
		return this.goalStats;
	}

	/**
	 * 获取今日目标完成情况
	 */
	getTodayGoalProgress(): { goal: number; actual: number; completionRate: number; completed: boolean } {
		const today = getTodayString();
		const goal = this.settings.dailyWordGoal;
		
		const todayRecord = this.goalStats.goalRecords.find(
			record => record.date === today && record.type === 'daily'
		);

		if (todayRecord) {
			return {
				goal: todayRecord.goal,
				actual: todayRecord.actual,
				completionRate: todayRecord.completionRate,
				completed: todayRecord.completed
			};
		}

		return {
			goal,
			actual: 0,
			completionRate: 0,
			completed: false
		};
	}

	/**
	 * 检查是否需要发送目标提醒
	 */
	checkGoalReminder(): boolean {
		if (!this.settings.enableGoalReminders) {
			return false;
		}

		const now = new Date();
		const reminderTime = this.settings.goalReminderTime.split(':');
		const reminderHour = parseInt(reminderTime[0]);
		const reminderMinute = parseInt(reminderTime[1]);

		// 检查是否到了提醒时间
		if (now.getHours() === reminderHour && now.getMinutes() === reminderMinute) {
			const todayProgress = this.getTodayGoalProgress();
			
			// 如果目标未完成，发送提醒
			return !todayProgress.completed;
		}

		return false;
	}

	/**
	 * 保存目标统计数据
	 */
	private async saveGoalStats(): Promise<void> {
		await errorHandler.wrapAsync(async () => {
			const existingData = await this.dataAccess.loadData() || {};
			existingData.goalStats = this.goalStats;
			await this.dataAccess.saveData(existingData);
		}, {
			component: 'GoalManager',
			operation: 'saveGoalStats'
		});
	}

	/**
	 * 加载目标统计数据
	 */
	async loadGoalStats(): Promise<void> {
		await errorHandler.wrapAsync(async () => {
			const data = await this.dataAccess.loadData();
			if (data && data.goalStats) {
				this.goalStats = { ...this.createEmptyGoalStats(), ...data.goalStats };
			}
		}, {
			component: 'GoalManager',
			operation: 'loadGoalStats'
		});
	}

	/**
	 * 更新设置
	 */
	updateSettings(newSettings: WordCountSettings): void {
		this.settings = newSettings;
	}

	/**
	 * 重置目标统计数据
	 */
	async resetGoalStats(): Promise<void> {
		this.goalStats = this.createEmptyGoalStats();
		await this.saveGoalStats();
	}
}

