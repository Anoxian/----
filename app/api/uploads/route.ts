import { NextResponse } from "next/server";

import {
  AppError,
  jsonError,
  maxUploadBytes,
  requireUser,
  resolveSupportedUpload,
  sanitizeFilename,
  uploadBucket,
} from "@/lib/career-canvas/server";
import type { FileType } from "@/lib/career-canvas/types";

const supportedFileTypes: FileType[] = ["resume", "jd"];

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const formData = await request.formData();
    const workspaceId = String(formData.get("workspaceId") || "");
    const fileType = String(formData.get("fileType") || "") as FileType;
    const file = formData.get("file");

    if (!workspaceId) {
      throw new AppError("missing_workspace", "workspaceId is required.");
    }

    if (!supportedFileTypes.includes(fileType)) {
      throw new AppError("invalid_file_type", "fileType must be resume or jd.");
    }

    if (!(file instanceof File)) {
      throw new AppError("missing_file", "A file is required.");
    }

    const uploadSupport = resolveSupportedUpload(file.name, file.type);

    if (!uploadSupport?.isSupported) {
      throw new AppError(
        "unsupported_file_format",
        "Only images, Markdown, and Word documents are supported.",
      );
    }

    if (file.size > maxUploadBytes()) {
      throw new AppError(
        "file_too_large",
        `File exceeds ${process.env.APP_MAX_UPLOAD_MB || 10}MB.`,
      );
    }

    const { data: workspace, error: workspaceError } = await supabase
      .from("job_workspaces")
      .select("id")
      .eq("id", workspaceId)
      .eq("user_id", userId)
      .single();

    if (workspaceError || !workspace) {
      throw new AppError("workspace_not_found", "Workspace not found.", 404);
    }

    const fileId = crypto.randomUUID();
    const filename = sanitizeFilename(file.name) || `${fileType}.png`;
    const bucket = uploadBucket();
    const storagePath = `${userId}/${workspaceId}/${fileId}-${filename}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, file, {
        contentType: uploadSupport.contentType,
        upsert: false,
      });

    if (uploadError) {
      throw new AppError("storage_upload_failed", uploadError.message, 500);
    }

    const { data, error } = await supabase
      .from("uploaded_files")
      .insert({
        id: fileId,
        workspace_id: workspaceId,
        user_id: userId,
        file_type: fileType,
        storage_bucket: bucket,
        storage_path: storagePath,
        mime_type: uploadSupport.contentType,
        size_bytes: file.size,
        original_filename: file.name,
      })
      .select("*")
      .single();

    if (error) {
      throw new AppError("file_metadata_failed", error.message, 500);
    }

    return NextResponse.json({
      fileId: data.id,
      fileType: data.file_type,
      storagePath: data.storage_path,
      file: data,
    });
  } catch (error) {
    return jsonError(error);
  }
}
