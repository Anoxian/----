import {
  buildMarkdownExport,
  getWorkspaceState,
  jsonError,
  requireUser,
} from "@/lib/career-canvas/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { userId } = await requireUser();
    const { workspaceId } = await params;
    const state = await getWorkspaceState(workspaceId, userId);
    const markdown = buildMarkdownExport(state);

    return new Response(markdown, {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `attachment; filename="job-canvas-${workspaceId}.md"`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
