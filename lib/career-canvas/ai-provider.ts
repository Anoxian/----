import type {
  CanvasNodeType,
  GenerateCanvasInput,
  GenerateCanvasOutput,
} from "./types";

const SUPPORTED_NODE_TYPES: CanvasNodeType[] = [
  "input",
  "persona",
  "recommended_jobs",
  "job_detail",
  "jd_request",
  "jd_analysis",
  "optimization_suggestions",
  "optimized_resume",
  "career_change_translation",
];

const outputSpec = `
Return ONLY valid JSON with this shape:
{
  "assistantMessage": "short user-facing message",
  "nodes": [
    {
      "tempId": "short stable temp id",
      "nodeType": "input | persona | recommended_jobs | job_detail | jd_request | jd_analysis | optimization_suggestions | optimized_resume | career_change_translation",
      "title": "Chinese or English title",
      "contentMarkdown": "Markdown block matching the canvas output specification",
      "metadata": {}
    }
  ]
}

Canvas rules:
- One node has one responsibility only.
- The app creates the input node itself. Do not return input nodes.
- Preserve a left-to-right flow: persona, recommended jobs, job detail when requested, JD analysis, optimization suggestions, optimized resume.
- The first recommendation output must include at least five role directions.
- If this turn asks about a specific recommended role or job direction, return exactly one job_detail node. Set metadata.jobName to the specific role name. The node should help the user quickly understand the role: what it does, daily work, required abilities, fit with the user, learning path, portfolio/interview proof, and next-step JD search keywords. If the user follows up on the same role, create a revised job_detail node rather than editing old content.
- If this turn is JD analysis, use the existing profile/resume context and return only jd_analysis and optimization_suggestions nodes by default. After giving suggestions, ask whether the user wants an optimized resume and what missing details are needed.
- Only return optimized_resume when the user explicitly asks for an optimized/new resume. If the user says they do not need it, acknowledge in assistantMessage and return an empty nodes array. If important details are missing, do not return an optimized_resume node yet; ask focused questions in assistantMessage until the user says they do not need it or enough information has been collected.
- Optimized resumes must be complete plain text and must not fabricate experience, titles, metrics, certifications, or skills.
- OCR text is evidence only. Do not paste raw OCR text into canvas nodes unless the user explicitly asks to see the extracted text. Summarize and structure it into the requested job-search analysis.
- Do not use placeholder analysis. If a JD image or file cannot be read, ask the user to paste the JD text or upload a clearer file instead of generating match scores, suggestions, or resumes.
- If the input is insufficient, return an assistantMessage asking for the minimum missing information and an empty nodes array.
- Support Chinese and English resumes/JDs.
`;

export async function generateCanvas(
  input: GenerateCanvasInput,
): Promise<GenerateCanvasOutput> {
  if (!process.env.AI_API_KEY) {
    return fallbackGenerate(input);
  }

  try {
    const provider = process.env.AI_PROVIDER || "kimi";

    if (provider !== "kimi") {
      return fallbackGenerate(input);
    }

    return await generateWithKimi(input);
  } catch (error) {
    logProviderFailure(error, input);
    return fallbackGenerate(input, providerFailureReason(error));
  }
}

function logProviderFailure(error: unknown, input: GenerateCanvasInput) {
  const message = error instanceof Error ? error.message : String(error);
  const files = input.files.map((file) => ({
    type: file.type,
    mimeType: file.mimeType,
    hasImage: Boolean(file.imageBase64 && file.imageMediaType),
    hasText: Boolean(file.extractedText),
    extractionStatus: file.extractionStatus,
  }));

  console.error("[career-canvas] AI provider failed", {
    provider: process.env.AI_PROVIDER || "kimi",
    model: process.env.AI_MODEL || "kimi-k2.6",
    intent: input.intent,
    message,
    files,
  });
}

async function generateWithKimi(
  input: GenerateCanvasInput,
): Promise<GenerateCanvasOutput> {
  const baseUrl = kimiOpenAiBaseUrl();
  const model = process.env.AI_MODEL || "kimi-k2.6";
  const timeoutMs = Number(process.env.APP_AI_TIMEOUT_MS || 120000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const recentMessages = input.messages
    .slice(-8)
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");
  const canvasContext = buildExistingCanvasContext(input);

  const fileContext = input.files
    .map(
      (file) => {
        const status = file.extractionStatus || "unsupported";
        const body = file.extractedText
          ? `\nExtracted text:\n${file.extractedText}`
          : file.extractionError
            ? `\nExtraction note: ${file.extractionError}`
            : "";

        return [
          `- ${file.type} file ${file.id}`,
          `filename=${file.originalFilename || "unknown"}`,
          `mime=${file.mimeType}`,
          `extractionStatus=${status}`,
          `signedUrl=${file.signedUrl || "unavailable"}`,
          body,
        ].join("\n");
      },
    )
    .join("\n\n");

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    signal: controller.signal,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.AI_API_KEY!}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 6000,
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You are an offer-oriented AI job-search matching agent for students.",
            "Use only the user's provided resume, JD, files, and conversation context.",
            "Ask for missing information instead of inventing facts.",
            outputSpec,
          ].join("\n\n"),
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                `Intent: ${input.intent}`,
                `Workspace ID: ${input.workspaceId}`,
                `Current prompt:\n${input.prompt || "(empty)"}`,
                `Uploaded files:\n${fileContext || "(none)"}`,
                `Existing canvas context:\n${canvasContext || "(none)"}`,
                `Recent conversation:\n${recentMessages || "(none)"}`,
                "If Intent is job_detail, create exactly one job_detail node and no JD/resume nodes.",
                "If this turn includes JD screenshots, use the OCR text above to identify role title, responsibilities, requirements, preferred qualifications, keywords, and screening signals.",
                "Do not create a canvas node that simply repeats OCR output. The canvas should contain structured conclusions, analysis, suggestions, or resume text.",
                "If OCR produced meaningful JD text, create JD analysis nodes with a confidence note. Only say the JD is unreadable when no role-related text is present in the extracted text.",
                "If resume optimization suggestions have been provided and the user has not explicitly asked for a full optimized resume, ask whether they want one and list missing details instead of creating an optimized_resume node.",
                "If the user says they do not need an optimized resume, return no nodes and keep the conversation ready for future JD/job questions.",
                "Create canvas nodes now if there is enough information.",
              ].join("\n\n"),
            },
          ],
        },
      ],
    }),
  });

  clearTimeout(timeout);

  if (!response.ok) {
    throw new Error(`AI provider failed with ${response.status}`);
  }

  const data = await response.json();
  const text = extractProviderText(data);
  const parsed = parseJsonOutput(text);

  return validateOutput(parsed);
}

function kimiOpenAiBaseUrl() {
  const configured = process.env.AI_BASE_URL || "https://api.moonshot.cn/v1";
  const normalized = configured.replace(/\/$/, "");

  if (normalized.endsWith("/anthropic")) {
    return normalized.replace(/\/anthropic$/, "/v1");
  }

  if (normalized.endsWith("/v1")) {
    return normalized;
  }

  return `${normalized}/v1`;
}

function extractProviderText(data: unknown) {
  if (
    data &&
    typeof data === "object" &&
    "choices" in data &&
    Array.isArray(data.choices)
  ) {
    return data.choices
      .map((choice) => {
        if (!choice || typeof choice !== "object" || !("message" in choice)) {
          return "";
        }

        const message = choice.message as Record<string, unknown>;
        return typeof message.content === "string" ? message.content : "";
      })
      .join("\n");
  }

  if (
    data &&
    typeof data === "object" &&
    "content" in data &&
    Array.isArray(data.content)
  ) {
    return data.content
      .map((item) =>
        item && typeof item === "object" && "text" in item
          ? String(item.text)
          : "",
      )
      .join("\n");
  }

  return JSON.stringify(data);
}

function parseJsonOutput(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1] || extractFirstJsonObject(trimmed) || trimmed;
  return JSON.parse(raw);
}

function extractFirstJsonObject(text: string) {
  const start = text.indexOf("{");

  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth += 1;
    }

    if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

function validateOutput(value: unknown): GenerateCanvasOutput {
  if (!value || typeof value !== "object") {
    throw new Error("Malformed AI output.");
  }

  const candidate = value as Partial<GenerateCanvasOutput>;
  const nodes = Array.isArray(candidate.nodes) ? candidate.nodes : [];

  return {
    assistantMessage:
      typeof candidate.assistantMessage === "string"
        ? candidate.assistantMessage
        : "我已完成本轮分析。",
    nodes: nodes
      .filter(
        (node) =>
          node &&
          SUPPORTED_NODE_TYPES.includes(node.nodeType) &&
          node.nodeType !== "input" &&
          typeof node.title === "string" &&
          typeof node.contentMarkdown === "string",
      )
      .map((node, index) => ({
        tempId: node.tempId || `node-${index}`,
        nodeType: node.nodeType,
        title: node.title,
        contentMarkdown: node.contentMarkdown,
        metadata: node.metadata || {},
      })),
  };
}

function fallbackGenerate(
  input: GenerateCanvasInput,
  providerFailure?: string,
): GenerateCanvasOutput {
  const trimmedPrompt = input.prompt.trim();
  const hasResume = input.files.some((file) => file.type === "resume");
  const extractedText = combinedExtractedText(input);
  const hasReadableJd = hasReadableJdContent(input);
  const hasVisualOnlyJd = input.files.some(
    (file) =>
      file.type === "jd" &&
      file.mimeType.startsWith("image/") &&
      !file.extractedText,
  );
  const hasJd =
    input.files.some((file) => file.type === "jd") ||
    /\bjd\b|岗位职责|任职要求|职位描述|招聘要求|job description|responsibilit|requirement/i.test(
      trimmedPrompt,
    );
  const asksJobDetail =
    input.intent === "job_detail" ||
    /介绍|具体|展开|讲讲|说说|是什么|做什么|工作内容|发展|前景|路径|门槛|薪资|日常|岗位方向|职业方向/i.test(
      trimmedPrompt,
    );

  if (!trimmedPrompt && input.files.length === 0) {
    return {
      assistantMessage:
        "你可以先上传简历截图，或者告诉我你的背景、目标行业、目标岗位、城市偏好和求职阶段。",
      nodes: [],
    };
  }

  if (asksJobDetail && !hasJd) {
    const jobName = inferJobNameFromPrompt(trimmedPrompt);

    return {
      assistantMessage: `我先为你生成「${jobName}」的岗位介绍。你可以继续追问职责、门槛、作品集、学习路径或面试准备，我会生成后续版本。`,
      nodes: [
        {
          tempId: "job-detail",
          nodeType: "job_detail",
          title: jobName,
          contentMarkdown: buildJobDetailMarkdown(jobName),
          metadata: { source: "fallback", jobName },
        },
      ],
    };
  }

  if (input.intent === "optimize_resume" || input.intent === "revise_resume") {
    if (/不需要|不用|不要|暂时不/i.test(trimmedPrompt)) {
      return {
        assistantMessage:
          "好的，我先不生成优化版简历。你后续如果想继续，可以直接说“需要生成优化简历”，我会再补齐缺失信息后生成。",
        nodes: [],
      };
    }

    if (hasEnoughResumeDraftContext(input)) {
      return {
        assistantMessage:
          "我会基于已确认信息生成优化后的简历版本；如果仍有细节不准，你可以继续补充并迭代下一版。",
        nodes: [
          {
            tempId: "optimized-resume",
            nodeType: "optimized_resume",
            title: "优化后的简历",
            contentMarkdown: buildOptimizedResumeMarkdown(),
            metadata: { source: "fallback" },
          },
        ],
      };
    }

    return {
      assistantMessage:
        "可以生成优化后的简历，但还缺几项关键信息：1. 目标岗位/JD 中你最想突出哪 2-3 个要求？2. 最相关的项目或实习有哪些真实成果数据？3. 技能熟练度、作品集链接、城市和投递版本语言是否确认？你补充后我再生成完整版本。",
      nodes: [],
    };
  }

  if (hasJd && hasVisualOnlyJd && providerFailure) {
    return {
      assistantMessage: `${providerFailure}。为了避免瞎编，我先只记录本轮上传；请重新发送一次，或粘贴 JD 文本/上传 MD 或 Word 文件后再分析。`,
      nodes: [],
    };
  }

  if (hasJd && !hasReadableJd && hasVisualOnlyJd) {
    return {
      assistantMessage:
        "这次 JD 截图没有被成功识别出可用文字。为了避免瞎编，我先只记录本轮上传；请粘贴 JD 文本，或重新上传更清晰的截图/MD/Word 文件后再分析。",
      nodes: [],
    };
  }

  if (hasJd) {
    return {
      assistantMessage:
        "我会基于已有用户画像和本轮 JD，生成 JD 匹配分析和简历优化建议。之后我会先问你是否需要完整优化版简历。",
      nodes: [
        {
          tempId: "jd-analysis",
          nodeType: "jd_analysis",
          title: "JD 匹配评分与分析",
          contentMarkdown: buildJdAnalysisMarkdown(trimmedPrompt, extractedText),
          metadata: { source: "fallback" },
        },
        {
          tempId: "optimization-suggestions",
          nodeType: "optimization_suggestions",
          title: "简历优化建议",
          contentMarkdown: buildSuggestionsMarkdown(),
          metadata: { source: "fallback" },
        },
      ],
    };
  }

  const nodes: GenerateCanvasOutput["nodes"] = [
    {
      tempId: "persona",
      nodeType: "persona",
      title: "用户画像",
      contentMarkdown: buildPersonaMarkdown(
        trimmedPrompt,
        hasResume,
        extractedText,
      ),
      metadata: { source: "fallback" },
    },
    {
      tempId: "recommended-jobs",
      nodeType: "recommended_jobs",
      title: "推荐岗位",
      contentMarkdown: buildRecommendedJobsMarkdown(hasJd),
      metadata: { source: "fallback" },
    },
  ];

  nodes.push({
    tempId: "jd-request",
    nodeType: "jd_request",
    title: "JD 补充引导",
    contentMarkdown:
      "# JD 补充引导 v1\n\n请上传你最感兴趣岗位的 JD 截图，或直接粘贴岗位职责和要求。我会继续生成匹配评分、差距分析、简历优化建议和完整优化版简历。\n",
    metadata: { source: "fallback" },
  });

  return {
    assistantMessage:
      "我已先生成用户画像和至少 5 个岗位方向；上传目标 JD 后可以继续做匹配评分和简历优化。",
    nodes,
  };
}

function providerFailureReason(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") {
    return "Kimi 语言模型接口本轮调用超时";
  }

  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("401")) {
    return "Kimi 接口鉴权失败";
  }

  if (message.includes("429")) {
    return "Kimi 接口当前限流";
  }

  if (/5\d\d/.test(message)) {
    return "Kimi 接口当前不可用";
  }

  if (/JSON|Malformed/i.test(message)) {
    return "Kimi 返回内容格式异常";
  }

  return "Kimi 语言模型接口本轮调用失败";
}

function buildExistingCanvasContext(input: GenerateCanvasInput) {
  const relevantTypes: CanvasNodeType[] = [
    "persona",
    "recommended_jobs",
    "job_detail",
    "jd_analysis",
    "optimization_suggestions",
    "optimized_resume",
  ];

  return relevantTypes
    .map((nodeType) => {
      const node = input.existingNodes
        .filter((candidate) => candidate.node_type === nodeType)
        .sort((a, b) => b.version - a.version || b.created_at.localeCompare(a.created_at))[0];

      if (!node) {
        return "";
      }

      return [
        `## Existing ${node.title}`,
        node.content_markdown.slice(0, 5000),
      ].join("\n");
    })
    .filter(Boolean)
    .join("\n\n---\n\n");
}

function inferJobNameFromPrompt(prompt: string) {
  const normalized = prompt
    .replace(/想了解|我想了解|帮我|请|一下|这个|那个|岗位|职位|方向|介绍|具体|展开|讲讲|说说|是什么|做什么/g, " ")
    .replace(/[，。！？,.!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || "具体岗位";
}

function hasEnoughResumeDraftContext(input: GenerateCanvasInput) {
  const text = [
    input.prompt,
    combinedExtractedText(input),
    input.existingNodes
      .filter((node) =>
        ["persona", "jd_analysis", "optimization_suggestions"].includes(
          node.node_type,
        ),
      )
      .map((node) => node.content_markdown)
      .join("\n"),
  ].join("\n");

  return (
    /姓名|电话|邮箱|教育|学校|实习|项目|经历|技能/.test(text) &&
    /jd|岗位|职责|要求|目标/.test(text.toLowerCase()) &&
    text.length > 1200
  );
}

function buildJobDetailMarkdown(jobName: string) {
  return [
    `# ${jobName}介绍V1`,
    "",
    "## 一句话理解",
    `${jobName}通常负责把业务目标、用户需求和团队资源转成可执行的方案，并推动结果落地。`,
    "",
    "## 日常工作",
    "- 梳理需求、竞品和用户反馈，判断优先级。",
    "- 和研发、设计、运营或业务团队沟通推进事项。",
    "- 写方案、做数据复盘、整理材料并推动迭代。",
    "",
    "## 核心能力",
    "- 结构化表达：能把复杂问题拆清楚。",
    "- 沟通推进：能让不同角色对齐目标。",
    "- 业务理解：能解释为什么做、做了有什么效果。",
    "- 证据意识：能用数据、案例或作品证明能力。",
    "",
    "## 和你当前背景的连接点",
    "- 可以优先把项目经历、运营经历、招聘/HR 相关经历转成岗位语言。",
    "- 如果你有 AI 工具使用、内容生产、用户研究或跨团队协作经历，可以作为切入点。",
    "",
    "## 入门准备",
    "1. 找 3-5 个真实 JD，提取高频关键词。",
    "2. 准备 1 个能展示分析和推进能力的作品或案例。",
    "3. 把简历里的经历改写成“场景 + 动作 + 结果”。",
    "",
    "## 继续追问方向",
    "- 这个岗位适不适合我？",
    "- 这个岗位需要什么作品集？",
    "- 这个岗位简历怎么写？",
    "- 这个岗位面试会问什么？",
  ].join("\n");
}

function combinedExtractedText(input: GenerateCanvasInput) {
  return input.files
    .map((file) => file.extractedText || "")
    .filter(Boolean)
    .join("\n\n---\n\n")
    .trim();
}

function hasReadableJdContent(input: GenerateCanvasInput) {
  const promptLooksLikeJd =
    /\bjd\b|岗位职责|任职要求|职位描述|job description|responsibilit|requirement/i.test(
      input.prompt,
    ) && input.prompt.trim().length > 80;

  return (
    promptLooksLikeJd ||
    input.files.some(
      (file) =>
        file.type === "jd" &&
        Boolean(file.extractedText && file.extractedText.trim().length > 40),
    )
  );
}

function buildPersonaMarkdown(
  prompt: string,
  hasResume: boolean,
  extractedText: string,
) {
  const excerpt = extractedText
    ? extractedText.slice(0, 1200)
    : "";

  return [
    "# 用户画像 v1",
    "",
    "## 基础信息",
    "- 求职阶段：待用户确认",
    "- 目标行业：从当前输入中提取，待补充",
    "- 目标岗位：从当前输入中提取，待补充",
    "- 地点偏好：待用户确认",
    "- 语言：中文 / 英文 / 中英双语",
    "",
    "## 背景摘要",
    `- 教育背景：${excerpt ? "已从上传文件中提取，需用户确认细节" : hasResume ? "已收到简历文件，但尚未提取到正文" : "待用户提供简历或文字背景"}`,
    `- 项目/实习/工作经历：${excerpt ? "已读取上传文件正文，可继续精细拆解" : "待从简历或用户补充中提取"}`,
    `- 核心技能：${excerpt ? "优先基于上传文件正文梳理" : "先围绕岗位目标、项目经验和可迁移能力梳理"}`,
    "- 领域经验：待确认",
    ...(excerpt
      ? [
          "",
          "## 已读取的文件摘录",
          excerpt,
        ]
      : []),
    "",
    "## 求职优势",
    "1. 已开始聚焦具体求职目标，适合做 JD 反向拆解。",
    "2. 可以通过画布保留每次分析和简历版本，方便对比迭代。",
    "3. 适合把项目、实习或课程经历转译成岗位筛选语言。",
    "",
    "## 可能短板",
    "1. 目标岗位、城市和投递阶段仍需更明确。",
    "2. 若只有截图，需要进一步确认关键信息是否识别准确。",
    "3. 缺少目标 JD 时，推荐只能停留在岗位方向层面。",
    "",
    "## 待补充信息",
    `- ${prompt ? "请确认以上画像是否符合你的真实情况。" : "请补充简历、目标岗位或求职偏好。"}`,
  ].join("\n");
}

function buildRecommendedJobsMarkdown(hasJd: boolean) {
  const jobs = [
    ["产品经理助理 / APM", "适合把用户研究、项目推进和跨团队沟通经历转成产品能力。"],
    ["数据分析实习 / 商业分析", "适合突出数据处理、业务理解和洞察表达。"],
    ["运营策略 / 用户运营", "适合强调增长、活动、用户分层和结果复盘。"],
    ["行业研究 / 咨询助理", "适合突出信息搜集、结构化分析和报告表达。"],
    ["AI 产品 / AI 应用运营", "适合将工具使用、内容生产和业务场景理解结合起来。"],
  ];

  return [
    "# 推荐岗位 v1",
    "",
    "## 推荐结论",
    hasJd
      ? "基于当前输入和 JD 信号，先给出可投递方向；后续匹配以用户提供的 JD 为准。"
      : "基于当前简历/画像，优先推荐以下岗位方向。若用户上传 JD，后续匹配会以用户提供的 JD 为准。",
    "",
    ...jobs.flatMap(([role, reason], index) => [
      `## 岗位方向 ${index + 1}：${role}`,
      `- 推荐理由：${reason}`,
      "- 与用户背景的匹配点：可围绕项目、实习、课程和作品集做证据化表达。",
      "- 需要补强的能力：补充岗位关键词、量化结果和工具链证明。",
      "- 简历强调方向：用 JD 语言改写经历标题、动作和结果。",
      "",
    ]),
    "## 下一步",
    "请上传你最感兴趣岗位的 JD 截图，我会继续生成 JD 匹配评分、差距分析和简历优化版本。",
  ].join("\n");
}

function buildJdAnalysisMarkdown(prompt: string, extractedText: string) {
  const jdExcerpt = extractedText.slice(0, 1600);

  return [
    "# JD 匹配评分与分析 v1",
    "",
    ...(jdExcerpt
      ? [
          "## 已读取的 JD 摘录",
          jdExcerpt,
          "",
        ]
      : []),
    "## 岗位信息",
    "- 岗位名称：基于 JD 原文提取，需用户确认",
    "- 公司：基于 JD 原文提取，需用户确认",
    "- 语言：中文 / 英文 / 中英双语",
    "- JD 来源：用户上传或输入",
    "",
    "## 总体评分",
    "- 匹配分：待结合 JD 原文和简历证据确认",
    "- 建议：需要用户确认 JD 关键要求后再定",
    "- 置信度：中",
    "",
    "## 必备要求匹配",
    "- 已满足：可从已有经历中提取项目推进、沟通协作和学习能力。",
    "- 部分满足：岗位关键词、工具熟练度和结果量化仍需补齐。",
    "- 未满足：需要用户确认 JD 中的硬性学历、年限、证书或专业限制。",
    "",
    "## 加分项匹配",
    "- 已满足：有机会用课程、项目、实习或作品集证明岗位兴趣。",
    "- 可补强：补充与目标岗位直接相关的案例、指标和方法论。",
    "",
    "## 关键词覆盖",
    "- 已覆盖关键词：项目、分析、沟通、优化、用户、业务",
    "- 缺失关键词：请根据 JD 原文补充工具、行业词和具体职责关键词",
    "- 建议自然加入的位置：摘要区、技能区、相关经历首条 bullet",
    "",
    "## 优势",
    "1. 已有材料可以转成岗位筛选语言。",
    "2. 可以围绕 JD 反向突出强相关经历。",
    "3. 学生身份适合强调学习速度、项目成果和实习潜力。",
    "",
    "## 差距与风险",
    "1. 若 JD 有硬性经验年限，需谨慎处理定位。",
    "2. 缺少量化成果会降低初筛说服力。",
    "3. 截图信息若不完整，会影响关键词覆盖判断。",
    "",
    "## 投递策略",
    "- 简历主线：围绕目标岗位职责重排经历证据。",
    "- 需要强调的经历：最接近 JD 任务的一段项目/实习经历。",
    `- 面试前需要准备的问题：${prompt ? "解释为什么选择该方向，并准备 2 个相关项目复盘。" : "补充目标 JD 后继续拆解。"}`,
  ].join("\n");
}

function buildSuggestionsMarkdown() {
  return [
    "# 简历优化建议 v1",
    "",
    "## 优化目标",
    "- 目标岗位：以用户本轮 JD 为准",
    "- 优化方向：提高 JD 关键词覆盖、经历相关性和初筛可读性",
    "",
    "## 摘要区优化",
    "- 当前问题：若只描述个人特质，和 JD 的直接关联会偏弱。",
    "- 建议写法方向：用 2-3 行说明目标岗位、核心能力、最相关经历。",
    "- 需要加入的关键词：岗位名称、核心工具、业务场景、可验证成果。",
    "",
    "## 技能区优化",
    "- 建议前置技能：和 JD 必备要求直接对应的技能。",
    "- 建议补充技能：工具、方法、行业词和语言能力。",
    "- 建议弱化或删除内容：与目标岗位无关且占空间的泛化描述。",
    "",
    "## 经历区优化",
    "### 经历 1：最相关项目/实习",
    "- 当前问题：职责描述可能多，成果证据不足。",
    "- 建议突出：任务背景、你的动作、工具方法、结果。",
    "- 建议改写：用“动词 + 场景 + 方法 + 结果/影响”的结构。",
    "",
    "### 经历 2：可迁移经历",
    "- 当前问题：跨方向经历容易看不出关联。",
    "- 建议突出：分析、沟通、推进、复盘等可迁移能力。",
    "- 建议改写：把经历翻译成目标岗位理解的语言。",
    "",
    "## ATS 与可读性检查",
    "- 关键词覆盖：摘要、技能、经历标题和 bullet 中自然出现。",
    "- 格式风险：避免图片化简历、复杂表格和过度装饰。",
    "- 可读性风险：每条经历保持清晰动作和结果，避免空泛形容词。",
    "",
    "## 下一步确认",
    "如果你需要我继续生成完整优化版简历，请先确认目标岗位版本、真实经历细节、可量化成果、技能熟练度、作品集链接和投递语言。缺少的信息我会在聊天中继续追问。",
  ].join("\n");
}

function buildOptimizedResumeMarkdown() {
  return [
    "# 优化后的简历 v1",
    "",
    "## 姓名与联系方式",
    "待用户确认姓名、电话、邮箱、城市、作品集链接。",
    "",
    "## 求职目标 / Professional Summary",
    "面向目标岗位的学生候选人，具备项目推进、结构化分析和快速学习能力。希望结合已有课程/项目/实习经历，在目标岗位中承担信息整理、需求分析、方案执行和结果复盘工作。",
    "",
    "## 核心技能 / Skills",
    "- 岗位相关技能：待根据 JD 原文补齐",
    "- 分析与表达：结构化分析、资料整理、报告撰写、跨团队沟通",
    "- 工具能力：待用户确认真实掌握工具",
    "",
    "## 教育背景 / Education",
    "待用户补充学校、专业、学历、时间、相关课程和成绩亮点。",
    "",
    "## 实习 / 项目 / 工作经历",
    "### 最相关经历",
    "- 围绕目标岗位任务整理项目背景、个人职责、使用方法和结果影响。",
    "- 将原始经历改写为 JD 关键词可识别的表达，保持事实准确。",
    "",
    "### 可迁移经历",
    "- 提炼沟通、分析、执行、复盘等能力，并连接到目标岗位场景。",
    "",
    "## 其他经历 / 证书 / 作品集",
    "待用户确认真实证书、竞赛、作品集、语言成绩或可公开链接。",
    "",
    "## 本版本说明",
    "- 目标岗位：以本轮 JD 为准",
    "- 相比上一版的主要变化：建立了面向 JD 的简历结构和改写方向",
    "- 仍需用户确认的信息：所有个人信息、经历细节、量化结果、技能熟练度",
  ].join("\n");
}
