/**
 * 插件常量定义
 */

export const CONSTANTS = {
	/** 最大字符变化记录数 */
	MAX_CHAR_CHANGES: 100,
	/** 防抖延迟时间（毫秒） */
	DEBOUNCE_DELAY: 500,
	/** 缓存生存时间（毫秒） */
	CACHE_TTL: 5 * 60 * 1000, // 5分钟
	/** 最大每日目标字数 */
	MAX_DAILY_GOAL: 10000,
	/** 最小每日目标字数 */
	MIN_DAILY_GOAL: 0,
	/** 默认每日目标字数 */
	DEFAULT_DAILY_GOAL: 1000,
	/** 热力图默认颜色 */
	DEFAULT_HEATMAP_COLORS: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
} as const;

/**
 * 正则表达式常量
 */
export const REGEX_PATTERNS = {
	/** 中文字符正则 */
	CHINESE: /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3300-\u33ff\ufe30-\ufe4f\uf900-\ufaff\U00020000-\U0002a6df\U0002a700-\U0002b73f\U0002b740-\U0002b81f\U0002b820-\U0002ceaf]/,
	/** 英文字符正则 */
	ENGLISH: /[a-zA-Z]/,
	/** 数字正则 */
	NUMBERS: /[0-9]/,
	/** 全角数字正则 */
	FULL_WIDTH_NUMBERS: /[\uff10-\uff19]/,
	/** 标点符号正则 */
	PUNCTUATION: /[^\w\s\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3300-\u33ff\ufe30-\ufe4f\uf900-\ufaff\U00020000-\U0002a6df\U0002a700-\U0002b73f\U0002b740-\U0002b81f\U0002b820-\U0002ceaf]/,
	/** 全角标点符号正则 */
	FULL_WIDTH_PUNCTUATION: /[\uff01-\uff0f\uff1a-\uff20\uff3b-\uff40\uff5b-\uff60\uff61-\uff65\uffe0-\uffe6]/,
	/** 罗马数字正则 */
	ROMAN_NUMERALS: /^[IVXLCDM]+$/i,
} as const;

/**
 * 错误消息常量
 */
export const ERROR_MESSAGES = {
	FILE_READ_FAILED: '读取文件失败',
	SETTINGS_SAVE_FAILED: '保存设置失败',
	DATA_LOAD_FAILED: '加载数据失败',
	DATA_RESET_FAILED: '重置数据失败',
	STATS_UPDATE_FAILED: '更新统计失败',
	INVALID_FILE_TYPE: '不支持的文件类型',
} as const;

