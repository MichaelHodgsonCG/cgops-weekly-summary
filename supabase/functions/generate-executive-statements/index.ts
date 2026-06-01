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
    const { fiscalYear, period, week, leadershipNotes } = await req.json();

    if (!fiscalYear || !period || !week) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: fiscalYear, period, week" }),
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

    // Fetch all chef summaries for this week
    const { data: chefSummaries, error: chefError } = await supabase
      .from("weekly_chef_summary")
      .select("*, locations!inner(name, code, exclude_from_reporting)")
      .eq("fiscal_year", fiscalYear)
      .eq("period_number", period)
      .eq("week_number", week)
      .eq("locations.exclude_from_reporting", false);

    if (chefError) {
      console.error("DB error fetching chef summaries:", chefError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch chef summaries" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch fiscal calendar for the week ending date
    const { data: fiscalData } = await supabase
      .from("fiscal_calendar")
      .select("end_date")
      .eq("fiscal_year", fiscalYear)
      .eq("period", period)
      .eq("week", week)
      .single();

    // Fetch consolidated P&L data
    let consolidatedText = "";
    if (fiscalData?.end_date) {
      const { data: plData } = await supabase
        .from("pl_line_items")
        .select("*, locations!inner(name, code, exclude_from_reporting)")
        .eq("week_ending_date", fiscalData.end_date)
        .eq("locations.exclude_from_reporting", false);

      if (plData && plData.length > 0) {
        const getLineItem = (locId: string, name: string, field: string) => {
          const item = plData.find(
            (pl: any) => pl.location_id === locId && pl.line_item_name === name
          );
          return item ? parseFloat(item[field]) || 0 : 0;
        };

        const locationIds = [...new Set(plData.map((pl: any) => pl.location_id))] as string[];
        const totalPTDSales = locationIds.reduce(
          (s, id) => s + getLineItem(id, "Food Sales", "current_actual"), 0
        );
        const totalPTDBudget = locationIds.reduce(
          (s, id) => s + getLineItem(id, "Food Sales", "current_budget"), 0
        );
        const totalYTDSales = locationIds.reduce(
          (s, id) => s + getLineItem(id, "Food Sales", "ytd_actual"), 0
        );
        const totalYTDBudget = locationIds.reduce(
          (s, id) => s + getLineItem(id, "Food Sales", "ytd_budget"), 0
        );
        const ptdFC = locationIds.reduce(
          (s, id) => s + getLineItem(id, "Cost of Sales (Food)", "current_actual"), 0
        );
        const ptdFCBudget = locationIds.reduce(
          (s, id) => s + getLineItem(id, "Cost of Sales (Food)", "current_budget"), 0
        );
        const ptdLab = locationIds.reduce(
          (s, id) => s + getLineItem(id, "Kitchen Labour", "current_actual"), 0
        );
        const ptdLabBudget = locationIds.reduce(
          (s, id) => s + getLineItem(id, "Kitchen Labour", "current_budget"), 0
        );

        const fmt = (v: number) => `$${Math.round(v).toLocaleString()}`;
        const fmtPct = (v: number) => `${v.toFixed(2)}%`;
        const ptdFCPct = totalPTDSales > 0 ? (ptdFC / totalPTDSales) * 100 : 0;
        const ptdFCBudgetPct = totalPTDBudget > 0 ? (ptdFCBudget / totalPTDBudget) * 100 : 0;
        const ptdLabPct = totalPTDSales > 0 ? (ptdLab / totalPTDSales) * 100 : 0;
        const ptdLabBudgetPct = totalPTDBudget > 0 ? (ptdLabBudget / totalPTDBudget) * 100 : 0;

        consolidatedText = `CONSOLIDATED RESULTS (All Locations) — FY${fiscalYear} P${period} W${week}:
Food Sales PTD: ${fmt(totalPTDSales)} vs Budget ${fmt(totalPTDBudget)} (${totalPTDSales >= totalPTDBudget ? "+" : ""}${fmt(totalPTDSales - totalPTDBudget)})
Food Sales YTD: ${fmt(totalYTDSales)} vs Budget ${fmt(totalYTDBudget)} (${totalYTDSales >= totalYTDBudget ? "+" : ""}${fmt(totalYTDSales - totalYTDBudget)})
Food Cost % PTD: ${fmtPct(ptdFCPct)} vs Budget ${fmtPct(ptdFCBudgetPct)} (${ptdFCPct >= ptdFCBudgetPct ? "+" : ""}${(ptdFCPct - ptdFCBudgetPct).toFixed(2)} pts)
Kitchen Labour % PTD: ${fmtPct(ptdLabPct)} vs Budget ${fmtPct(ptdLabBudgetPct)} (${ptdLabPct >= ptdLabBudgetPct ? "+" : ""}${(ptdLabPct - ptdLabBudgetPct).toFixed(2)} pts)`;
      }
    }

    // Build full chef summary text
    const chefSummaryText = (chefSummaries || [])
      .map((s: any) => {
        const parts = [
          `Location: ${s.locations?.name || "Unknown"} (${s.locations?.code || ""})`,
          s.food_cost_summary && `Food Cost: ${s.food_cost_summary}`,
          s.labour_summary && `Labour: ${s.labour_summary}`,
          s.boh_promo_summary && `Promos/BOH: ${s.boh_promo_summary}`,
          s.notes && `Notes: ${s.notes}`,
          s.action_plan_summary && `Action Plan: ${s.action_plan_summary}`,
          s.hiring_notes && `Hiring: ${s.hiring_notes}`,
          s.tm_mots_of_note && `Team Notes: ${s.tm_mots_of_note}`,
          s.ai_summary && `Summary: ${s.ai_summary}`,
          s.actual_food_cost_pct != null && `Actual FC%: ${s.actual_food_cost_pct}`,
          s.budget_food_cost_pct != null && `Budget FC%: ${s.budget_food_cost_pct}`,
          s.labour_cost_pct != null && `Labour%: ${s.labour_cost_pct}`,
        ];
        return parts.filter(Boolean).join("\n");
      })
      .join("\n\n---\n\n");

    const systemPrompt = `You are an executive culinary operations writer for a multi-unit restaurant group.

Your task is to review:
1. The full weekly chef summary
2. Consolidated financial results
3. Leadership notes provided by the VP Culinary / leadership team

Then produce:
* ONE opening statement
* ONE closing statement

The tone must be:
* Professional
* Direct
* Confident
* Supportive
* Accountability-driven
* Operationally sharp

The writing should sound like a strong restaurant operator speaking to chefs and culinary leaders — not corporate HR language.

IMPORTANT RULES:
* Keep openings to 2–4 short paragraphs maximum
* Keep closings concise and motivational
* Do not repeat detailed financial metrics already shown elsewhere in the report
* Focus on operational themes, momentum, opportunities, accountability, and team recognition
* Reinforce execution standards, labour discipline, food quality, cleanliness, leadership, and guest experience
* Mention weather, holidays, patio season, menu launches, or operational context if relevant
* Celebrate wins without sounding overly enthusiastic or exaggerated
* Address misses calmly and professionally without sounding negative
* Never fabricate results or add assumptions
* Use concise restaurant-industry language
* Avoid clichés, generic business jargon, or AI-sounding phrasing

OPENING STATEMENT GOALS:
* Set the tone for the week
* Highlight major wins/challenges
* Reinforce operational priorities
* Recognize team effort where appropriate
* Create urgency around opportunities
* Sound like leadership speaking to experienced chefs/operators

CLOSING STATEMENT GOALS:
* Reinforce focus areas for the upcoming week
* Encourage strong execution
* Emphasize standards and accountability
* Thank the team where appropriate
* End with confidence and momentum

STYLE EXAMPLES:
Good: "Weather ahead looks strong — let's stay ahead on staffing and execution to maximize the opportunity."
Good: "Several locations made meaningful progress on labour this week while maintaining strong guest experience."
Good: "The focus now shifts to consistency, prep discipline, and tightening execution heading into the weekend."
Avoid: "Amazing job team!", "Let's crush it!", "Synergies", "Best-in-class", "Game changer"

OUTPUT FORMAT (use these exact labels, nothing else):
Opening Statement:
[Final polished opening — 2–4 short paragraphs, plain text, no markdown]

Closing Statement:
[Final polished closing — concise, plain text, no markdown]`;

    const userContent = `Generate the opening and closing statements for FY${fiscalYear} Period ${period} Week ${week}.

[FULL WEEKLY CHEF SUMMARY]
${chefSummaryText || "No chef summaries available."}

[CONSOLIDATED RESULTS]
${consolidatedText || "No consolidated P&L data available."}

[LEADERSHIP NOTES]
${leadershipNotes?.trim() || "No leadership notes provided."}`;

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
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          max_tokens: 800,
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
    const raw = openaiData.choices?.[0]?.message?.content?.trim() || "";

    // Parse out Opening and Closing from the response
    const openingMatch = raw.match(/Opening Statement:\s*([\s\S]*?)(?=Closing Statement:|$)/i);
    const closingMatch = raw.match(/Closing Statement:\s*([\s\S]*?)$/i);

    const opening = openingMatch ? openingMatch[1].trim() : raw;
    const closing = closingMatch ? closingMatch[1].trim() : "";

    return new Response(
      JSON.stringify({ opening, closing }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-executive-statements:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
