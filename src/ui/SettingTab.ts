/**
 * 设置页面组件
 */

import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import { WordCountSettings, DEFAULT_SETTINGS } from '../types';
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

		// 每日目标设置
		this.createDailyGoalSetting(containerEl);

		// 状态栏显示设置
		this.createStatusBarSetting(containerEl);

		// 统计选项设置
		this.createTrackingSettings(containerEl);

		// 性能优化设置
		this.createPerformanceSettings(containerEl);

		// 热力图设置
		this.createHeatmapSettings(containerEl);
	}

	private createDailyGoalSetting(containerEl: HTMLElement) {
		let goalValueSpan: HTMLElement;
		let goalInput: HTMLInputElement;
		let sliderInstance: any;
		let saveTimeout: number | null = null;
		let isUpdating = false;

		new Setting(containerEl)
			.setName('每日目标字数')
			.setDesc('设定每日写作目标字数 (0-10000)')
			.addSlider(slider => {
				sliderInstance = slider;
				slider.setLimits(CONSTANTS.MIN_DAILY_GOAL, CONSTANTS.MAX_DAILY_GOAL, 100)
					.setValue(this.plugin.settings.dailyGoal)
					.onChange(async (value: number) => {
						if (isUpdating) return;
						
						isUpdating = true;
						this.plugin.settings.dailyGoal = value;
						
						// 更新显示
						if (goalValueSpan) {
							goalValueSpan.setText(value.toString());
						}
						if (goalInput) {
							goalInput.value = value.toString();
						}
						
						// 添加视觉反馈
						if (slider.sliderEl) {
							slider.sliderEl.classList.add('goal-slider-changed');
							setTimeout(() => {
								if (slider.sliderEl) {
									slider.sliderEl.classList.remove('goal-slider-changed');
								}
							}, 300);
						}
						
						isUpdating = false;
						
						// 防抖保存
						if (saveTimeout) {
							clearTimeout(saveTimeout);
						}
						saveTimeout = window.setTimeout(async () => {
							await this.plugin.saveSettings();
							new Notice(`每日目标已更新为 ${value} 字`);
						}, 500);
					});
			})
			.addText(text => {
				goalInput = text.inputEl;
				goalInput.type = 'number';
				goalInput.setAttr('min', CONSTANTS.MIN_DAILY_GOAL.toString());
				goalInput.setAttr('max', CONSTANTS.MAX_DAILY_GOAL.toString());
				goalInput.setAttr('step', '100');
				goalInput.value = this.plugin.settings.dailyGoal.toString();
				goalInput.style.width = '80px';
				goalInput.style.textAlign = 'right';
				
				// 输入验证
				goalInput.addEventListener('input', async () => {
					if (isUpdating) return;
					
					let inputValue = goalInput.value.trim();
					let value = parseInt(inputValue);
					
					if (inputValue === '') {
						return;
					}
					
					const validation = validateDailyGoal(value);
					if (!validation.isValid) {
						this.showErrorTooltip(goalInput, validation.message!);
						return;
					}
					
					// 更新显示
					if (value !== parseInt(inputValue)) {
						goalInput.value = value.toString();
					}
					
					isUpdating = true;
					this.plugin.settings.dailyGoal = value;
					
					if (goalValueSpan) {
						goalValueSpan.setText(value.toString());
					}
					if (sliderInstance) {
						sliderInstance.setValue(value);
					}
					
					// 添加视觉反馈
					goalInput.classList.add('goal-input-changed');
					setTimeout(() => {
						goalInput.classList.remove('goal-input-changed');
					}, 300);
					
					isUpdating = false;
					
					// 防抖保存
					if (saveTimeout) {
						clearTimeout(saveTimeout);
					}
					saveTimeout = window.setTimeout(async () => {
						await this.plugin.saveSettings();
						new Notice(`每日目标已更新为 ${value} 字`);
					}, 500);
				});
				
				// 键盘快捷键支持
				goalInput.addEventListener('keydown', (e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						goalInput.blur();
					} else if (e.key === 'ArrowUp') {
						e.preventDefault();
						let currentValue = parseInt(goalInput.value) || CONSTANTS.DEFAULT_DAILY_GOAL;
						let newValue = Math.min(CONSTANTS.MAX_DAILY_GOAL, currentValue + 100);
						goalInput.value = newValue.toString();
						goalInput.dispatchEvent(new Event('input'));
					} else if (e.key === 'ArrowDown') {
						e.preventDefault();
						let currentValue = parseInt(goalInput.value) || CONSTANTS.DEFAULT_DAILY_GOAL;
						let newValue = Math.max(CONSTANTS.MIN_DAILY_GOAL, currentValue - 100);
						goalInput.value = newValue.toString();
						goalInput.dispatchEvent(new Event('input'));
					}
				});
				
				// 失去焦点时的验证
				goalInput.addEventListener('blur', () => {
					let value = parseInt(goalInput.value);
					if (isNaN(value) || value < CONSTANTS.MIN_DAILY_GOAL) {
						goalInput.value = CONSTANTS.MIN_DAILY_GOAL.toString();
					} else if (value > CONSTANTS.MAX_DAILY_GOAL) {
						goalInput.value = CONSTANTS.MAX_DAILY_GOAL.toString();
					}
					goalInput.dispatchEvent(new Event('input'));
				});
			})
			.settingEl.createSpan({ text: '当前目标: ' }, (span) => {
				goalValueSpan = span;
				goalValueSpan.setText(this.plugin.settings.dailyGoal.toString());
				goalValueSpan.style.fontWeight = 'bold';
				goalValueSpan.style.color = 'var(--text-accent)';
			});
	}

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

	private showErrorTooltip(input: HTMLInputElement, message: string) {
		const existingTooltip = input.parentElement?.querySelector('.goal-input-error');
		if (existingTooltip) {
			existingTooltip.remove();
		}
		
		const tooltip = input.createDiv('goal-input-error');
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
