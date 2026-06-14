# AI Provider Abstraction

This document defines how the app should call AI models without binding product code to one vendor.

## Environment Contract

Application code should read:

```bash
AI_PROVIDER=kimi
AI_API_KEY=your-secret-token
AI_BASE_URL=https://api.moonshot.cn/v1
AI_MODEL=kimi-k2.6
APP_AI_TIMEOUT_MS=120000
APP_OCR_LANG=chi_sim
```

Do not read provider-specific variables such as `ANTHROPIC_*` in business code.

## Interface

```ts
type GenerateCanvasInput = {
  workspaceId: string;
  prompt: string;
  files: Array<{
    id: string;
    type: "resume" | "jd" | "other";
    mimeType: string;
    signedUrl?: string;
    extractedText?: string;
  }>;
  intent:
    | "onboarding"
    | "persona"
    | "recommend_jobs"
    | "analyze_jd"
    | "optimize_resume"
    | "revise_resume";
};

type GenerateCanvasOutput = {
  assistantMessage: string;
  nodes: Array<{
    nodeType:
      | "persona"
      | "recommended_jobs"
      | "job_detail"
      | "jd_analysis"
      | "optimization_suggestions"
      | "optimized_resume"
      | "career_change_translation";
    title: string;
    contentMarkdown: string;
    metadata?: Record<string, unknown>;
  }>;
  edges: Array<{
    sourceNodeId?: string;
    targetNodeTempId: string;
    label: string;
  }>;
};

type AIProvider = {
  generateCanvas(input: GenerateCanvasInput): Promise<GenerateCanvasOutput>;
};
```

## Kimi Provider

First implementation:

```text
AI_PROVIDER=kimi
AI_BASE_URL=https://api.moonshot.cn/v1
AI_MODEL=kimi-k2.6
```

The provider should:

- Run only on the server.
- Use the configured OpenAI-compatible Kimi endpoint for language generation only.
- Do not send uploaded images directly to the model. Uploaded screenshots should be converted to text by the server-side OCR pipeline before calling the AI provider.
- Include the canvas output specification in the system prompt.
- Ask for missing information instead of inventing details.
- Return `job_detail` when the user asks about one specific recommended role, and set `metadata.jobName`.
- Ask whether the user needs a full optimized resume after suggestions. Generate `optimized_resume` only after explicit confirmation and enough factual details.
- Return Markdown content matching `docs/api/canvas-output-spec.md`.

## OCR Preprocessing

Uploaded images should be processed before AI generation:

- Use server-side OCR to extract text from PNG, JPG, JPEG, and WebP files.
- Pass extracted text to the AI provider as normal file context.
- If OCR fails or extracts too little text, show the OCR failure reason in the user input node and do not ask the AI model to infer image contents.

## Output Validation

Before saving AI output:

- Ensure every node has a supported `nodeType`.
- Ensure every node has a title.
- Ensure each node has Markdown content.
- Ensure optimized resume nodes do not replace older versions.
- If the model returns malformed output, convert it into a clarifying assistant message and do not persist broken canvas nodes.

## Future Providers

The same interface can support:

- OpenAI
- Anthropic
- Gemini
- Other OpenAI-compatible or Anthropic-compatible providers

Do not let UI components depend on provider-specific response shapes.
