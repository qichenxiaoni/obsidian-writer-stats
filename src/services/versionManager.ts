/**
 * 数据版本管理和迁移服务
 */

import { errorHandler, ErrorLevel } from './errorHandler';

export interface DataVersion {
	version: string;
	timestamp: number;
	description: string;
}

export interface MigrationResult {
	success: boolean;
	fromVersion: string;
	toVersion: string;
	migratedItems: number;
	errors: string[];
}

export class VersionManager {
	private static readonly CURRENT_VERSION = '1.0.0';
	private static readonly VERSION_KEY = 'dataVersion';

	/**
	 * 检查数据版本并执行必要的迁移
	 */
	static async checkAndMigrate(pluginData: any): Promise<{ data: any; migrationResult?: MigrationResult }> {
		const currentDataVersion = pluginData?.[VersionManager.VERSION_KEY];
		
		if (!currentDataVersion) {
			// 首次安装或旧版本数据
			return VersionManager.handleLegacyData(pluginData);
		}

		if (currentDataVersion === VersionManager.CURRENT_VERSION) {
			// 数据版本匹配，无需迁移
			return { data: pluginData };
		}

		// 需要版本迁移
		return VersionManager.performMigration(pluginData, currentDataVersion);
	}

	/**
	 * 处理旧版本数据（无版本标识）
	 */
	private static async handleLegacyData(pluginData: any): Promise<{ data: any; migrationResult?: MigrationResult }> {
		if (!pluginData || Object.keys(pluginData).length === 0) {
			// 全新安装
			return {
				data: VersionManager.createNewDataStructure()
			};
		}

		// 检测旧版本数据格式
		const migrationResult = await VersionManager.migrateLegacyData(pluginData);
		
		return {
			data: migrationResult.success ? pluginData : VersionManager.createNewDataStructure(),
			migrationResult
		};
	}

	/**
	 * 执行版本迁移
	 */
	private static async performMigration(
		pluginData: any, 
		fromVersion: string
	): Promise<{ data: any; migrationResult: MigrationResult }> {
		const migrationResult: MigrationResult = {
			success: false,
			fromVersion,
			toVersion: VersionManager.CURRENT_VERSION,
			migratedItems: 0,
			errors: []
		};

		try {
			// 根据源版本执行相应的迁移逻辑
			switch (fromVersion) {
				case '0.1.0':
					pluginData = await VersionManager.migrateFrom010(pluginData, migrationResult);
					break;
				case '0.2.0':
					pluginData = await VersionManager.migrateFrom020(pluginData, migrationResult);
					break;
				default:
					migrationResult.errors.push(`不支持的版本迁移: ${fromVersion} -> ${VersionManager.CURRENT_VERSION}`);
					return { data: pluginData, migrationResult };
			}

			// 更新版本信息
			pluginData[VersionManager.VERSION_KEY] = VersionManager.CURRENT_VERSION;
			pluginData.lastMigration = {
				timestamp: Date.now(),
				fromVersion,
				toVersion: VersionManager.CURRENT_VERSION
			};

			migrationResult.success = true;
			
			errorHandler.handleError(
				`数据迁移成功: ${fromVersion} -> ${VersionManager.CURRENT_VERSION}`,
				{
					component: 'VersionManager',
					operation: 'performMigration',
					details: migrationResult
				},
				ErrorLevel.INFO
			);

		} catch (error) {
			migrationResult.errors.push(`迁移过程中发生错误: ${error instanceof Error ? error.message : String(error)}`);
			
			errorHandler.handleError(
				error as Error,
				{
					component: 'VersionManager',
					operation: 'performMigration',
					details: { fromVersion, toVersion: VersionManager.CURRENT_VERSION }
				}
			);
		}

		return { data: pluginData, migrationResult };
	}

	/**
	 * 迁移旧版本数据（无版本标识）
	 */
	private static async migrateLegacyData(pluginData: any): Promise<MigrationResult> {
		const migrationResult: MigrationResult = {
			success: false,
			fromVersion: 'legacy',
			toVersion: VersionManager.CURRENT_VERSION,
			migratedItems: 0,
			errors: []
		};

		try {
			// 检查是否有dailyStats数组（旧格式）
			if (Array.isArray(pluginData.dailyStats)) {
				// 验证和清理数据
				const validStats = pluginData.dailyStats.filter((stat: any) => {
					return stat && typeof stat === 'object' && stat.date;
				});

				// 确保数据结构完整
				pluginData.dailyStats = validStats.map((stat: any) => ({
					date: stat.date,
					chinese: stat.chinese || 0,
					english: stat.english || 0,
					punctuation: stat.punctuation || 0,
					numbers: stat.numbers || 0,
					spaces: stat.spaces || 0,
					words: stat.words || 0,
					total: stat.total || 0,
					goal: 0, // 移除旧的目标系统
					completed: stat.completed || false,
					charChanges: stat.charChanges || []
				}));

				migrationResult.migratedItems = pluginData.dailyStats.length;
			}

			// 添加版本信息
			pluginData[VersionManager.VERSION_KEY] = VersionManager.CURRENT_VERSION;
			pluginData.migrationHistory = [{
				timestamp: Date.now(),
				fromVersion: 'legacy',
				toVersion: VersionManager.CURRENT_VERSION,
				description: '从无版本标识的旧数据迁移'
			}];

			migrationResult.success = true;

		} catch (error) {
			migrationResult.errors.push(`旧版本数据迁移失败: ${error instanceof Error ? error.message : String(error)}`);
		}

		return migrationResult;
	}

	/**
	 * 从版本 0.1.0 迁移
	 */
	private static async migrateFrom010(pluginData: any, migrationResult: MigrationResult): Promise<any> {
		// 0.1.0 -> 1.0.0 的具体迁移逻辑
		// 例如：移除废弃的字段，添加新的字段等
		
		if (pluginData.dailyStats) {
			pluginData.dailyStats = pluginData.dailyStats.map((stat: any) => {
				// 移除旧的目标系统
				delete stat.goal;
				
				// 确保新字段存在
				return {
					...stat,
					goal: 0,
					completed: stat.total > 0
				};
			});
			
			migrationResult.migratedItems += pluginData.dailyStats.length;
		}

		return pluginData;
	}

	/**
	 * 从版本 0.2.0 迁移
	 */
	private static async migrateFrom020(pluginData: any, migrationResult: MigrationResult): Promise<any> {
		// 0.2.0 -> 1.0.0 的具体迁移逻辑
		// 这里可以添加具体的迁移步骤
		
		migrationResult.migratedItems = 0; // 根据实际迁移的项目数量更新
		
		return pluginData;
	}

	/**
	 * 创建新的数据结构
	 */
	private static createNewDataStructure(): any {
		return {
			[VersionManager.VERSION_KEY]: VersionManager.CURRENT_VERSION,
			createdAt: Date.now(),
			dailyStats: [],
			settings: {}, // 将由插件的默认设置填充
			migrationHistory: []
		};
	}

	/**
	 * 获取当前版本
	 */
	static getCurrentVersion(): string {
		return VersionManager.CURRENT_VERSION;
	}

	/**
	 * 验证数据完整性
	 */
	static validateDataIntegrity(pluginData: any): { isValid: boolean; issues: string[] } {
		const issues: string[] = [];

		// 检查版本信息
		if (!pluginData[VersionManager.VERSION_KEY]) {
			issues.push('缺少版本信息');
		}

		// 检查dailyStats格式
		if (pluginData.dailyStats && !Array.isArray(pluginData.dailyStats)) {
			issues.push('dailyStats 应该是数组格式');
		}

		// 检查每个统计项的完整性
		if (Array.isArray(pluginData.dailyStats)) {
			pluginData.dailyStats.forEach((stat: any, index: number) => {
				if (!stat || typeof stat !== 'object') {
					issues.push(`统计项 ${index} 格式无效`);
					return;
				}

				if (!stat.date) {
					issues.push(`统计项 ${index} 缺少日期`);
				}

				const requiredFields = ['chinese', 'english', 'punctuation', 'numbers', 'spaces', 'words', 'total'];
				for (const field of requiredFields) {
					if (typeof stat[field] !== 'number') {
						issues.push(`统计项 ${index} 的 ${field} 字段类型错误`);
					}
				}
			});
		}

		return {
			isValid: issues.length === 0,
			issues
		};
	}

	/**
	 * 创建数据备份
	 */
	static createBackup(pluginData: any): string {
		const backup = {
			...pluginData,
			backupTimestamp: Date.now(),
			backupVersion: VersionManager.CURRENT_VERSION
		};

		return JSON.stringify(backup, null, 2);
	}

	/**
	 * 从备份恢复数据
	 */
	static async restoreFromBackup(backupData: string): Promise<{ success: boolean; data?: any; error?: string }> {
		try {
			const parsedData = JSON.parse(backupData);
			
			// 验证备份数据
			const validation = VersionManager.validateDataIntegrity(parsedData);
			if (!validation.isValid) {
				return {
					success: false,
					error: `备份数据验证失败: ${validation.issues.join(', ')}`
				};
			}

			// 如果需要，执行迁移
			const { data } = await VersionManager.checkAndMigrate(parsedData);

			return {
				success: true,
				data
			};

		} catch (error) {
			return {
				success: false,
				error: `备份数据解析失败: ${error instanceof Error ? error.message : String(error)}`
			};
		}
	}
}


