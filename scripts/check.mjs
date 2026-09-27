import assert from "node:assert/strict";
import { applyTemplate, escapeHtml } from "../functions/_lib/html.js";
import { resolveContent, safeHero } from "../functions/_lib/content.js";
import { resolveGeo } from "../functions/_lib/geo.js";
import { readCookie, resolveVariant } from "../functions/_lib/cookies.js";
import { conversion } from "../functions/_lib/db.js";
import { assignShares, encodeGeos, pickOffer, readStoredGeos, validateOfferUrl } from "../functions/_lib/offers.js";

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

const offers = [
  { id: "de", priority: 0, geos: ["DE"] },
  { id: "us", priority: 1, geos: ["US", "CA"] },
  { id: "world", priority: 2, geos: [] },
];
assert.equal(pickOffer(offers, "US").id, "us");
assert.equal(pickOffer(offers, "DE").id, "de");
assert.equal(pickOffer(offers, "FR").id, "world");

const stored = readStoredGeos(encodeGeos("deny", ["MX", "VN", "mx"]));
assert.equal(stored.mode, "deny");
assert.deepEqual(stored.codes, ["MX", "VN"]);
const routed = [
  { id: "of", priority: 0, geos: ["MX", "VN"], geoMode: "deny" },
  { id: "cam", priority: 1, geos: ["MX", "US"] },
  { id: "tg", priority: 2, geos: [] },
];
assert.equal(pickOffer(routed, "US").id, "of");
assert.equal(pickOffer(routed, "MX").id, "cam");
assert.equal(pickOffer(routed, "VN").id, "tg");
assert.equal(validateOfferUrl("telegram", "https://t.me/geo"), "https://t.me/geo");
assert.equal(validateOfferUrl("telegram", "https://example.com"), "");
assert.equal(validateOfferUrl("octocpa", "http://example.com/offer"), "");

const freshShare = assignShares([
  { id: "winner", clicks: 20, impressions: 200 },
  { id: "newbie", clicks: 0, impressions: 0 },
]);
const freshRatio = freshShare[1].share / freshShare[0].share;
assert.ok(freshRatio > 0.8 && freshRatio < 1.2, freshRatio);

const faded = assignShares([
  { id: "winner", clicks: 20, impressions: 200 },
  { id: "newbie", clicks: 0, impressions: 200 },
]);
assert.ok(faded[1].share < faded[0].share / 5);

const equal = assignShares([
  { id: "a", clicks: 0, impressions: 0 },
  { id: "b", clicks: 0, impressions: 0 },
]);
assert.equal(equal[0].share, equal[1].share);

const clicked = assignShares([
  { id: "a", clicks: 10, impressions: 200 },
  { id: "b", clicks: 2, impressions: 200 },
]);
assert.ok(clicked[0].share > clicked[1].share);

console.log("content, geo, variant, conversion, and offer checks passed");
