import { createServiceClient } from "../shared/supabase-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createServiceClient();
    
    // Parse the JSON payload sent by the payment gateway
    const payload = await req.json();
    console.log("Received webhook payload:", payload);

    // 1. Determine the gateway (e.g. safepay or kuickpay) based on headers or payload structure
    // For this blueprint, we'll assume the payload includes { gateway: 'safepay', reference: '...', status: 'PAID' }
    const gateway = payload.gateway || "safepay"; // fallback for testing
    
    // In a real integration, you MUST verify the cryptographic signature of the webhook here
    // using the encrypted secrets stored in your `node_integrations` table.
    
    if (payload.status !== "PAID") {
      return new Response(JSON.stringify({ message: "Ignored non-paid event" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200, // Always return 200 to gateways so they don't retry unnecessarily
      });
    }

    // 2. The reference should map to our idempotency_key
    const idempotencyKey = payload.reference;
    if (!idempotencyKey) {
      throw new Error("Missing reference/idempotency_key in payload");
    }

    // 3. Log the webhook event in the database for auditing (Phase 3 schema)
    const { error: auditError } = await supabase
      .from('webhook_events')
      .insert({
        gateway,
        idempotency_key: idempotencyKey,
        raw_payload: payload,
        verified: true // Assume verified for this blueprint
      });
      
    if (auditError && auditError.code !== '23505') { // Ignore unique constraint if it's a duplicate retry
       console.error("Audit log failed:", auditError);
    }

    // 4. Update the actual ledger entries to "settled"
    // Since we don't know exactly if this is a school ledger or gym ledger, we can safely attempt both,
    // or the idempotency key could be prefixed like "gym_sub_XXXX" or "sch_fee_XXXX"
    
    let updated = false;

    // Try School Ledger
    const { data: schoolData, error: schoolErr } = await supabase
      .from('school_ledger_entries')
      .update({ status: 'settled', payment_method: gateway })
      .eq('idempotency_key', idempotencyKey)
      .select('id');
      
    if (schoolData && schoolData.length > 0) updated = true;

    // Try Subscription Ledger (Gym)
    if (!updated) {
      const { data: gymData, error: gymErr } = await supabase
        .from('subscription_ledger')
        .update({ status: 'settled', payment_method: gateway })
        .eq('idempotency_key', idempotencyKey)
        .select('id');
        
      if (gymData && gymData.length > 0) updated = true;
    }

    // Try Custom Challans
    if (!updated) {
      const { data: customData, error: customErr } = await supabase
        .from('custom_challans')
        .update({ status: 'settled', payment_method: gateway })
        .eq('idempotency_key', idempotencyKey)
        .select('id');
        
      if (customData && customData.length > 0) updated = true;
    }

    if (!updated) {
      console.warn(`No ledger entry found for idempotency_key: ${idempotencyKey}`);
      // Return 404 so we know it wasn't processed, though some gateways prefer a 200 anyway
      return new Response(JSON.stringify({ error: "Ledger entry not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    return new Response(JSON.stringify({ message: "Ledger settled successfully" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
    
  } catch (error: any) {
    console.error("Webhook processing error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
