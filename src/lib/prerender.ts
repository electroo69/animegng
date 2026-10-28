// Pages served through the edge arrive pre-rendered (worker/seo.js): <div id="prerender"> inside #root, with
// the home page's first hero banner as <a class="pr-hero"><img></a>. Captured at module load, before React
// replaces #root's contents, so the home hero can adopt that same <img> element instead of creating a new one.
export const prerenderHeroImg = document.querySelector<HTMLImageElement>("#prerender .pr-hero img")
