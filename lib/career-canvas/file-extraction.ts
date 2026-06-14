import mammoth from "mammoth";
import WordExtractor from "word-extractor";

import type { UploadedFileRecord } from "./types";

export type ExtractedFileContent = {
  text: string;
  status: "extracted" | "unsupported" | "failed" | "empty";
  error?: string;
};

const maxExtractedChars = 30000;
const minUsefulOcrChars = 12;

export async function extractUploadedFileText(
  file: UploadedFileRecord,
  blob: Blob,
): Promise<ExtractedFileContent> {
  try {
    const buffer = Buffer.from(await blob.arrayBuffer());
    const filename = file.original_filename || file.storage_path;
    const extension = filename.split(".").pop()?.toLowerCase() || "";
    let text = "";

    if (file.mime_type.startsWith("image/")) {
      text = await extractImageText(buffer);
    } else if (
      extension === "md" ||
      ["text/markdown", "text/x-markdown", "text/plain"].includes(
        file.mime_type,
      )
    ) {
      text = buffer.toString("utf8");
    } else if (
      extension === "docx" ||
      file.mime_type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (
      extension === "doc" ||
      file.mime_type === "application/msword"
    ) {
      const extractor = new WordExtractor();
      const document = await extractor.extract(buffer);
      text = document.getBody();
    } else {
      return {
        text: "",
        status: "unsupported",
        error: "暂不支持解析该文件格式。",
      };
    }

    const normalized = normalizeExtractedText(text);

    if (!normalized) {
      return {
        text: "",
        status: "empty",
        error: file.mime_type.startsWith("image/")
          ? "OCR 已运行，但没有从图片中识别到可用文字。"
          : "文件已读取，但没有提取到可用文本。",
      };
    }

    if (file.mime_type.startsWith("image/") && normalized.length < minUsefulOcrChars) {
      return {
        text: normalized,
        status: "empty",
        error: "OCR 只识别到极少文字，无法可靠分析 JD。",
      };
    }

    return {
      text: normalized.slice(0, maxExtractedChars),
      status: "extracted",
    };
  } catch (error) {
    return {
      text: "",
      status: "failed",
      error: error instanceof Error ? error.message : "文件解析失败。",
    };
  }
}

async function extractImageText(buffer: Buffer) {
  const { createWorker } = await import("tesseract.js");
  const language = process.env.APP_OCR_LANG || "chi_sim";
  const worker = await createWorker(language);

  try {
    const result = await worker.recognize(buffer);
    return result.data.text;
  } finally {
    await worker.terminate();
  }
}

function normalizeExtractedText(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}
