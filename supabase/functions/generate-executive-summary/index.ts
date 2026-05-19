import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { section, fiscalYear, period, week } = await req.json();

    if (!section || !fiscalYear || !period || !week) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: section, fiscalYear, period, week" }),
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: summaries, error: dbError } = await supabase
      .from("weekly_chef_summary")
      .select("*, locations!inner(name, code)")
      .eq("fiscal_year", fiscalYear)
      .eq("period_number", period)
      .eq("week_number", week);

    if (dbError) {
      console.error("DB error:", dbError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch chef summaries" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let filteredSummaries = summaries || [];

    const brandFilters: Record<string, string[]> = {
      beertown_summary: ["BTB", "Beertown"],
      trinity_summary: ["TC", "Trinity"],
      sole_summary: ["SR", "Sole"],
    };

    if (brandFilters[section]) {
      const keywords = brandFilters[section];
      filteredSummaries = filteredSummaries.filter((s: any) =>
        keywords.some(
          (kw) =>
            s.locations?.name?.includes(kw) || s.locations?.code?.includes(kw)
        )
      );
    }

    if (filteredSummaries.length === 0) {
      return new Response(
        JSON.stringify({ content: "No chef summaries available for this period to generate a report from." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const summaryTexts = filteredSummaries
      .map((s: any) => {
        const parts = [
          `Location: ${s.locations?.name || "Unknown"}`,
          s.food_cost_summary && `Food Cost: ${s.food_cost_summary}`,
          s.labour_summary && `Labour: ${s.labour_summary}`,
          s.boh_promo_summary && `BOH/Promo: ${s.boh_promo_summary}`,
          s.notes && `Notes: ${s.notes}`,
          s.action_plan_summary && `Action Plan: ${s.action_plan_summary}`,
          s.ai_summary && `AI Summary: ${s.ai_summary}`,
          s.actual_food_cost_pct && `Actual FC%: ${s.actual_food_cost_pct}`,
          s.labour_cost_pct && `Labour%: ${s.labour_cost_pct}`,
        ];
        return parts.filter(Boolean).join("\n");
      })
      .join("\n\n---\n\n");

    const sectionLabel =
      section === "executive_summary"
        ? "overall executive"
        : section.replace("_summary", "").replace("_", " ");

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
              content: `You are an executive operations analyst for a restaurant group. Write a concise ${sectionLabel} summary for leadership based on the chef reports provided. Focus on key performance metrics, notable wins, challenges, and action items. Use a professional tone. Keep it to 3-5 short paragraphs. Do not use bullet points or markdown formatting.`,
            },
            {
              role: "user",
              content: `Generate the ${sectionLabel} summary for FY${fiscalYear} Period ${period} Week ${week} based on these chef reports:\n\n${summaryTexts}`,
            },
          ],
          max_tokens: 500,
          temperature: 0.4,
        }),
      }
    );

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      console.error("OpenAI error:", errText);
      return new Response(
        JSON.stringify({ error: "Failed to generate AI content" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiData = await openaiResponse.json();
    const content = openaiData.choices?.[0]?.message?.content?.trim() || "";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-executive-summary:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
