import type { Metadata } from "next";
import { ResourcesLibrary } from "@/components/resources-library";
import {
  RESOURCE_ALLOWED_MIMES,
  RESOURCE_STORAGE_TYPE_LABEL,
} from "@/lib/resource-storage";

export const metadata: Metadata = { title: "Resources" };

export default function ResourcesPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Resources</h1>
        <p className="mt-1 text-sm text-muted">
          Upload and manage your own documents, then search the shared library
          where every account&apos;s public files appear with shareable links.
        </p>
      </header>
      <ResourcesLibrary
        uploadMimes={RESOURCE_ALLOWED_MIMES}
        uploadTypeLabel={RESOURCE_STORAGE_TYPE_LABEL}
      />
    </div>
  );
}
