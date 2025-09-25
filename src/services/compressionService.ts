/**
 * 数据压缩服务 - 优化存储空间
 */

import { DailyStats } from '../types';

export interface CompressedDailyStats {
	/** 日期 (d) */
	d: string;
	/** 中文字符 (c) */
	c: number;
	/** 英文字符 (e) */
	e: number;
	/** 标点符号 (p) */
	p: number;
	/** 数字 (n) */
	n: number;
	/** 空格 (s) */
	s: number;
	/** 词数 (w) */
	w: number;
	/** 总字数 (t) */
	t: number;
	/** 是否完成 (comp) */
	comp: boolean;
	/** 字符变化记录 - 仅保留最新的10条 (ch) */
	ch?: Array<{
		ts: number; // timestamp
		a: 'add' | 'delete'; // action
		f: string; // fileName
		c: number; // chinese
		e: number; // english
		p: number; // punctuation
		n: number; // numbers
		s: number; // spaces
		w: number; // words
		t: number; // total
	}>;
}

export class CompressionService {
	/**
	 * 压缩每日统计数据数组
	 */
	compressDailyStatsArray(dailyStats: DailyStats[]): CompressedDailyStats[] {
		return dailyStats.map(stats => this.compressDailyStats(stats));
	}

	/**
	 * 解压缩每日统计数据数组
	 */
	decompressDailyStatsArray(compressedStats: CompressedDailyStats[]): DailyStats[] {
		return compressedStats.map(stats => this.decompressDailyStats(stats));
	}

	/**
	 * 压缩单个每日统计数据
	 */
	private compressDailyStats(stats: DailyStats): CompressedDailyStats {
		const compressed: CompressedDailyStats = {
			d: stats.date,
			c: stats.chinese,
			e: stats.english,
			p: stats.punctuation,
			n: stats.numbers,
			s: stats.spaces,
			w: stats.words,
			t: stats.total,
			comp: stats.completed
		};

		// 只保留最新的10条字符变化记录
		if (stats.charChanges && stats.charChanges.length > 0) {
			const recentChanges = stats.charChanges.slice(-10);
			compressed.ch = recentChanges.map(change => ({
				ts: change.timestamp,
				a: change.action,
				f: change.fileName,
				c: change.chinese,
				e: change.english,
				p: change.punctuation,
				n: change.numbers,
				s: change.spaces,
				w: change.words,
				t: change.total
			}));
		}

		return compressed;
	}

	/**
	 * 解压缩单个每日统计数据
	 */
	private decompressDailyStats(compressed: CompressedDailyStats): DailyStats {
		const stats: DailyStats = {
			date: compressed.d,
			chinese: compressed.c,
			english: compressed.e,
			punctuation: compressed.p,
			numbers: compressed.n,
			spaces: compressed.s,
			words: compressed.w,
			total: compressed.t,
			goal: 0, // 不再使用目标
			completed: compressed.comp,
			charChanges: []
		};

		// 解压缩字符变化记录
		if (compressed.ch) {
			stats.charChanges = compressed.ch.map(change => ({
				timestamp: change.ts,
				action: change.a,
				fileName: change.f,
				chinese: change.c,
				english: change.e,
				punctuation: change.p,
				numbers: change.n,
				spaces: change.s,
				words: change.w,
				total: change.t
			}));
		}

		return stats;
	}

	/**
	 * 计算压缩率
	 */
	getCompressionRate(original: DailyStats[], compressed: CompressedDailyStats[]): number {
		const originalSize = JSON.stringify(original).length;
		const compressedSize = JSON.stringify(compressed).length;
		return ((originalSize - compressedSize) / originalSize) * 100;
	}
}