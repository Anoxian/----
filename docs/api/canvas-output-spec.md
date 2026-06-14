# Canvas Output Specification

This document defines the text block formats that the AI must use when generating content for the canvas.

## Layout Order

Canvas nodes should be placed from left to right:

1. User input / uploaded files
2. User persona
3. Recommended jobs
4. Specific job detail when the user asks about one role
5. JD request / JD received
6. JD match score and analysis
7. Resume optimization suggestions
8. Optimized resume version after user confirms and provides missing details
9. Later optimized resume versions

Each node must have one responsibility only.

## Block: User Persona

```markdown
# 用户画像 v{version}

## 基础信息
- 求职阶段：
- 目标行业：
- 目标岗位：
- 地点偏好：
- 语言：中文 / 英文 / 中英双语

## 背景摘要
- 教育背景：
- 项目/实习/工作经历：
- 核心技能：
- 领域经验：

## 求职优势
1.
2.
3.

## 可能短板
1.
2.
3.

## 待补充信息
- 
```

## Block: Recommended Jobs

The first recommendation output must include at least five role directions.

```markdown
# 推荐岗位 v{version}

## 推荐结论
基于当前简历/画像，优先推荐以下岗位方向。若用户上传 JD，后续匹配会以用户提供的 JD 为准。

## 岗位方向 1：{role}
- 推荐理由：
- 与用户背景的匹配点：
- 需要补强的能力：
- 简历强调方向：

## 岗位方向 2：{role}
- 推荐理由：
- 与用户背景的匹配点：
- 需要补强的能力：
- 简历强调方向：

## 岗位方向 3：{role}
- 推荐理由：
- 与用户背景的匹配点：
- 需要补强的能力：
- 简历强调方向：

## 岗位方向 4：{role}
- 推荐理由：
- 与用户背景的匹配点：
- 需要补强的能力：
- 简历强调方向：

## 岗位方向 5：{role}
- 推荐理由：
- 与用户背景的匹配点：
- 需要补强的能力：
- 简历强调方向：

## 下一步
请上传你最感兴趣岗位的 JD 截图，我会继续生成 JD 匹配评分、差距分析和简历优化版本。
```

## Block: Specific Job Detail

Use this block when the user asks about one specific recommended role or job direction. The node title should be `{specific role name}介绍V{version}`.

```markdown
# {specific role name}介绍V{version}

## 一句话理解

## 日常工作
- 

## 核心能力
- 

## 和用户当前背景的连接点
- 

## 入门准备
1.
2.
3.

## 作品集 / 简历证明
- 

## 继续追问方向
- 
```

## Block: JD Match Score And Analysis

```markdown
# JD 匹配评分与分析 v{version}

## 岗位信息
- 岗位名称：
- 公司：
- 语言：
- JD 来源：

## 总体评分
- 匹配分：{score}/100
- 建议：强烈投递 / 值得投递 / 谨慎投递 / 暂不建议
- 置信度：高 / 中 / 低

## 必备要求匹配
- 已满足：
- 部分满足：
- 未满足：

## 加分项匹配
- 已满足：
- 可补强：

## 关键词覆盖
- 已覆盖关键词：
- 缺失关键词：
- 建议自然加入的位置：

## 优势
1.
2.
3.

## 差距与风险
1.
2.
3.

## 投递策略
- 简历主线：
- 需要强调的经历：
- 面试前需要准备的问题：
```

## Block: Resume Optimization Suggestions

```markdown
# 简历优化建议 v{version}

## 优化目标
- 目标岗位：
- 优化方向：

## 摘要区优化
- 当前问题：
- 建议写法方向：
- 需要加入的关键词：

## 技能区优化
- 建议前置技能：
- 建议补充技能：
- 建议弱化或删除内容：

## 经历区优化
### 经历 1：{experience}
- 当前问题：
- 建议突出：
- 建议改写：

### 经历 2：{experience}
- 当前问题：
- 建议突出：
- 建议改写：

## ATS 与可读性检查
- 关键词覆盖：
- 格式风险：
- 可读性风险：
```

## Block: Optimized Resume

The optimized resume must be complete plain text. It must not fabricate experience, titles, metrics, certifications, or skills.
Do not generate this block immediately after suggestions unless the user explicitly confirms they need an optimized resume and has provided enough missing details. If details are missing, ask focused questions in chat first.

```markdown
# 优化后的简历 v{version}

## 姓名与联系方式
{content}

## 求职目标 / Professional Summary
{content}

## 核心技能 / Skills
{content}

## 教育背景 / Education
{content}

## 实习 / 项目 / 工作经历
{content}

## 其他经历 / 证书 / 作品集
{content}

## 本版本说明
- 目标岗位：
- 相比上一版的主要变化：
- 仍需用户确认的信息：
```

## Block: Career Change Translation

Use this block only when the user is switching industries or roles.

```markdown
# 转行能力翻译 v{version}

## 当前背景
- 当前行业：
- 当前角色：

## 目标方向
- 目标行业：
- 目标岗位：

## 可迁移能力
1. {skill} -> 可迁移原因：
2. {skill} -> 可迁移原因：
3. {skill} -> 可迁移原因：

## 语言翻译
| 原经历语言 | 目标岗位语言 |
| --- | --- |
|  |  |

## 桥接建议
- 需要补充的项目/课程/证书：
- 简历中应如何解释转向：
```

## Markdown Export

Markdown export should preserve:

- Canvas block titles
- Block version labels
- Logical order from left to right
- Connections between blocks as short relationship notes
- All optimized resume versions
