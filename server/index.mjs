#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { ExpertHubStore } from './data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(__dirname, '..');

function getArgValue(prefix) {
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

const DATA_DIR = getArgValue('--data_dir=') || process.env.EXPERT_HUB_DATA_DIR || null;
const APP_HTML_PATH =
  process.env.EXPERT_HUB_APP_HTML ||
  path.join(PLUGIN_ROOT, 'dist', 'app.html');

const APP_URI = 'ui://expert-hub/app.html';
const store = new ExpertHubStore(DATA_DIR);

const server = new McpServer({
  name: 'expert-hub',
  version: '1.0.0',
});

// UI Resource
server.registerResource(
  'expert-hub-ui',
  APP_URI,
  {
    title: '专家与技能市场 UI',
    description: 'WorkBuddy 风格的专家、专家团、技能与连接器市场界面',
    mimeType: 'text/html;profile=mcp-app',
    _meta: {
      ui: {
        prefersBorder: false,
        csp: {
          resourceDomains: [
            'https://acc-1258344699.cos.accelerate.myqcloud.com',
            'https://openplatform-cdn.codebuddy.cn',
          ],
        },
      },
    },
  },
  async () => {
    let html = '<html><body><h2>Expert Hub UI 未构建，请运行 npm run build:ui</h2></body></html>';
    if (fs.existsSync(APP_HTML_PATH)) {
      html = fs.readFileSync(APP_HTML_PATH, 'utf8');
    }
    return {
      contents: [
        {
          uri: APP_URI,
          mimeType: 'text/html;profile=mcp-app',
          text: html,
          _meta: {
            ui: {
              prefersBorder: false,
              csp: {
                resourceDomains: [
                  'https://acc-1258344699.cos.accelerate.myqcloud.com',
                  'https://openplatform-cdn.codebuddy.cn',
                ],
              },
            },
          },
        },
      ],
    };
  },
);

// Main Entrypoint Tool (Side Pane + Global Sidebar + Inline)
server.registerTool(
  'open_expert_hub',
  {
    title: '专家市场',
    description: '打开类似 WorkBuddy 的「专家与技能市场」交互面板，浏览 400+ 行业专家、专家团、本地技能与连接器，一键唤醒专家角色协助完成任务。',
    inputSchema: {
      tab: z.enum(['experts', 'skills', 'connectors', 'mine']).optional().describe('初始打开的标签页'),
      query: z.string().optional().describe('初始搜索关键词'),
      category: z.string().optional().describe('初始分类 ID'),
    },
    _meta: {
      ui: {
        resourceUri: APP_URI,
      },
      'com.google.antigravity/ui': {
        entrypoints: [
          { type: 'aux_pane', title: '专家市场' },
          { type: 'global', title: '专家市场' },
        ],
      },
    },
  },
  async (args = {}) => {
    const data = store.getExpertsData();
    const skills = store.getSkillsData();
    return {
      content: [
        {
          type: 'text',
          text: `已打开「专家与技能市场」（共加载 ${data.experts.length} 位专家/专家团、${skills.length} 个技能）。你可以在界面中按场景和分类浏览，点击任意专家一键唤醒到当前对话或新对话。`,
        },
      ],
      structuredContent: {
        initialTab: args.tab || 'experts',
        initialQuery: args.query || '',
        initialCategory: args.category || 'all',
        summary: {
          expertCount: data.experts.length,
          skillCount: skills.length,
        },
      },
    };
  },
);

// Model-facing search tool
server.registerTool(
  'search_experts',
  {
    title: '搜索专家与技能',
    description: '按关键词或分类检索本地专家与技能库，返回最匹配的专家 ID、简介与标签。',
    inputSchema: {
      query: z.string().describe('搜索关键词，如“电商”、“PPT”、“微信小程序”、“法务”'),
      limit: z.number().int().min(1).max(20).optional().describe('返回数量上限，默认 8'),
    },
  },
  async ({ query, limit = 8 }) => {
    const q = (query || '').trim().toLowerCase();
    const { experts } = store.getExpertsData();
    const matched = experts
      .filter((e) => {
        if (!q) return true;
        const hay = `${e.name} ${e.alias} ${e.description} ${e.tags.join(' ')} ${e.categoryId}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, limit);

    return {
      content: [
        {
          type: 'text',
          text: matched.length
            ? matched
                .map(
                  (e, i) =>
                    `${i + 1}. **${e.name}** (\`${e.id}\` · ${e.expertType === 'team' ? '专家团' : '专家'})\n   ${e.description}\n   标签: ${e.tags.join(' / ')}`,
                )
                .join('\n\n')
            : `未找到与「${query}」匹配的专家。`,
        },
      ],
      structuredContent: { results: matched },
    };
  },
);

// Model-facing get prompt tool
server.registerTool(
  'get_expert_prompt',
  {
    title: '获取专家人设提示词',
    description: '读取指定专家的完整 Markdown 人设提示词，用于让当前助手立即进入该专家角色。',
    inputSchema: {
      expertId: z.string().describe('专家 ID，可通过 search_experts 获取'),
    },
  },
  async ({ expertId }) => {
    const detail = await store.getExpertDetail(expertId);
    if (detail.error) {
      return { content: [{ type: 'text', text: detail.error }], isError: true };
    }
    store.recordUsage(expertId);
    return {
      content: [
        {
          type: 'text',
          text: `# 已加载专家：${detail.name}\n\n${detail.promptContent}`,
        },
      ],
      structuredContent: detail,
    };
  },
);

// ==================== APP-ONLY TOOLS ====================
const APP_ONLY = { ui: { visibility: ['app'] } };

server.registerTool(
  'app_bootstrap',
  {
    title: 'Bootstrap Expert Hub Data',
    description: 'App-only bootstrap payload for experts, categories, skills, connectors, and user state.',
    inputSchema: {},
    _meta: APP_ONLY,
  },
  async () => {
    const expertsData = store.getExpertsData();
    const skills = store.getSkillsData();
    const connectors = store.getConnectorsData();

    // Keep payload compact and fast (< 300KB)
    const compactExperts = expertsData.experts.map((e) => ({
      id: e.id,
      name: e.name,
      alias: e.alias,
      description: e.description,
      categoryId: e.categoryId,
      expertType: e.expertType,
      isOPC: e.isOPC,
      isLocal: e.isLocal,
      isCustom: e.isCustom,
      tags: e.tags,
      avatarUrl: e.avatarUrl,
      defaultInitPrompt: e.defaultInitPrompt,
      updatedAt: e.updatedAt,
      displayPosition: e.displayPosition,
      hotScore: e.hotScore,
      localUsage: e.localUsage,
      memberCount: e.memberCount,
    }));

    return {
      content: [{ type: 'text', text: 'ok' }],
      structuredContent: {
        categories: expertsData.categories,
        experts: compactExperts,
        favorites: expertsData.favorites,
        favoriteSkills: expertsData.favoriteSkills,
        recents: expertsData.recents,
        skills,
        connectors,
      },
    };
  },
);

server.registerTool(
  'app_get_expert_detail',
  {
    title: 'Get Expert Detail',
    description: 'App-only: fetch full expert markdown prompt and quick prompts.',
    inputSchema: {
      expertId: z.string(),
    },
    _meta: APP_ONLY,
  },
  async ({ expertId }) => {
    const detail = await store.getExpertDetail(expertId);
    return {
      content: [{ type: 'text', text: detail.error || 'ok' }],
      structuredContent: detail,
      isError: Boolean(detail.error),
    };
  },
);

server.registerTool(
  'app_get_skill_detail',
  {
    title: 'Get Skill Detail',
    description: 'App-only: read SKILL.md for a selected skill.',
    inputSchema: {
      skillId: z.string(),
    },
    _meta: APP_ONLY,
  },
  async ({ skillId }) => {
    const detail = store.getSkillDetail(skillId);
    return {
      content: [{ type: 'text', text: detail.error || 'ok' }],
      structuredContent: detail,
      isError: Boolean(detail.error),
    };
  },
);

server.registerTool(
  'app_toggle_favorite',
  {
    title: 'Toggle Favorite',
    description: 'App-only: toggle favorite status for an expert or skill.',
    inputSchema: {
      id: z.string(),
      kind: z.enum(['expert', 'skill']).optional(),
    },
    _meta: APP_ONLY,
  },
  async ({ id, kind = 'expert' }) => {
    const res = store.toggleFavorite(id, kind);
    return {
      content: [{ type: 'text', text: 'ok' }],
      structuredContent: res,
    };
  },
);

server.registerTool(
  'app_record_usage',
  {
    title: 'Record Expert Usage',
    description: 'App-only: record usage count and recents.',
    inputSchema: {
      expertId: z.string(),
    },
    _meta: APP_ONLY,
  },
  async ({ expertId }) => {
    const res = store.recordUsage(expertId);
    return {
      content: [{ type: 'text', text: 'ok' }],
      structuredContent: res,
    };
  },
);

server.registerTool(
  'app_create_expert',
  {
    title: 'Create Custom Expert',
    description: 'App-only: create and persist a custom markdown expert.',
    inputSchema: {
      name: z.string().min(1),
      description: z.string().optional(),
      categoryId: z.string().optional(),
      tags: z.array(z.string()).optional(),
      promptContent: z.string().min(1),
      defaultInitPrompt: z.string().optional(),
    },
    _meta: APP_ONLY,
  },
  async (args) => {
    const created = store.createCustomExpert(args);
    return {
      content: [{ type: 'text', text: 'ok' }],
      structuredContent: { expert: created },
    };
  },
);

server.registerTool(
  'app_sync_skill_to_antigravity',
  {
    title: 'Sync Skill to Antigravity',
    description: 'App-only: copy a WorkBuddy skill folder into ~/.gemini/config/skills/',
    inputSchema: {
      skillId: z.string(),
    },
    _meta: APP_ONLY,
  },
  async ({ skillId }) => {
    const res = store.syncSkillToAntigravity(skillId);
    return {
      content: [{ type: 'text', text: res.message || res.error || 'done' }],
      structuredContent: res,
      isError: !res.ok,
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
