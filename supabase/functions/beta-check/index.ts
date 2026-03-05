/**
 * Beta Check Edge Function
 * Validates if an email is on the beta allowlist
 * 
 * Endpoint: POST /functions/v1/beta-check
 * Body: { email: string }
 * Response: { allowed: boolean, message: string }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BetaCheckRequest {
  email: string;
}

interface BetaCheckResponse {
  allowed: boolean;
  message: string;
  email?: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { 
        status: 405, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }

  try {
    // Parse request body
    let body: BetaCheckRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const { email } = body;

    // Validate email
    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ 
          allowed: false, 
          message: "Please enter a valid email address" 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if beta mode is enabled
    // Note: In a real scenario, you might want to check this from a config table
    // For now, we assume beta mode is enabled if this function is being called
    
    // Call the RPC function to check allowlist
    const { data, error } = await supabase.rpc("check_beta_allowlist", {
      p_email: email.toLowerCase().trim(),
    });

    if (error) {
      console.error("Error checking beta allowlist:", error);
      return new Response(
        JSON.stringify({ 
          allowed: false, 
          message: "Unable to verify beta access. Please try again later." 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Return the result
    const result: BetaCheckResponse = {
      allowed: data[0]?.allowed || false,
      message: data[0]?.message || "Unable to verify beta access.",
      email: email.toLowerCase().trim(),
    };

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("Unexpected error in beta-check:", error);
    return new Response(
      JSON.stringify({ 
        allowed: false, 
        message: "An unexpected error occurred. Please try again later." 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
