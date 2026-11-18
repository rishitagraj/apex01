import { PdfViewerWithAnnotations } from '@/components/pdf/pdf-viewer-with-annotations';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function PdfViewerPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string; name?: string }>;
}) {
  const params = await searchParams;
  const url = params.url || '';
  const name = params.name || 'Document.pdf';

  if (!url) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#525659] text-white">
        <div className="text-center">
          <p className="mb-4 text-muted">No PDF URL provided</p>
          <Link href="/resources" className="inline-flex items-center gap-2 rounded-lg bg-surface px-4 py-2 text-sm">
            <ArrowLeft size={16} /> Back to Resources
          </Link>
        </div>
      </div>
    );
  }

  let decodedUrl = url;
  let decodedName = name;
  try {
    decodedUrl = decodeURIComponent(url);
  } catch {}
  try {
    decodedName = decodeURIComponent(name);
  } catch {}

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#525659]">
      <div className="flex items-center gap-3 border-b border-line/50 bg-[#323639] px-4 py-2 text-white">
        <Link href="/resources" className="inline-flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-white/10">
          <ArrowLeft size={18} />
          <span className="text-sm">Back to Apex</span>
        </Link>
        <div className="h-4 w-px bg-white/20" />
        <h1 className="flex-1 truncate text-sm font-medium">{decodedName}</h1>
      </div>
      <div className="flex-1">
        <PdfViewerWithAnnotations url={decodedUrl} fileName={decodedName} fullScreen />
      </div>
    </div>
  );
}
