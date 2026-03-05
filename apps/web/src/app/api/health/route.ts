import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface HealthCheck {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  env: string;
  checks: {
    database: { status: "ok" | "error"; latency?: number; error?: string };
    storage: { status: "ok" | "error"; error?: string };
    auth: { status: "ok" | "error"; error?: string };
  };
  metrics?: {
    uptime: number;
    memory: NodeJS.MemoryUsage;
  };
}

export async function GET(): Promise<NextResponse<HealthCheck>> {
  const timestamp = new Date().toISOString();
  const startTime = Date.now();
  
  const checks: HealthCheck["checks"] = {
    database: { status: "ok" },
    storage: { status: "ok" },
    auth: { status: "ok" },
  };

  let overallStatus: HealthCheck["status"] = "healthy";

  try {
    // Check database connectivity
    const supabase = await createClient();
    
    const { error: dbError } = await supabase
      .from("profiles")
      .select("count", { count: "exact", head: true });

    if (dbError) {
      checks.database = { status: "error", error: dbError.message };
      overallStatus = "unhealthy";
    } else {
      checks.database.latency = Date.now() - startTime;
    }

    // Check storage connectivity
    const { error: storageError } = await supabase.storage
      .from("case-files")
      .list("", { limit: 1 });

    if (storageError && storageError.message !== "Bucket not found") {
      checks.storage = { status: "error", error: storageError.message };
      if (overallStatus === "healthy") {
        overallStatus = "degraded";
      }
    }

    // Check auth service
    const { error: authError } = await supabase.auth.getSession();
    
    // getSession returns error if no session, which is fine for health check
    // We just want to verify the auth service is reachable
    if (authError && !authError.message.includes("Auth session missing")) {
      checks.auth = { status: "error", error: authError.message };
      if (overallStatus === "healthy") {
        overallStatus = "degraded";
      }
    }

    const health: HealthCheck = {
      status: overallStatus,
      timestamp,
      version: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",
      env: process.env.NEXT_PUBLIC_ENV || "unknown",
      checks,
      metrics: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      },
    };

    const statusCode = overallStatus === "healthy" ? 200 : 
                       overallStatus === "degraded" ? 200 : 503;

    return NextResponse.json(health, { status: statusCode });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    const health: HealthCheck = {
      status: "unhealthy",
      timestamp,
      version: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",
      env: process.env.NEXT_PUBLIC_ENV || "unknown",
      checks: {
        database: { status: "error", error: errorMessage },
        storage: { status: "error", error: "Check failed" },
        auth: { status: "error", error: "Check failed" },
      },
    };

    return NextResponse.json(health, { status: 503 });
  }
}
