// Client-side bid exports for a success story. Works in both build modes (no
// backend rendering). The data passed in determines the detail level, so an
// admin export (with clientName) is full and a public export is anonymized.
//   - PDF : a clean, single A4 one-pager (prints via the browser dialog)
//   - PPTX: an editable, non-overlapping 16:9 title slide
import { escapeHtml } from './util.js';
import logoLight from '../assets/brand/endava-logo-light.svg?url';

const BRAND = '#ff5640';
const INK = '#192b37';

function clientOf(story) {
  return story.clientName || story.clientAlias || 'Client';
}
function trunc(text, n) {
  const s = String(text || '').trim();
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
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

// Single-page (flowing) branded one-pager, printed via the browser dialog.
export function exportStoryPdf(story) {
  const w = window.open('', '_blank');
  if (!w) return;
  const client = clientOf(story);
  const meta = [client, story.industry, story.duration].filter(Boolean).join(' · ');
  const doc = `<!doctype html><html><head><meta charset="utf-8">
<title>${escapeHtml(story.title)} — Endava success story</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: "Dava Sans","Helvetica Neue",Helvetica,Arial,sans-serif; color: ${INK}; margin: 0; }
  .sheet { padding: 0; }
  header { display:flex; align-items:center; justify-content:space-between;
    border-bottom: 4px solid ${BRAND}; padding-bottom: 12px; margin-bottom: 18px; }
  header img { height: 30px; }
  header .kicker { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color:#8c959b; }
  h1 { font-size: 26px; margin: 0 0 4px; letter-spacing:-.01em; }
  .meta { color:#5e6a73; font-size: 13px; margin-bottom: 14px; }
  .metrics { display:flex; gap: 22px; margin: 14px 0 6px; flex-wrap: wrap; }
  .metric b { display:block; font-size: 22px; color: ${BRAND}; line-height:1.1; }
  .metric span { font-size: 12px; color:#5e6a73; }
  .lead { font-size: 14px; font-weight: 500; }
  section { margin-top: 14px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing:.08em; color:${BRAND}; margin:0 0 4px; }
  p { margin: 0 0 8px; font-size: 13px; line-height: 1.5; }
  .tags { margin-top: 14px; }
  .tags span { display:inline-block; background:#e8eaeb; border-radius:999px; padding:2px 9px; font-size:11px; margin:0 4px 4px 0; }
  @media screen { body { background:#f3f3f4; } .sheet { max-width: 800px; margin: 16px auto; background:#fff; box-shadow:0 6px 24px rgba(0,0,0,.15); padding:32px; } }
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
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };</script>
</body></html>`;
  w.document.open();
  w.document.write(doc);
  w.document.close();
}

// Editable 16:9 deck as a real .pptx (pptxgenjs, loaded on demand). Long
// sections flow across multiple slides so nothing is clipped.
export async function exportStoryPptx(story) {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'WIDE', width: 13.33, height: 7.5 });
  pptx.layout = 'WIDE';

  // Branded chrome shared by every slide.
  const header = (slide) => {
    slide.background = { color: '192B37' };
    slide.addShape(pptx.ShapeType.rect, { x: 0.6, y: 0.55, w: 1.2, h: 0.12, fill: { color: 'FF5640' } });
    slide.addText('ENDAVA  ·  SUCCESS STORY', {
      x: 0.6, y: 0.72, w: 12.1, h: 0.3, fontFace: 'Arial', fontSize: 11, color: 'A3AAAF', charSpacing: 2,
    });
  };

  // --- cover slide ---
  const cover = pptx.addSlide();
  header(cover);
  cover.addText(trunc(story.title || 'Success story', 90), {
    x: 0.6, y: 1.15, w: 12.1, h: 1.0, fontFace: 'Arial', fontSize: 30, bold: true, color: 'FFFFFF', valign: 'top',
  });
  const meta = [clientOf(story), story.industry, story.duration].filter(Boolean).join('    ·    ');
  cover.addText(meta, { x: 0.6, y: 2.2, w: 12.1, h: 0.4, fontFace: 'Arial', fontSize: 14, color: 'A3AAAF' });
  (story.metrics || []).slice(0, 4).forEach((m, i) => {
    const x = 0.6 + i * 3.1;
    cover.addText(trunc(m.value, 12), { x, y: 2.95, w: 3, h: 0.55, fontFace: 'Arial', fontSize: 26, bold: true, color: 'FF5640' });
    cover.addText(trunc(m.label, 28), { x, y: 3.55, w: 3, h: 0.4, fontFace: 'Arial', fontSize: 12, color: 'D1D5D7' });
  });
  if (story.summary) {
    cover.addText(trunc(story.summary, 300), {
      x: 0.6, y: 4.5, w: 12.1, h: 2.2, fontFace: 'Arial', fontSize: 16, color: 'E8EAEB', valign: 'top', lineSpacingMultiple: 1.2,
    });
  }

  // --- section slides, paginated so text never overflows the content box ---
  const CONTENT = { x: 0.6, y: 1.7, w: 12.1, h: 5.0 };
  const CHARS_PER_LINE = 95; // approx wrapped width at Arial 16 in 12.1"
  const LINES_PER_SLIDE = 20;

  // Break a body into slide-sized chunks (arrays of source lines).
  const chunk = (body) => {
    const pages = [];
    let cur = [];
    let used = 0;
    for (const raw of String(body).replace(/\r/g, '').split('\n')) {
      const cost = Math.max(1, Math.ceil(raw.length / CHARS_PER_LINE));
      if (used + cost > LINES_PER_SLIDE && cur.length) {
        pages.push(cur);
        cur = [];
        used = 0;
      }
      cur.push(raw);
      used += cost;
    }
    if (cur.length) pages.push(cur);
    return pages.length ? pages : [['']];
  };

  const sections = [
    ['Challenge', story.challenge],
    ['Solution', story.solution],
    ['Results', story.results],
  ].filter(([, v]) => String(v || '').trim());

  for (const [name, body] of sections) {
    const pages = chunk(body);
    pages.forEach((linesForPage, i) => {
      const slide = pptx.addSlide();
      header(slide);
      slide.addText(i === 0 ? name : `${name} (cont.)`, {
        x: 0.6, y: 1.05, w: 12.1, h: 0.5, fontFace: 'Arial', fontSize: 20, bold: true, color: 'FF5640',
      });
      slide.addText(linesForPage.join('\n'), {
        ...CONTENT, fontFace: 'Arial', fontSize: 16, color: 'E8EAEB', valign: 'top', lineSpacingMultiple: 1.2,
      });
    });
  }

  const safe = (story.title || 'success-story').replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-|-$/g, '');
  await pptx.writeFile({ fileName: `${safe || 'success-story'}.pptx` });
}
