"use client";

import { useCallback, useState } from "react";
import {
  DEFAULT_PARSE_OPTIONS,
  type ImportSummary,
  type ParseOptions,
  type RoadmapDraft,
} from "@/types/syllabus";

const PROMPT_KEY = "apex-syllabus-prompt";

export function useImportWizard() {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState<string | null>(null);
  const [prompt, setPromptState] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem(PROMPT_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [options, setOptions] = useState<ParseOptions>({ ...DEFAULT_PARSE_OPTIONS });
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsOcr, setNeedsOcr] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [roadmap, setRoadmap] = useState<RoadmapDraft | null>(null);
  const [textPreview, setTextPreview] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [recentImports, setRecentImports] = useState<
    { id: string; course: string; pdfName: string | null; createdAt: string }[]
  >([]);

  const setPrompt = useCallback((next: string) => {
    setPromptState(next);
    localStorage.setItem(PROMPT_KEY, next);
  }, []);

  const chooseFile = useCallback((next: File) => {
    setFile(next);
    setFileKey(null);
    setError(null);
    setNeedsOcr(false);
    setRoadmap(null);
    setSummary(null);
  }, []);

  const uploadAndParse = useCallback(async () => {
    if (!file) return;
    setParsing(true);
    setError(null);
    setNeedsOcr(false);
    setProgressText("Uploading to secure storage…");
    try {
      let key = fileKey;
      if (!key) {
        const contentType = file.type || "application/pdf";
        const presignRes = await fetch("/api/syllabus/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "presign",
            fileName: file.name,
            contentType,
            fileSize: file.size,
          }),
        });
        const presign = await presignRes.json();
        if (!presignRes.ok) throw new Error(presign.error || "Upload setup failed");
        key = presign.fileKey as string;
        const upload = await fetch(presign.uploadUrl as string, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: new Uint8Array(await readFileArrayBuffer(file)),
        });
        if (!upload.ok) throw new Error(`Upload failed (${upload.status})`);
        setFileKey(key);
      }

      setProgressText("Extracting text and generating roadmap with AI…");
      const processRes = await fetch("/api/syllabus/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "process",
          fileKey: key,
          instructions: prompt,
          options,
        }),
      });
      const parsed = await processRes.json();
      if (!processRes.ok) {
        if (parsed.needsOcr) setNeedsOcr(true);
        throw new Error(parsed.error || `Parse failed (${processRes.status})`);
      }
      setRoadmap(parsed.roadmap as RoadmapDraft);
      setTextPreview(String(parsed.textPreview ?? ""));
      setProgressText("");
      setFileKey(null);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setParsing(false);
    }
  }, [file, fileKey, prompt, options]);

  const confirmImport = useCallback(async () => {
    if (!roadmap) return;
    setImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/syllabus/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roadmap,
          course: roadmap.course,
          pdfName: file?.name ?? null,
          fileKey,
          keepPdf: options.keepPdf,
          instructions: prompt,
          options,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setSummary(data.summary as ImportSummary);
      setImportId(data.importId as string);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }, [roadmap, file, fileKey, options, prompt]);

  const retry = useCallback(() => void uploadAndParse(), [uploadAndParse]);

  return {
    step,
    setStep,
    file,
    chooseFile,
    prompt,
    setPrompt,
    options,
    setOptions,
    parsing,
    importing,
    error,
    needsOcr,
    progressText,
    roadmap,
    setRoadmap,
    textPreview,
    summary,
    setSummary,
    importId,
    fileKey,
    uploadAndParse,
    confirmImport,
    retry,
    recentImports,
    setRecentImports,
  };
}

async function readFileArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}