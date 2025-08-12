import type { GeneratedSite } from "@/types/site";
import JSZip from "jszip";

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "site";
}

export function filenameForSite(site: GeneratedSite): string {
  return `${slugify(site.title || "site")}.html`;
}

export function buildStandaloneHtml(site: GeneratedSite): string {
  const title = escapeHtml(site.title || "Site");
  const theme = site.theme ?? "green";

  // Minimal standalone CSS (no Tailwind)
  const css = `:root{--bg:#ffffff;--fg:#0b1220;--brand:#1f8f4a;--brand-strong:#1aa052;--muted:#4a5a6a;--card:#ffffff;--border:#e3efe7;--radius:12px}@media(prefers-color-scheme:dark){:root{--bg:#0b1210;--fg:#f7faf8;--brand:#22b15b;--brand-strong:#27c566;--muted:#9fb3a6;--card:#0e1713;--border:#1e2a24}}*{box-sizing:border-box}html,body{height:100%}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif}a{color:inherit}img{max-width:100%;display:block}button{font:inherit}
.container{max-width:1080px;margin-inline:auto;padding:0 24px}
.hero{position:relative;overflow:hidden;padding:72px 0}
.hero .glow{position:absolute;inset:-120px;background:radial-gradient(600px 240px at 50% 0%, rgba(34,177,91,0.2), transparent 70%);filter:blur(20px);pointer-events:none}
.hero h1{font-size:clamp(32px,6vw,56px);line-height:1.1;margin:0;background:linear-gradient(135deg,var(--brand),var(--brand-strong));-webkit-background-clip:text;background-clip:text;color:transparent}
.hero p{margin:16px auto 0;max-width:720px;color:var(--muted);font-size:18px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;height:44px;padding:0 20px;border-radius:12px;border:1px solid var(--border);background:linear-gradient(135deg,var(--brand),var(--brand-strong));color:white;box-shadow:0 10px 30px -12px rgba(34,177,91,0.45);cursor:pointer;transition:transform .12s ease,filter .2s ease}
.btn:hover{filter:brightness(1.05)}
.section{padding:72px 0}
.card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);box-shadow:0 10px 30px -12px rgba(34,177,91,0.25);padding:24px}
.grid{display:grid;gap:20px}
.grid-3{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.center{text-align:center}
.h2{font-size:28px;margin:0 0 24px}
.quote{font-size:22px;margin:0}
.author{margin-top:12px;color:var(--muted)}\n`;

  const sectionsHtml = site.sections
    .map((section) => {
      if (section.type === "hero") {
        return `<section class="hero"><div class="glow"></div><div class="container center"><h1>${escapeHtml(
          section.headline
        )}</h1>${section.subheadline ? `<p>${escapeHtml(
          section.subheadline
        )}</p>` : ""}${section.ctaLabel ? `<div style="margin-top:28px"><button class="btn">${escapeHtml(
          section.ctaLabel
        )}</button></div>` : ""}</div></section>`;
      }
      if (section.type === "features") {
        const items = section.items
          .map(
            (item) =>
              `<article class="card"><h3 style="margin:0 0 8px;font-size:18px">${escapeHtml(
                item.title
              )}</h3><p style="margin:0;color:var(--muted)">${escapeHtml(
                item.description
              )}</p></article>`
          )
          .join("");
        return `<section class="section"><div class="container">${section.title ? `<h2 class="h2">${escapeHtml(
          section.title
        )}</h2>` : ""}<div class="grid grid-3">${items}</div></div></section>`;
      }
      if (section.type === "testimonial") {
        return `<section class="section"><div class="container"><figure class="card center"><blockquote class="quote">“${escapeHtml(
          section.quote
        )}”</blockquote><figcaption class="author">— ${escapeHtml(
          section.author
        )}</figcaption></figure></div></section>`;
      }
      if (section.type === "cta") {
        return `<section class="section"><div class="container center"><h2 class="h2">${escapeHtml(
          section.headline
        )}</h2>${section.ctaLabel ? `<div style="margin-top:16px"><button class="btn">${escapeHtml(
          section.ctaLabel
        )}</button></div>` : ""}</div></section>`;
      }
      return "";
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <title>${title}</title>
    <style>${css}</style>
  </head>
  <body>
    ${sectionsHtml}
  </body>
</html>`;
}

function buildStylesCss(): string {
  return `/* Project styles */\n/* You can split this file as needed. */\n`;
}

function buildScriptJs(): string {
  return `// Optional interactivity can be added here.\n// Example: smooth scroll for same-page anchors.\n(function(){\n  document.addEventListener('click', function(e){\n    const a = e.target instanceof Element ? e.target.closest('a[href^="#"]') : null;\n    if(!a) return;\n    const id = a.getAttribute('href');\n    if(!id || id.length < 2) return;\n    const el = document.querySelector(id);\n    if(!el) return;\n    e.preventDefault();\n    el.scrollIntoView({behavior:'smooth'});\n  });\n})();\n`;
}

export async function buildProjectZip(site: GeneratedSite): Promise<Blob> {
  const zip = new JSZip();
  const projectSlug = slugify(site.title || "site");

  // Files
  const fullHtml = buildStandaloneHtml(site);
  const bodyOpen = fullHtml.indexOf("<body>");
  const bodyClose = fullHtml.lastIndexOf("</body>");
  const bodyContent = bodyOpen !== -1 && bodyClose !== -1 && bodyClose > bodyOpen
    ? fullHtml.substring(bodyOpen + "<body>".length, bodyClose)
    : "";
  const indexHtml = `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <title>${escapeHtml(site.title || "Site")}</title>\n    <link rel="stylesheet" href="styles.css" />\n  </head>\n  <body>\n    ${bodyContent}\n    <script src="script.js"></script>\n  </body>\n</html>`;

  zip.file("index.html", indexHtml);
  zip.file("styles.css", buildStylesCss());
  zip.file("script.js", buildScriptJs());
  zip.file("site.json", JSON.stringify(site, null, 2));
  zip.file("README.md", `# ${escapeHtml(site.title || "Site")}\n\nGenerated with root dev.\n\n- Open \`index.html\` in your browser.\n- Edit \`styles.css\` and \`script.js\` to customize.\n- Site structure is mirrored from \`site.json\`.\n`);

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  return blob;
}