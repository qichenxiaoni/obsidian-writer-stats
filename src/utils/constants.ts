/**
 * 插件常量定义
 */

export const CONSTANTS = {
	/** 最大字符变化记录数 */
	MAX_CHAR_CHANGES: 100,
	/** 防抖延迟时间（毫秒） */
	DEBOUNCE_DELAY: 150,
	/** 缓存生存时间（毫秒） */
	CACHE_TTL: 10 * 60 * 1000, // 10分钟
	/** 最大每日目标字数 */
	MAX_DAILY_GOAL: 10000,
	/** 最小每日目标字数 */
	MIN_DAILY_GOAL: 0,
	/** 默认每日目标字数 */
	DEFAULT_DAILY_GOAL: 1000,
	/** 热力图默认颜色 */
	DEFAULT_HEATMAP_COLORS: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
	
	// 性能优化相关常量
	/** 懒加载初始天数 */
	LAZY_LOAD_INITIAL_DAYS: 30,
	/** 懒加载增量天数 */
	LAZY_LOAD_INCREMENT_DAYS: 30,
	/** 懒加载最大天数 */
	LAZY_LOAD_MAX_DAYS: 365,
	/** 懒加载预加载天数 */
	LAZY_LOAD_PRELOAD_DAYS: 15,
	
	/** 批量操作默认批次大小 */
	BATCH_SIZE: 10,
	/** 批量操作默认并发数 */
	BATCH_CONCURRENCY: 3,
	/** 批量操作默认超时时间（毫秒） */
	BATCH_TIMEOUT: 30000,
	/** 批量操作默认重试次数 */
	BATCH_RETRY_COUNT: 2,
	
	/** 内存警告阈值（字节） */
	MEMORY_WARNING_THRESHOLD: 10 * 1024 * 1024, // 10MB
	/** 内存危险阈值（字节） */
	MEMORY_DANGER_THRESHOLD: 50 * 1024 * 1024, // 50MB
	/** 最大缓存项数 */
	MAX_CACHE_ITEMS: 500,
	
	/** 数据清理间隔（毫秒） */
	CLEANUP_INTERVAL: 60 * 1000, // 1分钟
	/** 字符变化记录最大保存时间（毫秒） */
	CHAR_CHANGES_MAX_AGE: 30 * 24 * 60 * 60 * 1000, // 30天
} as const;

/**
 * 正则表达式常量
 */
export const REGEX_PATTERNS = {
	/** 中文字符正则 - 修复Unicode范围 */
	CHINESE: /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3300-\u33ff\ufe30-\ufe4f]/,
	/** 英文字符正则 */
	ENGLISH: /[a-zA-Z]/,
	/** 数字正则 */
	NUMBERS: /[0-9]/,
	/** 全角数字正则 */
	FULL_WIDTH_NUMBERS: /[\uff10-\uff19]/,
	/** 标点符号正则 - 修复Unicode范围 */
	PUNCTUATION: /[^\w\s\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3300-\u33ff\ufe30-\ufe4f]/,
	/** 全角标点符号正则 */
	FULL_WIDTH_PUNCTUATION: /[\uff01-\uff0f\uff1a-\uff20\uff3b-\uff40\uff5b-\uff60\uff61-\uff65\uffe0-\uffe6]/,
	/** 罗马数字正则 */
	ROMAN_NUMERALS: /^[IVXLCDM]+$/i,
	/** 空白字符正则 */
	WHITESPACE: /[\s\t\n\r]/,
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

