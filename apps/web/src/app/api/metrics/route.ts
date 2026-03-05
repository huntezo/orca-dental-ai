/**
 * Admin Metrics Endpoint
 * Returns system metrics for admin dashboard
 * Requires admin authentication
 */

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface SystemMetrics {
  timestamp: string;
  users: {
    total: number;
    active_last_24h: number;
    new_last_24h: number;
  };
  cases: {
    total: number;
    new_last_24h: number;
  };
  analyses: {
    total: number;
    last_24h: number;
    failed_last_24h: number;
    avg_processing_time_seconds: number | null;
  };
  beta?: {
    total_invited: number;
    registered: number;
    remaining_slots: number;
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();

    // Verify admin access
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Get total users
    const { count: totalUsers, error: usersError } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    if (usersError) throw usersError;

    // Get new users in last 24h
    const { count: newUsers24h, error: newUsersError } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", last24h);

    if (newUsersError) throw newUsersError;

    // Get total cases
    const { count: totalCases, error: casesError } = await supabase
      .from("cases")
      .select("*", { count: "exact", head: true });

    if (casesError) throw casesError;

    // Get new cases in last 24h
    const { count: newCases24h, error: newCasesError } = await supabase
      .from("cases")
      .select("*", { count: "exact", head: true })
      .gte("created_at", last24h);

    if (newCasesError) throw newCasesError;

    // Get total analyses
    const { count: totalAnalyses, error: analysesError } = await supabase
      .from("ai_results")
      .select("*", { count: "exact", head: true });

    if (analysesError) throw analysesError;

    // Get analyses in last 24h
    const { count: analyses24h, error: analyses24hError } = await supabase
      .from("ai_results")
      .select("*", { count: "exact", head: true })
      .gte("created_at", last24h);

    if (analyses24hError) throw analyses24hError;

    // Get failed analyses in last 24h
    const { count: failedAnalyses24h, error: failedError } = await supabase
      .from("ai_results")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", last24h);

    if (failedError) throw failedError;

    // Get avg processing time for completed analyses in last 24h
    const { data: processingData, error: processingError } = await supabase
      .from("ai_results")
      .select("started_at, finished_at")
      .eq("status", "done")
      .gte("finished_at", last24h)
      .not("started_at", "is", null)
      .not("finished_at", "is", null);

    let avgProcessingTime: number | null = null;
    if (processingData && processingData.length > 0 && !processingError) {
      const times = processingData.map((row: Record<string, string>) => {
        const started = new Date(row.started_at).getTime();
        const finished = new Date(row.finished_at).getTime();
        return (finished - started) / 1000; // Convert to seconds
      });
      avgProcessingTime = times.reduce((a, b) => a + b, 0) / times.length;
    }

    // Get beta stats if beta mode is enabled
    let betaStats = undefined;
    if (process.env.NEXT_PUBLIC_BETA_MODE === "true") {
      try {
        const { data: betaData, error: betaError } = await supabase
          .rpc("get_beta_stats")
          .single();
        
        if (!betaError && betaData) {
          const stats = betaData as Record<string, number>;
          betaStats = {
            total_invited: stats.total_invited,
            registered: stats.total_registered,
            remaining_slots: stats.remaining_slots,
          };
        }
      } catch {
        // Beta stats are optional, ignore errors
      }
    }

    const metrics: SystemMetrics = {
      timestamp: new Date().toISOString(),
      users: {
        total: totalUsers || 0,
        active_last_24h: 0, // Would need to track last_activity
        new_last_24h: newUsers24h || 0,
      },
      cases: {
        total: totalCases || 0,
        new_last_24h: newCases24h || 0,
      },
      analyses: {
        total: totalAnalyses || 0,
        last_24h: analyses24h || 0,
        failed_last_24h: failedAnalyses24h || 0,
        avg_processing_time_seconds: avgProcessingTime,
      },
      beta: betaStats,
    };

    return NextResponse.json(metrics);

  } catch (error) {
    console.error("Metrics error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return NextResponse.json(
      { error: "Failed to fetch metrics", details: errorMessage },
      { status: 500 }
    );
  }
}
