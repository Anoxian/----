# Supabase Data Model

This document describes the first-version persistence model for the AI job-search canvas.

## Storage Bucket

Create a private Supabase Storage bucket:

```text
career-canvas-assets
```

Purpose:

- Store resume images uploaded by authenticated users.
- Store JD images uploaded by authenticated users.
- Keep uploaded files private by default.

Recommended path format:

```text
{user_id}/{workspace_id}/{file_id}-{original_filename}
```

## Tables

### `job_workspaces`

One workspace represents one job-search canvas.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | References `auth.users.id` |
| `title` | `text` | User-facing workspace title |
| `status` | `text` | `active`, `archived` |
| `created_at` | `timestamptz` | Default `now()` |
| `updated_at` | `timestamptz` | Updated when canvas changes |

### `uploaded_files`

Stores metadata for JD and resume files.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `workspace_id` | `uuid` | References `job_workspaces.id` |
| `user_id` | `uuid` | References `auth.users.id` |
| `file_type` | `text` | `resume`, `jd`, `other` |
| `storage_bucket` | `text` | Usually `career-canvas-assets` |
| `storage_path` | `text` | Private object path |
| `mime_type` | `text` | Allowed: PNG, JPG, JPEG, WebP, Markdown, DOC, DOCX |
| `size_bytes` | `integer` | Must respect `APP_MAX_UPLOAD_MB` |
| `created_at` | `timestamptz` | Default `now()` |

### `canvas_nodes`

Each AI output text box is a node.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `workspace_id` | `uuid` | References `job_workspaces.id` |
| `user_id` | `uuid` | References `auth.users.id` |
| `node_type` | `text` | `input`, `persona`, `recommended_jobs`, `job_detail`, `jd_request`, `jd_analysis`, `optimization_suggestions`, `optimized_resume`, `career_change_translation` |
| `title` | `text` | Canvas node title |
| `content_markdown` | `text` | Markdown content following `canvas-output-spec.md` |
| `version` | `integer` | Starts at 1 per node type or resume iteration |
| `position_x` | `integer` | Canvas position |
| `position_y` | `integer` | Canvas position |
| `metadata` | `jsonb` | Scores, language, confidence, source file ids |
| `created_at` | `timestamptz` | Default `now()` |
| `updated_at` | `timestamptz` | Updated when node changes |

### `canvas_edges`

Edges preserve the logical relationship between nodes.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `workspace_id` | `uuid` | References `job_workspaces.id` |
| `user_id` | `uuid` | References `auth.users.id` |
| `source_node_id` | `uuid` | References `canvas_nodes.id` |
| `target_node_id` | `uuid` | References `canvas_nodes.id` |
| `label` | `text` | Relationship note, such as `generates`, `analyzes`, `revises` |
| `created_at` | `timestamptz` | Default `now()` |

### `ai_messages`

Stores the conversation-side messages that produced canvas nodes.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `workspace_id` | `uuid` | References `job_workspaces.id` |
| `user_id` | `uuid` | References `auth.users.id` |
| `role` | `text` | `user`, `assistant`, `system` |
| `content` | `text` | Message content |
| `created_node_ids` | `uuid[]` | Nodes created by this message |
| `created_at` | `timestamptz` | Default `now()` |

## RLS Policy Requirements

Enable RLS on all tables.

Policy rule:

- Authenticated users can select, insert, update, and delete rows where `user_id = auth.uid()`.
- Users must not access rows owned by other users.
- Storage objects should follow the same ownership model using the first path segment as `user_id`.

## Implementation Notes

- Use Supabase MCP to inspect existing tables and buckets before applying migrations.
- Start with private storage. Use signed URLs for temporary previews if needed.
- Store generated text as Markdown so Markdown export can reuse the same content.
