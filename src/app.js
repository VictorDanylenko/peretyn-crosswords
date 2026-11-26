import { generate, validate, key } from './generator.js';
import { makePDF, download } from './pdf.js';

const $ = selector => document.querySelector(selector);
const storageKey = 'peretyn-creator-v2';
const blankRow = id => ({id,word:'',clue:''});
const defaultName = 'Мій кросворд';
let rows = [], title = '', puzzle = null, zoom = 1, generating = false;
let noticeTimer;

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}
function readRows(entries) {
  if (!Array.isArray(entries) || entries.length > 60 || entries.some(row =>
    typeof row?.word !== 'string' || typeof row.clue !== 'string')) throw Error('Файл має містити до 60 пар «слово й запитання» у списку entries.');
  return entries.map(({word,clue},i) => ({id:i+1,word,clue}));
}
function material() {
  return rows.filter(row => row.word.trim() || row.clue.trim());
}
function isOriginalExample(entries, name) {
  if (entries.length !== 19 || name !== 'Основи психодіагностики') return false;
  // Fingerprint of the original, untouched example. Modified dictionaries are user work.
  let hash = 2166136261;
  for (const ch of JSON.stringify(entries.map(row => [row.word,row.clue]))) {
    hash = Math.imul(hash ^ ch.charCodeAt(0),16777619);
  }
  return (hash >>> 0) === 1062223346;
}
function restore() {
  try {
    let saved = JSON.parse(localStorage.getItem(storageKey));
    if (!saved) {
      const legacy = JSON.parse(localStorage.getItem('peretyn-v1'));
      if (!legacy) return;
      const source = legacy.draft || legacy;
      const entries = readRows(source.entries);
      if (!legacy.draft && isOriginalExample(entries,source.title)) return;
      saved = {entries,title:source.title,seed:legacy.draft ? null : legacy.puzzle?.seed};
    }
    rows = readRows(saved.entries);
    title = String(saved.title ?? '').slice(0,100);
    if (Number.isFinite(saved.seed) && !validate(material()).length) {
      const previous = generate(material(),{seed:saved.seed});
      if (!previous.omitted.length) puzzle = previous;
    }
  } catch { /* An unreadable local save must not prevent opening the editor. */ }
}
function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({title,entries:rows,seed:puzzle?.seed ?? null}));
  } catch { notice('Автозбереження недоступне. Збережіть словник у JSON.'); }
}
function notice(message) {
  clearTimeout(noticeTimer);
  $('#notice').textContent = message;
  noticeTimer = setTimeout(() => { $('#notice').textContent = ''; },4500);
}
function updateControls() {
  $('#word-count').textContent = rows.filter(row => row.word.trim()).length;
  $('#generate').disabled = generating || material().length < 2;
  $('#generate').textContent = generating ? 'Шукаємо перетини…' : 'Згенерувати сітку';
  $('#export-top').disabled = !puzzle || generating;
  $('#json').disabled = !material().length && !title;
  $('#add').disabled = rows.length >= 60;
  $('#new').disabled = !title && !material().length;
}
function renderRows(openId) {
  if (!rows.length) rows.push(blankRow(1));
  $('#title').value = title;
  $('#editor-list').innerHTML = rows.map((row,i) => `
    <details class="entry" data-row="${row.id}" ${row.id === openId || (rows.length === 1 && !row.word) ? 'open' : ''}>
      <summary><span class="index">${i+1}</span><strong>${escapeHTML(row.word || 'Нове слово')}</strong><span aria-hidden="true" class="chevron"></span></summary>
      <div class="fields">
        <label>Слово<input data-field="word" maxlength="24" value="${escapeHTML(row.word)}" autocomplete="off" placeholder="Введіть слово"></label>
        <label>Запитання<textarea data-field="clue" maxlength="500" rows="2" placeholder="Як його відгадати?">${escapeHTML(row.clue)}</textarea></label>
        <button class="delete">Видалити слово</button>
      </div>
    </details>`).join('');
  updateControls();
}
function setZoom(value) {
  zoom = Math.max(1,Math.min(2,value));
  $('#grid').style.setProperty('--zoom',zoom);
  $('#smaller').disabled = zoom === 1;
  $('#larger').disabled = zoom === 2;
}
function renderPreview() {
  $('#empty-preview').hidden = !!puzzle;
  $('#grid').hidden = $('#preview-meta').hidden = $('#preview-clues').hidden = !puzzle;
  const grid = $('#grid');
  if (!puzzle) {
    grid.replaceChildren();
    $('#preview-clues').replaceChildren();
    return;
  }
  const cells = new Map(puzzle.cells.map(c => [key(c.x,c.y),c]));
  grid.style.setProperty('--cols',puzzle.width);
  grid.setAttribute('aria-label','Сітка зі словами, '+puzzle.width+' на '+puzzle.height+'.');
  grid.innerHTML = Array.from({length:puzzle.width*puzzle.height},(_,i) => {
    const c = cells.get(key(i % puzzle.width, Math.floor(i / puzzle.width)));
    if (!c) return '<div></div>';
    return '<div class="cell">'+(c.number ? '<small>'+c.number+'</small>' : '')+escapeHTML(c.char)+'</div>';
  }).join('');
  $('#dimensions').textContent = 'Розмір сітки · '+puzzle.width+' × '+puzzle.height;
  $('#preview-clues').innerHTML = ['across','down'].map(dir => '<section><h3>'+
    (dir === 'across' ? 'За горизонталлю' : 'За вертикаллю')+'</h3><ol>'+
    puzzle.placed.filter(p => p.dir === dir).map(p => '<li value="'+p.number+'">'+escapeHTML(p.clue)+'</li>').join('')+'</ol></section>').join('');
  setZoom(1);
}
function edited() {
  if (puzzle) { puzzle = null; renderPreview(); }
  $('#validation').textContent = '';
  updateControls();
  persist();
}
async function rebuild() {
  if (generating) return;
  const problems = validate(material());
  $('#validation').textContent = problems[0] || '';
  if (problems.length) return;
  generating = true;
  updateControls();
  try {
    await new Promise(resolve => setTimeout(resolve,25));
    const next = generate(material());
    if (next.omitted.length) {
      $('#validation').textContent = 'Не вдалося з’єднати слова: '+next.omitted.map(row => row.word).join(', ')+'. Змініть словник або спробуйте ще раз.';
      return;
    }
    puzzle = next;
    renderPreview();
    persist();
    notice('Кросворд готовий до експорту.');
    if (matchMedia('(max-width: 780px)').matches) $('#preview').scrollIntoView({block:'start'});
  } catch(error) { $('#validation').textContent = error.message; }
  finally { generating = false; updateControls(); }
}
function dialog(heading,body) {
  $('#dialog-heading').textContent = heading;
  $('#dialog-body').innerHTML = body;
  $('#dialog').showModal();
}
$('#close').onclick = () => $('#dialog').close();
$('#help').onclick = () => dialog('Як створити кросворд','<ol><li>Введіть назву, додайте слова із запитаннями або імпортуйте словник JSON.</li><li>Натисніть «Згенерувати сітку». Слова мають утворювати зв’язану сітку через спільні літери.</li><li>Перегляньте перетини й нумерацію. «Експорт у PDF» готує аркуші для друку та, за бажанням, окремий ключ.</li></ol>');
$('#new').onclick = () => {
  dialog('Почати новий кросворд?','<p>Поточну чернетку буде замінено. Щоб повернутися до неї пізніше, збережіть словник у JSON.</p><div class="actions"><button id="cancel" class="secondary">Скасувати</button><button id="confirm" class="primary">Створити новий</button></div>');
  $('#cancel').onclick = () => $('#dialog').close();
  $('#confirm').onclick = () => {
    $('#dialog').close();
    title = ''; rows = []; puzzle = null;
    renderRows(); renderPreview(); edited();
    $('#title').focus();
  };
};
$('#title').oninput = event => { title = event.target.value; updateControls(); persist(); };
$('#editor-list').oninput = event => {
  const field = event.target.dataset.field;
  if (!field) return;
  const details = event.target.closest('.entry');
  const row = rows.find(r => r.id === Number(details.dataset.row));
  row[field] = field === 'word' ? event.target.value.toLocaleUpperCase('uk-UA') : event.target.value;
  if (field === 'word') details.querySelector('strong').textContent = row.word || 'Нове слово';
  edited();
};
$('#editor-list').onclick = event => {
  if (!event.target.closest('.delete')) return;
  const id = Number(event.target.closest('.entry').dataset.row);
  rows = rows.filter(r => r.id !== id);
  renderRows(); edited();
};
$('#add').onclick = () => {
  const id = Math.max(0,...rows.map(r => r.id))+1;
  rows.push(blankRow(id));
  renderRows(id);
  $('.entry:last-child input').focus();
  persist();
};
$('#generate').onclick = rebuild;
$('#larger').onclick = () => setZoom(zoom+.25);
$('#smaller').onclick = () => setZoom(zoom-.25);
$('#import').onclick = () => $('#import-file').click();
$('#import-file').onchange = async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 200000) throw Error('Оберіть файл розміром до 200 КБ.');
    const data = JSON.parse(await file.text());
    const imported = readRows(data?.entries);
    title = String(data.title ?? '').slice(0,100);
    rows = imported;
    renderRows(rows[0]?.id); edited();
    if (!validate(material()).length) await rebuild();
    else notice('Чернетку імпортовано. Доповніть словник для генерації.');
  } catch(error) { $('#validation').textContent = error.message; }
  finally { event.target.value = ''; }
};
$('#json').onclick = () => download(new Blob([JSON.stringify({title,entries:material()},null,2)],{type:'application/json'}),'peretyn-words.json');
$('#export-top').onclick = () => {
  dialog('Експорт у PDF','<p>Аркуші A4 із порожньою сіткою та запитаннями.</p><label class="option"><input type="checkbox" id="with-answers">Додати окремий PDF із відповідями</label><button id="download-pdf" class="primary">Завантажити PDF</button><p id="pdf-error" role="alert"></p>');
  $('#download-pdf').onclick = async () => {
    const button = $('#download-pdf'), withAnswers = $('#with-answers').checked;
    button.disabled = true;
    try {
      download(await makePDF(puzzle,title.trim() || defaultName), 'peretyn-crossword.pdf');
      if (withAnswers) download(await makePDF(puzzle,title.trim() || defaultName,{answers:true}), 'peretyn-answers.pdf');
      $('#dialog').close();
    } catch(error) { $('#pdf-error').textContent = error.message; button.disabled = false; }
  };
};
restore();
renderRows(rows[0]?.id);
renderPreview();
