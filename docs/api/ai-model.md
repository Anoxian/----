# AI Model Configuration

## Selected Provider

- Provider: Kimi / Moonshot AI
- Provider key: `kimi`
- Base URL: `https://api.moonshot.cn/v1`
- Model: `kimi-k2.6`
- Compatibility: OpenAI-compatible endpoint

## Environment Variables

Use these server-side environment variables:

```bash
AI_PROVIDER=kimi
AI_API_KEY=<your-secret-token>
AI_BASE_URL=https://api.moonshot.cn/v1
AI_MODEL=kimi-k2.6
```

## Security Notes

- Do not commit the real `AI_API_KEY` to this repository.
- Store the real token in `.env.local` or another ignored local environment file.
- Do not expose `AI_API_KEY` through `NEXT_PUBLIC_` variables.
- Calls that require this token should run on the server side only.

## Intended Usage

- Use this model for the `/protected` AI job matching and resume optimization workflow.
- The model should process prompt text, JD images, and resume images through server-side API routes or server actions.
- The frontend should only send user input and uploaded files to the application server. It should never call the provider directly with the secret token.

## Provider Abstraction

- Application code should read generic `AI_*` variables instead of provider-specific names.
- Start with `AI_PROVIDER=kimi`.
- If the product later switches to another model provider, keep the same internal `AI_*` contract and only change the provider implementation.
