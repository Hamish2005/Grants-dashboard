import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { listGrants, referenceData } from '@/lib/grants';
export const dynamic='force-dynamic';
export async function GET() {try {const user=await currentUser();return NextResponse.json({user,grants:listGrants(),...referenceData()},{headers:{'Cache-Control':'no-store'}});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unauthorized'},{status:401});}}
