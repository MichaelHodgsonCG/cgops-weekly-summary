import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ChefSummaryInput {
  id: string;
  location_name: string;
  food_cost_summary: string;
  labour_summary: string;
  boh_promo_summary: string;
  notes: string;
  action_plan_summary: string;
  hiring_notes: string;
  tm_mots_of_note: string;
  development_path_updates?: string;
  rm_issues?: string;
  cleaning_focus?: string;
  features_notes?: string;
  audit_score_comment?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { summaries } = (await req.json()) as {
      summaries: ChefSummaryInput[];
    };

    if (!summaries || !Array.isArray(summaries) || summaries.length === 0) {
      return new Response(
        JSON.stringify({ error: "No summaries provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const summary of summaries) {
      const chefNotes = [
        summary.food_cost_summary && `Food Cost: ${summary.food_cost_summary}`,
        summary.labour_summary && `Labour: ${summary.labour_summary}`,
        summary.boh_promo_summary && `BOH/Promo: ${summary.boh_promo_summary}`,
        summary.notes && `Notes: ${summary.notes}`,
        summary.action_plan_summary && `Action Plan: ${summary.action_plan_summary}`,
        summary.hiring_notes && `Hiring: ${summary.hiring_notes}`,
        summary.tm_mots_of_note && `Team Members of Note: ${summary.tm_mots_of_note}`,
        summary.development_path_updates && `Development Path: ${summary.development_path_updates}`,
        summary.rm_issues && `R&M Issues: ${summary.rm_issues}`,
        summary.cleaning_focus && `Cleaning Focus: ${summary.cleaning_focus}`,
        summary.features_notes && `Features: ${summary.features_notes}`,
        summary.audit_score_comment && `Audit: ${summary.audit_score_comment}`,
      ]
        .filter(Boolean)
        .join("\n");

      if (!chefNotes.trim()) {
        results.push({ id: summary.id, ai_summary: null });
        continue;
      }

      const openaiResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content:
                  "You are a concise restaurant operations analyst. Summarize the chef's weekly notes into 2-3 sentences highlighting the most important operational points, challenges, and wins. Keep it factual and actionable. Do not use bullet points.",
              },
              {
                role: "user",
                content: `Summarize this chef's weekly report for ${summary.location_name}:\n\n${chefNotes}`,
              },
            ],
            max_tokens: 200,
            temperature: 0.3,
          }),
        }
      );

      if (!openaiResponse.ok) {
        const errText = await openaiResponse.text();
        console.error(`OpenAI error for ${summary.location_name}:`, errText);
        results.push({ id: summary.id, ai_summary: null });
        continue;
      }

      const openaiData = await openaiResponse.json();
      const aiSummary =
        openaiData.choices?.[0]?.message?.content?.trim() || null;

      results.push({ id: summary.id, ai_summary: aiSummary });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-chef-summary:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
