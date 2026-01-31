// Jesse Chapter Factory - Cloudflare Worker
// Serves ready-to-paste context prompts for chapter writing sessions
// D1 Database: jesse-chapter-factory (dd91a213-b881-4b01-88bb-0e90dc43c825)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    try {
      if (path === '/' || path === '/api') {
        return json({ service: 'Jesse Chapter Factory', endpoints: {
          '/api/context/:book_slug/:chapter_number': 'GET - Full chapter writing prompt',
          '/api/books': 'GET - List all books with status',
          '/api/chapters/:book_slug': 'GET - List chapters for a book',
          '/api/characters': 'GET - All characters',
          '/api/canon': 'GET - All canon facts',
          '/api/status': 'GET - Full project dashboard',
          '/api/master-context': 'GET - Complete project context (no chapter focus)',
          '/api/session': 'POST - Log a completed session',
          '/api/chapter/:id': 'PUT - Update chapter status/prose',
        }}, corsHeaders);
      }
      if (path === '/api/master-context') return json({ prompt: await buildMasterContext(env.DB) }, corsHeaders);
      if (path === '/api/status') return json(await getStatus(env.DB), corsHeaders);
      if (path === '/api/books') { const r = await env.DB.prepare('SELECT * FROM books ORDER BY series_order').all(); return json(r.results, corsHeaders); }
      if (path === '/api/characters') { const r = await env.DB.prepare('SELECT * FROM characters ORDER BY id').all(); return json(r.results, corsHeaders); }
      if (path === '/api/canon') { const r = await env.DB.prepare("SELECT * FROM canon_facts WHERE confidence = 'high' ORDER BY category").all(); return json(r.results, corsHeaders); }
      const chaptersMatch = path.match(/^\/api\/chapters\/([a-z-]+)$/);
      if (chaptersMatch) { const r = await env.DB.prepare('SELECT c.* FROM chapters c JOIN books b ON c.book_id = b.id WHERE b.slug = ? ORDER BY c.chapter_number').bind(chaptersMatch[1]).all(); return json(r.results, corsHeaders); }
      const contextMatch = path.match(/^\/api\/context\/([a-z-]+)\/(\d+)$/);
      if (contextMatch) { const prompt = await buildChapterContext(env.DB, contextMatch[1], parseInt(contextMatch[2])); return json({ prompt, book: contextMatch[1], chapter: parseInt(contextMatch[2]) }, corsHeaders); }
      if (path === '/api/session' && request.method === 'POST') {
        const body = await request.json();
        await env.DB.prepare('INSERT INTO sessions (book_id, chapter_id, session_type, output_summary, decisions_made, issues_found, next_steps) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(body.book_id, body.chapter_id, body.session_type || 'writing', body.output_summary, body.decisions_made, body.issues_found, body.next_steps).run();
        return json({ success: true }, corsHeaders);
      }
      const updateMatch = path.match(/^\/api\/chapter\/(\d+)$/);
      if (updateMatch && request.method === 'PUT') {
        const id = parseInt(updateMatch[1]); const body = await request.json(); const sets = []; const vals = [];
        for (const [k, v] of Object.entries(body)) { if (['status','prose','summary','word_count','title','notes','planning_locked','content_locked','final_locked'].includes(k)) { sets.push(`${k} = ?`); vals.push(v); } }
        if (sets.length > 0) { sets.push("updated_at = datetime('now')"); vals.push(id); await env.DB.prepare(`UPDATE chapters SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run(); }
        return json({ success: true, updated: sets.length }, corsHeaders);
      }
      return json({ error: 'Not found' }, corsHeaders, 404);
    } catch (err) { return json({ error: err.message }, corsHeaders, 500); }
  }
};

function json(data, corsHeaders, status = 200) {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function buildMasterContext(db) {
  const books = await db.prepare('SELECT * FROM books ORDER BY series_order').all();
  const characters = await db.prepare('SELECT * FROM characters ORDER BY id').all();
  const canon = await db.prepare("SELECT * FROM canon_facts WHERE confidence = 'high' ORDER BY category").all();
  const chapters = await db.prepare('SELECT c.*, b.slug as book_slug FROM chapters c JOIN books b ON c.book_id = b.id ORDER BY b.series_order, c.chapter_number').all();
  let p = `# JESSE ADVENTURES — MASTER PROJECT CONTEXT\n# Generated: ${new Date().toISOString()}\n\n---\n\n## WHO YOU ARE WORKING FOR\nMichael (michael@bermech.com). Autonomous execution preferred. Skip explanations. Use tools first. Irish, expects natural profanity in content.\n\n---\n\n## TONE RULES (NON-NEGOTIABLE)\n- Authentic Irish dialogue with natural profanity\n- Adult humor that undercuts emotional moments\n- No saccharine family dynamics\n- Comedy over sentiment, always\n- No inspirational speeches unless immediately undercut\n\n---\n\n## BOOKS\n\n`;
  for (const book of books.results) {
    const bc = chapters.results.filter(c => c.book_slug === book.slug);
    p += `### Book ${book.series_order}: ${book.title} [${book.status.toUpperCase()}]\n${book.summary}\nChapters: ${bc.length} total | ${bc.filter(c=>c.status==='complete').length} complete | ${bc.filter(c=>c.status==='complete_corrupted').length} corrupted | ${bc.filter(c=>c.status==='written_unextracted').length} unextracted | ${bc.filter(c=>c.status==='outlined').length} outlined\n\n`;
  }
  p += `---\n\n## CHARACTERS\n\n`;
  for (const c of characters.results) { p += `**${c.name}** (${c.species}, ${c.role}${c.family_role ? ', '+c.family_role : ''})\n${c.personality}\nSpeech: ${c.speech_pattern}\nQuirks: ${c.quirks}\n\n`; }
  p += `---\n\n## CANON FACTS\n\n`;
  let lc = ''; for (const f of canon.results) { if (f.category !== lc) { p += `### ${f.category.toUpperCase()}\n`; lc = f.category; } p += `- ${f.fact} [${f.source_chapter}]\n`; }
  p += `\n---\n\n## CHAPTER INDEX\n\n`;
  let lb = ''; for (const ch of chapters.results) { if (ch.book_slug !== lb) { const bk = books.results.find(b=>b.slug===ch.book_slug); p += `\n### ${bk.title}\n| Ch | Title | Status | Summary |\n|---|---|---|---|\n`; lb = ch.book_slug; } p += `| ${ch.chapter_number} | ${ch.title||'TBD'} | ${ch.status} | ${(ch.summary||'').substring(0,80)} |\n`; }
  p += `\n---\n\n## INFRASTRUCTURE\n- Chapter Factory API: deployed on Cloudflare Workers\n- Supabase: Project ylcepmvbjjnwmzvevxid\n- n8n: https://n8n.bermech.com\n- GitHub: bermingham85/jesse-chapter-factory\n`;
  return p;
}

async function buildChapterContext(db, bookSlug, chapterNumber) {
  const book = await db.prepare('SELECT * FROM books WHERE slug = ?').bind(bookSlug).first();
  if (!book) throw new Error(`Book not found: ${bookSlug}`);
  const chapter = await db.prepare('SELECT * FROM chapters WHERE book_id = ? AND chapter_number = ?').bind(book.id, chapterNumber).first();
  if (!chapter) throw new Error(`Chapter ${chapterNumber} not found`);
  const prev = await db.prepare('SELECT chapter_number, title, status, summary, characters_present FROM chapters WHERE book_id = ? AND chapter_number < ? ORDER BY chapter_number').bind(book.id, chapterNumber).all();
  const next = await db.prepare('SELECT chapter_number, title, summary FROM chapters WHERE book_id = ? AND chapter_number = ?').bind(book.id, chapterNumber + 1).first();
  const names = (chapter.characters_present || '').split(',').map(s=>s.trim()).filter(Boolean);
  const allC = await db.prepare('SELECT * FROM characters ORDER BY id').all();
  const chars = allC.results.filter(c => names.length === 0 || names.some(n => c.name.toLowerCase().includes(n.toLowerCase())));
  const canon = await db.prepare("SELECT * FROM canon_facts WHERE confidence = 'high' AND (book_id = ? OR book_id IS NULL) ORDER BY category").bind(book.id).all();
  const lastSess = await db.prepare('SELECT * FROM sessions WHERE chapter_id = ? ORDER BY created_at DESC LIMIT 1').bind(chapter.id).first();
  let p = `# CHAPTER WRITING SESSION\n# Book: ${book.title} | Chapter ${chapterNumber}: ${chapter.title || 'TBD'}\n# Generated: ${new Date().toISOString()}\n\n---\n\n## YOUR TASK\nWrite Chapter ${chapterNumber} of "${book.title}".\n**Brief:** ${chapter.summary || 'Outline needed.'}\n${chapter.notes ? '**Notes:** ' + chapter.notes : ''}\n${chapter.location ? '**Location:** ' + chapter.location : ''}\n**Status:** ${chapter.status} | **Target:** 2,000-3,000 words\n\n---\n\n## TONE RULES\n${book.tone_notes}\n- Irish profanity natural\n- Comedy undercuts emotion\n- No saccharine\n\n---\n\n## CHARACTERS\n\n`;
  for (const c of chars) { p += `**${c.name}** (${c.species})\n${c.personality}\nSpeech: ${c.speech_pattern}\nQuirks: ${c.quirks}\n\n`; }
  p += `---\n\n## STORY SO FAR\n\n`;
  for (const pr of prev.results) { p += `**Ch ${pr.chapter_number}: ${pr.title||''}** [${pr.status}] ${pr.summary||''}\n\n`; }
  if (next) { p += `---\n\n## NEXT CHAPTER\nCh ${next.chapter_number}: ${next.title||'TBD'} — ${next.summary||'Not outlined.'}\n*End this chapter leading into above.*\n\n`; }
  p += `---\n\n## CANON\n\n`;
  let lc2 = ''; for (const f of canon.results) { if (f.category !== lc2) { p += `### ${f.category.toUpperCase()}\n`; lc2 = f.category; } p += `- ${f.fact}\n`; }
  if (lastSess) { p += `\n---\n\n## LAST SESSION\n${lastSess.output_summary||''}\n${lastSess.next_steps ? 'Next: '+lastSess.next_steps : ''}\n`; }
  p += `\n---\n\n## OUTPUT FORMAT\nWrite full chapter prose, then provide:\n1. SUMMARY: One paragraph\n2. CANON UPDATES: New facts established\n3. CONTINUITY NOTES: What next chapter must respect\n4. ISSUES: Contradictions or review items\n\nWhen done, update via API: PUT /api/chapter/${chapter.id}\n`;
  return p;
}

async function getStatus(db) {
  const books = await db.prepare('SELECT * FROM books ORDER BY series_order').all();
  const result = [];
  for (const book of books.results) {
    const ch = await db.prepare('SELECT chapter_number, title, status, planning_locked, content_locked, final_locked, word_count FROM chapters WHERE book_id = ? ORDER BY chapter_number').bind(book.id).all();
    const sess = await db.prepare('SELECT COUNT(*) as count FROM sessions WHERE book_id = ?').bind(book.id).first();
    result.push({ book: book.title, slug: book.slug, status: book.status, chapters: ch.results, total_chapters: ch.results.length, complete: ch.results.filter(c=>c.status==='complete').length, outlined: ch.results.filter(c=>c.status==='outlined').length, corrupted: ch.results.filter(c=>c.status==='complete_corrupted').length, unextracted: ch.results.filter(c=>c.status==='written_unextracted').length, sessions: sess?.count || 0 });
  }
  return result;
}
