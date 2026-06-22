// Client-side bid exports for a success story. Works in both build modes (no
// backend rendering). The data passed in determines the detail level, so an
// admin export (with clientName) is full and a public export is anonymized.
import { escapeHtml } from './util.js';
import logoLight from '../assets/brand/endava-logo-light.svg?url';

const BRAND = '#ff5640';
const INK = '#192b37';

function clientOf(story) {
  return story.clientName || story.clientAlias || 'Client';
}

function para(text) {
  return escapeHtml(String(text || ''))
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function metricsHtml(story) {
  if (!story.metrics?.length) return '';
  return `<div class="metrics">${story.metrics
    .map((m) => `<div class="metric"><b>${escapeHtml(m.value)}</b><span>${escapeHtml(m.label)}</span></div>`)
    .join('')}</div>`;
}

function tagsHtml(story) {
  if (!story.tags?.length) return '';
  return `<div class="tags">${story.tags.map((t) => `<span>${escapeHtml(t.value)}</span>`).join('')}</div>`;
}

function section(title, body) {
  return body ? `<section><h2>${title}</h2>${para(body)}</section>` : '';
}

// One-page PDF via a print window (A4) + a 16:9 slide page.
export function exportStoryPdf(story) {
  const w = window.open('', '_blank');
  if (!w) return;
  const client = clientOf(story);
  const meta = [client, story.industry, story.duration].filter(Boolean).join(' · ');
  const doc = `<!doctype html><html><head><meta charset="utf-8">
<title>${escapeHtml(story.title)} — Endava success story</title>
<style>
  @page { margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "Dava Sans","Helvetica Neue",Helvetica,Arial,sans-serif; color: ${INK}; margin: 0; }
  .sheet { padding: 0 0 24px; }
  header { display:flex; align-items:center; justify-content:space-between;
    border-bottom: 4px solid ${BRAND}; padding-bottom: 12px; margin-bottom: 18px; }
  header img { height: 30px; }
  header .kicker { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color:#8c959b; }
  h1 { font-size: 26px; margin: 0 0 4px; letter-spacing:-.01em; }
  .meta { color:#5e6a73; font-size: 13px; margin-bottom: 16px; }
  .metrics { display:flex; gap: 18px; margin: 14px 0 6px; flex-wrap: wrap; }
  .metric b { display:block; font-size: 24px; color: ${BRAND}; }
  .metric span { font-size: 12px; color:#5e6a73; }
  .lead { font-size: 14px; }
  section { margin-top: 14px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing:.08em; color:${BRAND}; margin:0 0 4px; }
  p { margin: 0 0 8px; font-size: 13px; line-height: 1.5; }
  .tags { margin-top: 12px; }
  .tags span { display:inline-block; background:#e8eaeb; border-radius:999px; padding:2px 9px; font-size:11px; margin:0 4px 4px 0; }
  .slide { page-break-before: always; background:${INK}; color:#fff; padding: 8% 7%; min-height: 90vh; }
  .slide .bar { width:64px; height:6px; background:${BRAND}; margin-bottom: 18px; }
  .slide h1 { color:#fff; font-size: 34px; }
  .slide .meta { color:#a3aaaf; }
  .slide .metric b { color:#fff; }
  .slide .metric span { color:#a3aaaf; }
  @media screen { body { background:#f3f3f4; } .sheet,.slide { max-width: 800px; margin: 16px auto; background:#fff; box-shadow:0 6px 24px rgba(0,0,0,.15);} .sheet{padding:32px;} }
</style></head><body>
  <div class="sheet">
    <header>
      <img src="${logoLight}" alt="Endava">
      <span class="kicker">Success story</span>
    </header>
    <h1>${escapeHtml(story.title)}</h1>
    <div class="meta">${escapeHtml(meta)}</div>
    ${metricsHtml(story)}
    ${story.summary ? `<p class="lead">${escapeHtml(story.summary)}</p>` : ''}
    ${section('Challenge', story.challenge)}
    ${section('Solution', story.solution)}
    ${section('Results', story.results)}
    ${tagsHtml(story)}
  </div>
  <div class="slide">
    <div class="bar"></div>
    <h1>${escapeHtml(story.title)}</h1>
    <div class="meta">${escapeHtml(meta)}</div>
    ${metricsHtml(story)}
    ${story.summary ? `<p class="lead">${escapeHtml(story.summary)}</p>` : ''}
  </div>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };</script>
</body></html>`;
  w.document.open();
  w.document.write(doc);
  w.document.close();
}

// Editable 16:9 slide as a real .pptx (pptxgenjs, loaded on demand).
export async function exportStoryPptx(story) {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'WIDE', width: 13.33, height: 7.5 });
  pptx.layout = 'WIDE';
  const slide = pptx.addSlide();
  slide.background = { color: '192B37' };
  slide.addShape(pptx.ShapeType.rect, { x: 0.6, y: 0.6, w: 1.2, h: 0.12, fill: { color: 'FF5640' } });
  slide.addText('ENDAVA · SUCCESS STORY', { x: 0.6, y: 0.78, w: 12, h: 0.3, fontFace: 'Arial', fontSize: 11, color: 'A3AAAF', charSpacing: 2 });
  slide.addText(story.title || 'Success story', { x: 0.6, y: 1.2, w: 12, h: 1, fontFace: 'Arial', fontSize: 30, bold: true, color: 'FFFFFF' });
  const meta = [clientOf(story), story.industry, story.duration].filter(Boolean).join('   ·   ');
  slide.addText(meta, { x: 0.6, y: 2.1, w: 12, h: 0.4, fontFace: 'Arial', fontSize: 14, color: 'A3AAAF' });

  (story.metrics || []).slice(0, 4).forEach((m, i) => {
    const x = 0.6 + i * 3.1;
    slide.addText(String(m.value || ''), { x, y: 2.9, w: 3, h: 0.6, fontFace: 'Arial', fontSize: 26, bold: true, color: 'FF5640' });
    slide.addText(String(m.label || ''), { x, y: 3.5, w: 3, h: 0.4, fontFace: 'Arial', fontSize: 12, color: 'D1D5D7' });
  });

  const bullets = [
    story.challenge && `Challenge: ${story.challenge}`,
    story.solution && `Solution: ${story.solution}`,
    story.results && `Results: ${story.results}`,
  ].filter(Boolean);
  if (bullets.length) {
    slide.addText(bullets.map((t) => ({ text: String(t).slice(0, 220), options: { bullet: true } })), {
      x: 0.6, y: 4.4, w: 12, h: 2.4, fontFace: 'Arial', fontSize: 13, color: 'E8EAEB', lineSpacingMultiple: 1.1,
    });
  }
  const safe = (story.title || 'success-story').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  await pptx.writeFile({ fileName: `${safe}.pptx` });
}
