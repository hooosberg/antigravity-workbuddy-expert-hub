import {
  App,
  applyDocumentTheme,
  applyHostStyleVariables,
} from '@modelcontextprotocol/ext-apps';

const app = new App({ name: 'Expert Hub', version: '1.0.0' }, {});

const state = {
  tab: 'experts', // experts | skills | connectors | mine
  expertType: 'agent', // agent | team
  sortBy: 'default', // default | hot | latest
  category: 'all', // all | opc | <categoryId>
  skillFilter: 'all',
  query: '',
  pageSize: 36,
  categories: [],
  experts: [],
  skills: [],
  connectors: [],
  favorites: new Set(),
  favoriteSkills: new Set(),
  recents: [],
  capabilities: {},
  bootstrapped: false,
};

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #6366f1, #3b82f6)',
  'linear-gradient(135deg, #10b981, #06b6d4)',
  'linear-gradient(135deg, #f59e0b, #ef4444)',
  'linear-gradient(135deg, #8b5cf6, #ec4899)',
  'linear-gradient(135deg, #0ea5e9, #14b8a6)',
  'linear-gradient(135deg, #f97316, #eab308)',
];

const FEATURED_SCENARIOS = [
  {
    title: '电商运营',
    themeClass: 'scenario-purple',
    artSvg: `<svg class="scenario-art" viewBox="0 0 64 64" fill="none"><rect x="10" y="18" width="44" height="34" rx="10" fill="#7C3AED" fill-opacity="0.18"/><path d="M22 22v-3a10 10 0 0 1 20 0v3" stroke="#6D28D9" stroke-width="3" stroke-linecap="round"/><rect x="18" y="24" width="28" height="22" rx="6" fill="#7C3AED" fill-opacity="0.85"/><path d="M26 35l4 4 8-8" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    items: [
      { label: '中国电商运营专家', keywords: ['电商运营', '电商'] },
      { label: '商家宣传页与海报设计师', keywords: ['海报', '宣传页', 'UI设计'] },
      { label: '跨境电商专家', keywords: ['跨境', '出海'] },
    ],
  },
  {
    title: '内容创作',
    themeClass: 'scenario-green',
    artSvg: `<svg class="scenario-art" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="22" fill="#16A34A" fill-opacity="0.16"/><rect x="20" y="16" width="24" height="32" rx="6" fill="#16A34A" fill-opacity="0.85"/><path d="M26 26h12M26 33h12M26 40h8" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>`,
    items: [
      { label: '内容创作专家团', keywords: ['内容创作', '专家团'] },
      { label: '内容创作专家', keywords: ['内容创作专家', 'ContentCreator'] },
      { label: '微信公众号运营专家', keywords: ['公众号', '微信'] },
    ],
  },
  {
    title: '投资分析',
    themeClass: 'scenario-blue',
    artSvg: `<svg class="scenario-art" viewBox="0 0 64 64" fill="none"><rect x="10" y="14" width="44" height="36" rx="10" fill="#2563EB" fill-opacity="0.16"/><path d="M18 40l9-10 7 6 12-14" stroke="#2563EB" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="46" cy="22" r="4" fill="#2563EB"/></svg>`,
    items: [
      { label: '交易分析团队', keywords: ['交易', '量化', '投资'] },
      { label: '股票研究专家', keywords: ['股票', '研报', '金融'] },
      { label: '投研分析专家团', keywords: ['投研', '金融投资'] },
    ],
  },
  {
    title: '法律咨询',
    themeClass: 'scenario-slate',
    artSvg: `<svg class="scenario-art" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="22" fill="#475569" fill-opacity="0.15"/><path d="M32 16v32M20 48h24M18 24h28" stroke="#334155" stroke-width="3" stroke-linecap="round"/><path d="M18 24l-5 11h10l-5-11zM46 24l-5 11h10l-5-11z" fill="#475569" fill-opacity="0.75"/></svg>`,
    items: [
      { label: '法律检索专家', keywords: ['法律', '法务'] },
      { label: '资深合同法务', keywords: ['合同', '合规'] },
      { label: '财税合规专家', keywords: ['财税', '税务', '安全合规'] },
    ],
  },
];

// ==================== DOM References ====================
const viewContainer = document.getElementById('viewContainer');
const loadingState = document.getElementById('loadingState');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const myExpertsBtn = document.getElementById('myExpertsBtn');
const drawerBackdrop = document.getElementById('drawerBackdrop');
const detailDrawer = document.getElementById('detailDrawer');
const drawerBody = document.getElementById('drawerBody');
const modalBackdrop = document.getElementById('modalBackdrop');
const createExpertForm = document.getElementById('createExpertForm');
const modalCategorySelect = document.getElementById('modalCategorySelect');
const toastEl = document.getElementById('toast');

let toastTimer = null;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 2600);
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function gradientFor(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function formatHot(score = 0) {
  if (score >= 1000) return `${(score / 100).toFixed(1)}k`;
  return String(score);
}

function renderAvatar(expert, size = 48) {
  const initial = (expert.name || '专').slice(0, 1);
  const bg = gradientFor(expert.id || expert.name);
  const style = `width:${size}px;height:${size}px;background:${bg};`;
  if (expert.avatarUrl) {
    return `<div class="avatar-wrap" style="${style}"><img src="${escapeHtml(expert.avatarUrl)}" alt="${escapeHtml(expert.name)}" loading="lazy" onerror="this.remove();" /><span>${escapeHtml(initial)}</span></div>`;
  }
  return `<div class="avatar-wrap" style="${style}"><span>${escapeHtml(initial)}</span></div>`;
}

function findScenarioExpert(keywords) {
  for (const kw of keywords) {
    const found = state.experts.find(
      (e) =>
        e.name.includes(kw) ||
        e.id.toLowerCase().includes(kw.toLowerCase()) ||
        e.description.includes(kw) ||
        (e.tags || []).some((t) => t.includes(kw)),
    );
    if (found) return found;
  }
  return state.experts[0] || null;
}

// ==================== Render Views ====================
function syncHeaderUI() {
  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === state.tab);
  });
  myExpertsBtn.classList.toggle('active', state.tab === 'mine');

  const placeholders = {
    experts: '搜索专家、标签或场景',
    skills: '搜索技能名称或描述',
    connectors: '搜索连接器',
    mine: '搜索我的收藏与自定义专家',
  };
  searchInput.placeholder = placeholders[state.tab] || '搜索';
  clearSearchBtn.classList.toggle('hidden', !state.query);
}

function render() {
  if (!state.bootstrapped) return;
  syncHeaderUI();

  if (state.tab === 'experts') {
    renderExpertsView();
  } else if (state.tab === 'skills') {
    renderSkillsView();
  } else if (state.tab === 'connectors') {
    renderConnectorsView();
  } else {
    renderMineView();
  }
}

function getFilteredExperts() {
  const q = state.query.trim().toLowerCase();
  let list = state.experts.filter((e) => {
    if (state.expertType === 'team' && e.expertType !== 'team') return false;
    if (state.expertType === 'agent' && e.expertType === 'team') return false;

    if (state.category === 'opc' && !e.isOPC) return false;
    if (state.category !== 'all' && state.category !== 'opc' && e.categoryId !== state.category) {
      return false;
    }

    if (q) {
      const hay = `${e.name} ${e.alias} ${e.description} ${(e.tags || []).join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (state.sortBy === 'hot') {
    list = [...list].sort((a, b) => (b.hotScore || 0) - (a.hotScore || 0));
  } else if (state.sortBy === 'latest') {
    list = [...list].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  } else {
    list = [...list].sort((a, b) => {
      if (a.isCustom !== b.isCustom) return a.isCustom ? -1 : 1;
      if (a.isLocal !== b.isLocal) return a.isLocal ? -1 : 1;
      if ((a.displayPosition ?? 9999) !== (b.displayPosition ?? 9999)) {
        return (a.displayPosition ?? 9999) - (b.displayPosition ?? 9999);
      }
      return (b.hotScore || 0) - (a.hotScore || 0);
    });
  }
  return list;
}

function renderExpertCard(e) {
  const isFav = state.favorites.has(e.id);
  const tagsHtml = (e.tags || [])
    .slice(0, 3)
    .map((t) => `<span class="tag-pill">${escapeHtml(t)}</span>`)
    .join('');

  return `
    <article class="expert-card" data-expert-id="${escapeHtml(e.id)}">
      <div class="card-head">
        ${renderAvatar(e, 48)}
        <div class="card-meta">
          <div class="card-title-row">
            <h4 class="card-title" title="${escapeHtml(e.name)}">${escapeHtml(e.name)}</h4>
            ${e.expertType === 'team' ? '<span class="badge-mini badge-team">专家团</span>' : ''}
            ${e.isLocal ? '<span class="badge-mini badge-local">本地</span>' : ''}
          </div>
          <p class="card-desc" title="${escapeHtml(e.description)}">${escapeHtml(e.description || '行业专业角色，点击查看完整提示词并唤醒')}</p>
        </div>
      </div>
      <div class="card-tags">${tagsHtml || '<span class="tag-pill">专业助手</span>'}</div>
      <div class="card-footer">
        <span class="card-stat">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          ${formatHot(e.hotScore)}
        </span>
        <button class="fav-btn ${isFav ? 'active' : ''}" data-fav-expert="${escapeHtml(e.id)}" title="${isFav ? '取消收藏' : '收藏到我的专家'}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </button>
      </div>
    </article>
  `;
}

function renderExpertsView() {
  const agentCount = state.experts.filter((e) => e.expertType !== 'team').length;
  const teamCount = state.experts.filter((e) => e.expertType === 'team').length;
  const filtered = getFilteredExperts();
  const visible = filtered.slice(0, state.pageSize);

  const featuredHtml = !state.query
    ? `
      <section class="featured-wrapper">
        <div class="featured-grid">
          ${FEATURED_SCENARIOS.map(
            (sc) => `
              <div class="scenario-card">
                <div class="scenario-banner ${sc.themeClass}">
                  <h3>${escapeHtml(sc.title)}</h3>
                  ${sc.artSvg}
                </div>
                <div class="scenario-links">
                  ${sc.items
                    .map((item) => {
                      const matched = findScenarioExpert(item.keywords);
                      const id = matched ? matched.id : '';
                      return `<button class="scenario-link" data-open-expert="${escapeHtml(id)}"><span>${escapeHtml(item.label)}</span><span class="chev">›</span></button>`;
                    })
                    .join('')}
                </div>
              </div>
            `,
          ).join('')}
        </div>
      </section>
    `
    : '';

  const categoryPills = [
    { id: 'all', name: '全部' },
    { id: 'opc', name: 'OPC·一人公司' },
    ...state.categories,
  ];

  viewContainer.innerHTML = `
    ${featuredHtml}
    <div class="section-toolbar">
      <div class="sub-tabs">
        <button class="sub-tab ${state.expertType === 'agent' ? 'active' : ''}" data-expert-type="agent">
          专家<span class="count-badge">${agentCount}</span>
        </button>
        <button class="sub-tab ${state.expertType === 'team' ? 'active' : ''}" data-expert-type="team">
          专家团<span class="count-badge">${teamCount}</span>
        </button>
      </div>
      <div class="sort-group">
        <button class="sort-btn ${state.sortBy === 'default' ? 'active' : ''}" data-sort="default">综合</button>
        <button class="sort-btn ${state.sortBy === 'hot' ? 'active' : ''}" data-sort="hot">最热</button>
        <button class="sort-btn ${state.sortBy === 'latest' ? 'active' : ''}" data-sort="latest">最新</button>
      </div>
    </div>

    <div class="category-bar-wrap">
      <div class="category-bar" id="categoryBar">
        ${categoryPills
          .map(
            (c) => `
              <button class="cat-pill ${state.category === c.id ? 'active' : ''}" data-cat="${escapeHtml(c.id)}">
                ${escapeHtml(c.name)}
              </button>
            `,
          )
          .join('')}
      </div>
      <button class="scroll-right-btn" id="catScrollRight" title="向右滚动">›</button>
    </div>

    ${
      visible.length
        ? `<section class="cards-grid">${visible.map(renderExpertCard).join('')}</section>`
        : `<div class="empty-state">没有找到匹配的专家，试试更换关键词或切换分类。</div>`
    }

    ${
      filtered.length > visible.length
        ? `<div class="load-more-wrap"><button id="loadMoreBtn" class="btn btn-secondary">加载更多专家（剩余 ${filtered.length - visible.length} 位）</button></div>`
        : ''
    }
  `;

  // Bind category horizontal scroll
  const catBar = document.getElementById('categoryBar');
  const scrollBtn = document.getElementById('catScrollRight');
  if (catBar && scrollBtn) {
    scrollBtn.onclick = () => catBar.scrollBy({ left: 260, behavior: 'smooth' });
  }
}

function renderSkillsView() {
  const q = state.query.trim().toLowerCase();
  const filters = [
    { id: 'all', label: '全部技能' },
    { id: 'workbuddy-local', label: 'WorkBuddy 本地技能' },
    { id: 'antigravity-user', label: '反重力全局技能' },
    { id: 'workbuddy-connector', label: '连接器技能' },
    { id: 'antigravity-builtin', label: '反重力内置技能' },
    { id: 'workbuddy-builtin', label: 'WorkBuddy 内置' },
  ];

  const list = state.skills.filter((s) => {
    if (state.skillFilter !== 'all' && s.source !== state.skillFilter) return false;
    if (q) {
      const hay = `${s.name} ${s.slug} ${s.description}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const sourceLabel = (src) => {
    const map = {
      'workbuddy-local': 'WorkBuddy 本地',
      'antigravity-user': '反重力用户',
      'antigravity-builtin': '反重力内置',
      'workbuddy-connector': '连接器技能',
      'workbuddy-builtin': 'WorkBuddy 内置',
    };
    return map[src] || src;
  };

  viewContainer.innerHTML = `
    <div class="section-toolbar">
      <div class="sub-tabs">
        <span class="sub-tab active">技能市场 <span class="count-badge">${list.length}</span></span>
      </div>
    </div>
    <div class="category-bar-wrap">
      <div class="category-bar">
        ${filters
          .map(
            (f) => `<button class="cat-pill ${state.skillFilter === f.id ? 'active' : ''}" data-skill-filter="${f.id}">${f.label}</button>`,
          )
          .join('')}
      </div>
    </div>
    ${
      list.length
        ? `<section class="cards-grid">
            ${list
              .map(
                (s) => `
                <article class="expert-card" data-skill-id="${escapeHtml(s.id)}">
                  <div class="card-head">
                    <div class="avatar-wrap" style="width:44px;height:44px;background:${gradientFor(s.name)};font-size:16px;">⚡</div>
                    <div class="card-meta">
                      <div class="card-title-row">
                        <h4 class="card-title" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</h4>
                        ${s.syncedToAntigravity || s.source.startsWith('antigravity') ? '<span class="badge-mini badge-local">反重力可用</span>' : ''}
                      </div>
                      <p class="card-desc" title="${escapeHtml(s.description)}">${escapeHtml(s.description || 'Markdown 自动化工作流技能')}</p>
                    </div>
                  </div>
                  <div class="card-tags">
                    <span class="tag-pill">${escapeHtml(sourceLabel(s.source))}</span>
                    ${s.hasScripts ? '<span class="tag-pill">含脚本</span>' : ''}
                    ${s.hasReferences ? '<span class="tag-pill">含参考库</span>' : ''}
                  </div>
                </article>
              `,
              )
              .join('')}
          </section>`
        : `<div class="empty-state">没有找到匹配的技能。</div>`
    }
  `;
}

function renderConnectorsView() {
  const q = state.query.trim().toLowerCase();
  const list = state.connectors.filter((c) => {
    if (!q) return true;
    return `${c.name} ${c.source} ${c.endpoint}`.toLowerCase().includes(q);
  });

  viewContainer.innerHTML = `
    <div class="section-toolbar">
      <div class="sub-tabs">
        <span class="sub-tab active">连接器与 MCP 服务 <span class="count-badge">${list.length}</span></span>
      </div>
    </div>
    ${
      list.length
        ? `<section class="cards-grid">
            ${list
              .map(
                (c) => `
                <article class="expert-card">
                  <div class="card-head">
                    <div class="avatar-wrap" style="width:44px;height:44px;background:${gradientFor(c.name)};font-size:16px;">🔗</div>
                    <div class="card-meta">
                      <div class="card-title-row">
                        <h4 class="card-title">${escapeHtml(c.name)}</h4>
                        <span class="badge-mini badge-team">${escapeHtml(c.transport)}</span>
                      </div>
                      <p class="card-desc" title="${escapeHtml(c.endpoint)}">${escapeHtml(c.endpoint || c.source)}</p>
                    </div>
                  </div>
                  <div class="card-tags">
                    <span class="tag-pill">${escapeHtml(c.source)}</span>
                    ${c.skillCount ? `<span class="tag-pill">${c.skillCount} 个配套技能</span>` : ''}
                    ${c.preAuth ? `<span class="tag-pill">需鉴权</span>` : ''}
                  </div>
                </article>
              `,
              )
              .join('')}
          </section>`
        : `<div class="empty-state">本地暂未发现连接器配置。</div>`
    }
  `;
}

function renderMineView() {
  const q = state.query.trim().toLowerCase();
  const match = (e) => !q || `${e.name} ${e.description} ${(e.tags || []).join(' ')}`.toLowerCase().includes(q);

  const customList = state.experts.filter((e) => e.isCustom && match(e));
  const favList = state.experts.filter((e) => state.favorites.has(e.id) && match(e));
  const recentList = state.recents
    .map((id) => state.experts.find((e) => e.id === id))
    .filter((e) => e && match(e));

  viewContainer.innerHTML = `
    <div class="section-toolbar">
      <div class="sub-tabs">
        <span class="sub-tab active">我的专家工作台</span>
      </div>
      <button id="openCreateModalBtn" class="btn btn-primary">+ 新建自定义专家</button>
    </div>

    <div class="section-heading"><h3>我创建的自定义专家 (${customList.length})</h3></div>
    ${
      customList.length
        ? `<section class="cards-grid">${customList.map(renderExpertCard).join('')}</section>`
        : `<div class="empty-state" style="padding:20px;">还没有自定义专家，点击右上角「+ 新建自定义专家」创建你的专属 Markdown 角色。</div>`
    }

    <div class="section-heading"><h3>收藏的专家 (${favList.length})</h3></div>
    ${
      favList.length
        ? `<section class="cards-grid">${favList.map(renderExpertCard).join('')}</section>`
        : `<div class="empty-state" style="padding:20px;">点击任意专家卡片右下角的星标即可收藏到这里。</div>`
    }

    <div class="section-heading"><h3>最近使用 (${recentList.length})</h3></div>
    ${
      recentList.length
        ? `<section class="cards-grid">${recentList.map(renderExpertCard).join('')}</section>`
        : `<div class="empty-state" style="padding:20px;">暂无最近使用记录。</div>`
    }
  `;
}

// ==================== Detail Drawers ====================
function closeDrawer() {
  drawerBackdrop.classList.add('hidden');
  detailDrawer.classList.add('hidden');
  detailDrawer.setAttribute('aria-hidden', 'true');
}

async function openExpertDrawer(expertId) {
  if (!expertId) return;
  drawerBackdrop.classList.remove('hidden');
  detailDrawer.classList.remove('hidden');
  detailDrawer.setAttribute('aria-hidden', 'false');
  drawerBody.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>正在加载专家 Markdown 人设...</p></div>`;

  try {
    const res = await app.callServerTool({
      name: 'app_get_expert_detail',
      arguments: { expertId },
    });
    const detail = res.structuredContent;
    if (!detail || detail.error) {
      drawerBody.innerHTML = `<div class="empty-state">${escapeHtml(detail?.error || '加载失败')}</div>`;
      return;
    }

    const canMessage = Boolean(state.capabilities?.message);
    const canContext = Boolean(state.capabilities?.updateModelContext);
    const isFav = state.favorites.has(detail.id);
    const sourceBadge =
      detail.promptSource === 'local'
        ? '本地 WorkBuddy MD'
        : detail.promptSource === 'cdn' || detail.promptSource === 'cached'
          ? '官方完整 MD（已缓存）'
          : '结构化专家模板';

    const defaultTask = detail.defaultInitPrompt || `请以「${detail.name}」的身份协助我完成以下任务：`;

    drawerBody.innerHTML = `
      <div class="drawer-header">
        <div class="card-head" style="flex:1;min-width:0;">
          ${renderAvatar(detail, 54)}
          <div class="card-meta">
            <div class="card-title-row">
              <h3 class="card-title" style="font-size:17px;">${escapeHtml(detail.name)}</h3>
              ${detail.expertType === 'team' ? '<span class="badge-mini badge-team">专家团</span>' : ''}
            </div>
            <p class="card-desc" style="white-space:normal;">${escapeHtml(detail.description || '')}</p>
            <div class="card-tags" style="margin-top:8px;">
              <span class="badge-mini badge-local">${sourceBadge}</span>
              ${(detail.tags || []).map((t) => `<span class="tag-pill">${escapeHtml(t)}</span>`).join('')}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:6px;">
          <button id="drawerFavBtn" class="icon-btn" title="${isFav ? '取消收藏' : '收藏'}">${isFav ? '★' : '☆'}</button>
          <button id="drawerCloseBtn" class="icon-btn" title="关闭">×</button>
        </div>
      </div>

      <div class="drawer-body-scroll">
        ${
          detail.members?.length
            ? `<div>
                <div class="drawer-section-title">专家团成员 (${detail.members.length})</div>
                <div class="card-tags">
                  ${detail.members.map((m) => `<span class="tag-pill">${escapeHtml(m.name)}</span>`).join('')}
                </div>
              </div>`
            : ''
        }

        ${
          detail.quickPrompts?.length
            ? `<div>
                <div class="drawer-section-title">快捷任务模板（点击填入下方）</div>
                <div class="quick-prompts">
                  ${detail.quickPrompts
                    .map((qp) => `<button class="quick-prompt-btn" data-qp="${escapeHtml(qp)}">${escapeHtml(qp)}</button>`)
                    .join('')}
                </div>
              </div>`
            : ''
        }

        <div>
          <div class="drawer-section-title" style="display:flex;justify-content:space-between;align-items:center;">
            <span>专家人设提示词 (Markdown)</span>
            <button id="copyPromptBtn" class="btn btn-ghost" style="padding:2px 8px;font-size:12px;">复制完整 MD</button>
          </div>
          <pre class="prompt-preview">${escapeHtml(detail.promptContent || '')}</pre>
        </div>
      </div>

      <div class="drawer-footer">
        <textarea id="expertTaskInput" class="task-input" placeholder="输入你想交给这位专家的具体任务...">${escapeHtml(defaultTask)}</textarea>
        <div class="action-row">
          ${
            canMessage
              ? `<button id="invokeCurrentBtn" class="btn btn-primary" style="flex:1;">在当前对话唤醒专家</button>
                 <button id="invokeNewBtn" class="btn btn-secondary">新对话开启</button>`
              : `<button id="copyAllActionBtn" class="btn btn-primary" style="flex:1;">复制专家指令（去对话粘贴）</button>`
          }
          ${canContext ? `<button id="attachContextBtn" class="btn btn-secondary">附加到下条消息</button>` : ''}
        </div>
        ${!canMessage ? `<p style="font-size:11.5px;color:var(--text-tertiary);">提示：全屏视图无当前会话，从右侧边栏「+」打开「专家市场」可直接一键唤醒到对话。</p>` : ''}
      </div>
    `;

    document.getElementById('drawerCloseBtn').onclick = closeDrawer;
    document.getElementById('drawerFavBtn').onclick = async () => {
      await toggleFavorite(detail.id, 'expert');
      document.getElementById('drawerFavBtn').textContent = state.favorites.has(detail.id) ? '★' : '☆';
    };

    const taskInput = document.getElementById('expertTaskInput');
    drawerBody.querySelectorAll('.quick-prompt-btn').forEach((btn) => {
      btn.onclick = () => {
        taskInput.value = btn.dataset.qp;
        taskInput.focus();
      };
    });

    const buildFullPrompt = () => {
      const userTask = taskInput.value.trim() || defaultTask;
      return `请立即进入「${detail.name}」专家模式，严格遵循以下专家人设规范并直接帮我完成任务。\n\n<EXPERT_PERSONA name="${detail.name}">\n${detail.promptContent}\n</EXPERT_PERSONA>\n\n我的任务需求：\n${userTask}`;
    };

    const copyText = async (txt, msg) => {
      try {
        await navigator.clipboard.writeText(txt);
        showToast(msg);
      } catch {
        showToast('复制失败，请手动选中复制');
      }
    };

    document.getElementById('copyPromptBtn').onclick = () => copyText(detail.promptContent, '已复制专家 Markdown 提示词');

    const copyAllBtn = document.getElementById('copyAllActionBtn');
    if (copyAllBtn) {
      copyAllBtn.onclick = () => copyText(buildFullPrompt(), '已复制完整唤醒指令，可直接粘贴到对话！');
    }

    const invokeCurrentBtn = document.getElementById('invokeCurrentBtn');
    if (invokeCurrentBtn) {
      invokeCurrentBtn.onclick = async () => {
        try {
          await app.sendMessage({ role: 'user', content: [{ type: 'text', text: buildFullPrompt() }] });
          await recordUsage(detail.id);
          showToast(`已唤醒「${detail.name}」到当前对话！`);
          closeDrawer();
        } catch (err) {
          showToast(`唤醒失败：${err?.message || '请重试'}`);
        }
      };
    }

    const invokeNewBtn = document.getElementById('invokeNewBtn');
    if (invokeNewBtn) {
      invokeNewBtn.onclick = async () => {
        try {
          await app.sendMessage({
            role: 'user',
            content: [{ type: 'text', text: buildFullPrompt() }],
            _meta: { 'com.google.antigravity/message': { target: 'new' } },
          });
          await recordUsage(detail.id);
          showToast(`已在新对话中开启「${detail.name}」！`);
          closeDrawer();
        } catch (err) {
          showToast(`创建新对话失败：${err?.message || '请重试'}`);
        }
      };
    }

    const attachBtn = document.getElementById('attachContextBtn');
    if (attachBtn) {
      attachBtn.onclick = async () => {
        try {
          await app.updateModelContext({
            content: [
              {
                type: 'text',
                text: `已附加专家角色「${detail.name}」的人设规范：\n\n${detail.promptContent}`,
              },
            ],
          });
          await recordUsage(detail.id);
          showToast(`已将「${detail.name}」附加为下条消息上下文！`);
          closeDrawer();
        } catch (err) {
          showToast(`附加失败：${err?.message || '请重试'}`);
        }
      };
    }
  } catch (err) {
    drawerBody.innerHTML = `<div class="empty-state">加载详情出错：${escapeHtml(err?.message || String(err))}</div>`;
  }
}

async function openSkillDrawer(skillId) {
  drawerBackdrop.classList.remove('hidden');
  detailDrawer.classList.remove('hidden');
  detailDrawer.setAttribute('aria-hidden', 'false');
  drawerBody.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>正在读取 SKILL.md...</p></div>`;

  try {
    const res = await app.callServerTool({
      name: 'app_get_skill_detail',
      arguments: { skillId },
    });
    const detail = res.structuredContent;
    if (!detail || detail.error) {
      drawerBody.innerHTML = `<div class="empty-state">${escapeHtml(detail?.error || '读取失败')}</div>`;
      return;
    }

    const canMessage = Boolean(state.capabilities?.message);
    const canSync = detail.source.startsWith('workbuddy') && !detail.syncedToAntigravity && detail.dirPath;

    drawerBody.innerHTML = `
      <div class="drawer-header">
        <div class="card-meta">
          <h3 class="card-title" style="font-size:17px;">⚡ ${escapeHtml(detail.name)}</h3>
          <p class="card-desc" style="white-space:normal;margin-top:4px;">${escapeHtml(detail.description || '')}</p>
        </div>
        <button id="drawerCloseBtn" class="icon-btn" title="关闭">×</button>
      </div>
      <div class="drawer-body-scroll">
        <div>
          <div class="drawer-section-title" style="display:flex;justify-content:space-between;align-items:center;">
            <span>SKILL.md 内容</span>
            <button id="copySkillBtn" class="btn btn-ghost" style="padding:2px 8px;font-size:12px;">复制</button>
          </div>
          <pre class="prompt-preview" style="max-height:420px;">${escapeHtml(detail.content || '')}</pre>
        </div>
      </div>
      <div class="drawer-footer">
        <div class="action-row">
          ${canMessage ? `<button id="runSkillBtn" class="btn btn-primary" style="flex:1;">在当前对话使用此技能</button>` : ''}
          ${canSync ? `<button id="syncSkillBtn" class="btn btn-secondary">同步到反重力全局技能</button>` : ''}
          ${!canMessage ? `<button id="copySkillMainBtn" class="btn btn-primary" style="flex:1;">复制技能指令</button>` : ''}
        </div>
      </div>
    `;

    document.getElementById('drawerCloseBtn').onclick = closeDrawer;
    const copyFn = async () => {
      await navigator.clipboard.writeText(detail.content || '');
      showToast('已复制 SKILL.md 内容');
    };
    document.getElementById('copySkillBtn').onclick = copyFn;
    const copyMain = document.getElementById('copySkillMainBtn');
    if (copyMain) copyMain.onclick = copyFn;

    const runBtn = document.getElementById('runSkillBtn');
    if (runBtn) {
      runBtn.onclick = async () => {
        await app.sendMessage({
          role: 'user',
          content: [{ type: 'text', text: `请使用技能「${detail.name}」来协助我完成接下来的任务。以下是该技能的说明文档：\n\n${detail.content}` }],
        });
        showToast(`已在对话中激活技能「${detail.name}」！`);
        closeDrawer();
      };
    }

    const syncBtn = document.getElementById('syncSkillBtn');
    if (syncBtn) {
      syncBtn.onclick = async () => {
        syncBtn.disabled = true;
        syncBtn.textContent = '同步中...';
        const syncRes = await app.callServerTool({
          name: 'app_sync_skill_to_antigravity',
          arguments: { skillId: detail.id },
        });
        if (syncRes.structuredContent?.ok) {
          showToast(syncRes.structuredContent.message || '同步成功！');
          await loadBootstrap();
          closeDrawer();
        } else {
          showToast(syncRes.structuredContent?.error || '同步失败');
          syncBtn.disabled = false;
          syncBtn.textContent = '同步到反重力全局技能';
        }
      };
    }
  } catch (err) {
    drawerBody.innerHTML = `<div class="empty-state">加载技能出错：${escapeHtml(err?.message || String(err))}</div>`;
  }
}

// ==================== Actions & Persistence ====================
async function toggleFavorite(id, kind = 'expert') {
  const res = await app.callServerTool({
    name: 'app_toggle_favorite',
    arguments: { id, kind },
  });
  if (res.structuredContent?.list) {
    if (kind === 'expert') {
      state.favorites = new Set(res.structuredContent.list);
    } else {
      state.favoriteSkills = new Set(res.structuredContent.list);
    }
    showToast(res.structuredContent.favorited ? '已收藏到「我的专家」' : '已取消收藏');
    render();
  }
}

async function recordUsage(expertId) {
  try {
    const res = await app.callServerTool({
      name: 'app_record_usage',
      arguments: { expertId },
    });
    if (res.structuredContent?.recents) {
      state.recents = res.structuredContent.recents;
    }
  } catch {
    // non-blocking
  }
}

function openCreateModal() {
  modalCategorySelect.innerHTML = state.categories
    .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`)
    .join('');
  modalBackdrop.classList.remove('hidden');
}

function closeCreateModal() {
  modalBackdrop.classList.add('hidden');
  createExpertForm.reset();
}

// ==================== Global Event Delegation ====================
document.querySelectorAll('.nav-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.tab = btn.dataset.tab;
    state.pageSize = 36;
    render();
  });
});

myExpertsBtn.addEventListener('click', () => {
  state.tab = 'mine';
  render();
});

searchInput.addEventListener('input', (e) => {
  state.query = e.target.value;
  state.pageSize = 36;
  render();
});

clearSearchBtn.addEventListener('click', () => {
  state.query = '';
  searchInput.value = '';
  render();
});

drawerBackdrop.addEventListener('click', closeDrawer);
document.getElementById('closeModalBtn').addEventListener('click', closeCreateModal);
document.getElementById('cancelModalBtn').addEventListener('click', closeCreateModal);

createExpertForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(createExpertForm);
  const payload = {
    name: fd.get('name'),
    categoryId: fd.get('categoryId'),
    description: fd.get('description'),
    defaultInitPrompt: fd.get('defaultInitPrompt'),
    promptContent: fd.get('promptContent'),
    tags: String(fd.get('tags') || '')
      .split(/[,，、]/)
      .map((s) => s.trim())
      .filter(Boolean),
  };
  try {
    await app.callServerTool({ name: 'app_create_expert', arguments: payload });
    showToast(`已创建自定义专家「${payload.name}」`);
    closeCreateModal();
    await loadBootstrap();
  } catch (err) {
    showToast(`创建失败：${err?.message || '请重试'}`);
  }
});

viewContainer.addEventListener('click', (e) => {
  const favBtn = e.target.closest('[data-fav-expert]');
  if (favBtn) {
    e.stopPropagation();
    toggleFavorite(favBtn.dataset.favExpert, 'expert');
    return;
  }

  const subTab = e.target.closest('[data-expert-type]');
  if (subTab) {
    state.expertType = subTab.dataset.expertType;
    state.pageSize = 36;
    render();
    return;
  }

  const sortBtn = e.target.closest('[data-sort]');
  if (sortBtn) {
    state.sortBy = sortBtn.dataset.sort;
    render();
    return;
  }

  const catBtn = e.target.closest('[data-cat]');
  if (catBtn) {
    state.category = catBtn.dataset.cat;
    state.pageSize = 36;
    render();
    return;
  }

  const skillFilterBtn = e.target.closest('[data-skill-filter]');
  if (skillFilterBtn) {
    state.skillFilter = skillFilterBtn.dataset.skillFilter;
    render();
    return;
  }

  if (e.target.id === 'loadMoreBtn') {
    state.pageSize += 48;
    render();
    return;
  }

  if (e.target.id === 'openCreateModalBtn') {
    openCreateModal();
    return;
  }

  const scenarioBtn = e.target.closest('[data-open-expert]');
  if (scenarioBtn && scenarioBtn.dataset.openExpert) {
    openExpertDrawer(scenarioBtn.dataset.openExpert);
    return;
  }

  const expertCard = e.target.closest('[data-expert-id]');
  if (expertCard) {
    openExpertDrawer(expertCard.dataset.expertId);
    return;
  }

  const skillCard = e.target.closest('[data-skill-id]');
  if (skillCard) {
    openSkillDrawer(skillCard.dataset.skillId);
  }
});

// ==================== MCP App Handshake ====================
async function loadBootstrap() {
  try {
    const res = await app.callServerTool({ name: 'app_bootstrap', arguments: {} });
    const data = res.structuredContent || {};
    state.categories = data.categories || [];
    state.experts = data.experts || [];
    state.skills = data.skills || [];
    state.connectors = data.connectors || [];
    state.favorites = new Set(data.favorites || []);
    state.favoriteSkills = new Set(data.favoriteSkills || []);
    state.recents = data.recents || [];
    state.bootstrapped = true;

    loadingState.classList.add('hidden');
    viewContainer.classList.remove('hidden');
    render();
  } catch (err) {
    loadingState.innerHTML = `<p style="color:#ef4444;">加载数据失败：${escapeHtml(err?.message || String(err))}</p>`;
  }
}

function applyThemeContext(ctx) {
  if (!ctx) return;
  if (ctx.theme) {
    applyDocumentTheme(ctx.theme);
    document.documentElement.setAttribute('data-theme', ctx.theme);
  }
  if (ctx.styles?.variables) {
    applyHostStyleVariables(ctx.styles.variables);
  }
}

app.ontoolinput = ({ arguments: args }) => {
  if (args?.tab) state.tab = args.tab;
  if (args?.query) {
    state.query = args.query;
    searchInput.value = args.query;
  }
  if (args?.category) state.category = args.category;
};

app.ontoolresult = (result) => {
  const sc = result?.structuredContent;
  if (sc?.initialTab) state.tab = sc.initialTab;
  if (typeof sc?.initialQuery === 'string') {
    state.query = sc.initialQuery;
    searchInput.value = sc.initialQuery;
  }
  if (sc?.initialCategory) state.category = sc.initialCategory;
  if (state.bootstrapped) render();
};

app.onhostcontextchanged = (ctx) => applyThemeContext(ctx);

(async function init() {
  try {
    await app.connect();
    state.capabilities = app.getHostCapabilities() || {};
    applyThemeContext(app.getHostContext());
    await loadBootstrap();
  } catch (err) {
    loadingState.innerHTML = `<p style="color:#ef4444;">初始化失败：${escapeHtml(err?.message || String(err))}</p>`;
  }
})();
