# Environment Variables

## Required For Supabase

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
```

- These values are public client-side configuration.
- They are required for authentication and Supabase client initialization.

## Required For AI Generation

```bash
AI_PROVIDER=kimi
AI_API_KEY=your-secret-token
AI_BASE_URL=https://api.moonshot.cn/v1
AI_MODEL=kimi-k2.6
```

- These values are server-side only.
- Do not prefix them with `NEXT_PUBLIC_`.
- Store real secrets in `.env.local` or another ignored local environment file.
- Application code should depend on these generic `AI_*` variables instead of provider-specific names.

## Local Environment Status

- `.env.example` now documents all required variables.
- The current local `.env` contains Supabase public variables, AI provider variables, and server-side app settings.
- `.env.local` is optional for this local project. If used later, keep the same keys and avoid committing it.

## Required For File Uploads

```bash
APP_UPLOAD_BUCKET=career-canvas-assets
APP_MAX_UPLOAD_MB=10
APP_OCR_LANG=chi_sim
```

- These values are server-side application settings.
- `APP_UPLOAD_BUCKET` is the private Supabase Storage bucket used for JD and resume images.
- `APP_MAX_UPLOAD_MB` limits each uploaded file size.
- `APP_OCR_LANG` configures server-side OCR language for uploaded screenshots. The default is Simplified Chinese, which fits Chinese JD screenshots and still preserves common English terms.

## Required For Generation Runtime

```bash
APP_AI_TIMEOUT_MS=120000
```

- This sets the maximum server-side AI generation timeout.
- The first version can use a single timeout for persona extraction, JD analysis, resume optimization, and Markdown export.
