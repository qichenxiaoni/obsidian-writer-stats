/**
 * 字符变化记录接口
 */
export interface CharChange {
	/** 时间戳 */
	timestamp: number;
	/** 操作类型 */
	action: 'add' | 'delete';
	/** 文件名 */
	fileName: string;
	/** 中文字符变化 */
	chinese: number;
	/** 英文字符变化 */
	english: number;
	/** 标点符号变化 */
	punctuation: number;
	/** 数字变化 */
	numbers: number;
	/** 空格变化 */
	spaces: number;
	/** 词数变化 */
	words: number;
	/** 总字数变化 */
	total: number;
}

/**
 * 每日统计数据接口
 */
export interface DailyStats {
	/** 日期 YYYY-MM-DD */
	date: string;
	/** 中文字符数 */
	chinese: number;
	/** 英文字符数 */
	english: number;
	/** 标点符号数 */
	punctuation: number;
	/** 数字数量 */
	numbers: number;
	/** 空格数量 */
	spaces: number;
	/** 词数 */
	words: number;
	/** 总字数 */
	total: number;
	/** 当日目标 */
	goal: number;
	/** 是否完成目标 */
	completed: boolean;
	/** 字符变化记录 */
	charChanges: CharChange[];
}

/**
 * 连续写作数据接口
 */
export interface StreakData {
	/** 当前连续天数 */
	current: number;
	/** 最长连续天数 */
	longest: number;
	/** 最后写作日期 */
	lastDate: string;
}

/**
 * 文本分析结果接口
 */
export interface TextAnalysisResult {
	/** 中文字符数 */
	chinese: number;
	/** 英文字符数 */
	english: number;
	/** 标点符号数 */
	punctuation: number;
	/** 数字数量 */
	numbers: number;
	/** 空格数量 */
	spaces: number;
	/** 词数 */
	words: number;
}

