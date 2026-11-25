---
name: expert-hub
description: 打开 WorkBuddy 风格的「专家与技能市场」面板，或检索并加载 400+ 本地行业专家 Markdown 人设与技能包。当用户想逛专家市场、挑选行业专家/专家团、使用 WorkBuddy 专家或技能时触发。
---

# 专家与技能市场 (Expert Hub)

当用户想要浏览、搜索或使用专业领域的专家角色和技能时，使用本插件提供的 `expert-hub` MCP 工具：

1. **打开可视化市场面板**：当用户说“打开专家市场”、“我想挑个专家”、“看看有哪些技能/连接器”时，直接调用 `open_expert_hub` 工具（可传 `tab`: `experts` | `skills` | `connectors` | `mine`，`query` 搜索词）。
2. **按需检索并扮演专家**：如果用户直接提出专业诉求（如“帮我找个电商运营专家”、“用微信小程序专家帮我写代码”），先调用 `search_experts` 找到最匹配的 `expertId`，再调用 `get_expert_prompt` 加载其完整 Markdown 人设并按该专家标准执行任务。
