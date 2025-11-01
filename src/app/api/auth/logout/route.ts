
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  // Clear the session cookie
  // Await cookies() before using it
  cookies().set('session', '', { expires: new Date(0) });
  return NextResponse.json({ message: 'Logout successful' }, { status: 200 });
}
