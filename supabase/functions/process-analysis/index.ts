// supabase/functions/process-analysis/index.ts
// Edge Function for queuing AI analysis jobs

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface AnalysisRequest {
  caseId: string;
  analysisType?: string;
  priority?: number;
}

const MAX_JOBS_PER_HOUR = 10;
const MAX_QUEUED_JOBS_PER_USER = 5;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Bearer token required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = authHeader.replace('Bearer ', '');

    // Create Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client for DB operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the access token and get user
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    // Parse request body
    let body: AnalysisRequest;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { caseId, analysisType = 'ceph_xray', priority = 0 } = body;

    if (!caseId) {
      return new Response(
        JSON.stringify({ error: 'caseId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify case belongs to user
    const { data: caseData, error: caseError } = await supabaseAdmin
      .from('cases')
      .select('id, patient_code, user_id, status')
      .eq('id', caseId)
      .single();

    if (caseError || !caseData) {
      return new Response(
        JSON.stringify({ error: 'Case not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (caseData.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: 'Access denied - case belongs to another user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if case already has an active job
    const { data: activeJob } = await supabaseAdmin
      .from('ai_jobs')
      .select('id, status')
      .eq('case_id', caseId)
      .in('status', ['queued', 'processing'])
      .maybeSingle();

    if (activeJob) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Analysis already in progress',
          jobId: activeJob.id,
          status: activeJob.status
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if case already has completed analysis
    const { data: completedResult } = await supabaseAdmin
      .from('ai_results')
      .select('id, status')
      .eq('case_id', caseId)
      .eq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (completedResult) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Analysis already completed',
          resultId: completedResult.id,
          status: 'done'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limit: count jobs in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentJobCount } = await supabaseAdmin
      .from('ai_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneHourAgo);

    if ((recentJobCount || 0) >= MAX_JOBS_PER_HOUR) {
      return new Response(
        JSON.stringify({ 
          error: `Rate limit exceeded. Maximum ${MAX_JOBS_PER_HOUR} analyses per hour. Please try again later.` 
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check max queued jobs per user
    const { count: queuedJobCount } = await supabaseAdmin
      .from('ai_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', ['queued', 'processing']);

    if ((queuedJobCount || 0) >= MAX_QUEUED_JOBS_PER_USER) {
      return new Response(
        JSON.stringify({ 
          error: `Too many active jobs. Maximum ${MAX_QUEUED_JOBS_PER_USER} active analyses per user. Please wait for current analyses to complete.` 
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create ai_result placeholder (will be filled by worker)
    const { data: aiResult, error: resultError } = await supabaseAdmin
      .from('ai_results')
      .insert({
        case_id: caseId,
        user_id: userId,
        model: 'orca-ceph-v1',
        status: 'pending',
        result_json: {},
      })
      .select('id')
      .single();

    if (resultError || !aiResult) {
      return new Response(
        JSON.stringify({ error: 'Failed to create analysis record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the job
    const { data: job, error: jobError } = await supabaseAdmin
      .from('ai_jobs')
      .insert({
        user_id: userId,
        case_id: caseId,
        status: 'queued',
        model: 'orca-ceph-v1',
        priority: priority,
        result_id: aiResult.id,
        metadata: {
          analysis_type: analysisType,
          patient_code: caseData.patient_code,
        },
      })
      .select('id, status, created_at')
      .single();

    if (jobError || !job) {
      // Clean up the ai_result if job creation failed
      await supabaseAdmin.from('ai_results').delete().eq('id', aiResult.id);
      
      return new Response(
        JSON.stringify({ error: 'Failed to queue analysis job' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update case status to processing
    await supabaseAdmin
      .from('cases')
      .update({ status: 'processing' })
      .eq('id', caseId);

    // Return immediately with accepted status
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Analysis job queued successfully',
        jobId: job.id,
        resultId: aiResult.id,
        status: 'queued',
        position: (queuedJobCount || 0) + 1,
      }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
