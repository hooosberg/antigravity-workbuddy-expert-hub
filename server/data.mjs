import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { sanitizeText, sanitizeEndpoint, isPrivateContent } from './sanitize.mjs';
import { SAMPLE_CATEGORIES, SAMPLE_EXPERTS } from './sample-catalog.mjs';

const HOME = os.homedir();
const WB_ROOT = path.join(HOME, '.workbuddy');
const AG_USER_SKILLS = path.join(HOME, '.gemini', 'config', 'skills');
const AG_BUILTIN_SKILLS = path.join(HOME, '.gemini', 'antigravity', 'builtin', 'skills');

const DEFAULT_CDN_BASE = 'https://acc-1258344699.cos.accelerate.myqcloud.com/workbuddy/expert-marketplace';

export class ExpertHubStore {
  constructor(dataDir) {
    this.dataDir = dataDir || path.join(HOME, '.gemini', 'config', 'plugins', 'expert-hub', '.data');
    this.statePath = path.join(this.dataDir, 'state.json');
    this.promptCacheDir = path.join(this.dataDir, 'prompt-cache');
    this.customExpertsDir = path.join(this.dataDir, 'custom-experts');
    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.mkdirSync(this.promptCacheDir, { recursive: true });
    fs.mkdirSync(this.customExpertsDir, { recursive: true });
  }

  loadState() {
    const fallback = {
      favorites: [],
      favoriteSkills: [],
      recents: [],
      usageCounts: {},
      customExperts: [],
    };
    try {
      if (fs.existsSync(this.statePath)) {
        const parsed = JSON.parse(fs.readFileSync(this.statePath, 'utf8'));
        return { ...fallback, ...parsed };
      }
    } catch {
      // ignore corrupted state
    }
    return fallback;
  }

  saveState(state) {
    fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2), 'utf8');
  }

  getCdnBaseUrl() {
    try {
      const metaPath = path.join(WB_ROOT, 'app', 'cache', 'experts', 'metadata.json');
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        if (meta.sourceSignature) {
          const sig = JSON.parse(meta.sourceSignature);
          if (sig.baseUrl) return sig.baseUrl.replace(/\/$/, '');
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_CDN_BASE;
  }

  findLocalPromptFile(expert) {
    const candidates = [];
    const pluginSlug = expert.plugin || '';
    const agentSlug = expert.agentName || pluginSlug;
    const promptRel = (expert.promptFile || '').replace(/^\/+/, '');

    if (expert.localPromptPath && fs.existsSync(expert.localPromptPath)) {
      return expert.localPromptPath;
    }

    if (promptRel) {
      candidates.push(path.join(WB_ROOT, 'plugins', 'marketplaces', 'experts', promptRel));
      candidates.push(path.join(WB_ROOT, 'plugins', 'marketplaces', 'my-experts', promptRel));
    }

    if (pluginSlug) {
      const mpDir = path.join(WB_ROOT, 'plugins', 'marketplaces', 'experts', 'plugins', pluginSlug);
      candidates.push(path.join(mpDir, 'agents', `${agentSlug}.md`));
      candidates.push(path.join(mpDir, 'agents', `${pluginSlug}.md`));
      candidates.push(path.join(mpDir, 'README.md'));

      const myDir = path.join(WB_ROOT, 'plugins', 'marketplaces', 'my-experts', 'plugins', pluginSlug);
      candidates.push(path.join(myDir, 'agents', `${agentSlug}.md`));
      candidates.push(path.join(myDir, 'agents', `${pluginSlug}.md`));

      const cacheDir = path.join(WB_ROOT, 'plugins', 'cache', 'experts', pluginSlug);
      if (fs.existsSync(cacheDir)) {
        try {
          const versions = fs.readdirSync(cacheDir).filter((v) => !v.startsWith('.')).sort().reverse();
          for (const v of versions) {
            candidates.push(path.join(cacheDir, v, 'agents', `${agentSlug}.md`));
            candidates.push(path.join(cacheDir, v, 'agents', `${pluginSlug}.md`));
          }
        } catch {
          // ignore
        }
      }
    }

    const cachedFile = path.join(this.promptCacheDir, `${expert.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`);
    candidates.push(cachedFile);

    for (const p of candidates) {
      if (p && fs.existsSync(p) && fs.statSync(p).isFile()) {
        return p;
      }
    }
    return null;
  }

  scanLocalExpertPlugins() {
    const installedSet = new Set();
    const dirs = [
      path.join(WB_ROOT, 'plugins', 'marketplaces', 'experts', 'plugins'),
      path.join(WB_ROOT, 'plugins', 'cache', 'experts'),
      path.join(WB_ROOT, 'plugins', 'marketplaces', 'my-experts', 'plugins'),
    ];
    for (const d of dirs) {
      if (!fs.existsSync(d)) continue;
      try {
        for (const name of fs.readdirSync(d)) {
          if (!name.startsWith('.')) installedSet.add(name);
        }
      } catch {
        // ignore
      }
    }
    return installedSet;
  }

  loadWorkBuddyRecents() {
    const recents = [];
    try {
      const storageDir = path.join(WB_ROOT, 'storage');
      if (!fs.existsSync(storageDir)) return recents;
      for (const entry of fs.readdirSync(storageDir)) {
        const p = path.join(storageDir, entry, 'expert.json');
        if (fs.existsSync(p)) {
          const data = JSON.parse(fs.readFileSync(p, 'utf8'));
          if (Array.isArray(data.recents)) {
            for (const r of data.recents) {
              if (r.id) recents.push(r.id);
            }
          }
        }
      }
    } catch {
      // ignore
    }
    return recents;
  }

  loadManifest() {
    const manifestPath = path.join(WB_ROOT, 'app', 'cache', 'experts', 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return { categories: [], experts: [] };
    }
    try {
      return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch {
      return { categories: [], experts: [] };
    }
  }

  pickLang(val, fallback = '') {
    if (!val) return fallback;
    if (typeof val === 'string') return val;
    return val.zh || val.en || fallback;
  }

  getExpertsData() {
    const manifest = this.loadManifest();
    const cdnBase = this.getCdnBaseUrl();
    const installedPlugins = this.scanLocalExpertPlugins();
    const state = this.loadState();
    const wbRecents = this.loadWorkBuddyRecents();

    const categories = (manifest.categories || []).length
      ? (manifest.categories || []).map((c) => ({
          id: c.id,
          name: this.pickLang(c.name, c.id),
          enName: c.name?.en || '',
          description: this.pickLang(c.description, ''),
        }))
      : SAMPLE_CATEGORIES;

    const experts = (manifest.experts || []).length
      ? (manifest.experts || []).map((e, idx) => {
          const avatarPath = e.avatar || '';
          const avatarUrl = avatarPath.startsWith('http')
            ? avatarPath
            : avatarPath
              ? `${cdnBase}${avatarPath.startsWith('/') ? '' : '/'}${avatarPath}`
              : '';
          const tags = (e.tags || [])
            .map((t) => this.pickLang(t))
            .filter(Boolean)
            .slice(0, 3);
          const isLocal = Boolean(e.plugin && installedPlugins.has(e.plugin));
          const baseHot = Math.max(12, Math.round(600 - idx * 1.1 + (isLocal ? 320 : 0) + (e.displayPosition ? (20 - Math.min(20, e.displayPosition)) * 45 : 0)));
          const localUsage = state.usageCounts[e.id] || 0;

          return {
            id: e.id,
            name: this.pickLang(e.profession, this.pickLang(e.displayName, e.id)),
            alias: this.pickLang(e.displayName, ''),
            description: sanitizeText(this.pickLang(e.displayDescription || e.description, '')),
            categoryId: e.categoryId || 'other',
            expertType: e.expertType || 'agent',
            isOPC: Boolean(e.isOPC),
            isLocal,
            isCustom: false,
            tags,
            avatarUrl,
            plugin: e.plugin || '',
            agentName: e.agentName || '',
            promptFile: e.promptFile || '',
            defaultInitPrompt: sanitizeText(this.pickLang(e.defaultInitPrompt, '')),
            quickPrompts: (e.quickPrompts || []).map((q) => sanitizeText(this.pickLang(q))).filter(Boolean).slice(0, 4),
            author: this.pickLang(e.author, ''),
            updatedAt: e.updatedAt || e.createdAt || '',
            displayPosition: e.displayPosition ?? 9999,
            hotScore: baseHot + localUsage * 100,
            localUsage,
            memberCount: Array.isArray(e.members) ? e.members.length : 0,
          };
        })
      : SAMPLE_EXPERTS.map((e) => ({ ...e }));

    // Merge user custom experts
    for (const ce of state.customExperts || []) {
      experts.unshift({
        id: ce.id,
        name: ce.name,
        alias: ce.alias || '自定义',
        description: ce.description || '',
        categoryId: ce.categoryId || '02-Engineering',
        expertType: ce.expertType || 'agent',
        isOPC: Boolean(ce.isOPC),
        isLocal: true,
        isCustom: true,
        tags: (ce.tags || []).slice(0, 3),
        avatarUrl: '',
        plugin: '',
        agentName: '',
        promptFile: '',
        localPromptPath: ce.promptPath,
        defaultInitPrompt: ce.defaultInitPrompt || `请以「${ce.name}」的身份协助我完成以下任务：`,
        quickPrompts: ce.quickPrompts || [],
        author: '我的自定义专家',
        updatedAt: ce.updatedAt || new Date().toISOString(),
        displayPosition: 0,
        hotScore: 9999 + (state.usageCounts[ce.id] || 0) * 100,
        localUsage: state.usageCounts[ce.id] || 0,
        memberCount: 0,
      });
    }

    const mergedRecents = Array.from(new Set([...(state.recents || []), ...wbRecents])).slice(0, 30);

    return {
      categories,
      experts,
      favorites: state.favorites || [],
      favoriteSkills: state.favoriteSkills || [],
      recents: mergedRecents,
    };
  }

  async getExpertDetail(expertId) {
    const { experts } = this.getExpertsData();
    const expert = experts.find((e) => e.id === expertId);
    if (!expert) {
      return { error: `未找到专家: ${expertId}` };
    }

    let promptContent = '';
    let promptSource = 'generated';

    const localPath = this.findLocalPromptFile(expert);
    if (localPath) {
      try {
        promptContent = fs.readFileSync(localPath, 'utf8');
        promptSource = localPath.startsWith(this.promptCacheDir) ? 'cached' : 'local';
      } catch {
        // ignore
      }
    }

    // Try fetching from public CDN if not locally available
    if (!promptContent && expert.promptFile) {
      const cdnBase = this.getCdnBaseUrl();
      const rel = expert.promptFile.startsWith('/') ? expert.promptFile : `/${expert.promptFile}`;
      const url = `${cdnBase}${rel}`;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          const text = await res.text();
          if (text && text.trim().length > 20) {
            promptContent = text;
            promptSource = 'cdn';
            const cachePath = path.join(this.promptCacheDir, `${expert.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`);
            fs.writeFileSync(cachePath, text, 'utf8');
          }
        }
      } catch {
        // Fallback to structured prompt below
      }
    }

    if (!promptContent) {
      promptContent = [
        `# ${expert.name}${expert.alias ? ` (${expert.alias})` : ''}`,
        '',
        `## 角色定位`,
        expert.description || `你是资深「${expert.name}」，请以专业、结构化、可落地的风格完成用户交付的任务。`,
        '',
        expert.tags.length ? `## 核心能力\n${expert.tags.map((t) => `- ${t}`).join('\n')}` : '',
        '',
        `## 工作原则`,
        `- 先明确目标、约束条件与交付物标准，再给出可执行方案。`,
        `- 输出结构清晰、重点突出、避免空话，必要时提供模板、代码或检查清单。`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    // Also include team members if present in manifest
    let members = [];
    const manifest = this.loadManifest();
    const raw = (manifest.experts || []).find((e) => e.id === expertId);
    if (raw && Array.isArray(raw.members)) {
      members = raw.members.map((m) => ({
        name: this.pickLang(m.name || m.displayName || m.profession, m.id || '成员'),
        role: this.pickLang(m.role || m.profession || m.description, ''),
      }));
    }

    return {
      ...expert,
      promptContent: sanitizeText(promptContent),
      promptSource,
      localPath: localPath ? sanitizeText(localPath) : null,
      members,
    };
  }

  parseSkillFrontmatter(mdText) {
    const match = mdText.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) return {};
    const fm = {};
    const lines = match[1].split('\n');
    let currentKey = null;
    for (const line of lines) {
      const kv = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
      if (kv) {
        currentKey = kv[1];
        const val = kv[2].trim().replace(/^['"]|['"]$/g, '');
        if (val !== '>-' && val !== '|' && val !== '>') {
          fm[currentKey] = val;
        } else {
          fm[currentKey] = '';
        }
      } else if (currentKey && /^\s+/.test(line)) {
        fm[currentKey] = (fm[currentKey] ? fm[currentKey] + ' ' : '') + line.trim();
      }
    }
    return fm;
  }

  scanSkillDir(dirPath, sourceLabel) {
    const results = [];
    if (!fs.existsSync(dirPath)) return results;
    try {
      for (const entry of fs.readdirSync(dirPath)) {
        if (entry.startsWith('.') || entry.startsWith('_')) continue;
        const skillDir = path.join(dirPath, entry);
        if (!fs.statSync(skillDir).isDirectory()) continue;
        const skillMd = path.join(skillDir, 'SKILL.md');
        if (!fs.existsSync(skillMd)) continue;
        const content = fs.readFileSync(skillMd, 'utf8');
        if (isPrivateContent(content)) continue;
        const fm = this.parseSkillFrontmatter(content);
        results.push({
          id: `${sourceLabel}:${entry}`,
          name: fm.name || entry,
          slug: entry,
          description: sanitizeText(fm.description || '本地 Markdown 技能包'),
          source: sourceLabel,
          filePath: skillMd,
          dirPath: skillDir,
          hasScripts: fs.existsSync(path.join(skillDir, 'scripts')),
          hasReferences: fs.existsSync(path.join(skillDir, 'references')),
        });
      }
    } catch {
      // ignore
    }
    return results;
  }

  getSkillsData() {
    const skillsMap = new Map();

    // 1. Antigravity user skills
    for (const s of this.scanSkillDir(AG_USER_SKILLS, 'antigravity-user')) {
      skillsMap.set(`ag:${s.slug}`, s);
    }

    // 2. Antigravity builtin skills
    for (const s of this.scanSkillDir(AG_BUILTIN_SKILLS, 'antigravity-builtin')) {
      skillsMap.set(`ag-builtin:${s.slug}`, s);
    }

    // 3. WorkBuddy local skills
    for (const s of this.scanSkillDir(path.join(WB_ROOT, 'skills'), 'workbuddy-local')) {
      const synced = fs.existsSync(path.join(AG_USER_SKILLS, s.slug, 'SKILL.md'));
      skillsMap.set(`wb:${s.slug}`, { ...s, syncedToAntigravity: synced });
    }

    // 4. WorkBuddy .skill-list-cache.json (deduplicated)
    const cacheFile = path.join(WB_ROOT, '.skill-list-cache.json');
    if (fs.existsSync(cacheFile)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        for (const item of parsed.results || []) {
          const slug = item.name || path.basename(path.dirname(item.filePath || ''));
          const key = `wb:${slug}`;
          if (skillsMap.has(key)) continue;
          if (isPrivateContent(item.description || '') || isPrivateContent(slug)) continue;
          const exists = item.filePath && fs.existsSync(item.filePath);
          const src =
            item.source === 'userSettings'
              ? 'workbuddy-local'
              : item.source === 'connector'
                ? 'workbuddy-connector'
                : 'workbuddy-builtin';
          skillsMap.set(`wb-cache:${slug}`, {
            id: `${src}:${slug}`,
            name: slug,
            slug,
            description: sanitizeText(item.description || ''),
            source: src,
            filePath: item.filePath || '',
            dirPath: item.filePath ? path.dirname(item.filePath) : '',
            exists: Boolean(exists),
            syncedToAntigravity: fs.existsSync(path.join(AG_USER_SKILLS, slug, 'SKILL.md')),
          });
        }
      } catch {
        // ignore
      }
    }

    return Array.from(skillsMap.values());
  }

  getSkillDetail(skillId) {
    const skills = this.getSkillsData();
    const skill = skills.find((s) => s.id === skillId || s.slug === skillId || s.name === skillId);
    if (!skill) return { error: `未找到技能: ${skillId}` };

    let content = '';
    if (skill.filePath && fs.existsSync(skill.filePath)) {
      try {
        content = fs.readFileSync(skill.filePath, 'utf8');
      } catch {
        // ignore
      }
    }
    if (!content) {
      content = `# ${skill.name}\n\n${skill.description || '暂无详细说明'}`;
    }

    return {
      ...skill,
      filePath: sanitizeText(skill.filePath || ''),
      dirPath: sanitizeText(skill.dirPath || ''),
      content: sanitizeText(content),
    };
  }

  syncSkillToAntigravity(skillId) {
    const skills = this.getSkillsData();
    const skill = skills.find((s) => s.id === skillId || s.slug === skillId);
    if (!skill) return { ok: false, error: '未找到对应技能' };
    if (!skill.dirPath || !fs.existsSync(skill.dirPath)) {
      return { ok: false, error: '该技能在本地没有可复制的目录文件' };
    }
    const targetDir = path.join(AG_USER_SKILLS, skill.slug);
    fs.mkdirSync(AG_USER_SKILLS, { recursive: true });
    fs.cpSync(skill.dirPath, targetDir, { recursive: true });
    return {
      ok: true,
      targetDir,
      message: `已将技能「${skill.name}」同步至反重力全局技能目录 (~/.gemini/config/skills/${skill.slug})，下一轮对话即可原生调用！`,
    };
  }

  getConnectorsData() {
    const connectors = [];
    const cDir = path.join(WB_ROOT, 'connectors-marketplace', 'connectors');
    if (fs.existsSync(cDir)) {
      try {
        for (const entry of fs.readdirSync(cDir)) {
          if (entry.startsWith('.')) continue;
          const full = path.join(cDir, entry);
          if (!fs.statSync(full).isDirectory()) continue;
          let transport = 'stdio';
          let endpoint = '';
          let preAuth = '';
          const mcpFile = path.join(full, 'mcp.json');
          if (fs.existsSync(mcpFile)) {
            try {
              const cfg = JSON.parse(fs.readFileSync(mcpFile, 'utf8'));
              preAuth = cfg.preAuth || '';
              const servers = cfg.mcpServers || {};
              const firstKey = Object.keys(servers)[0];
              if (firstKey) {
                const s = servers[firstKey];
                transport = s.type || (s.url ? 'http' : 'stdio');
                endpoint = s.url || [s.command, ...(s.args || [])].join(' ');
              }
            } catch {
              // ignore
            }
          }
          const skillsDir = path.join(full, 'skills');
          let skillCount = 0;
          if (fs.existsSync(skillsDir)) {
            skillCount = fs.readdirSync(skillsDir).filter((x) => !x.startsWith('.')).length;
          }
          connectors.push({
            id: `wb-conn:${entry}`,
            name: entry,
            source: 'WorkBuddy 连接器',
            transport,
            endpoint: sanitizeEndpoint(endpoint),
            preAuth,
            skillCount,
            dirPath: sanitizeText(full),
          });
        }
      } catch {
        // ignore
      }
    }

    // Also inspect Antigravity MCP config (strictly redacted)
    const agMcpPath = path.join(HOME, '.gemini', 'antigravity', 'mcp_config.json');
    if (fs.existsSync(agMcpPath)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(agMcpPath, 'utf8'));
        for (const [name, srv] of Object.entries(cfg.mcpServers || {})) {
          connectors.push({
            id: `ag-mcp:${name}`,
            name,
            source: 'Antigravity MCP',
            transport: srv.serverUrl || srv.url ? 'http' : 'stdio',
            endpoint: sanitizeEndpoint(srv.serverUrl || srv.url || [srv.command, ...(srv.args || [])].join(' ')),
            preAuth: '',
            skillCount: 0,
            dirPath: sanitizeText(agMcpPath),
          });
        }
      } catch {
        // ignore
      }
    }

    return connectors;
  }

  toggleFavorite(id, kind = 'expert') {
    const state = this.loadState();
    const key = kind === 'skill' ? 'favoriteSkills' : 'favorites';
    const list = new Set(state[key] || []);
    let favorited = false;
    if (list.has(id)) {
      list.delete(id);
      favorited = false;
    } else {
      list.add(id);
      favorited = true;
    }
    state[key] = Array.from(list);
    this.saveState(state);
    return { id, kind, favorited, list: state[key] };
  }

  recordUsage(expertId) {
    const state = this.loadState();
    state.usageCounts[expertId] = (state.usageCounts[expertId] || 0) + 1;
    state.recents = [expertId, ...(state.recents || []).filter((x) => x !== expertId)].slice(0, 30);
    this.saveState(state);
    return { expertId, count: state.usageCounts[expertId], recents: state.recents };
  }

  createCustomExpert({ name, description, categoryId, tags, promptContent, defaultInitPrompt }) {
    const state = this.loadState();
    const id = `custom_${Date.now()}`;
    const safeFile = `${id}.md`;
    const promptPath = path.join(this.customExpertsDir, safeFile);
    const md = promptContent?.trim() || `# ${name}\n\n${description || ''}`;
    fs.writeFileSync(promptPath, md, 'utf8');

    const record = {
      id,
      name: name.trim(),
      alias: '自定义',
      description: (description || '').trim(),
      categoryId: categoryId || '02-Engineering',
      expertType: 'agent',
      isOPC: false,
      tags: Array.isArray(tags) ? tags.filter(Boolean).slice(0, 3) : [],
      promptPath,
      defaultInitPrompt: (defaultInitPrompt || `请以「${name.trim()}」专家的身份帮我处理以下需求：`).trim(),
      quickPrompts: [],
      updatedAt: new Date().toISOString(),
    };

    state.customExperts = [record, ...(state.customExperts || [])];
    state.favorites = Array.from(new Set([id, ...(state.favorites || [])]));
    this.saveState(state);
    return record;
  }
}
