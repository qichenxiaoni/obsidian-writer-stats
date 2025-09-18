/**
 * 字数统计插件设置接口
 */
export interface WordCountSettings {
	/** 是否启用热力图 */
	enableHeatmap: boolean;
	/** 热力图颜色配置 */
	heatmapColors: string[];
	/** 热力图单元格大小 */
	heatmapCellSize: number;
	/** 热力图显示月份标签 */
	heatmapShowMonthLabels: boolean;
	/** 热力图显示统计信息 */
	heatmapShowStats: boolean;
	/** 热力图颜色主题 */
	heatmapColorTheme: 'github' | 'green' | 'blue' | 'purple' | 'custom';
	/** 热力图颜色区间配置 */
	heatmapColorRanges: ColorRange[];
	/** 是否启用热力图缩放 */
	enableHeatmapZoom: boolean;
	/** 热力图默认缩放级别 */
	heatmapDefaultZoom: number;
	/** 热力图最小缩放级别 */
	heatmapMinZoom: number;
	/** 热力图最大缩放级别 */
	heatmapMaxZoom: number;
	/** 是否统计中文字符 */
	trackChinese: boolean;
	/** 是否统计英文字符 */
	trackEnglish: boolean;
	/** 是否统计标点符号 */
	trackPunctuation: boolean;
	/** 是否显示状态栏 */
	showStatusBar: boolean;
	/** 是否每周重置数据 */
	resetWeekly: boolean;
	/** 是否统计数字 */
	trackNumbers: boolean;
	/** 是否统计空格 */
	trackSpaces: boolean;
	/** 是否显示词数统计 */
	showWordCount: boolean;
	/** 是否启用缓存优化 */
	enableCache: boolean;
}

export interface ColorRange {
	min: number;
	max: number;
	color: string;
	label: string;
}

/**
 * 默认设置配置
 */
export const DEFAULT_SETTINGS: WordCountSettings = {
	enableHeatmap: true,
	heatmapColors: ['#f0f9f0', '#10b981'], // 绿色主题：浅绿 + 翠绿
	heatmapCellSize: 18,
	heatmapShowMonthLabels: true,
	heatmapShowStats: true,
	heatmapColorTheme: 'green',
	heatmapColorRanges: [
		{ min: 0, max: 0, color: '#f0f9f0', label: '无写作' },
		{ min: 1, max: 99, color: '#dcfce7', label: '少量写作' },
		{ min: 100, max: 199, color: '#bbf7d0', label: '轻度写作' },
		{ min: 200, max: 299, color: '#86efac', label: '中度写作' },
		{ min: 300, max: 999999, color: '#10b981', label: '重度写作' }
	],
	enableHeatmapZoom: true,
	heatmapDefaultZoom: 1.0,
	heatmapMinZoom: 0.5,
	heatmapMaxZoom: 3.0,
	trackChinese: true,
	trackEnglish: true,
	trackPunctuation: true,
	showStatusBar: true,
	resetWeekly: false,
	trackNumbers: true,
	trackSpaces: false,
	showWordCount: true,
	enableCache: true
};
