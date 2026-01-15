
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const grafanaUrl = process.env.NEXT_PUBLIC_GRAFANA_URL;
  const apiToken = process.env.GRAFANA_API_TOKEN;

  if (!grafanaUrl || !apiToken) {
    return new NextResponse('Grafana configuration missing', { status: 500 });
  }

  // Construct the target URL
  // "path" is an array of path segments, e.g. ["UID", "slug"]
  const path = (await params).path.join('/');
  const targetUrl = new URL(`${grafanaUrl}/d/${path}`);

  // Copy search params (query string)
  request.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  try {
    const upstreamResponse = await fetch(targetUrl.toString(), {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        // Pass Host/Origin as required by Azure
        Host: targetUrl.host,
        Origin: targetUrl.origin,
      },
      // Ensure we don't automatically follow redirect if we want to handle them, 
      // but usually following is fine unless auth fails.
      redirect: 'follow', 
    });

    // Create a new response with the upstream body
    const response = new NextResponse(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
    });

    // Copy headers from upstream to our response
    upstreamResponse.headers.forEach((value, key) => {
      // STRIP SECURITY HEADERS that block embedding
      if (key.toLowerCase() === 'x-frame-options' || 
          key.toLowerCase() === 'content-security-policy') {
        return; 
      }
      response.headers.set(key, value);
    });

    return response;

  } catch (error) {
    console.error('Error proxying to Grafana:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
