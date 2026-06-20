import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Non disponible en production' }, { status: 403 });
  }

  const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:5000';

  try {
    const { method, endpoint, body } = (await request.json()) as {
      method: string;
      endpoint: string;
      body?: Record<string, unknown>;
    };

    const cookie = request.headers.get('cookie') ?? '';

    const response = await fetch(`${backendUrl}${endpoint}`, {
      method: method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      ...(method !== 'GET' && body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    const data: unknown = await response.json().catch(() => ({ success: false, message: 'Réponse non-JSON' }));
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    console.error('[dev-proxy]', err);
    return NextResponse.json({ success: false, message: String(err) }, { status: 500 });
  }
}
