/**
 * 热力图组件 - 重新设计版本
 */

import { App, Notice } from 'obsidian';
import { WordCountSettings } from '../types';
import { DailyStats } from '../types/stats';
import { formatNumber, calculatePercentage } from '../utils';

export interface HeatmapData {
	date: string;
	wordCount: number;
	completed: boolean;
}

export class HeatmapComponent {
	private app: App;
	private settings: WordCountSettings;
	private dailyStats: Map<string, DailyStats>;
	private container: HTMLElement;
	private currentDays: number;
	private currentZoom: number;
	private zoomContainer: HTMLElement | null = null;
	private hideControlsTimer: number | null = null;

	constructor(
		app: App,
		settings: WordCountSettings,
		dailyStats: Map<string, DailyStats>,
		container: HTMLElement
	) {
		this.app = app;
		this.settings = settings;
		this.dailyStats = dailyStats;
		this.container = container;
		this.currentDays = 30; // 固定显示最近30天
		this.currentZoom = this.settings.heatmapDefaultZoom || 1.0;
		
		console.log('HeatmapComponent 初始化:', {
			currentDays: this.currentDays,
			currentZoom: this.currentZoom,
			dataSize: this.dailyStats.size,
			settings: {
				heatmapColors: this.settings.heatmapColors,
				enableHeatmapZoom: this.settings.enableHeatmapZoom
			}
		});
	}

	/**
	 * 渲染热力图
	 */
	public render(): void {
		try {
			console.log('开始渲染热力图，数据量：', this.dailyStats.size);
			console.log('当前天数设置：', this.currentDays);
			console.log('当前缩放级别：', this.currentZoom);
			
			this.clear();
			this.createHeader();
			this.createControls();
			this.createZoomContainer();
			this.createHeatmap();
			this.createStats();
			
			console.log('热力图渲染完成');
		} catch (error) {
			console.error('热力图渲染失败：', error);
		}
	}

	/**
	 * 清除容器内容
	 */
	private clear(): void {
		this.container.empty();
	}

	/**
	 * 创建标题
	 */
	private createHeader(): void {
		const header = this.container.createDiv({ cls: 'heatmap-header' });
		header.createEl('h3', { text: '写作热力图' });
	}

	/**
	 * 创建控制面板 - 已移除时间范围选择器
	 */
	private createControls(): void {
		// 不再创建控制面板，直接使用默认30天
		console.log('使用默认30天显示，无需控制面板');
	}

	/**
	 * 创建缩放容器
	 */
	private createZoomContainer(): void {
		if (!this.settings.enableHeatmapZoom) {
			return;
		}

		// 创建缩放容器
		this.zoomContainer = this.container.createDiv({ cls: 'heatmap-zoom-container' });
		this.zoomContainer.style.position = 'relative';
		this.zoomContainer.style.overflow = 'visible'; // 修复：确保边缘不被裁剪
		this.zoomContainer.style.borderRadius = '12px';
		this.zoomContainer.style.border = '2px solid var(--background-modifier-border)';
		this.zoomContainer.style.background = 'linear-gradient(135deg, var(--background-primary), var(--background-secondary))';

		// 添加鼠标滚轮缩放事件
		this.zoomContainer.addEventListener('wheel', (e) => {
			e.preventDefault();
			this.handleZoom(e.deltaY > 0 ? -0.1 : 0.1);
		});

		// 添加鼠标悬停显示控制按钮
		this.zoomContainer.addEventListener('mouseenter', () => {
			this.showZoomControls();
		});

		this.zoomContainer.addEventListener('mouseleave', () => {
			this.hideZoomControls();
		});

		// 添加缩放控制按钮
		this.createZoomControls();
	}

	/**
	 * 创建缩放控制按钮
	 */
	private createZoomControls(): void {
		if (!this.zoomContainer) return;

		const controlsContainer = this.zoomContainer.createDiv({ cls: 'zoom-controls' });
		controlsContainer.style.position = 'absolute';
		controlsContainer.style.top = '10px'; // 移到热力图内部右上角
		controlsContainer.style.right = '10px';
		controlsContainer.style.display = 'none'; // 默认隐藏
		controlsContainer.style.gap = '5px';
		controlsContainer.style.zIndex = '10';
		controlsContainer.style.background = 'rgba(var(--background-primary-rgb), 0.95)';
		controlsContainer.style.borderRadius = '8px';
		controlsContainer.style.padding = '8px';
		(controlsContainer.style as any).backdropFilter = 'blur(8px)';
		controlsContainer.style.border = '1px solid var(--background-modifier-border)';
		controlsContainer.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
		controlsContainer.style.transition = 'opacity 0.3s ease';

		// 缩小按钮
		const zoomOutBtn = controlsContainer.createEl('button', { text: '−' });
		zoomOutBtn.style.width = '32px';
		zoomOutBtn.style.height = '32px';
		zoomOutBtn.style.borderRadius = '6px';
		zoomOutBtn.style.border = '1px solid var(--background-modifier-border)';
		zoomOutBtn.style.background = 'var(--background-primary)';
		zoomOutBtn.style.color = 'var(--text-normal)';
		zoomOutBtn.style.cursor = 'pointer';
		zoomOutBtn.style.fontSize = '16px';
		zoomOutBtn.style.fontWeight = 'bold';
		zoomOutBtn.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
		zoomOutBtn.onclick = () => this.handleZoom(-0.1);

		// 缩放级别显示
		const zoomLevel = controlsContainer.createEl('span', { text: `${Math.round(this.currentZoom * 100)}%` });
		zoomLevel.style.padding = '0 8px';
		zoomLevel.style.fontSize = '12px';
		zoomLevel.style.color = 'var(--text-muted)';
		zoomLevel.style.display = 'flex';
		zoomLevel.style.alignItems = 'center';

		// 放大按钮
		const zoomInBtn = controlsContainer.createEl('button', { text: '+' });
		zoomInBtn.style.width = '32px';
		zoomInBtn.style.height = '32px';
		zoomInBtn.style.borderRadius = '6px';
		zoomInBtn.style.border = '1px solid var(--background-modifier-border)';
		zoomInBtn.style.background = 'var(--background-primary)';
		zoomInBtn.style.color = 'var(--text-normal)';
		zoomInBtn.style.cursor = 'pointer';
		zoomInBtn.style.fontSize = '16px';
		zoomInBtn.style.fontWeight = 'bold';
		zoomInBtn.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
		zoomInBtn.onclick = () => this.handleZoom(0.1);

		// 重置按钮
		const resetBtn = controlsContainer.createEl('button', { text: '↺' });
		resetBtn.style.width = '32px';
		resetBtn.style.height = '32px';
		resetBtn.style.borderRadius = '6px';
		resetBtn.style.border = '1px solid var(--background-modifier-border)';
		resetBtn.style.background = 'var(--background-primary)';
		resetBtn.style.color = 'var(--text-normal)';
		resetBtn.style.cursor = 'pointer';
		resetBtn.style.fontSize = '14px';
		resetBtn.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
		resetBtn.onclick = () => this.resetZoom();

		// 存储缩放级别显示元素，用于更新
		(this as any).zoomLevelElement = zoomLevel;
	}

	/**
	 * 处理缩放
	 */
	private handleZoom(delta: number): void {
		const newZoom = Math.max(
			this.settings.heatmapMinZoom,
			Math.min(this.settings.heatmapMaxZoom, this.currentZoom + delta)
		);

		if (newZoom !== this.currentZoom) {
			this.currentZoom = newZoom;
			this.applyZoom();
			this.updateZoomLevel();
			this.showZoomControlsTemporarily(); // 缩放时显示控制按钮
		}
	}

	/**
	 * 重置缩放
	 */
	private resetZoom(): void {
		this.currentZoom = this.settings.heatmapDefaultZoom;
		this.applyZoom();
		this.updateZoomLevel();
		this.showZoomControlsTemporarily(); // 重置时也显示控制按钮
	}

	/**
	 * 显示缩放控制按钮
	 */
	private showZoomControls(): void {
		const controlsContainer = this.zoomContainer?.querySelector('.zoom-controls') as HTMLElement;
		if (controlsContainer) {
			controlsContainer.style.display = 'flex';
			controlsContainer.style.opacity = '1';
		}
	}

	/**
	 * 隐藏缩放控制按钮
	 */
	private hideZoomControls(): void {
		const controlsContainer = this.zoomContainer?.querySelector('.zoom-controls') as HTMLElement;
		if (controlsContainer) {
			controlsContainer.style.opacity = '0';
			setTimeout(() => {
				if (controlsContainer.style.opacity === '0') {
					controlsContainer.style.display = 'none';
				}
			}, 300);
		}
	}

	/**
	 * 临时显示缩放控制按钮（3秒后隐藏）
	 */
	private showZoomControlsTemporarily(): void {
		this.showZoomControls();
		
		// 清除之前的定时器
		if (this.hideControlsTimer) {
			clearTimeout(this.hideControlsTimer);
		}
		
		// 设置新的定时器
		this.hideControlsTimer = window.setTimeout(() => {
			this.hideZoomControls();
		}, 3000);
	}

	/**
	 * 应用缩放
	 */
	private applyZoom(): void {
		if (!this.zoomContainer) return;

		const heatmapGrid = this.zoomContainer.querySelector('.heatmap-grid') as HTMLElement;
		if (heatmapGrid) {
			heatmapGrid.style.transform = `scale(${this.currentZoom})`;
			heatmapGrid.style.transformOrigin = 'center center';
			heatmapGrid.style.transition = 'transform 0.2s ease';
		}
	}

	/**
	 * 更新缩放级别显示
	 */
	private updateZoomLevel(): void {
		const zoomLevelElement = (this as any).zoomLevelElement;
		if (zoomLevelElement) {
			zoomLevelElement.textContent = `${Math.round(this.currentZoom * 100)}%`;
		}
	}

	/**
	 * 创建热力图网格
	 */
	private createHeatmap(): void {
		// 确定热力图容器
		const parentContainer = this.zoomContainer || this.container;
		
		// 查找或创建热力图容器 - 避免重复创建
		let heatmapContainer = parentContainer.querySelector('.heatmap-content') as HTMLElement;
		if (!heatmapContainer) {
			heatmapContainer = parentContainer.createDiv({ cls: 'heatmap-content' });
		}

		const grid = heatmapContainer.createDiv({ 
			cls: 'heatmap-grid',
			attr: { 'data-days': this.currentDays.toString() }
		});

		const heatmapData = this.generateHeatmapData();
		console.log(`创建热力图网格，${heatmapData.length} 个单元格`);
		
		if (heatmapData.length === 0) {
			console.warn('热力图数据为空，显示空状态');
			grid.createDiv({ 
				cls: 'heatmap-empty',
				text: '暂无数据'
			});
			return;
		}
		
		heatmapData.forEach((data, index) => {
			const cell = grid.createDiv({ cls: 'heatmap-cell' });
			
			// 设置单元格样式
			cell.style.backgroundColor = this.getCellColor(data.wordCount);
			cell.style.width = '24px'; // 更新为新的尺寸
			cell.style.height = '24px'; // 更新为新的尺寸
			cell.setAttribute('data-date', data.date);
			cell.setAttribute('data-words', data.wordCount.toString());
			cell.setAttribute('data-completed', data.completed.toString());
			cell.setAttribute('data-theme', this.settings.heatmapColorTheme); // 添加主题属性
			
			// 添加完成状态类
			if (data.completed) {
				cell.classList.add('completed');
			}
			
			// 设置工具提示
			cell.setAttribute('title', this.getTooltipText(data));
			
			// 添加点击事件
			cell.addEventListener('click', () => this.showDayDetails(data));
			
			// 添加动画延迟
			cell.style.animationDelay = `${index * 0.01}s`;
		});

		console.log(`热力图网格创建完成，包含 ${grid.children.length} 个单元格`);
		
		// 如果启用了缩放功能，应用初始缩放
		if (this.settings.enableHeatmapZoom && this.currentZoom !== 1.0) {
			setTimeout(() => this.applyZoom(), 100);
		}
	}

	/**
	 * 创建统计信息
	 */
	private createStats(): void {
		const statsContainer = this.container.createDiv({ cls: 'heatmap-stats-container' });
		
		const heatmapData = this.generateHeatmapData();
		const completedDays = heatmapData.filter(data => data.completed).length;
		const totalWords = heatmapData.reduce((sum, data) => sum + data.wordCount, 0);
		const averageWords = this.currentDays > 0 ? Math.round(totalWords / this.currentDays) : 0;
		const completionRate = this.currentDays > 0 ? calculatePercentage(completedDays, this.currentDays) : '0%';

		statsContainer.innerHTML = `
			<div class="stat-item">
				<span class="stat-label">完成率</span>
				<span class="stat-value">${completionRate}</span>
			</div>
			<div class="stat-item">
				<span class="stat-label">完成天数</span>
				<span class="stat-value">${completedDays}/${this.currentDays}</span>
			</div>
			<div class="stat-item">
				<span class="stat-label">平均字数</span>
				<span class="stat-value">${formatNumber(averageWords)}</span>
			</div>
			<div class="stat-item">
				<span class="stat-label">总字数</span>
				<span class="stat-value">${formatNumber(totalWords)}</span>
			</div>
		`;
	}

	/**
	 * 生成热力图数据
	 */
	private generateHeatmapData(): HeatmapData[] {
		const data: HeatmapData[] = [];
		const today = new Date();
		const startDate = new Date(today);
		startDate.setDate(today.getDate() - this.currentDays + 1);

		console.log(`生成热力图数据，范围: ${this.currentDays} 天`);
		console.log(`开始日期: ${startDate.toISOString().split('T')[0]}`);
		console.log(`结束日期: ${today.toISOString().split('T')[0]}`);
		console.log(`统计数据总量: ${this.dailyStats.size}`);
		console.log(`统计数据示例:`, Array.from(this.dailyStats.entries()).slice(0, 3));

		for (let i = 0; i < this.currentDays; i++) {
			const currentDate = new Date(startDate);
			currentDate.setDate(startDate.getDate() + i);
			const dateString = currentDate.toISOString().split('T')[0];
			
			const dayStats = this.dailyStats.get(dateString);
			const wordCount = dayStats?.total || 0;
			const completed = dayStats?.completed || false;

			data.push({
				date: dateString,
				wordCount,
				completed
			});
		}

		console.log(`生成了 ${data.length} 个数据点`);
		console.log('热力图数据示例：', data.slice(0, 3));
		
		// 如果所有数据都是0，创建一些测试数据
		const hasData = data.some(d => d.wordCount > 0);
		if (!hasData && this.dailyStats.size === 0) {
			console.log('没有实际数据，将显示测试数据');
			return this.generateTestData();
		}
		
		return data;
	}

	/**
	 * 生成测试数据
	 */
	private generateTestData(): HeatmapData[] {
		const testData: HeatmapData[] = [];
		for (let i = 0; i < this.currentDays; i++) {
			const date = new Date();
			date.setDate(date.getDate() - this.currentDays + i + 1);
			const wordCount = Math.floor(Math.random() * 1000);
			const completed = wordCount > 0; // 只要有字数就算完成
			testData.push({
				date: date.toISOString().split('T')[0],
				wordCount,
				completed
			});
		}
		return testData;
	}

	/**
	 * 获取单元格颜色 - 根据字数区间返回对应颜色
	 */
	private getCellColor(wordCount: number): string {
		// 确保有默认颜色区间
		const defaultRanges = [
			{ min: 0, max: 0, color: '#f0f9f0', label: '无写作' },
			{ min: 1, max: 99, color: '#dcfce7', label: '少量写作' },
			{ min: 100, max: 199, color: '#bbf7d0', label: '轻度写作' },
			{ min: 200, max: 299, color: '#86efac', label: '中度写作' },
			{ min: 300, max: 999999, color: '#10b981', label: '重度写作' }
		];
		
		const ranges = this.settings.heatmapColorRanges && this.settings.heatmapColorRanges.length > 0 
			? this.settings.heatmapColorRanges 
			: defaultRanges;
		
		// 根据字数找到对应的颜色区间
		for (const range of ranges) {
			if (wordCount >= range.min && wordCount <= range.max) {
				return range.color;
			}
		}
		
		// 如果没有找到匹配的区间，返回第一个区间的颜色
		return ranges[0]?.color || '#f0f9f0';
	}

	/**
	 * 获取工具提示文本
	 */
	private getTooltipText(data: HeatmapData): string {
		const date = new Date(data.date);
		const dateStr = date.toLocaleDateString('zh-CN', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			weekday: 'long'
		});
		
		// 获取对应的区间标签
		const rangeLabel = this.getRangeLabel(data.wordCount);
		
		return `${dateStr}\n字数: ${formatNumber(data.wordCount)}\n区间: ${rangeLabel}`;
	}

	/**
	 * 获取字数对应的区间标签
	 */
	private getRangeLabel(wordCount: number): string {
		const defaultRanges = [
			{ min: 0, max: 0, color: '#f0f9f0', label: '无写作' },
			{ min: 1, max: 99, color: '#dcfce7', label: '少量写作' },
			{ min: 100, max: 199, color: '#bbf7d0', label: '轻度写作' },
			{ min: 200, max: 299, color: '#86efac', label: '中度写作' },
			{ min: 300, max: 999999, color: '#10b981', label: '重度写作' }
		];
		
		const ranges = this.settings.heatmapColorRanges && this.settings.heatmapColorRanges.length > 0 
			? this.settings.heatmapColorRanges 
			: defaultRanges;
		
		// 根据字数找到对应的区间标签
		for (const range of ranges) {
			if (wordCount >= range.min && wordCount <= range.max) {
				return range.label;
			}
		}
		
		// 如果没有找到匹配的区间，返回第一个区间的标签
		return ranges[0]?.label || '无写作';
	}

	/**
	 * 显示日期详情
	 */
	private showDayDetails(data: HeatmapData): void {
		const dayStats = this.dailyStats.get(data.date);
		if (!dayStats) {
			new Notice(`${data.date}: 当日无写作记录`);
			return;
		}

		const totalChars = dayStats.chinese + dayStats.english + dayStats.punctuation + dayStats.numbers;
		const message = `
${data.date} 写作详情：
总字数: ${formatNumber(dayStats.total)}
中文字符: ${formatNumber(dayStats.chinese)}
英文字符: ${formatNumber(dayStats.english)}
标点符号: ${formatNumber(dayStats.punctuation)}
数字: ${formatNumber(dayStats.numbers)}
空格: ${formatNumber(dayStats.spaces)}
词数: ${formatNumber(dayStats.words)}
总字符数: ${formatNumber(totalChars)}
		状态: ${dayStats.completed ? '✅ 已完成' : '❌ 未完成'}
		`.trim();

		new Notice(message);
	}

	/**
	 * 更新热力图
	 */
	private updateHeatmap(): void {
		console.log('开始更新热力图，当前天数：', this.currentDays);
		
		// 清除现有的热力图和统计信息
		const existingContent = this.container.querySelector('.heatmap-content');
		const existingStats = this.container.querySelector('.heatmap-stats-container');
		
		if (existingContent) {
			existingContent.remove();
			console.log('清除了现有的热力图内容');
		}
		if (existingStats) {
			existingStats.remove();
			console.log('清除了现有的统计信息');
		}
		
		// 重新创建
		this.createHeatmap();
		this.createStats();
		
		console.log('热力图更新完成');
	}

	/**
	 * 更新数据
	 */
	public updateData(dailyStats: Map<string, DailyStats>): void {
		this.dailyStats = dailyStats;
		this.updateHeatmap();
	}
}
