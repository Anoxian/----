# Frontend Architecture

This document defines the first-version frontend structure for the protected AI job-search canvas.

## Page

Target page:

```text
/protected
```

The protected page should replace the starter-template content with the job-search canvas workspace.

## Layout

Use a two-area workspace inspired by `docs/images/image.png`:

- Main canvas area on the left.
- Chat/input panel on the right.
- Bottom or panel-anchored composer with:
  - Prompt input
  - `+` upload button
  - Send button

## Canvas Library

Use `@xyflow/react` for the first version.

Reasoning:

- It supports node-based canvas layouts.
- It supports edges/lines between nodes.
- It fits the product requirement that each text box is a separate logical block.
- It avoids hand-rolling drag, zoom, pan, node positioning, and edge rendering.

Required dependency:

```bash
pnpm add @xyflow/react
```

## Suggested Component Structure

```text
components/career-canvas/
  career-workspace.tsx
  canvas-board.tsx
  canvas-node.tsx
  chat-panel.tsx
  prompt-composer.tsx
  upload-menu.tsx
  export-button.tsx
lib/career-canvas/
  types.ts
  layout.ts
  markdown-export.ts
```

## UI States

The first version should support:

- Empty state with proactive assistant greeting.
- Uploading state for JD/resume images.
- Generating state while AI is processing.
- Canvas state with nodes and edges.
- Error state for failed upload or generation.
- Export state for Markdown download.

## Canvas Layout Defaults

Use deterministic left-to-right positioning:

| Node type | X position |
| --- | --- |
| Input / upload | 0 |
| User persona | 360 |
| Recommended jobs | 720 |
| JD analysis | 1080 |
| Optimization suggestions | 1440 |
| Optimized resume | 1800 |
| Later resume versions | +360 each |

Y positions can stack related nodes vertically when multiple nodes of the same type exist.

## Accessibility And UX Notes

- All canvas nodes should remain copyable as text.
- Chat input should support keyboard submission.
- Upload button should clearly distinguish `resume` and `JD` file types.
- Markdown export should be available from the workspace once at least one generated node exists.
