/**
 * 文本分析服务
 */

import { WordCountSettings, TextAnalysisResult } from '../types';
import { REGEX_PATTERNS } from '../utils/constants';

export class TextAnalyzer {
	constructor(private settings: WordCountSettings) {}

	/**
	 * 分析文本内容
	 * @param text 要分析的文本
	 * @returns 分析结果
	 */
	analyzeText(text: string): TextAnalysisResult {
		// 预处理文本
		const cleanText = this.preprocessText(text);
		
		// 统计字符
		return this.countCharacters(cleanText);
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
	 * 单次遍历统计字符
	 * @param text 要统计的文本
	 * @returns 统计结果
	 */
	private countCharacters(text: string): TextAnalysisResult {
		let chinese = 0;
		let english = 0;
		let punctuation = 0;
		let numbers = 0;
		let spaces = 0;
		let words = 0;

		// 单次遍历统计
		for (let i = 0; i < text.length; i++) {
			const char = text[i];

			// 优先检查数字字符（包括全角数字）
			if (this.settings.trackNumbers && (REGEX_PATTERNS.NUMBERS.test(char) || REGEX_PATTERNS.FULL_WIDTH_NUMBERS.test(char))) {
				numbers++;
			}
			// 然后检查英文字符和单词
			else if (this.settings.trackEnglish && REGEX_PATTERNS.ENGLISH.test(char)) {
				// 检查是否是英文单词的开始
				if (i === 0 || !REGEX_PATTERNS.ENGLISH.test(text[i - 1])) {
					// 可能是英文单词的开始
					let j = i;
					while (j < text.length && REGEX_PATTERNS.ENGLISH.test(text[j])) {
						j++;
					}
					const word = text.substring(i, j);

					// 排除单独的罗马数字和单个字符
					if (!REGEX_PATTERNS.ROMAN_NUMERALS.test(word) && word.length > 1) {
						english += word.length; // 统计英文字符数
						if (this.settings.showWordCount) {
							words++; // 统计单词数
						}
					} else if (word.length === 1 && /^[a-zA-Z]$/.test(word)) {
						// 单个字母，也计入英文字符统计
						english++;
					}
					i = j - 1; // 因为循环末尾会i++
				}
			}
			// 然后检查中文字符
			else if (this.settings.trackChinese && REGEX_PATTERNS.CHINESE.test(char)) {
				chinese++;
			}
			// 然后检查标点符号（包括全角标点）
			else if (this.settings.trackPunctuation && (REGEX_PATTERNS.PUNCTUATION.test(char) || REGEX_PATTERNS.FULL_WIDTH_PUNCTUATION.test(char))) {
				punctuation++;
			}
			// 最后检查空白字符
			else if (this.settings.trackSpaces && (char === ' ' || char === '\t' || char === '\n' || char === '\r')) {
				spaces++;
			}
		}

		return { chinese, english, punctuation, numbers, spaces, words };
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
}

