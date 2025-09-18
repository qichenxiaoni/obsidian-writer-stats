/**
 * 设置页面组件
 */

import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import { WordCountSettings, DEFAULT_SETTINGS, ColorRange } from '../types';
import { validateDailyGoal, CONSTANTS } from '../utils';

export class WordCountSettingTab extends PluginSettingTab {
	private plugin: any; // 避免循环依赖，使用any类型

	constructor(app: App, plugin: any) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: '字数统计设置' });

		// 每日目标设置已移除

		// 状态栏显示设置
		this.createStatusBarSetting(containerEl);

		// 统计选项设置
		this.createTrackingSettings(containerEl);

		// 性能优化设置
		this.createPerformanceSettings(containerEl);

		// 热力图设置
		this.createHeatmapSettings(containerEl);
	}

	// createDailyGoalSetting 方法已移除

	private createStatusBarSetting(containerEl: HTMLElement) {
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
							this.plugin.statusBarItem = undefined;
						}
						await this.plugin.saveSettings();
					});
			});
	}

	private createTrackingSettings(containerEl: HTMLElement) {
		new Setting(containerEl)
			.setName('统计选项')
			.setDesc('选择要统计的字符类型')
			.setHeading();

		const trackingOptions = [
			{ key: 'trackChinese', name: '统计中文字符' },
			{ key: 'trackEnglish', name: '统计英文字符' },
			{ key: 'trackPunctuation', name: '统计标点符号' },
			{ key: 'trackNumbers', name: '统计数字' },
			{ key: 'trackSpaces', name: '统计空格' },
			{ key: 'showWordCount', name: '显示词数统计' }
		];

		trackingOptions.forEach(option => {
			new Setting(containerEl)
				.setName(option.name)
				.addToggle(toggle => {
					toggle.setValue(this.plugin.settings[option.key])
						.onChange(async (value) => {
							this.plugin.settings[option.key] = value;
							await this.plugin.saveSettings();
							this.plugin.updateWordCount();
						});
				});
		});
	}

	private createPerformanceSettings(containerEl: HTMLElement) {
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
	}

	private createHeatmapSettings(containerEl: HTMLElement) {
		new Setting(containerEl)
			.setName('热力图设置')
			.setDesc('配置热力图显示选项')
			.setHeading();

		// 启用热力图
		new Setting(containerEl)
			.setName('启用热力图')
			.setDesc('在统计页面显示写作热力图')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.enableHeatmap)
					.onChange(async (value) => {
						this.plugin.settings.enableHeatmap = value;
						await this.plugin.saveSettings();
					});
			});

		// 默认显示天数设置已移除，固定显示30天

		// 单元格大小
		new Setting(containerEl)
			.setName('单元格大小')
			.setDesc('热力图单元格的大小 (像素)')
			.addSlider(slider => {
				slider.setLimits(8, 20, 2)
					.setValue(this.plugin.settings.heatmapCellSize)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.heatmapCellSize = value;
						await this.plugin.saveSettings();
					});
			});

		// 颜色主题
		new Setting(containerEl)
			.setName('颜色主题')
			.setDesc('选择热力图的颜色主题')
			.addDropdown(dropdown => {
				dropdown.addOption('github', 'GitHub风格');
				dropdown.addOption('green', '绿色主题');
				dropdown.addOption('blue', '蓝色主题');
				dropdown.addOption('purple', '紫色主题');
				dropdown.addOption('custom', '自定义');
				dropdown.setValue(this.plugin.settings.heatmapColorTheme);
				dropdown.onChange(async (value) => {
					this.plugin.settings.heatmapColorTheme = value as any;
					// 根据主题更新颜色
					this.updateHeatmapColors(value as any);
					await this.plugin.saveSettings();
				});
			});

		// 显示月份标签
		new Setting(containerEl)
			.setName('显示月份标签')
			.setDesc('在热力图上显示月份标签')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.heatmapShowMonthLabels)
					.onChange(async (value) => {
						this.plugin.settings.heatmapShowMonthLabels = value;
						await this.plugin.saveSettings();
					});
			});

		// 显示统计信息
		new Setting(containerEl)
			.setName('显示统计信息')
			.setDesc('在热力图下方显示完成率和平均字数')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.heatmapShowStats)
					.onChange(async (value) => {
						this.plugin.settings.heatmapShowStats = value;
						await this.plugin.saveSettings();
					});
			});

		// 自定义颜色区间设置
		this.createCustomColorRangesSetting(containerEl);

		// 热力图缩放设置
		this.createHeatmapZoomSettings(containerEl);
	}

	/**
	 * 根据主题更新热力图颜色 - 为每个主题设计独特的颜色方案和区间
	 */
	private updateHeatmapColors(theme: string) {
		const colorThemes = {
			github: {
				colors: ['#ebedf0', '#216e39'],
				ranges: [
					{ min: 0, max: 0, color: '#ebedf0', label: '无写作' },
					{ min: 1, max: 99, color: '#c6e48b', label: '少量写作' },
					{ min: 100, max: 199, color: '#7bc96f', label: '轻度写作' },
					{ min: 200, max: 299, color: '#40c463', label: '中度写作' },
					{ min: 300, max: 999999, color: '#216e39', label: '重度写作' }
				]
			},
			green: {
				colors: ['#f0f9f0', '#10b981'],
				ranges: [
					{ min: 0, max: 0, color: '#f0f9f0', label: '无写作' },
					{ min: 1, max: 99, color: '#dcfce7', label: '少量写作' },
					{ min: 100, max: 199, color: '#bbf7d0', label: '轻度写作' },
					{ min: 200, max: 299, color: '#86efac', label: '中度写作' },
					{ min: 300, max: 999999, color: '#10b981', label: '重度写作' }
				]
			},
			blue: {
				colors: ['#f0f4ff', '#2563eb'],
				ranges: [
					{ min: 0, max: 0, color: '#f0f4ff', label: '无写作' },
					{ min: 1, max: 99, color: '#dbeafe', label: '少量写作' },
					{ min: 100, max: 199, color: '#bfdbfe', label: '轻度写作' },
					{ min: 200, max: 299, color: '#93c5fd', label: '中度写作' },
					{ min: 300, max: 999999, color: '#2563eb', label: '重度写作' }
				]
			},
			purple: {
				colors: ['#faf5ff', '#7c3aed'],
				ranges: [
					{ min: 0, max: 0, color: '#faf5ff', label: '无写作' },
					{ min: 1, max: 99, color: '#e9d5ff', label: '少量写作' },
					{ min: 100, max: 199, color: '#d8b4fe', label: '轻度写作' },
					{ min: 200, max: 299, color: '#c084fc', label: '中度写作' },
					{ min: 300, max: 999999, color: '#7c3aed', label: '重度写作' }
				]
			},
			custom: {
				colors: this.plugin.settings.heatmapColors,
				ranges: this.plugin.settings.heatmapColorRanges
			}
		};
		
		if (theme !== 'custom') {
			const themeConfig = colorThemes[theme as keyof typeof colorThemes];
			this.plugin.settings.heatmapColors = [...themeConfig.colors];
			this.plugin.settings.heatmapColorRanges = [...themeConfig.ranges];
			console.log(`更新热力图颜色主题为 ${theme}:`, {
				colors: this.plugin.settings.heatmapColors,
				ranges: this.plugin.settings.heatmapColorRanges
			});
		}
	}

	/**
	 * 创建自定义颜色区间设置
	 */
	private createCustomColorRangesSetting(containerEl: HTMLElement) {
		const setting = new Setting(containerEl)
			.setName('自定义颜色区间')
			.setDesc('自定义热力图颜色区间（仅在自定义主题下生效）');

		const rangesContainer = setting.descEl.createDiv('color-ranges-container');
		rangesContainer.style.marginTop = '10px';

		// 添加区间按钮
		const addButton = rangesContainer.createEl('button', { text: '+ 添加区间' });
		addButton.style.marginBottom = '10px';
		addButton.onclick = () => this.addColorRange(rangesContainer);

		// 渲染现有区间
		this.renderColorRanges(rangesContainer);
	}

	/**
	 * 渲染颜色区间
	 */
	private renderColorRanges(container: HTMLElement) {
		// 清除现有内容（保留添加按钮）
		const addButton = container.querySelector('button');
		container.innerHTML = '';
		if (addButton) {
			container.appendChild(addButton);
		}

		this.plugin.settings.heatmapColorRanges.forEach((range: ColorRange, index: number) => {
			const rangeDiv = container.createDiv('color-range-item');
			rangeDiv.style.display = 'flex';
			rangeDiv.style.alignItems = 'center';
			rangeDiv.style.gap = '10px';
			rangeDiv.style.marginBottom = '8px';

			// 最小值输入
			const minInput = rangeDiv.createEl('input', { type: 'number', placeholder: '最小值' });
			minInput.value = range.min.toString();
			minInput.style.width = '80px';
			minInput.onchange = () => {
				range.min = parseInt(minInput.value) || 0;
				this.plugin.saveSettings();
			};

			// 最大值输入
			const maxInput = rangeDiv.createEl('input', { type: 'number', placeholder: '最大值' });
			maxInput.value = range.max === 999999 ? '' : range.max.toString();
			maxInput.placeholder = '最大值（留空为无限制）';
			maxInput.style.width = '80px';
			maxInput.onchange = () => {
				range.max = maxInput.value ? parseInt(maxInput.value) : 999999;
				this.plugin.saveSettings();
			};

			// 颜色选择器
			const colorInput = rangeDiv.createEl('input', { type: 'color' });
			colorInput.value = range.color;
			colorInput.style.width = '40px';
			colorInput.onchange = () => {
				range.color = colorInput.value;
				this.plugin.saveSettings();
			};

			// 标签输入
			const labelInput = rangeDiv.createEl('input', { type: 'text', placeholder: '标签' });
			labelInput.value = range.label;
			labelInput.style.width = '120px';
			labelInput.onchange = () => {
				range.label = labelInput.value;
				this.plugin.saveSettings();
			};

			// 删除按钮
			const deleteButton = rangeDiv.createEl('button', { text: '删除' });
			deleteButton.style.color = 'var(--text-error)';
			deleteButton.onclick = () => {
				this.plugin.settings.heatmapColorRanges.splice(index, 1);
				this.plugin.saveSettings();
				this.renderColorRanges(container);
			};
		});
	}

	/**
	 * 添加颜色区间
	 */
	private addColorRange(container: HTMLElement) {
		const newRange: ColorRange = {
			min: 0,
			max: 100,
			color: '#10b981',
			label: '新区间'
		};
		this.plugin.settings.heatmapColorRanges.push(newRange);
		this.plugin.saveSettings();
		this.renderColorRanges(container);
	}

	/**
	 * 创建热力图缩放设置
	 */
	private createHeatmapZoomSettings(containerEl: HTMLElement) {
		new Setting(containerEl)
			.setName('热力图缩放设置')
			.setDesc('配置热力图缩放功能')
			.setHeading();

		// 启用缩放功能
		new Setting(containerEl)
			.setName('启用热力图缩放')
			.setDesc('允许用户通过鼠标滚轮和按钮缩放热力图')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.enableHeatmapZoom)
					.onChange(async (value) => {
						this.plugin.settings.enableHeatmapZoom = value;
						await this.plugin.saveSettings();
					});
			});

		// 默认缩放级别
		new Setting(containerEl)
			.setName('默认缩放级别')
			.setDesc('热力图打开时的默认缩放比例 (0.5-3.0)')
			.addSlider(slider => {
				slider.setLimits(0.5, 3.0, 0.1)
					.setValue(this.plugin.settings.heatmapDefaultZoom)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.heatmapDefaultZoom = value;
						await this.plugin.saveSettings();
					});
			});

		// 最小缩放级别
		new Setting(containerEl)
			.setName('最小缩放级别')
			.setDesc('热力图可以缩放到的最小比例 (0.1-1.0)')
			.addSlider(slider => {
				slider.setLimits(0.1, 1.0, 0.1)
					.setValue(this.plugin.settings.heatmapMinZoom)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.heatmapMinZoom = value;
						await this.plugin.saveSettings();
					});
			});

		// 最大缩放级别
		new Setting(containerEl)
			.setName('最大缩放级别')
			.setDesc('热力图可以缩放到的最大比例 (1.0-5.0)')
			.addSlider(slider => {
				slider.setLimits(1.0, 5.0, 0.1)
					.setValue(this.plugin.settings.heatmapMaxZoom)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.heatmapMaxZoom = value;
						await this.plugin.saveSettings();
					});
			});
	}

	private showErrorTooltip(input: HTMLInputElement, message: string) {
		const existingTooltip = input.parentElement?.querySelector('.goal-input-error');
		if (existingTooltip) {
			existingTooltip.remove();
		}
		
		const tooltip = input.createDiv('goal-input-error-tooltip');
		tooltip.setText(message);
		tooltip.style.color = 'var(--text-error)';
		tooltip.style.fontSize = '12px';
		tooltip.style.marginTop = '2px';
		tooltip.style.display = 'block';
		
		setTimeout(() => {
			tooltip.remove();
		}, 3000);
	}

}
