/**
 * 文本分析服务
 */

import { WordCountSettings, TextAnalysisResult } from '../types';

interface CompositionState {
	isComposing: boolean;
	compositionText: string;
	lastCompositionEnd: number;
}

interface PerformanceMetrics {
	totalAnalyses: number;
	averageTime: number;
	maxTime: number;
	minTime: number;
	lastResetTime: number;
}

export class TextAnalyzer {
	private compositionState: CompositionState = {
		isComposing: false,
		compositionText: '',
		lastCompositionEnd: 0
	};

	private performanceMetrics: PerformanceMetrics = {
		totalAnalyses: 0,
		averageTime: 0,
		maxTime: 0,
		minTime: Number.MAX_SAFE_INTEGER,
		lastResetTime: Date.now()
	};

	// 简单的结果缓存，避免重复分析相同内容
	private resultCache = new Map<string, { result: TextAnalysisResult; timestamp: number }>();
	private readonly CACHE_TTL = 60000; // 1分钟缓存
	private readonly MAX_CACHE_SIZE = 50;

	constructor(private settings: WordCountSettings) {}

	/**
	 * 处理组合开始事件
	 * @param compositionText 组合文本
	 */
	onCompositionStart(compositionText: string = ''): void {
		this.compositionState.isComposing = true;
		this.compositionState.compositionText = compositionText;
	}

	/**
	 * 处理组合更新事件
	 * @param compositionText 组合文本
	 */
	onCompositionUpdate(compositionText: string): void {
		this.compositionState.compositionText = compositionText;
	}

	/**
	 * 处理组合结束事件
	 */
	onCompositionEnd(): void {
		this.compositionState.isComposing = false;
		this.compositionState.compositionText = '';
		this.compositionState.lastCompositionEnd = Date.now();
	}

	/**
	 * 检查是否应该延迟统计（等待组合输入完成）
	 * @returns 是否应该延迟
	 */
	shouldDelayCount(): boolean {
		if (this.compositionState.isComposing) {
			return true;
		}
		
		// 组合结束后短暂延迟，确保输入完成
		const timeSinceCompositionEnd = Date.now() - this.compositionState.lastCompositionEnd;
		return timeSinceCompositionEnd < 50; // 50ms延迟
	}

	/**
	 * 分析文本内容（带性能监控和缓存）
	 * @param text 要分析的文本
	 * @param includeComposing 是否包含正在组合的文本
	 * @returns 分析结果
	 */
	analyzeText(text: string, includeComposing: boolean = false): TextAnalysisResult {
		const startTime = performance.now();
		
		// 如果正在组合且不包含组合文本，先预处理移除组合部分
		let processText = text;
		
		if (this.compositionState.isComposing && !includeComposing) {
			processText = this.removeComposingText(text);
		}
		
		// 预处理文本
		const cleanText = this.preprocessText(processText);
		
		// 检查缓存
		const cacheKey = this.getCacheKey(cleanText);
		const cached = this.getFromCache(cacheKey);
		if (cached) {
			this.updatePerformanceMetrics(performance.now() - startTime);
			return cached;
		}
		
		// 统计字符
		const result = this.countCharacters(cleanText);
		
		// 缓存结果
		this.setCache(cacheKey, result);
		
		// 更新性能指标
		this.updatePerformanceMetrics(performance.now() - startTime);
		
		return result;
	}

	/**
	 * 移除正在组合的文本
	 * @param text 原始文本
	 * @returns 移除组合文本后的文本
	 */
	private removeComposingText(text: string): string {
		// 如果有组合文本，尝试从末尾移除
		if (this.compositionState.compositionText) {
			const composingLength = this.compositionState.compositionText.length;
			if (text.length >= composingLength) {
				const withoutComposing = text.slice(0, -composingLength);
				return withoutComposing;
			}
		}
		return text;
	}

	/**
	 * 预处理文本：移除Markdown语法但保留内容
	 * @param text 原始文本
	 * @returns 处理后的文本
	 */
	private preprocessText(text: string): string {
		return text
			.replace(/^---[\s\S]*?---\n/gm, '') // 移除frontmatter
			.replace(/```[\s\S]*?```/g, '') // 移除代码块
			.replace(/`[^`]+`/g, '') // 移除行内代码
			.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // 保留图片alt文本
			.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 保留链接文本
			.replace(/^#{1,6}\s+/gm, '') // 移除标题标记
			.replace(/^>\s*/gm, '') // 移除引用标记
			.replace(/^[-*+]\s+/gm, '') // 移除列表标记
			.replace(/^\[[ x]\]\s+/gm, '') // 移除任务列表
			.replace(/<[^>]+>/g, '') // 移除HTML标签
			.replace(/\s+/g, ' ') // 合并空白字符
			.trim();
	}

	/**
	 * 优化的字符统计方法 - 结合正则表达式和单次遍历
	 * @param text 要统计的文本
	 * @returns 统计结果
	 */
	private countCharacters(text: string): TextAnalysisResult {
		// 对于大文件，使用分块处理
		if (text.length > 10000) {
			return this.countCharactersInChunks(text);
		}

		// 对于小文件，使用优化的单次遍历
		return this.countCharactersFast(text);
	}

	/**
	 * 分块处理大文件
	 */
	private countCharactersInChunks(text: string): TextAnalysisResult {
		const chunkSize = 5000; // 每块5000字符
		const result: TextAnalysisResult = { chinese: 0, english: 0, punctuation: 0, numbers: 0, spaces: 0, words: 0 };

		for (let i = 0; i < text.length; i += chunkSize) {
			const chunk = text.slice(i, i + chunkSize);
			const chunkResult = this.countCharactersFast(chunk);
			
			result.chinese += chunkResult.chinese;
			result.english += chunkResult.english;
			result.punctuation += chunkResult.punctuation;
			result.numbers += chunkResult.numbers;
			result.spaces += chunkResult.spaces;
			result.words += chunkResult.words;
		}

		return result;
	}

	/**
	 * 快速字符统计 - 使用优化的正则表达式
	 */
	private countCharactersFast(text: string): TextAnalysisResult {
		const result: TextAnalysisResult = { chinese: 0, english: 0, punctuation: 0, numbers: 0, spaces: 0, words: 0 };

		// 使用正则表达式批量匹配，比逐字符循环快
		if (this.settings.trackChinese) {
			const chineseMatches = text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3300-\u33ff\ufe30-\ufe4f]/g);
			result.chinese = chineseMatches ? chineseMatches.length : 0;
		}

		if (this.settings.trackEnglish) {
			const englishMatches = text.match(/[a-zA-Z\uff21-\uff3a\uff41-\uff5a]/g);
			result.english = englishMatches ? englishMatches.length : 0;
		}

		if (this.settings.trackNumbers) {
			const numberMatches = text.match(/[0-9\uff10-\uff19]/g);
			result.numbers = numberMatches ? numberMatches.length : 0;
		}

		if (this.settings.trackSpaces) {
			const spaceMatches = text.match(/[\s\t\n\r\u3000]/g);
			result.spaces = spaceMatches ? spaceMatches.length : 0;
		}

		if (this.settings.trackPunctuation) {
			// 标点符号：排除中文、英文、数字、空格后的所有字符
			const punctuationMatches = text.match(/[^\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3300-\u33ff\ufe30-\ufe4fa-zA-Z\uff21-\uff3a\uff41-\uff5a0-9\uff10-\uff19\s\t\n\r\u3000]/g);
			result.punctuation = punctuationMatches ? punctuationMatches.length : 0;
		}

		// 计算英文单词数（如果需要）
		if (this.settings.showWordCount && this.settings.trackEnglish) {
			result.words = this.countEnglishWords(text);
		}

		return result;
	}

	/**
	 * 检查是否为中文字符
	 */
	private isChinese(char: string): boolean {
		const code = char.charCodeAt(0);
		return (
			(code >= 0x4e00 && code <= 0x9fff) || // CJK统一汉字
			(code >= 0x3400 && code <= 0x4dbf) || // CJK扩展A
			(code >= 0xf900 && code <= 0xfaff) || // CJK兼容汉字
			(code >= 0x3300 && code <= 0x33ff) || // CJK兼容
			(code >= 0xfe30 && code <= 0xfe4f)    // CJK兼容形式
		);
	}

	/**
	 * 检查是否为英文字符
	 */
	private isEnglish(char: string): boolean {
		const code = char.charCodeAt(0);
		return (code >= 0x41 && code <= 0x5a) || // A-Z
			   (code >= 0x61 && code <= 0x7a) || // a-z
			   (code >= 0xff21 && code <= 0xff3a) || // 全角A-Z
			   (code >= 0xff41 && code <= 0xff5a);   // 全角a-z
	}

	/**
	 * 检查是否为数字字符
	 */
	private isNumber(char: string): boolean {
		const code = char.charCodeAt(0);
		return (code >= 0x30 && code <= 0x39) || // 0-9
			   (code >= 0xff10 && code <= 0xff19); // 全角数字
	}

	/**
	 * 检查是否为标点符号
	 */
	private isPunctuation(char: string): boolean {
		const code = char.charCodeAt(0);
		
		// 全角标点符号
		if (code >= 0xff01 && code <= 0xff0f) return true; // ！＂＃＄％＆＇（）＊＋，－．／
		if (code >= 0xff1a && code <= 0xff20) return true; // ：；＜＝＞？＠
		if (code >= 0xff3b && code <= 0xff40) return true; // ［＼］＾＿｀
		if (code >= 0xff5b && code <= 0xff60) return true; // ｛｜｝～
		if (code >= 0xff61 && code <= 0xff65) return true; // ｡｢｣､･
		if (code >= 0xffe0 && code <= 0xffe6) return true; // ￠￡￢￣￤￥
		
		// 半角标点符号
		if (code >= 0x21 && code <= 0x2f) return true; // !"#$%&'()*+,-./
		if (code >= 0x3a && code <= 0x40) return true; // :;<=>?@
		if (code >= 0x5b && code <= 0x60) return true; // [\]^_`
		if (code >= 0x7b && code <= 0x7e) return true; // {|}~
		
		// 中文标点符号（不包括全角空格）
		if (code === 0x3001) return true; // 、
		if (code === 0x3002) return true; // 。
		if (code === 0x3003) return true; // 〃
		if (code === 0x3005) return true; // 々
		if (code === 0x3006) return true; // 〆
		if (code === 0x3007) return true; // 〇
		if (code === 0x3008) return true; // 〈
		if (code === 0x3009) return true; // 〉
		if (code === 0x300a) return true; // 《
		if (code === 0x300b) return true; // 》
		if (code === 0x300c) return true; // 「
		if (code === 0x300d) return true; // 」
		if (code === 0x300e) return true; // 『
		if (code === 0x300f) return true; // 』
		if (code === 0x3010) return true; // 【
		if (code === 0x3011) return true; // 】
		if (code === 0x3012) return true; // 〒
		if (code === 0x3013) return true; // 〓
		if (code === 0x3014) return true; // 〔
		if (code === 0x3015) return true; // 〕
		if (code === 0x3016) return true; // 〖
		if (code === 0x3017) return true; // 〗
		if (code === 0x3018) return true; // 〘
		if (code === 0x3019) return true; // 〙
		if (code === 0x301a) return true; // 〚
		if (code === 0x301b) return true; // 〛
		if (code === 0x301c) return true; // 〜
		if (code === 0x301d) return true; // 〝
		if (code === 0x301e) return true; // 〞
		if (code === 0x301f) return true; // 〟
		if (code === 0x3030) return true; // 〰
		if (code === 0x303d) return true; // 〽
		if (code === 0x303f) return true; // 〿
		if (code === 0x30fb) return true; // ・
		if (code === 0x30fc) return true; // ー
		if (code === 0x30fd) return true; // ヽ
		if (code === 0x30fe) return true; // ヾ
		
		return false;
	}

	/**
	 * 检查是否为空白字符
	 */
	private isWhitespace(char: string): boolean {
		const code = char.charCodeAt(0);
		return code === 0x20 ||  // 空格
			   code === 0x09 ||  // 制表符
			   code === 0x0a ||  // 换行符
			   code === 0x0d ||  // 回车符
			   code === 0x3000 || // 全角空格
			   code === 0xff20;   // 全角空格（另一种编码）
	}

	/**
	 * 计算英文单词数（优化版本）
	 * @param text 要统计的文本
	 * @returns 单词数
	 */
	private countEnglishWords(text: string): number {
		// 使用更精确的正则表达式匹配英文单词，包括全角字母
		const wordMatches = text.match(/\b[a-zA-Z\uff21-\uff3a\uff41-\uff5a]+\b/g);
		return wordMatches ? wordMatches.length : 0;
	}

	/**
	 * 计算简单词数统计（用于对比）
	 * @param text 要统计的文本
	 * @returns 词数
	 */
	calculateSimpleWordCount(text: string): number {
		const cleanText = this.preprocessText(text);
		if (!cleanText) return 0;
		return cleanText.split(' ').filter(word => word.length > 0).length;
	}

	/**
	 * 生成缓存键
	 */
	private getCacheKey(text: string): string {
		// 使用简单的哈希算法生成缓存键
		let hash = 5381;
		for (let i = 0; i < text.length; i++) {
			hash = ((hash << 5) + hash) + text.charCodeAt(i);
		}
		return (hash >>> 0).toString(16);
	}

	/**
	 * 从缓存获取结果
	 */
	private getFromCache(key: string): TextAnalysisResult | null {
		const cached = this.resultCache.get(key);
		if (!cached) return null;

		// 检查是否过期
		if (Date.now() - cached.timestamp > this.CACHE_TTL) {
			this.resultCache.delete(key);
			return null;
		}

		return cached.result;
	}

	/**
	 * 设置缓存
	 */
	private setCache(key: string, result: TextAnalysisResult): void {
		// 清理过期缓存
		this.cleanupCache();

		// 如果缓存已满，删除最旧的项
		if (this.resultCache.size >= this.MAX_CACHE_SIZE) {
			const firstKey = this.resultCache.keys().next().value;
			if (firstKey) {
				this.resultCache.delete(firstKey);
			}
		}

		this.resultCache.set(key, {
			result,
			timestamp: Date.now()
		});
	}

	/**
	 * 清理过期缓存
	 */
	private cleanupCache(): void {
		const now = Date.now();
		for (const [key, value] of this.resultCache.entries()) {
			if (now - value.timestamp > this.CACHE_TTL) {
				this.resultCache.delete(key);
			}
		}
	}

	/**
	 * 更新性能指标
	 */
	private updatePerformanceMetrics(executionTime: number): void {
		this.performanceMetrics.totalAnalyses++;
		this.performanceMetrics.maxTime = Math.max(this.performanceMetrics.maxTime, executionTime);
		this.performanceMetrics.minTime = Math.min(this.performanceMetrics.minTime, executionTime);
		
		// 计算平均时间（使用指数移动平均）
		const alpha = 0.1; // 平滑因子
		if (this.performanceMetrics.averageTime === 0) {
			this.performanceMetrics.averageTime = executionTime;
		} else {
			this.performanceMetrics.averageTime = alpha * executionTime + (1 - alpha) * this.performanceMetrics.averageTime;
		}
	}

	/**
	 * 获取性能指标
	 */
	getPerformanceMetrics(): PerformanceMetrics {
		return { ...this.performanceMetrics };
	}

	/**
	 * 重置性能指标
	 */
	resetPerformanceMetrics(): void {
		this.performanceMetrics = {
			totalAnalyses: 0,
			averageTime: 0,
			maxTime: 0,
			minTime: Number.MAX_SAFE_INTEGER,
			lastResetTime: Date.now()
		};
	}

	/**
	 * 清空缓存
	 */
	clearCache(): void {
		this.resultCache.clear();
	}

	/**
	 * 获取缓存统计
	 */
	getCacheStats(): { size: number; maxSize: number; hitRate: number } {
		// 简化的命中率计算（基于缓存大小）
		const hitRate = this.resultCache.size > 0 ? (this.performanceMetrics.totalAnalyses / this.resultCache.size) : 0;
		
		return {
			size: this.resultCache.size,
			maxSize: this.MAX_CACHE_SIZE,
			hitRate: Math.min(hitRate, 100)
		};
	}
}

