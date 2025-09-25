/**
 * 统一错误处理服务
 */

import { Notice } from 'obsidian';

export enum ErrorLevel {
	INFO = 'info',
	WARNING = 'warning',
	ERROR = 'error',
	CRITICAL = 'critical'
}

export interface ErrorContext {
	component: string;
	operation: string;
	details?: any;
}

export class ErrorHandler {
	private static instance: ErrorHandler;
	private errorLog: Array<{
		timestamp: number;
		level: ErrorLevel;
		message: string;
		context: ErrorContext;
		error?: Error;
	}> = [];

	private constructor() {}

	static getInstance(): ErrorHandler {
		if (!ErrorHandler.instance) {
			ErrorHandler.instance = new ErrorHandler();
		}
		return ErrorHandler.instance;
	}

	/**
	 * 处理错误
	 */
	handleError(
		error: Error | string,
		context: ErrorContext,
		level: ErrorLevel = ErrorLevel.ERROR,
		showNotice: boolean = true
	): void {
		const errorObj = error instanceof Error ? error : new Error(error);
		const message = this.formatErrorMessage(errorObj.message, context);

		// 记录错误日志
		this.errorLog.push({
			timestamp: Date.now(),
			level,
			message: errorObj.message,
			context,
			error: errorObj
		});

		// 控制台输出
		this.logToConsole(level, message, errorObj, context);

		// 显示用户通知
		if (showNotice) {
			this.showUserNotice(level, message);
		}

		// 限制错误日志数量
		if (this.errorLog.length > 100) {
			this.errorLog = this.errorLog.slice(-50);
		}
	}

	/**
	 * 异步操作错误处理包装器
	 */
	async wrapAsync<T>(
		operation: () => Promise<T>,
		context: ErrorContext,
		fallbackValue?: T
	): Promise<T | undefined> {
		try {
			return await operation();
		} catch (error) {
			this.handleError(error as Error, context);
			return fallbackValue;
		}
	}

	/**
	 * 同步操作错误处理包装器
	 */
	wrapSync<T>(
		operation: () => T,
		context: ErrorContext,
		fallbackValue?: T
	): T | undefined {
		try {
			return operation();
		} catch (error) {
			this.handleError(error as Error, context);
			return fallbackValue;
		}
	}

	/**
	 * 格式化错误消息
	 */
	private formatErrorMessage(message: string, context: ErrorContext): string {
		return `[${context.component}:${context.operation}] ${message}`;
	}

	/**
	 * 输出到控制台
	 */
	private logToConsole(
		level: ErrorLevel,
		message: string,
		error: Error,
		context: ErrorContext
	): void {
		const logData = {
			message,
			error: error.stack || error.message,
			context,
			timestamp: new Date().toISOString()
		};

		switch (level) {
			case ErrorLevel.INFO:
				console.info('📘 [WordCount]', logData);
				break;
			case ErrorLevel.WARNING:
				console.warn('⚠️ [WordCount]', logData);
				break;
			case ErrorLevel.ERROR:
				console.error('❌ [WordCount]', logData);
				break;
			case ErrorLevel.CRITICAL:
				console.error('🚨 [WordCount CRITICAL]', logData);
				break;
		}
	}

	/**
	 * 显示用户通知
	 */
	private showUserNotice(level: ErrorLevel, message: string): void {
		const userMessage = this.getUserFriendlyMessage(level, message);
		
		switch (level) {
			case ErrorLevel.INFO:
				new Notice(userMessage, 3000);
				break;
			case ErrorLevel.WARNING:
				new Notice(`⚠️ ${userMessage}`, 5000);
				break;
			case ErrorLevel.ERROR:
				new Notice(`❌ ${userMessage}`, 8000);
				break;
			case ErrorLevel.CRITICAL:
				new Notice(`🚨 严重错误: ${userMessage}`, 10000);
				break;
		}
	}

	/**
	 * 获取用户友好的错误消息
	 */
	private getUserFriendlyMessage(level: ErrorLevel, message: string): string {
		// 将技术错误消息转换为用户友好的消息
		if (message.includes('读取文件失败')) {
			return '无法读取文件，请检查文件是否存在或权限是否正确';
		}
		
		if (message.includes('保存数据失败')) {
			return '保存数据失败，请检查磁盘空间是否充足';
		}
		
		if (message.includes('网络')) {
			return '网络连接出现问题，请检查网络设置';
		}
		
		if (message.includes('内存')) {
			return '内存使用过高，建议关闭其他应用程序';
		}
		
		// 根据错误级别提供通用消息
		switch (level) {
			case ErrorLevel.INFO:
				return message;
			case ErrorLevel.WARNING:
				return `注意: ${message}`;
			case ErrorLevel.ERROR:
				return `操作失败: ${message}。请查看控制台获取详细信息`;
			case ErrorLevel.CRITICAL:
				return `严重错误导致功能异常。请重启插件或联系开发者`;
			default:
				return message;
		}
	}

	/**
	 * 获取错误日志
	 */
	getErrorLog(): Array<{
		timestamp: number;
		level: ErrorLevel;
		message: string;
		context: ErrorContext;
	}> {
		return this.errorLog.map(log => ({
			timestamp: log.timestamp,
			level: log.level,
			message: log.message,
			context: log.context
		}));
	}

	/**
	 * 清除错误日志
	 */
	clearErrorLog(): void {
		this.errorLog = [];
	}

	/**
	 * 获取错误统计
	 */
	getErrorStats(): {
		total: number;
		byLevel: Record<ErrorLevel, number>;
		recent: number; // 最近1小时的错误数
	} {
		const now = Date.now();
		const oneHourAgo = now - 60 * 60 * 1000;
		
		const byLevel = {
			[ErrorLevel.INFO]: 0,
			[ErrorLevel.WARNING]: 0,
			[ErrorLevel.ERROR]: 0,
			[ErrorLevel.CRITICAL]: 0
		};

		let recent = 0;

		for (const log of this.errorLog) {
			byLevel[log.level]++;
			if (log.timestamp > oneHourAgo) {
				recent++;
			}
		}

		return {
			total: this.errorLog.length,
			byLevel,
			recent
		};
	}
}

// 便捷函数
export const errorHandler = ErrorHandler.getInstance();

/**
 * 错误处理装饰器（用于类方法）
 */
export function handleErrors(context: Partial<ErrorContext>) {
	return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		const originalMethod = descriptor.value;
		
		descriptor.value = async function (...args: any[]) {
			const fullContext: ErrorContext = {
				component: context.component || target.constructor.name,
				operation: context.operation || propertyKey,
				details: context.details
			};
			
			try {
				return await originalMethod.apply(this, args);
			} catch (error) {
				errorHandler.handleError(error as Error, fullContext);
				throw error; // 重新抛出以保持原有的错误传播
			}
		};
		
		return descriptor;
	};
}


