/**
 * 数据访问服务 - 统一的插件数据访问层
 */

import { App } from 'obsidian';
import { errorHandler, ErrorLevel } from './errorHandler';

export interface PluginDataAccess {
	loadData(): Promise<any>;
	saveData(data: any): Promise<void>;
	getSettings(): any;
	saveSettings(settings: any): Promise<void>;
}

export class DataAccessService {
	private static instance: DataAccessService;
	private app: App;
	private pluginId: string;
	private pluginInstance: any = null;

	private constructor(app: App, pluginId: string) {
		this.app = app;
		this.pluginId = pluginId;
	}

	/**
	 * 获取单例实例
	 */
	static getInstance(app: App, pluginId: string): DataAccessService {
		if (!DataAccessService.instance) {
			DataAccessService.instance = new DataAccessService(app, pluginId);
		}
		return DataAccessService.instance;
	}

	/**
	 * 设置插件实例
	 */
	setPluginInstance(plugin: any): void {
		this.pluginInstance = plugin;
	}

	/**
	 * 获取插件实例
	 */
	private getPluginInstance(): any {
		if (this.pluginInstance) {
			return this.pluginInstance;
		}

		// 尝试从Obsidian获取插件实例
		try {
			const plugins = (this.app as any).plugins;
			if (plugins && plugins.plugins) {
				this.pluginInstance = plugins.plugins[this.pluginId];
			} else if (plugins && typeof plugins.getPlugin === 'function') {
				this.pluginInstance = plugins.getPlugin(this.pluginId);
			}
		} catch (error) {
			errorHandler.handleError(
				`获取插件实例失败: ${error instanceof Error ? error.message : String(error)}`,
				{
					component: 'DataAccessService',
					operation: 'getPluginInstance'
				},
				ErrorLevel.WARNING,
				false // 不显示用户通知
			);
		}

		return this.pluginInstance;
	}

	/**
	 * 加载插件数据
	 */
	async loadData(): Promise<any> {
		const plugin = this.getPluginInstance();
		if (!plugin || typeof plugin.loadData !== 'function') {
			throw new Error('插件实例不可用或不支持数据加载');
		}

		try {
			return await plugin.loadData();
		} catch (error) {
			errorHandler.handleError(
				`加载数据失败: ${error instanceof Error ? error.message : String(error)}`,
				{
					component: 'DataAccessService',
					operation: 'loadData'
				}
			);
			throw error;
		}
	}

	/**
	 * 保存插件数据
	 */
	async saveData(data: any): Promise<void> {
		const plugin = this.getPluginInstance();
		if (!plugin || typeof plugin.saveData !== 'function') {
			throw new Error('插件实例不可用或不支持数据保存');
		}

		try {
			await plugin.saveData(data);
		} catch (error) {
			errorHandler.handleError(
				`保存数据失败: ${error instanceof Error ? error.message : String(error)}`,
				{
					component: 'DataAccessService',
					operation: 'saveData'
				}
			);
			throw error;
		}
	}

	/**
	 * 获取插件设置
	 */
	getSettings(): any {
		const plugin = this.getPluginInstance();
		if (!plugin) {
			errorHandler.handleError(
				'插件实例不可用',
				{
					component: 'DataAccessService',
					operation: 'getSettings'
				},
				ErrorLevel.WARNING,
				false
			);
			return null;
		}

		return plugin.settings || null;
	}

	/**
	 * 保存插件设置
	 */
	async saveSettings(settings: any): Promise<void> {
		const plugin = this.getPluginInstance();
		if (!plugin || typeof plugin.saveSettings !== 'function') {
			throw new Error('插件实例不可用或不支持设置保存');
		}

		try {
			plugin.settings = settings;
			await plugin.saveSettings();
		} catch (error) {
			errorHandler.handleError(
				`保存设置失败: ${error instanceof Error ? error.message : String(error)}`,
				{
					component: 'DataAccessService',
					operation: 'saveSettings'
				}
			);
			throw error;
		}
	}

	/**
	 * 获取统计管理器
	 */
	getStatsManager(): any {
		const plugin = this.getPluginInstance();
		return plugin?.pluginManager?.statsManagerInstance || null;
	}

	/**
	 * 获取目标管理器
	 */
	getGoalManager(): any {
		const plugin = this.getPluginInstance();
		return plugin?.pluginManager?.goalManagerInstance || null;
	}

	/**
	 * 获取缓存服务
	 */
	getCacheService(): any {
		const plugin = this.getPluginInstance();
		return plugin?.pluginManager?.cacheServiceInstance || null;
	}

	/**
	 * 检查插件是否可用
	 */
	isPluginAvailable(): boolean {
		const plugin = this.getPluginInstance();
		return plugin !== null && plugin !== undefined;
	}

	/**
	 * 检查服务是否可用
	 */
	isServiceAvailable(serviceName: 'stats' | 'goal' | 'cache'): boolean {
		const plugin = this.getPluginInstance();
		if (!plugin || !plugin.pluginManager) {
			return false;
		}

		switch (serviceName) {
			case 'stats':
				return !!plugin.pluginManager.statsManagerInstance;
			case 'goal':
				return !!plugin.pluginManager.goalManagerInstance;
			case 'cache':
				return !!plugin.pluginManager.cacheServiceInstance;
			default:
				return false;
		}
	}

	/**
	 * 安全地执行需要插件实例的操作
	 */
	async safeExecute<T>(
		operation: (plugin: any) => Promise<T> | T,
		defaultValue?: T
	): Promise<T | undefined> {
		const plugin = this.getPluginInstance();
		if (!plugin) {
			if (defaultValue !== undefined) {
				return defaultValue;
			}
			return undefined;
		}

		try {
			return await operation(plugin);
		} catch (error) {
			errorHandler.handleError(
				`安全执行操作失败: ${error instanceof Error ? error.message : String(error)}`,
				{
					component: 'DataAccessService',
					operation: 'safeExecute'
				},
				ErrorLevel.WARNING,
				false
			);
			
			if (defaultValue !== undefined) {
				return defaultValue;
			}
			return undefined;
		}
	}

	/**
	 * 重置数据访问服务
	 */
	reset(): void {
		this.pluginInstance = null;
	}

	/**
	 * 获取插件ID
	 */
	getPluginId(): string {
		return this.pluginId;
	}
}
