/**
 * 命令注册模块
 */

import { Plugin } from 'obsidian';

// 使用接口来避免循环依赖
interface IWordCountPlugin extends Plugin {
	showStatistics(): void;
	resetData(): Promise<void>;
	testWordCountAccuracy(): Promise<void>;
	exportData(): Promise<void>;
}

/**
 * 注册所有插件命令
 * @param plugin 插件实例
 */
export function registerCommands(plugin: IWordCountPlugin): void {
	// 显示字数统计命令
	plugin.addCommand({
		id: 'show-word-count-statistics',
		name: '显示字数统计',
		callback: () => plugin.showStatistics()
	});

	// 重置统计数据命令
	plugin.addCommand({
		id: 'reset-word-count-data',
		name: '重置统计数据',
		callback: () => plugin.resetData()
	});

	// 测试字数统计准确性命令
	plugin.addCommand({
		id: 'test-word-count-accuracy',
		name: '测试字数统计准确性',
		callback: () => plugin.testWordCountAccuracy()
	});

	// 导出数据命令
	plugin.addCommand({
		id: 'export-word-count-data',
		name: '导出统计数据',
		callback: () => plugin.exportData()
	});
}

