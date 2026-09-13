/**
 * 字数统计插件设置接口
 */
export interface WordCountSettings {
	/** 每日目标字数 */
	dailyGoal: number;
	/** 是否启用热力图 */
	enableHeatmap: boolean;
	/** 热力图颜色配置 */
	heatmapColors: string[];
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

/**
 * 默认设置配置
 */
export const DEFAULT_SETTINGS: WordCountSettings = {
	dailyGoal: 1000,
	enableHeatmap: true,
	heatmapColors: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
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
