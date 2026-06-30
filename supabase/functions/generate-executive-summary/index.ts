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
    const { section, fiscalYear, period, week, leadershipNotes } = await req.json();

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
      .select("*, locations!inner(name, code, exclude_from_reporting)")
      .eq("fiscal_year", fiscalYear)
      .eq("period_number", period)
      .eq("week_number", week)
      .eq("locations.exclude_from_reporting", false);

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

    const num = (v: any) => (v == null || v === "" || isNaN(parseFloat(v)) ? null : parseFloat(v));
    const pct = (v: any) => (num(v) == null ? null : `${num(v)!.toFixed(2)}%`);
    const money = (v: any) => (num(v) == null ? null : `$${Math.round(num(v)!).toLocaleString()}`);

    const summaryTexts = filteredSummaries
      .map((s: any) => {
        const fcVar = num(s.actual_food_cost_pct) != null && num(s.budget_food_cost_pct) != null
          ? (num(s.actual_food_cost_pct)! - num(s.budget_food_cost_pct)!).toFixed(2)
          : null;
        const labVar = num(s.labour_cost_pct) != null && num(s.labour_budget_pct) != null
          ? (num(s.labour_cost_pct)! - num(s.labour_budget_pct)!).toFixed(2)
          : null;
        const parts = [
          `Location: ${s.locations?.name || "Unknown"} (${s.locations?.code || ""})`,
          money(s.food_sales_labour_push) && `Food Sales (WTD): ${money(s.food_sales_labour_push)}`,
          pct(s.actual_food_cost_pct) && `Food Cost %: ${pct(s.actual_food_cost_pct)} (budget ${pct(s.budget_food_cost_pct) || "n/a"}${fcVar ? `, ${fcVar} pts` : ""})`,
          pct(s.labour_cost_pct) && `Labour %: ${pct(s.labour_cost_pct)} (budget ${pct(s.labour_budget_pct) || "n/a"}${labVar ? `, ${labVar} pts` : ""})`,
          money(s.boh_promo_amount) && `BOH Promos: ${money(s.boh_promo_amount)}`,
          s.food_cost_summary && `Food Cost notes: ${s.food_cost_summary}`,
          s.labour_summary && `Labour notes: ${s.labour_summary}`,
          s.boh_promo_summary && `Promo notes: ${s.boh_promo_summary}`,
          s.sales_action_plan && `Sales action plan: ${s.sales_action_plan}`,
          s.action_plan_summary && `Action plan: ${s.action_plan_summary}`,
          s.hiring_notes && `Hiring: ${s.hiring_notes}`,
          s.tm_mots_of_note && `Team members of note: ${s.tm_mots_of_note}`,
          s.development_path_updates && `Development: ${s.development_path_updates}`,
          s.rm_issues && `R&M issues: ${s.rm_issues}`,
          s.cleaning_focus && `Cleaning focus: ${s.cleaning_focus}`,
          num(s.last_audit_score_pct) && `Audit score: ${pct(s.last_audit_score_pct)}`,
          s.notes && `Other notes: ${s.notes}`,
          s.ai_summary && `Chef's own summary: ${s.ai_summary}`,
        ];
        return parts.filter(Boolean).join("\n");
      })
      .join("\n\n---\n\n");

    const sectionLabel =
      section === "executive_summary"
        ? "overall executive"
        : section.replace("_summary", "").replace("_", " ");

    const systemPrompt = `You are an executive culinary operations writer for a multi-unit Canadian restaurant group. Use Canadian spelling throughout ("Labour", "Colour", "Organise", "Licence").

Write a concise ${sectionLabel} summary for leadership for FY${fiscalYear} Period ${period} Week ${week}.

RULES:
- Ground every statement in the specific numbers and notes provided below — cite real figures (sales, food cost %, labour %, variances, audit scores) and name specific locations. Do not write generic filler.
- This is a weekly report, so it MUST read differently week to week. Reflect what is actually different this week; never recycle boilerplate.
- Where Leadership Notes are provided, treat them as the priorities to reinforce, and weave their themes through the summary.
- Cover: key performance vs budget, notable wins, misses/risks, and the concrete action items the chefs have committed to.
- Professional, direct, operationally sharp — like a strong operator speaking to chefs, not corporate HR language. No hype ("crush it", "best-in-class"), no clichés.
- 3-5 short paragraphs, plain text, no markdown or bullet points.
- Never fabricate numbers or facts not present in the data.`;

    const userContent = `[CHEF REPORTS]
${summaryTexts}

[LEADERSHIP NOTES — priorities to reinforce]
${leadershipNotes?.trim() || "None provided."}`;

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
          max_tokens: 600,
          temperature: 0.6,
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
