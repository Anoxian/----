# Project Rules

## Project Background

- This is a Next.js + Supabase project.
- Future development should follow the existing tech stack, directory structure, and code style in this repository.

## Documentation Structure

- Project documentation lives under `docs/`.
- `docs/prd.md` stores product requirements, feature specs, and confirmed product decisions.
- `docs/images/` stores screenshots, UI references, flowcharts, and other image assets.
- `docs/api/` stores API docs, interface contracts, and third-party integration notes.

## Requirement Capture

- When discussing feature implementation, product requirements, business rules, or interaction details, write confirmed requirements into `docs/prd.md` promptly.
- Before writing to the PRD, use only confirmed information. Do not treat unconfirmed assumptions as final requirements.
- If a requirement is incomplete, record it as a pending question or open issue.

## Supabase Operations

- For Supabase-related tasks, prefer Supabase MCP when available, including but not limited to:
  - Inspecting database table structure
  - Running SQL queries
  - Checking or creating RLS policies
  - Inspecting or creating Storage buckets
- Before changing schema, RLS, or storage configuration, inspect the existing state first.

## Security And Configuration

- Do not write Supabase service role keys, database passwords, access tokens, or other sensitive secrets into frontend code or committed files.
- Frontend code may only use public environment variables prefixed with `NEXT_PUBLIC_`.
- When user data is involved, consider RLS policies and least-privilege access first.
