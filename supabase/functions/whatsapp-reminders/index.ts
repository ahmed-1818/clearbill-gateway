import { createServiceClient } from "../shared/supabase-client.ts";

Deno.serve(async (req: Request) => {
  try {
    // This function will be triggered by pg_cron or Supabase Scheduled Functions.
    // It shouldn't normally be called directly by clients, but if it is, we can optionally
    // verify an authorization header to ensure it's an authorized cron trigger.
    
    console.log("Starting WhatsApp Reminder Cron Job...");
    const supabase = createServiceClient();

    // 1. Find overdue or approaching unpaid ledgers across all domains.
    // In Phase 3, we added `last_reminder_sent_at` to avoid spamming parents/members every day.
    // We want to send a reminder if they haven't been reminded in the last 3 days.

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoISO = threeDaysAgo.toISOString();

    // Query School Ledger (Unpaid students)
    const { data: schoolDues, error: schoolErr } = await supabase
      .from('school_ledger_entries')
      .select('id, invoiced_amount, due_date, last_reminder_sent_at, students(full_name, parent_phone)')
      .eq('status', 'unpaid')
      // Only remind if they've never been reminded OR were last reminded more than 3 days ago
      .or(`last_reminder_sent_at.is.null,last_reminder_sent_at.lt.${threeDaysAgoISO}`)
      .limit(50); // Process in batches to avoid timing out

    if (schoolErr) console.error("Error fetching school dues:", schoolErr);

    // Query Gym Ledger (Unpaid members)
    const { data: gymDues, error: gymErr } = await supabase
      .from('subscription_ledger')
      .select('id, invoiced_amount, billing_period_end, last_reminder_sent_at, members(full_name, phone_number)')
      .eq('status', 'unpaid')
      .or(`last_reminder_sent_at.is.null,last_reminder_sent_at.lt.${threeDaysAgoISO}`)
      .limit(50);

    if (gymErr) console.error("Error fetching gym dues:", gymErr);

    let remindersSent = 0;

    // Helper function to send the actual WhatsApp message via Whapi.Cloud
    async function sendWhatsAppMessage(phone: string, name: string, amount: number, dueDate: string) {
      // Clean the phone number (remove +, spaces, dashes). Whapi expects e.g., '923124660742'
      const cleanPhone = phone.replace(/[\s\+\-\(\)]/g, "");
      
      const messageBody = `*ClearBill Reminder*\n\nDear ${name},\nThis is a gentle reminder that a fee of *Rs. ${amount}* is due on *${dueDate}*. Please pay at your earliest convenience to avoid penalties.\n\nThank you!`;
      
      const whapiToken = Deno.env.get('WHAPI_TOKEN') ?? "6LJX055neyjsUAW0LSQcvyZKSMYqPxd0";
      
      try {
        const response = await fetch("https://gate.whapi.cloud/messages/text", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${whapiToken}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            to: cleanPhone,
            body: messageBody
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Whapi API Error for ${cleanPhone}:`, response.status, errorText);
          return false;
        }

        const data = await response.json();
        console.log(`[Whapi API] Sent successfully to ${cleanPhone}. Message ID: ${data.message_id || 'unknown'}`);
        return true;
      } catch (err: any) {
        console.error(`[Whapi API] Network error sending to ${cleanPhone}:`, err.message);
        return false;
      }
    }

    // 2. Process School Reminders
    if (schoolDues && schoolDues.length > 0) {
      for (const entry of schoolDues) {
        const student = entry.students as any;
        const success = await sendWhatsAppMessage(student.parent_phone, student.full_name, entry.invoiced_amount, entry.due_date);
        
        if (success) {
          await supabase
            .from('school_ledger_entries')
            .update({ last_reminder_sent_at: new Date().toISOString() })
            .eq('id', entry.id);
          remindersSent++;
        }
      }
    }

    // 3. Process Gym Reminders
    if (gymDues && gymDues.length > 0) {
      for (const entry of gymDues) {
        const member = entry.members as any;
        const success = await sendWhatsAppMessage(member.phone_number, member.full_name, entry.invoiced_amount, entry.billing_period_end);
        
        if (success) {
          await supabase
            .from('subscription_ledger')
            .update({ last_reminder_sent_at: new Date().toISOString() })
            .eq('id', entry.id);
          remindersSent++;
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Cron completed successfully. Reminders dispatched: ${remindersSent}` 
    }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
    
  } catch (error: any) {
    console.error("Cron Job Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
