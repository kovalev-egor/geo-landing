import assert from "node:assert/strict";
import { applyTemplate, escapeHtml } from "../functions/_lib/html.js";
import { resolveContent, safeHero } from "../functions/_lib/content.js";
import { resolveGeo } from "../functions/_lib/geo.js";
import { readCookie, resolveVariant } from "../functions/_lib/cookies.js";
import { conversion } from "../functions/_lib/db.js";

const config = {
  variants: {
    A: {
      default: { headline: "Default", cta: "Go", hero: "/landings/landing-1/images/hero-a.svg" },
      geo: {
        US: { headline: "United States", proof: "Ships from the U.S." },
        "US-CA": { headline: "California", hero: "/landings/landing-1/images/hero-ca.svg" },
        DE: { headline: "Deutschland" },
      },
    },
    B: {
      default: { headline: "Shorter", cta: "Buy", hero: "/landings/landing-1/images/hero-b.svg" },
    },
  },
};

assert.equal(resolveContent(config, "A", "XX", "").headline, "Default");
assert.equal(resolveContent(config, "A", "DE", "").headline, "Deutschland");
assert.equal(resolveContent(config, "A", "US", "").headline, "United States");
assert.equal(resolveContent(config, "A", "US", "").proof, "Ships from the U.S.");
assert.equal(resolveContent(config, "A", "US", "CA").headline, "California");
assert.equal(resolveContent(config, "A", "US", "CA").proof, "Ships from the U.S.");
assert.equal(resolveContent(config, "A", "US", "CA").hero, "/landings/landing-1/images/hero-ca.svg");
assert.equal(resolveContent(config, "B", "DE", "").headline, "Shorter");
assert.equal(resolveContent(config, "B", "FR", "").cta, "Buy");

assert.equal(safeHero("/landings/landing-1/images/hero-a.svg", "landing-1"), "/landings/landing-1/images/hero-a.svg");
assert.equal(safeHero("https://evil.example/a.svg", "landing-1"), "");
assert.equal(safeHero("/landings/landing-2/images/hero-a.svg", "landing-1"), "");

const escaped = applyTemplate("<h1>{{headline}}</h1>{{preview}}", {
  headline: `<script>alert("x")</script>`,
  preview: "<b>ok</b>",
});
assert.equal(escaped, "<h1>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</h1><b>ok</b>");
assert.equal(escapeHtml(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");

const previewRequest = new Request("https://landings.test/l/landing-1?country=DE&region=BE&city=Berlin");
const previewGeo = resolveGeo(previewRequest, true);
assert.deepEqual(previewGeo, { country: "DE", region: "BE", city: "Berlin" });

const ignored = resolveGeo(previewRequest, false);
assert.equal(ignored.country, "XX");

const cfRequest = new Request("https://landings.test/l/landing-1");
cfRequest.cf = { country: "JP", regionCode: "13", city: "Tokyo" };
assert.deepEqual(resolveGeo(cfRequest, false), { country: "JP", region: "13", city: "Tokyo" });

const cookieRequest = new Request("https://landings.test/l/landing-1", {
  headers: { cookie: "glab_landing-1=B" },
});
assert.equal(readCookie(cookieRequest, "glab_landing-1"), "B");
assert.equal(resolveVariant(cookieRequest, "landing-1", false).variant, "B");
assert.equal(resolveVariant(cookieRequest, "landing-1", false).cookie, null);

const forced = resolveVariant(new Request("https://landings.test/l/landing-1?variant=A"), "landing-1", true);
assert.equal(forced.variant, "A");
assert.equal(forced.cookie, null);

const fresh = resolveVariant(new Request("https://landings.test/l/landing-1"), "landing-1", false);
assert.match(fresh.variant, /^[AB]$/);
assert.match(fresh.cookie, /Max-Age=2592000/);
assert.match(fresh.cookie, /HttpOnly/);

assert.equal(conversion(0, 0), null);
assert.equal(conversion(4, 1), 25);
assert.equal(conversion(3, 1), 33.3);

console.log("content, geo, variant, and conversion checks passed");
