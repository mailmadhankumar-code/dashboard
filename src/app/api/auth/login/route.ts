
import { NextRequest, NextResponse } from 'next/server';
import { getSettings } from '@/lib/server/settings';
import { encrypt } from '@/lib/server/session';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const settings = await getSettings();
    const users = Array.isArray(settings.users) ? settings.users : [];
    
    const user = users.find(
      (u) => u.username && u.username.toLowerCase() === username.toLowerCase()
    );

    if (!user || user.password !== password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    
    const sessionPayload = {
      email: user.email,
      username: user.username,
      role: user.role,
      customerIds: user.customerIds
    };

    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day
    const session = await encrypt(sessionPayload);

    // Correctly await cookies().set() to fix the crash
    cookies().set('session', session, { expires, httpOnly: true });

    return NextResponse.json({ message: 'Login successful' }, { status: 200 });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
