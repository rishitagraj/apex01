import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  
  if (!url) {
    return new Response("URL required", { status: 400 });
  }

  try {
    let targetUrl = url;
    // If it's a relative URL, make it absolute
    if (targetUrl.startsWith("/")) {
      const baseUrl = new URL(request.url).origin;
      targetUrl = baseUrl + targetUrl;
    }

    // Follow redirects
    let response = await fetch(targetUrl, { redirect: "follow" });
    
    // If it's a redirect response, try to follow
    if (response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308) {
      const location = response.headers.get("location");
      if (location) {
        response = await fetch(location, { redirect: "follow" });
      }
    }
    
    if (!response.ok) {
      return new Response("Failed to fetch PDF", { status: response.status });
    }

    const contentType = response.headers.get("content-type") || "application/pdf";
    const data = await response.arrayBuffer();

    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("PDF proxy error:", error);
    return new Response("Failed to proxy PDF", { status: 500 });
  }
}
