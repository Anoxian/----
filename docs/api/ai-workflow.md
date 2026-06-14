# AI Job Matching Workflow

## Input

- Prompt text entered by the user.
- JD files uploaded from the input upload button.
- Resume files uploaded from the input upload button.
- Supported upload formats are images, Markdown, and Word documents.
- If the user has not provided enough information, the assistant should ask for the minimum missing inputs instead of generating low-confidence output.

## Initial Greeting

When the user first opens the protected workspace, the chat panel should proactively greet them and ask for useful inputs.

Recommended greeting:

```text
你好，我是你的 AI 求职匹配助手。你可以先上传简历截图，或者告诉我你的背景、目标行业、目标岗位、城市偏好和求职阶段。

我会先在画布上生成你的用户画像和至少 5 个适合的岗位方向。之后你可以继续上传心仪岗位的 JD，我会帮你做匹配评分、差距分析、优化建议，并生成完整的优化版简历。每一次迭代都会保留在画布上，方便你看清楚整个优化过程。
```

## Server-Side Processing

The server should:

- Validate the authenticated user.
- Accept prompt text and uploaded files.
- Send the prompt and file content to the configured AI provider.
- Keep provider tokens server-side only.
- Return structured generation results to the frontend.

## Output Contract

The first version should return these sections:

```ts
type JobMatchingResult = {
  userPersona: string;
  recommendedJobs: Array<{
    title: string;
    reason: string;
    matchScore?: number;
  }>;
  jdMatchAnalysis: {
    strengths: string[];
    gaps: string[];
    suggestions: string[];
  };
  optimizedResume: string;
  language: "zh" | "en" | "mixed";
  iterationLabel: string;
};
```

## Canvas Rendering

- Render each output section as an editable or copyable canvas block.
- Preserve the conversation context that produced the result.
- Keep the initial layout close to the reference image in `docs/images/image.png`.
- Render blocks from left to right in the user's natural reading order.
- Use one block for one function only.
- Render different optimized resume iterations as separate canvas blocks.
- Use connecting lines between blocks to show the relationship between prompt, uploaded files, analysis, recommendations, and resume iterations.
- Do not replace older generated versions when a new revision is created.
- Follow the detailed block schemas in `docs/api/canvas-output-spec.md`.

## Data Persistence

- Persist generated canvas content to Supabase.
- Store enough information to reconstruct the canvas:
  - User prompt
  - Uploaded file metadata
  - Generated result sections
  - Canvas block positions
  - Connections between blocks
  - Iteration/version labels
- Follow the proposed schema in `docs/api/supabase-data-model.md`.

## Export

- Support exporting generated results.
- Markdown export is the first priority.
- Export should preserve the logical structure of the canvas output, including user persona, recommended jobs, JD match analysis, and optimized resume versions.
- Follow the route contract in `docs/api/app-routes.md`.
