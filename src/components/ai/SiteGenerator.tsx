import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageRenderer } from "./PageRenderer";
import { GeneratedSite } from "@/types/site";
import { z } from "zod";

const SiteSchema = z.object({
  title: z.string(),
  theme: z.enum(["green", "light", "dark"]).optional(),
  sections: z
    .array(
      z.discriminatedUnion("type", [
        z.object({
          type: z.literal("hero"),
          headline: z.string(),
          subheadline: z.string().optional(),
          ctaLabel: z.string().optional(),
        }),
        z.object({
          type: z.literal("features"),
          title: z.string().optional(),
          items: z.array(
            z.object({
              title: z.string(),
              description: z.string(),
              icon: z.string().optional(),
            })
          ),
        }),
        z.object({
          type: z.literal("testimonial"),
          quote: z.string(),
          author: z.string(),
        }),
        z.object({
          type: z.literal("cta"),
          headline: z.string(),
          ctaLabel: z.string().optional(),
        }),
      ])
    )
    .min(1),
});

const DEFAULT_MODEL = "gemini-2.5-flash"; // configurable

function cleanToJson(text: string) {
  // Remove code fences if present
  return text
    .replace(/^```json\n?/i, "")
    .replace(/^```\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
}

export function SiteGenerator() {
  const [apiKey, setApiKey] = useState<string>("");
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const [prompt, setPrompt] = useState<string>(
    "A clean product landing page for a sustainable AI website builder named 'root'. Focus on clarity, 3 feature cards, one testimonial, and a strong call-to-action."
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [site, setSite] = useState<GeneratedSite | null>(null);

  // Load from localStorage
  useEffect(() => {
    const storedKey = localStorage.getItem("gemini_api_key");
    if (storedKey) setApiKey(storedKey);
    const storedModel = localStorage.getItem("gemini_model");
    if (storedModel) setModel(storedModel);
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (apiKey) localStorage.setItem("gemini_api_key", apiKey);
  }, [apiKey]);
  useEffect(() => {
    if (model) localStorage.setItem("gemini_model", model);
  }, [model]);

  const systemPrompt = useMemo(
    () =>
      `You are an expert product designer and front-end architect. Generate only JSON, no prose. The JSON must conform to this TypeScript type without extra fields:

type HeroSection = { type: "hero"; headline: string; subheadline?: string; ctaLabel?: string };
type FeaturesSection = { type: "features"; title?: string; items: { title: string; description: string; icon?: string }[] };
type TestimonialSection = { type: "testimonial"; quote: string; author: string };
type CtaSection = { type: "cta"; headline: string; ctaLabel?: string };
export type GeneratedSite = { title: string; theme?: "green"|"light"|"dark"; sections: Array<HeroSection|FeaturesSection|TestimonialSection|CtaSection> };

Constraints:
- title must be short and brandable
- theme should be "green" by default
- Provide EXACTLY one hero, one features section (3 items), optionally one testimonial, and one cta.
- No markdown fences. Output pure JSON.`,
    []
  );

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      if (!apiKey) {
        throw new Error(
          "Missing API key. For security, enter your Gemini API key locally."
        );
      }

      const userInstruction = `${prompt}`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          model
        )}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              { role: "user", parts: [{ text: systemPrompt }] },
              { role: "user", parts: [{ text: userInstruction }] },
            ],
            generationConfig: {
              temperature: 0.6,
              maxOutputTokens: 1200,
            },
          }),
        }
      );

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Gemini error: ${res.status} ${txt}`);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text as
        | string
        | undefined;
      if (!text) throw new Error("No content returned by model");

      const jsonText = cleanToJson(text);
      const parsed = SiteSchema.parse(JSON.parse(jsonText)) as GeneratedSite;
      setSite(parsed);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to generate site");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="py-8">
      <div className="section-container">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>AI Generator Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiKey">Gemini API key (stored locally)</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Enter your key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  aria-label="Gemini API key"
                />
                <p className="text-xs text-muted-foreground">
                  Your key is kept in your browser only. For production, use a
                  secure backend proxy (e.g., Supabase Edge Functions).
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  aria-label="Model name"
                />
                <p className="text-xs text-muted-foreground">
                  Example: gemini-2.5-flash (default), gemini-2.0-flash
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Describe the website you want to create</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Textarea
                  rows={6}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe your site: purpose, audience, features..."
                  aria-label="Website description"
                />
                <div className="flex gap-3">
                  <Button variant="hero" size="lg" onClick={handleGenerate} disabled={loading}>
                    {loading ? "Generating..." : "Generate Website"}
                  </Button>
                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {site && (
          <div className="mt-10">
            <PageRenderer site={site} />
          </div>
        )}
      </div>
    </section>
  );
}
