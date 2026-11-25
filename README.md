# 反重力 WorkBuddy 专家技能市场复刻插件 (Antigravity Expert Hub)

为 **Google Antigravity（反重力）** 打造的 WorkBuddy 风格 **「专家、专家团、技能与连接器市场」** MCP App 插件。  
支持在右侧边栏 (`aux_pane`) 与左侧全局导航栏 (`global`) 一键打开，快捷浏览、检索并唤醒行业专家 Markdown 人设与本地技能包。

## 核心特性

- **高还原度 WorkBuddy 市场 UI**：
  - 顶部导航切换「专家 / 技能 / 连接器 / 我的专家」与实时搜索框
  - 四大精选场景推荐大卡（电商运营 / 内容创作 / 投资分析 / 法律咨询）
  - 「专家 / 专家团」二级切换、「综合 / 最热 / 最新」排序与 15+ 行业分类胶囊条
  - 响应式多列卡片网格，自动适配 Antigravity 浅色/深色主题
- **一键唤醒专家干活**：
  - 点击任意专家打开右侧抽屉，支持查看完整 Markdown 人设、快捷任务模板
  - 支持 **在当前对话唤醒专家**、**附加到下条消息上下文**、**在新对话中开启**
- **本地资产整合 + 开箱即用**：
  - 若本机已安装 WorkBuddy，自动动态读取本机 `~/.workbuddy` 中的专家清单、本地 Markdown 人设、技能与连接器
  - 若未安装 WorkBuddy，自动启用内置公开示例专家库，开箱即用
  - 支持将本地技能一键同步至 Antigravity 全局技能目录（`~/.gemini/config/skills/`）
  - 支持在「我的专家」中收藏专家、查看最近使用以及新建自定义 Markdown 专家
- **内置隐私脱敏与安全机制**：
  - 仓库源码零硬编码个人数据、账号、密钥或私人流程
  - 内置脱敏过滤器 (`server/sanitize.mjs`)，在读取提示词、技能与连接器时自动脱敏 API Key / Token / 密码 / 邮箱 / 手机号 / 身份证号 / 本地用户名路径，并自动过滤标记为绝密的私人文档

## 快速安装

环境要求：Node.js 18+

```bash
git clone https://github.com/hooosberg/antigravity-workbuddy-expert-hub.git
cd antigravity-workbuddy-expert-hub
chmod +x install.sh
./install.sh
```

安装完成后无需重启 Antigravity，即可通过以下任意方式打开：
1. 点击右侧边栏顶部 **`+`** 按钮 → 选择 **「专家市场」**（推荐，支持一键唤醒到当前对话）
2. 点击左侧全局导航栏 **「专家市场」** 全屏浏览
3. 在对话中直接说：“打开专家市场” 或 “帮我找个电商运营专家”

## 目录结构

```text
├── plugin.json             # Antigravity 插件清单
├── mcp_config.json         # MCP Server 启动配置
├── install.sh              # 一键构建与安装脚本
├── assets/logo.svg         # 插件图标
├── skills/expert-hub/      # 配套触发技能 SKILL.md
├── server/
│   ├── index.mjs           # MCP Server & App-only 工具
│   ├── data.mjs            # 本地专家/技能/连接器动态加载引擎
│   ├── sanitize.mjs        # 隐私信息与凭据自动脱敏模块
│   └── sample-catalog.mjs  # 公开示例专家库（无本地 WorkBuddy 时兜底）
└── ui/                     # 单文件前端源码（Vite + vite-plugin-singlefile）
```

## License

[MIT](./LICENSE)
