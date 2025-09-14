# Obsidian 字数统计插件

这是一个功能完善的Obsidian字数统计插件，帮助用户跟踪写作习惯、设定目标并通过热力图可视化展示。

## 主要功能

### 1. 写作统计
- 自动跟踪用户每天在Obsidian中书写的中文字符、英文字符以及标点符号
- 实时更新统计，支持文件编辑和创建事件监听
- 按日期存储历史数据，支持长期统计
- **已修复**：字数统计现在与Obsidian内置统计保持一致，准确排除Markdown语法元素
- **优化统计**：
  - 高性能单次遍历统计算法
  - 支持数字和空格统计
  - 智能词数统计功能
  - 详细的字符类型分析和占比
  - 可折叠的统计详情面板

### 2. 目标和连续写作
- 用户可以设定每日书写字符目标并跟踪每日目标完成情况
- 显示目标完成百分比和完成状态
- 计算并显示连续写作天数，记录最长连续记录

### 3. 热力视图
- 使用热力图展现用户每天输入的情况
- 支持30天写作历史可视化
- 可自定义热力图颜色方案

## 使用方法

### 安装
1. 将 `main.js`、`manifest.json` 和 `styles.css` 复制到你的 vault 的插件目录：
   ```
   <Vault>/.obsidian/plugins/word-count-plugin/
   ```
2. 重启 Obsidian
3. 在设置中启用插件

### 基本使用
1. **查看统计**：点击左侧边栏的"字数统计"图标或使用命令"显示字数统计"
2. **设置目标**：在插件设置中设定每日写作目标字数
3. **自定义统计**：选择要统计的字符类型（中文、英文、标点符号）
4. **热力图**：在统计视图中查看最近30天的写作热力图

### 命令
- **显示字数统计**：打开统计信息模态框
- **重置统计数据**：清除所有历史统计数据（不可恢复）

### 设置选项
- **每日目标字数**：设定每日写作目标（100-10000字）
- **显示状态栏**：在状态栏显示今日字数统计
- **统计选项**：选择要统计的字符类型
- **热力图设置**：启用/禁用热力图显示

## 技术实现

### 开发环境
- 使用TypeScript开发，提供类型检查
- 使用esbuild进行构建和打包
- 遵循Obsidian插件开发规范

### 核心功能
- **字符统计算法**：使用正则表达式精确统计中文字符、英文字符和标点符号
- **数据存储**：按日期存储统计数据，支持增量更新
- **热力图实现**：使用CSS Grid布局，动态颜色映射
- **性能优化**：防抖处理文件变更，批量更新数据

### 目录结构
```
.
├── main.ts                 # 插件入口点
├── manifest.json           # 插件清单
├── styles.css              # 插件样式
├── package.json            # 项目配置
├── tsconfig.json           # TypeScript配置
├── esbuild.config.mjs      # 构建配置
└── README.md               # 说明文档
```

## 构建和发布

### 开发构建
```bash
npm run dev
```

### 生产构建
```bash
npm run build
```

### 版本管理
- 更新 `manifest.json` 中的版本号
- 更新 `versions.json` 以支持不同Obsidian版本

## 兼容性

- 支持桌面端和移动端
- 兼容 Obsidian 0.15.0 及以上版本
- 支持所有主流操作系统

## 注意事项

- 插件会自动跟踪所有Markdown文件的编辑
- 数据存储在本地，不会上传到任何服务器
- 重置数据操作不可恢复，请谨慎操作

## 后续计划

- [ ] 添加数据导出功能（CSV格式）
- [ ] 实现更多统计图表（趋势图、饼图等）
- [ ] 支持按文件类型和文件夹统计
- [ ] 添加写作时间分析功能
- [ ] 实现数据备份和恢复

## 许可证

MIT License

## First time developing plugins?

Quick starting guide for new plugin devs:

- Check if [someone already developed a plugin for what you want](https://obsidian.md/plugins)! There might be an existing plugin similar enough that you can partner up with.
- Make a copy of this repo as a template with the "Use this template" button (login to GitHub if you don't see it).
- Clone your repo to a local development folder. For convenience, you can place this folder in your `.obsidian/plugins/your-plugin-name` folder.
- Install NodeJS, then run `npm i` in the command line under your repo folder.
- Run `npm run dev` to compile your plugin from `main.ts` to `main.js`.
- Make changes to `main.ts` (or create new `.ts` files). Those changes should be automatically compiled into `main.js`.
- Reload Obsidian to load the new version of your plugin.
- Enable plugin in settings window.
- For updates to the Obsidian API run `npm update` in the command line under your repo folder.

## Releasing new releases

- Update your `manifest.json` with your new version number, such as `1.0.1`, and the minimum Obsidian version required for your latest release.
- Update your `versions.json` file with `"new-plugin-version": "minimum-obsidian-version"` so older versions of Obsidian can download an older version of your plugin that's compatible.
- Create new GitHub release using your new version number as the "Tag version". Use the exact version number, don't include a prefix `v`. See here for an example: https://github.com/obsidianmd/obsidian-sample-plugin/releases
- Upload the files `manifest.json`, `main.js`, `styles.css` as binary attachments. Note: The manifest.json file must be in two places, first the root path of your repository and also in the release.
- Publish the release.

> You can simplify the version bump process by running `npm version patch`, `npm version minor` or `npm version major` after updating `minAppVersion` manually in `manifest.json`.
> The command will bump version in `manifest.json` and `package.json`, and add the entry for the new version to `versions.json`

## Adding your plugin to the community plugin list

- Check the [plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines).
- Publish an initial version.
- Make sure you have a `README.md` file in the root of your repo.
- Make a pull request at https://github.com/obsidianmd/obsidian-releases to add your plugin.

## How to use

- Clone this repo.
- Make sure your NodeJS is at least v16 (`node --version`).
- `npm i` or `yarn` to install dependencies.
- `npm run dev` to start compilation in watch mode.

## Manually installing the plugin

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/your-plugin-id/`.

## Improve code quality with eslint (optional)
- [ESLint](https://eslint.org/) is a tool that analyzes your code to quickly find problems. You can run ESLint against your plugin to find common bugs and ways to improve your code. 
- To use eslint with this project, make sure to install eslint from terminal:
  - `npm install -g eslint`
- To use eslint to analyze this project use this command:
  - `eslint main.ts`
  - eslint will then create a report with suggestions for code improvement by file and line number.
- If your source code is in a folder, such as `src`, you can use eslint with this command to analyze all files in that folder:
  - `eslint ./src/`

## Funding URL

You can include funding URLs where people who use your plugin can financially support it.

The simple way is to set the `fundingUrl` field to your link in your `manifest.json` file:

```json
{
    "fundingUrl": "https://buymeacoffee.com"
}
```

If you have multiple URLs, you can also do:

```json
{
    "fundingUrl": {
        "Buy Me a Coffee": "https://buymeacoffee.com",
        "GitHub Sponsor": "https://github.com/sponsors",
        "Patreon": "https://www.patreon.com/"
    }
}
```

## API Documentation

See https://github.com/obsidianmd/obsidian-api
