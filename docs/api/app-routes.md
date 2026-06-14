# Application API Routes

This document defines the first-version server routes for the AI job-search canvas.

All routes must validate the authenticated Supabase user on the server.

## `POST /api/workspaces`

Creates a new job-search canvas workspace.

Request:

```json
{
  "title": "My job search canvas"
}
```

Response:

```json
{
  "workspaceId": "uuid"
}
```

## `GET /api/workspaces/:workspaceId`

Returns the full canvas state.

Response:

```json
{
  "workspace": {},
  "nodes": [],
  "edges": [],
  "messages": [],
  "files": []
}
```

## `POST /api/uploads`

Uploads resume or JD files.

Request:

- `multipart/form-data`
- Fields:
  - `workspaceId`
  - `fileType`: `resume` or `jd`
  - `file`

Validation:

- Supported formats:
  - `image/png`
  - `image/jpeg`
  - `image/webp`
  - `.md` as Markdown
  - `.doc`
  - `.docx`
- Max size: `APP_MAX_UPLOAD_MB`.
- Store files in the private Supabase bucket configured by `APP_UPLOAD_BUCKET`.

Response:

```json
{
  "fileId": "uuid",
  "fileType": "resume",
  "storagePath": "user/workspace/file.png"
}
```

## `POST /api/ai/generate`

Runs the AI job-search workflow.

Request:

```json
{
  "workspaceId": "uuid",
  "prompt": "用户输入的提示词",
  "fileIds": ["uuid"],
  "intent": "onboarding | persona | recommend_jobs | analyze_jd | optimize_resume | revise_resume"
}
```

Behavior:

- If information is insufficient, return a clarifying assistant message instead of low-confidence canvas nodes.
- If enough information exists, create one or more canvas nodes and edges.
- Preserve all previous optimized resume versions.
- Use the output formats in `docs/api/canvas-output-spec.md`.

Response:

```json
{
  "message": "assistant message",
  "createdNodes": [],
  "createdEdges": []
}
```

## `GET /api/workspaces/:workspaceId/export.md`

Exports the canvas as Markdown.

Behavior:

- Export nodes from left to right.
- Preserve node titles and version labels.
- Include relationship notes between nodes.
- Include all optimized resume versions.

Response:

- Content-Type: `text/markdown; charset=utf-8`
- Download filename suggestion:

```text
job-canvas-{workspaceId}.md
```

## Error Shape

All routes should use the same error shape:

```json
{
  "error": {
    "code": "string",
    "message": "human readable message"
  }
}
```

## Security Notes

- Never return `AI_API_KEY` or any provider secret.
- Never trust client-provided `userId`; always derive user identity from Supabase auth.
- Do not expose private Supabase Storage paths without checking ownership.
