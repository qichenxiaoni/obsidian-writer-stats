/**
 * 设置页面组件
 */

import { App, PluginSettingTab, Setting, Notice, Plugin } from 'obsidian';
import { WordCountSettings, DEFAULT_SETTINGS, ColorRange } from '../types';
import { validateDailyGoal, CONSTANTS } from '../utils';

// 定义插件接口以避免循环依赖
interface WordCountPluginInterface extends Plugin {
	settings: WordCountSettings;
	saveSettings(): Promise<void>;
	initStatusBar(): void;
	statusBarItem?: HTMLElement;
	pluginManager?: {
		cacheServiceInstance?: {
			getStats(): any;
			clear(): void;
		};
	};
	updateWordCount(): Promise<void>;
}

export class WordCountSettingTab extends PluginSettingTab {
	private plugin: WordCountPluginInterface;

	constructor(app: App, plugin: WordCountPluginInterface) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: '字数统计设置' });

		// 基本设置
		this.createBasicSettings(containerEl);

		// 统计选项设置
		this.createTrackingSettings(containerEl);

		// 写作目标设置
		this.createWritingGoalSettings(containerEl);

		// 热力图设置
		this.createHeatmapSettings(containerEl);

		// 高级设置（可折叠）
		this.createAdvancedSettings(containerEl);
	}

	/**
	 * 创建基本设置
	 */
	private createBasicSettings(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('基本设置')
			.setDesc('常用的基本配置选项')
			.setHeading();

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
							this.plugin.statusBarItem = undefined;
						}
						await this.plugin.saveSettings();
					});
			});
	}

	/**
	 * 创建高级设置（可折叠）
	 */
	private createAdvancedSettings(containerEl: HTMLElement): void {
		const advancedContainer = containerEl.createDiv('advanced-settings');
		
		// 创建折叠标题
		const advancedHeader = advancedContainer.createDiv({
			cls: 'setting-item setting-item-heading advanced-settings-header'
		});
		advancedHeader.style.cursor = 'pointer';
		advancedHeader.style.userSelect = 'none';
		
		const headerContent = advancedHeader.createDiv('setting-item-info');
		headerContent.createDiv({
			text: '高级设置',
			cls: 'setting-item-name'
		});
		headerContent.createDiv({
			text: '点击展开高级配置选项（一般用户无需修改）',
			cls: 'setting-item-description'
		});
		
		// 添加展开/收起图标
		const toggleIcon = advancedHeader.createDiv({
			cls: 'advanced-settings-toggle',
			text: '▶'
		});
		toggleIcon.style.marginLeft = 'auto';
		toggleIcon.style.fontSize = '12px';
		toggleIcon.style.transition = 'transform 0.2s ease';
		
		// 创建可折叠内容容器
		const advancedContent = advancedContainer.createDiv('advanced-settings-content');
		advancedContent.style.display = 'none';
		advancedContent.style.marginTop = '10px';
		advancedContent.style.paddingLeft = '20px';
		advancedContent.style.borderLeft = '2px solid var(--background-modifier-border)';
		
		// 点击事件
		let isExpanded = false;
		advancedHeader.onclick = () => {
			isExpanded = !isExpanded;
			if (isExpanded) {
				advancedContent.style.display = 'block';
				toggleIcon.style.transform = 'rotate(90deg)';
				toggleIcon.textContent = '▼';
			} else {
				advancedContent.style.display = 'none';
				toggleIcon.style.transform = 'rotate(0deg)';
				toggleIcon.textContent = '▶';
			}
		};
		
		// 在高级设置内容中添加各种高级选项
		this.createPerformanceSettings(advancedContent);
		this.createAdvancedCacheSettings(advancedContent);
		this.createAdvancedPerformanceSettings(advancedContent);
	}

	private createTrackingSettings(containerEl: HTMLElement) {
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
						await this.plugin.updateWordCount();
					});
			});

		new Setting(containerEl)
			.setName('统计英文字符')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.trackEnglish)
					.onChange(async (value) => {
						this.plugin.settings.trackEnglish = value;
						await this.plugin.saveSettings();
						await this.plugin.updateWordCount();
					});
			});

		new Setting(containerEl)
			.setName('统计标点符号')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.trackPunctuation)
					.onChange(async (value) => {
						this.plugin.settings.trackPunctuation = value;
						await this.plugin.saveSettings();
						await this.plugin.updateWordCount();
					});
			});

		new Setting(containerEl)
			.setName('统计数字')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.trackNumbers)
					.onChange(async (value) => {
						this.plugin.settings.trackNumbers = value;
						await this.plugin.saveSettings();
						await this.plugin.updateWordCount();
					});
			});

		new Setting(containerEl)
			.setName('统计空格')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.trackSpaces)
					.onChange(async (value) => {
						this.plugin.settings.trackSpaces = value;
						await this.plugin.saveSettings();
						await this.plugin.updateWordCount();
					});
			});

		new Setting(containerEl)
			.setName('显示词数统计')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.showWordCount)
					.onChange(async (value) => {
						this.plugin.settings.showWordCount = value;
						await this.plugin.saveSettings();
						await this.plugin.updateWordCount();
					});
			});
	}

	private createPerformanceSettings(containerEl: HTMLElement) {
		new Setting(containerEl)
			.setName('性能优化')
			.setDesc('基本的性能优化选项')
			.setHeading();

		new Setting(containerEl)
			.setName('启用缓存优化')
			.setDesc('启用智能缓存以提高文本分析和统计的性能')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.enableCache)
					.onChange(async (value) => {
						this.plugin.settings.enableCache = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('输入法智能检测')
			.setDesc('智能检测拼音输入法状态，只统计完整输入的汉字，避免统计拼音中间状态')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.enableIMEDetection)
					.onChange(async (value) => {
						this.plugin.settings.enableIMEDetection = value;
						await this.plugin.saveSettings();
						// 提示用户重新加载插件
						new Notice('输入法检测设置已更改，建议重新加载插件以应用更改');
					});
			});
	}

	/**
	 * 创建高级性能设置
	 */
	private createAdvancedPerformanceSettings(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('高级性能设置')
			.setDesc('调节防抖时间和其他性能参数')
			.setHeading();

		// 防抖延迟设置
		new Setting(containerEl)
			.setName('防抖延迟')
			.setDesc('文件修改后延迟多久开始统计（毫秒）')
			.addSlider(slider => {
				slider.setLimits(50, 1000, 50)
					.setValue(this.plugin.settings.debounceDelay)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.debounceDelay = value;
						await this.plugin.saveSettings();
					});
			});

		// 实时更新防抖设置
		new Setting(containerEl)
			.setName('实时更新延迟')
			.setDesc('编辑器内容变化后延迟多久更新状态栏（毫秒）')
			.addSlider(slider => {
				slider.setLimits(50, 500, 25)
					.setValue(this.plugin.settings.realTimeDebounceDelay)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.realTimeDebounceDelay = value;
						await this.plugin.saveSettings();
					});
			});

		// 组合输入防抖设置
		new Setting(containerEl)
			.setName('输入法组合延迟')
			.setDesc('输入法组合完成后延迟多久更新（毫秒）')
			.addSlider(slider => {
				slider.setLimits(25, 300, 25)
					.setValue(this.plugin.settings.compositionDebounceDelay)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.compositionDebounceDelay = value;
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

		// 颜色主题（仅自定义）
		new Setting(containerEl)
			.setName('颜色主题')
			.setDesc('使用自定义颜色主题配置热力图')
			.addDropdown(dropdown => {
				dropdown.addOption('custom', '自定义');
				dropdown.setValue('custom');
				dropdown.onChange(async (value) => {
					this.plugin.settings.heatmapColorTheme = 'custom';
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
	 * 更新热力图颜色 - 仅支持自定义主题
	 */
	private updateHeatmapColors(theme: string) {
		// 现在只支持自定义主题，无需任何操作
		// 用户的自定义颜色配置已保存在 heatmapColors 和 heatmapColorRanges 中
		console.log('热力图使用自定义颜色主题');
	}

	/**
	 * 创建自定义颜色区间设置
	 */
	private createCustomColorRangesSetting(containerEl: HTMLElement) {
		const setting = new Setting(containerEl)
			.setName('自定义颜色区间')
			.setDesc('配置热力图的颜色区间和对应的字数范围');

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

	/**
	 * 创建写作目标设置
	 */
	private createWritingGoalSettings(containerEl: HTMLElement) {
		new Setting(containerEl)
			.setName('写作目标设置')
			.setDesc('配置写作目标和提醒')
			.setHeading();

		// 启用写作目标
		new Setting(containerEl)
			.setName('启用写作目标')
			.setDesc('启用写作目标功能')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.enableWritingGoals)
					.onChange(async (value) => {
						this.plugin.settings.enableWritingGoals = value;
						await this.plugin.saveSettings();
					});
			});

		// 每日目标
		new Setting(containerEl)
			.setName('每日写作目标')
			.setDesc('设置每日写作目标字数')
			.addText(text => {
				text.setValue(this.plugin.settings.dailyWordGoal.toString())
					.setPlaceholder('1000')
					.onChange(async (value) => {
						const goal = parseInt(value) || 0;
						if (goal >= 0 && goal <= 10000) {
							this.plugin.settings.dailyWordGoal = goal;
							await this.plugin.saveSettings();
						}
					});
			});

		// 每周目标
		new Setting(containerEl)
			.setName('每周写作目标')
			.setDesc('设置每周写作目标字数')
			.addText(text => {
				text.setValue(this.plugin.settings.weeklyWordGoal.toString())
					.setPlaceholder('7000')
					.onChange(async (value) => {
						const goal = parseInt(value) || 0;
						if (goal >= 0 && goal <= 100000) {
							this.plugin.settings.weeklyWordGoal = goal;
							await this.plugin.saveSettings();
						}
					});
			});

		// 每月目标
		new Setting(containerEl)
			.setName('每月写作目标')
			.setDesc('设置每月写作目标字数')
			.addText(text => {
				text.setValue(this.plugin.settings.monthlyWordGoal.toString())
					.setPlaceholder('30000')
					.onChange(async (value) => {
						const goal = parseInt(value) || 0;
						if (goal >= 0 && goal <= 1000000) {
							this.plugin.settings.monthlyWordGoal = goal;
							await this.plugin.saveSettings();
						}
					});
			});

		// 目标提醒
		new Setting(containerEl)
			.setName('启用目标提醒')
			.setDesc('在指定时间提醒未完成的目标')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.enableGoalReminders)
					.onChange(async (value) => {
						this.plugin.settings.enableGoalReminders = value;
						await this.plugin.saveSettings();
					});
			});

		// 提醒时间
		new Setting(containerEl)
			.setName('提醒时间')
			.setDesc('设置目标提醒的时间 (HH:MM)')
			.addText(text => {
				text.setValue(this.plugin.settings.goalReminderTime)
					.setPlaceholder('20:00')
					.onChange(async (value) => {
						if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
							this.plugin.settings.goalReminderTime = value;
							await this.plugin.saveSettings();
						}
					});
			});
	}


	/**
	 * 创建缓存高级设置
	 */
	private createAdvancedCacheSettings(containerEl: HTMLElement) {
		new Setting(containerEl)
			.setName('缓存设置')
			.setDesc('简单的缓存配置来优化字数统计性能')
			.setHeading();

		// 缓存最大大小
		new Setting(containerEl)
			.setName('缓存大小')
			.setDesc('设置最多缓存多少个分析结果（推荐：50-200）')
			.addSlider(slider => {
				slider.setLimits(20, 200, 10)
					.setValue(this.plugin.settings.cacheMaxSize)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.cacheMaxSize = value;
						await this.plugin.saveSettings();
					});
			});

		// 缓存生存时间
		new Setting(containerEl)
			.setName('缓存时间')
			.setDesc('缓存结果保存多长时间（分钟）')
			.addSlider(slider => {
				slider.setLimits(1, 30, 1)
					.setValue(this.plugin.settings.cacheDefaultTTL / 60000) // 转换为分钟
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.cacheDefaultTTL = value * 60000; // 转换为毫秒
						await this.plugin.saveSettings();
					});
			});

		// 缓存状态显示
		const cacheInfoDiv = containerEl.createDiv('cache-info');
		cacheInfoDiv.style.marginTop = '16px';
		cacheInfoDiv.style.padding = '12px';
		cacheInfoDiv.style.backgroundColor = 'var(--background-secondary)';
		cacheInfoDiv.style.borderRadius = '6px';
		cacheInfoDiv.style.fontSize = '14px';
		cacheInfoDiv.style.color = 'var(--text-muted)';
		
		// 获取缓存统计信息
		const cacheStats = this.plugin.pluginManager?.cacheServiceInstance?.getStats();
		
		if (cacheStats) {
			cacheInfoDiv.innerHTML = `
				<strong>📊 当前缓存状态：</strong><br>
				• 缓存项数量: ${cacheStats.itemCount}<br>
				• 命中率: ${cacheStats.hitRate.toFixed(1)}%<br>
				• 总请求数: ${cacheStats.totalRequests}
			`;
		} else {
			cacheInfoDiv.innerHTML = `
				<strong>📊 缓存信息：</strong><br>
				• 缓存服务未初始化<br>
				• 请重新加载插件以查看统计信息
			`;
		}

		// 清理缓存按钮
		const clearCacheButton = containerEl.createEl('button', { 
			text: '清理缓存',
			cls: 'mod-warning'
		});
		clearCacheButton.style.marginTop = '10px';
		clearCacheButton.onclick = async () => {
			this.plugin.pluginManager?.cacheServiceInstance?.clear();
			new Notice('缓存已清理');
			// 刷新缓存信息显示
			this.display();
		};

		// 使用说明
		const usageTip = containerEl.createDiv('cache-usage-tip');
		usageTip.style.marginTop = '16px';
		usageTip.style.padding = '12px';
		usageTip.style.backgroundColor = 'var(--background-primary-alt)';
		usageTip.style.borderRadius = '6px';
		usageTip.style.fontSize = '14px';
		usageTip.style.color = 'var(--text-muted)';
		usageTip.style.borderLeft = '4px solid var(--interactive-accent)';
		
		usageTip.innerHTML = `
			<strong>💡 缓存说明：</strong><br>
			• 缓存可以避免重复分析相同的文本，提高性能<br>
			• 较大的缓存大小适合经常编辑多个文件的用户<br>
			• 较短的缓存时间确保数据及时更新<br>
			• 遇到统计问题时可以尝试清理缓存
		`;
	}

}
