/**
 * 命令注册模块
 */

import { Plugin, Notice } from 'obsidian';

// 使用接口来避免循环依赖
interface IWordCountPlugin extends Plugin {
	showStatistics(): void;
	resetData(): Promise<void>;
	testWordCountAccuracy(): Promise<void>;
	debugWordCount(): Promise<void>;
	testCharacterRecognition(): Promise<void>;
	exportData(): Promise<void>;
	batchAnalyzeFiles(): Promise<void>;
	getMemoryReport(): any;
	cleanupMemory(): Promise<void>;
	showGoalProgress(): void;
	showCacheStats(): void;
	createDataBackup(): Promise<void>;
	restoreFromBackup(): Promise<void>;
	showVersionInfo(): void;
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

	// 调试字数统计问题命令
	plugin.addCommand({
		id: 'debug-word-count',
		name: '调试字数统计问题',
		callback: () => plugin.debugWordCount()
	});

	// 测试字符识别功能命令
	plugin.addCommand({
		id: 'test-character-recognition',
		name: '测试字符识别功能',
		callback: () => plugin.testCharacterRecognition()
	});

	// 导出数据命令
	plugin.addCommand({
		id: 'export-word-count-data',
		name: '导出统计数据',
		callback: () => plugin.exportData()
	});

	// 批量分析文件命令
	plugin.addCommand({
		id: 'batch-analyze-files',
		name: '批量分析文件',
		callback: () => plugin.batchAnalyzeFiles()
	});

	// 获取内存报告命令
	plugin.addCommand({
		id: 'get-memory-report',
		name: '获取内存使用报告',
		callback: () => {
			const report = plugin.getMemoryReport();
			console.log('内存使用报告:', report);
			new Notice('内存报告已输出到控制台');
		}
	});

	// 清理内存命令
	plugin.addCommand({
		id: 'cleanup-memory',
		name: '清理内存',
		callback: () => plugin.cleanupMemory()
	});

	// 显示目标进度命令
	plugin.addCommand({
		id: 'show-goal-progress',
		name: '显示目标进度',
		callback: () => plugin.showGoalProgress()
	});


	// 显示缓存统计命令
	plugin.addCommand({
		id: 'show-cache-stats',
		name: '显示缓存统计',
		callback: () => plugin.showCacheStats()
	});

	// 创建数据备份命令
	plugin.addCommand({
		id: 'create-data-backup',
		name: '创建数据备份',
		callback: () => plugin.createDataBackup()
	});

	// 从备份恢复数据命令
	plugin.addCommand({
		id: 'restore-from-backup',
		name: '从备份恢复数据',
		callback: () => plugin.restoreFromBackup()
	});

	// 显示版本信息命令
	plugin.addCommand({
		id: 'show-version-info',
		name: '显示版本信息',
		callback: () => plugin.showVersionInfo()
	});
}

