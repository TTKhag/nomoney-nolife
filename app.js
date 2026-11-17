/* NOMONEY-NOLIFE UI (vanilla JS). Data: localStorage. Financial logic lives in core.js */
const KEY = 'nomoney-nolife-v1';
const BANKS = ['Vietcombank', 'VietinBank', 'BIDV', 'Agribank', 'Techcombank', 'MB Bank', 'ACB', 'VPBank', 'TPBank', 'Sacombank', 'HDBank', 'VIB', 'SHB', 'SeABank', 'OCB', 'MSB', 'Eximbank', 'LPBank', 'Nam A Bank', 'Bac A Bank', 'ABBank', 'VietBank', 'Kienlongbank', 'NCB', 'PVcomBank', 'BaoViet Bank', 'Cake', 'Timo', 'Khác'];
const NAV = { home: ['TRANG CHỦ', [['tq', 'TỔNG QUAN'], ['db', 'DASHBOARD']]], fin: ['TÀI CHÍNH', [['no', 'NỢ'], ['bd', 'BIẾN ĐỘNG'], ['du', 'DƯ']]], fc: ['DỰ KIẾN', [['no', 'NỢ DỰ KIẾN'], ['bd', 'BIẾN ĐỘNG DỰ KIẾN'], ['du', 'DƯ DỰ KIẾN']]], set: ['THIẾT LẬP', [['dm', 'DANH MỤC'], ['cn', 'CÁ NHÂN'], ['sl', 'SAO LƯU']]] };
const BD = [['ci', 'CHI ĐỊNH KỲ'], ['cp', 'CHI PHÁT SINH'], ['ti', 'THU ĐỊNH KỲ'], ['tp', 'THU PHÁT SINH'], ['lend', 'CHI VAY'], ['tv', 'THU VAY']];
let S = load(), ui = { bd: 'ci', fcDate: addDays(today(), 30) };
function load() { try { const o = JSON.parse(localStorage.getItem(KEY)); if (o && validBackup(o)) return o; } catch (e) { } return defState(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { alert('Không thể lưu dữ liệu vào trình duyệt.'); } };
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); }
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' ₫';
const money = n => `<span class="${n < 0 ? 'neg' : ''}">${fmt(n)}</span>`;
const dmy = d => d ? d.split('-').reverse().join('/') : '';
const accName = id => { if (id == 'cash') return 'Tiền mặt'; const b = S.banks.find(b => b.id == id); return b ? b.name + (b.note ? ' · ' + b.note : '') : '(đã xóa)'; };
const dLabel = d => `${d.type == 'bank' ? 'NH' : 'TM'} · ${d.name}${d.info ? ' · ' + d.info : ''} (#${d.id.slice(-4)})`;
const accOpts = () => [['cash', 'Tiền mặt'], ...S.banks.map(b => [b.id, 'NH · ' + accName(b.id)])];
const debtOpts = () => S.debts.map(d => [d.id, dLabel(d)]);
const catOpts = t => S.cats[t].map(c => [c, c]);

/* ---------- state mutation with validation (rollback on any error) ---------- */
function mutate(fn) {
  const c = JSON.parse(JSON.stringify(S));
  try { fn(c); const e = validate(c); if (e) throw e; } catch (e) { return typeof e == 'string' ? e : 'Lỗi: ' + e.message; }
  S = c; save(); render(); return null;
}

/* ---------- modal form ---------- */
function ask(title, fields, cb, vals = {}) {
  const dlg = document.getElementById('dlg');
  const val = f => vals[f.n] ?? f.v ?? '';
  dlg.innerHTML = `<form method="dialog"><h3>${esc(title)}</h3>${fields.map(f => `<div data-f="${f.n}"><label>${f.l}</label>${f.t == 'select' ? `<select name="${f.n}">${f.o.map(([v, l]) => `<option value="${esc(v)}" ${v == val(f) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>` : f.t == 'textarea' ? `<textarea name="${f.n}" rows="2">${esc(val(f))}</textarea>` : `<input name="${f.n}" type="${f.t || 'text'}" value="${esc(val(f))}" ${f.t == 'number' ? 'min="0" step="any"' : ''} ${f.max ? 'max="' + f.max + '"' : ''}>`}</div>`).join('')}
  <div class="err"></div><div class="row"><button type="button" class="g" id="x">HỦY</button><button>LƯU</button></div></form>`;
  enhance(dlg);
  const form = dlg.querySelector('form'), get = () => Object.fromEntries(fields.map(f => [f.n, f.t == 'number' ? (form[f.n].value === '' ? NaN : +form[f.n].value) : form[f.n].value.trim()]));
  const vis = () => { const v = get(); fields.forEach(f => { dlg.querySelector(`[data-f="${f.n}"]`).style.display = !f.show || f.show(v) ? '' : 'none'; }); };
  form.oninput = form.onchange = vis; vis();
  dlg.querySelector('#x').onclick = () => dlg.close();
  form.onsubmit = ev => {
    ev.preventDefault(); const v = get(); fields.forEach(f => { if (f.show && !f.show(v)) v[f.n] = f.t == 'number' ? 0 : ''; });
    const bad = fields.find(f => (!f.show || f.show(v)) && f.req && (f.t == 'number' ? isNaN(v[f.n]) || v[f.n] <= 0 : !v[f.n]));
    const e = bad ? `Vui lòng nhập hợp lệ: ${bad.l}.` : cb(v);
    if (e) dlg.querySelector('.err').textContent = e; else dlg.close();
  };
  dlg.showModal();
}
const show = (title, html) => { const d = document.getElementById('dlg'); d.innerHTML = `<h3>${title}</h3>${html}<div class="row"><button class="g" onclick="dlg.close()">ĐÓNG</button></div>`; d.showModal(); };
const tbl = (h, rows, empty = 'Chưa có dữ liệu.') => rows.length ? `<div class="wrap"><table><tr>${h.map(x => `<th class="${x[0] == '#' ? 'n' : ''}">${x.replace(/^#/, '')}</th>`).join('')}</tr>${rows.join('')}</table></div>` : `<div class="empty">${empty}</div>`;
const tr = (cells, cls = '') => `<tr class="${cls}">${cells.map((c, i) => `<td class="${/^<span class="(neg)?">[-\d]/.test(c) || /^#/.test(c) ? 'n' : ''}">${c.replace?.(/^#/, '') ?? c}</td>`).join('')}</tr>`;
const btn = (t, fn, cls = 'g s') => `<button class="${cls}" onclick="${fn}">${t}</button>`;
const ico = d => `<span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d == 'in' ? 'M6 6l12 12M18 9v9H9' : 'M6 18L18 6M9 6h9v9'}"/></svg></span>`;
const kpi = (l, v, i) => `<div class="k ${i ? 'i' : ''}">${i ? ico(i) : ''}<small>${l}</small><b>${v}</b></div>`;
const safeImg = u => /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(u || '') ? u : '';
const KN = { ci: 'Chi định kỳ', cp: 'Chi phát sinh', ti: 'Thu định kỳ', tp: 'Thu phát sinh', lend: 'Cho vay', collect: 'Thu cho vay', borrow: 'Nhận vay', repay: 'Trả nợ' };
/* custom dropdowns: the native <select> stays hidden as the source of truth */
const closeDd = () => document.querySelectorAll('.dd.open').forEach(d => d.classList.remove('open'));
function enhance(root) {
  root.querySelectorAll('select:not([data-dd])').forEach(sel => {
    sel.dataset.dd = 1; sel.classList.add('hid');
    const w = document.createElement('div'); w.className = 'dd'; w.innerHTML = '<button type="button" class="ddb"></button><ul></ul>'; sel.after(w);
    const b = w.firstChild, ul = w.lastChild;
    const sync = () => { b.textContent = sel.selectedOptions[0]?.textContent || '—'; ul.innerHTML = [...sel.options].map(o => `<li data-v="${esc(o.value)}" class="${o.selected ? 'on' : ''}">${esc(o.textContent)}</li>`).join(''); };
    sync();
    b.onclick = e => { e.stopPropagation(); e.preventDefault(); const o = w.classList.contains('open'); closeDd(); if (!o) w.classList.add('open'); };
    ul.onclick = e => { const li = e.target.closest('li'); if (!li) return; sel.value = li.dataset.v; sync(); w.classList.remove('open'); sel.dispatchEvent(new Event('change', { bubbles: true })); };
  });
}
document.addEventListener('click', closeDd);

/* ---------- transactions ---------- */
function txFields(kind) {
  const dt = { n: 'date', l: 'NGÀY', t: 'date', req: 1, max: today(), v: today() }, am = { n: 'amount', l: 'SỐ TIỀN (₫)', t: 'number', req: 1 };
  const src = [{ n: 'src', l: 'NGUỒN TIỀN', t: 'select', o: [['bal', 'DƯ'], ['debt', 'NỢ']] }, { n: 'acc', l: 'TÀI KHOẢN DƯ', t: 'select', o: accOpts(), show: v => v.src == 'bal' }, { n: 'debt', l: 'TÀI KHOẢN NỢ', t: 'select', o: debtOpts(), show: v => v.src == 'debt', req: 1 }];
  if (kind == 'ci' || kind == 'cp') return [dt, am, { n: 'cat', l: 'DANH MỤC', t: 'select', o: catOpts('exp'), req: 1 }, { n: 'desc', l: 'MÔ TẢ', req: kind == 'cp' }, ...src, ...(kind == 'cp' ? [{ n: 'note', l: 'GHI CHÚ', t: 'textarea' }] : [])];
  if (kind == 'ti' || kind == 'tp') return [dt, am, { n: 'cat', l: 'DANH MỤC', t: 'select', o: catOpts('inc'), req: 1 }, ...(kind == 'tp' ? [{ n: 'desc', l: 'MÔ TẢ', req: 1 }] : []), { n: 'acc', l: 'CỘNG VÀO', t: 'select', o: accOpts() }];
  if (kind == 'lend') return [{ n: 'borrower', l: 'NGƯỜI VAY', req: 1 }, { n: 'contact', l: 'THÔNG TIN LIÊN HỆ' }, am, dt, { n: 'due', l: 'NGÀY HẸN TRẢ', t: 'date' }, { n: 'note', l: 'GHI CHÚ', t: 'textarea' }];
  if (kind == 'collect') return [{ n: 'lendId', l: 'KHOẢN CHO VAY', t: 'select', o: S.tx.filter(t => t.kind == 'lend' && lendLeft(S, t.id) > 0.5).map(t => [t.id, `${t.borrower} · còn ${fmt(lendLeft(S, t.id))} (${dmy(t.date)})`]), req: 1 }, am, dt, { n: 'acc', l: 'CỘNG VÀO', t: 'select', o: accOpts() }];
  if (kind == 'borrow') return [dt, am, { n: 'fee', l: 'PHÍ / CHI PHÍ VAY (₫)', t: 'number' }, { n: 'debt', l: 'CHỦ NỢ', t: 'select', o: [...debtOpts(), ['new', '+ Tạo chủ nợ mới']] }, ...debtAcctFields(v => v.debt == 'new'), { n: 'acc', l: 'NHẬN VÀO', t: 'select', o: accOpts() }, { n: 'note', l: 'GHI CHÚ', t: 'textarea' }];
  if (kind == 'repay') return [{ n: 'debt', l: 'TÀI KHOẢN NỢ', t: 'select', o: debtOpts(), req: 1 }, am, dt, { n: 'acc', l: 'TRẢ TỪ', t: 'select', o: accOpts() }];
}
function debtAcctFields(sh = () => true) {
  return [{ n: 'dtype', l: 'LOẠI NỢ', t: 'select', o: [['bank', 'NỢ NGÂN HÀNG / TÍN DỤNG'], ['cash', 'NỢ TIỀN MẶT']], show: sh },
  { n: 'bank', l: 'NGÂN HÀNG', t: 'select', o: BANKS.map(b => [b, b]), show: v => sh(v) && v.dtype == 'bank' },
  { n: 'dname', l: 'TÊN CHỦ NỢ / TÊN NGÂN HÀNG', req: 1, show: v => sh(v) && (v.dtype == 'cash' || v.bank == 'Khác') },
  { n: 'info', l: 'THÔNG TIN (SĐT, 4 số cuối thẻ, ...)', show: sh }, { n: 'rate', l: 'LÃI SUẤT (%/NĂM)', t: 'number', show: sh }];
}
const newDebt = v => ({ id: uid(), type: v.dtype, name: v.dtype == 'bank' && v.bank != 'Khác' ? v.bank : v.dname, info: v.info, rate: v.rate || 0, extra: 0 });
function txForm(kind, id) {
  const old = id && S.tx.find(t => t.id == id); const f = txFields(kind);
  if (kind == 'collect' && !f[0].o.length && !old) return alert('Chưa có khoản cho vay nào còn phải thu.');
  if ((kind == 'repay' || ((kind == 'ci' || kind == 'cp') && false)) && !S.debts.length) return alert('Hãy tạo tài khoản nợ trước (TÀI CHÍNH › NỢ).');
  if ((kind == 'ci' || kind == 'cp') && !S.cats.exp.length || (kind == 'ti' || kind == 'tp') && !S.cats.inc.length) return alert('Hãy tạo danh mục trong THIẾT LẬP › DANH MỤC.');
  const t = { ci: 'CHI ĐỊNH KỲ', cp: 'CHI PHÁT SINH', ti: 'THU ĐỊNH KỲ', tp: 'THU PHÁT SINH', lend: 'CHI VAY', collect: 'THU TIỀN CHO VAY', borrow: 'NHẬN TIỀN VAY', repay: 'TRẢ NỢ' }[kind];
  ask((old ? 'SỬA · ' : 'THÊM · ') + t, f, v => {
    if (v.date && v.date > today()) return 'Không được nhập ngày trong tương lai (dùng DỰ KIẾN).';
    const x = { ...(old || {}), ...v, kind }; if (kind == 'lend' && v.due && v.due < v.date) return 'Ngày hẹn trả phải sau ngày cho vay.';
    if ((kind == 'ci' || kind == 'cp') && v.src == 'debt' && !S.debts.length) return 'Chưa có tài khoản nợ.';
    ['dtype', 'bank', 'dname', 'info', 'rate'].forEach(k => delete x[k]); if (kind == 'ci' || kind == 'cp') { if (x.src == 'debt') delete x.acc; else delete x.debt; }
    return mutate(c => { if (old) delTx(c, id); if (kind == 'borrow' && v.debt == 'new') { const d = newDebt(v); c.debts.push(d); x.debt = d.id; } addTx(c, x); });
  }, old ? { ...old, fee: old.fee } : {});
}
const delT = id => { if (confirm('Xóa giao dịch này? Các số dư và nợ liên quan sẽ được tính lại.')) { const e = mutate(c => delTx(c, id)); if (e) alert(e); } };
const txSrc = t => t.src == 'debt' ? `<span class="tag">NỢ</span> ${esc(dLabel(S.debts.find(d => d.id == t.debt) || { type: 'cash', name: '(đã xóa)', id: '    ' }))}` : (t.kind == 'ci' || t.kind == 'cp') ? `<span class="tag">DƯ</span> ${esc(accName(t.acc))}` : esc(accName(t.acc));
const acts = t => btn('Sửa', `txForm('${t.kind}','${t.id}')`) + ' ' + btn('Xóa', `delT('${t.id}')`);
const byDate = a => [...a].sort((x, y) => y.date.localeCompare(x.date));

/* ---------- pages ---------- */
const deco = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="30"/><circle cx="50" cy="50" r="12"/><path d="M50 0v24M50 76v24M0 50h24M76 50h24"/></svg>`;
function pgTq() {
  const c = calc(S), p = project(S, ui.fcDate), pr = S.profile, cv = safeImg(pr.cover), av = safeImg(pr.avatar);
  const hr = new Date().getHours(), g = hr < 11 ? 'Chào buổi sáng' : hr < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  const recent = byDate(S.tx).slice(0, 7), inc = t => ['ti', 'tp', 'collect', 'borrow'].includes(t.kind);
  const owed = sum(S.tx.filter(t => t.kind == 'lend'), t => lendLeft(S, t.id));
  return `<section class="cover" style="${cv ? `background-image:url(${cv})` : ''}">${cv ? '' : deco}</section>
  <div class="prof"><div class="avatar"><div>${av ? `<img src="${av}" alt="">` : esc((pr.name || 'N')[0].toUpperCase())}</div></div>
  <div class="meta"><h1>${g}${pr.name ? ', ' + esc(pr.name) : ''}</h1><p>${esc(pr.note) || 'Cập nhật ảnh đại diện, ảnh bìa và ghi chú trong THIẾT LẬP › CÁ NHÂN.'}</p></div></div>
  <div class="hero"><small>TÀI SẢN RÒNG</small><div class="big">${money(c.net)}</div></div>
  ${p.has ? `<div class="sec">TÀI SẢN RÒNG DỰ KIẾN · ${dmy(ui.fcDate)}: <b>${money(p.net)}</b></div>` : ''}
  <div class="split"><div><h2>TỔNG QUAN</h2><div class="grid">${kpi('TỔNG DƯ', money(c.total))}${kpi('TỔNG NỢ THỰC TẾ', money(c.da))}${kpi('TIỀN MẶT', money(c.cash))}${kpi('NGÂN HÀNG', money(c.bank))}</div>
  <h2>TỔNG NỢ</h2><div class="grid">${kpi('NỢ GỐC', money(c.dp))}${kpi('LÃI & ĐIỀU CHỈNH', money(c.di))}${kpi('NỢ THỰC TẾ', money(c.da))}${kpi('CHO VAY CÒN PHẢI THU', money(owed))}</div></div>
  <div><h2>GẦN ĐÂY</h2>${tbl(['NGÀY', 'LOẠI', '#SỐ TIỀN'], recent.map(t => tr([dmy(t.date), KN[t.kind], '#' + `<span class="${inc(t) ? '' : ''}">${inc(t) ? '+' : t.src == 'debt' ? '' : '−'}${fmt(t.amount)}</span>`])), 'Chưa có giao dịch.')}</div></div>`;
}
const RANGES = [['3', '3 THÁNG'], ['6', '6 THÁNG'], ['12', '12 THÁNG'], ['0', 'TẤT CẢ']];
ui.f = { range: '6', acc: 'all', cat: 'all' };
const selF = (opts, cur, key) => `<select onchange="ui.f.${key}=this.value;render()">${opts.map(([v, l]) => `<option value="${esc(v)}" ${v == cur ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
function pgDb() {
  const c = calc(S), p = project(S, ui.fcDate), f = ui.f, flow = S.tx.filter(t => ['ci', 'cp', 'ti', 'tp'].includes(t.kind));
  const key = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), now = new Date();
  let n = +f.range; if (!n) { const first = flow.map(t => t.date).sort()[0]; n = first ? Math.min(24, Math.max(3, (now.getFullYear() - +first.slice(0, 4)) * 12 + now.getMonth() - +first.slice(5, 7) + 2)) : 6; }
  const months = Array.from({ length: n }, (_, i) => key(new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1))), from = months[0] + '-01';
  const rows = flow.filter(t => t.date >= from && (f.acc == 'all' || (f.acc == 'debt' ? t.src == 'debt' : t.acc == f.acc && t.src != 'debt')) && (f.cat == 'all' || t.cat == f.cat));
  const isI = t => t.kind[0] == 't', I = rows.filter(isI), E = rows.filter(t => !isI(t));
  const inc = months.map(m => sum(I.filter(t => t.date.startsWith(m)), t => t.amount)), exp = months.map(m => sum(E.filter(t => t.date.startsWith(m)), t => t.amount));
  const mx = Math.max(1, ...inc, ...exp), H = 170, W = 1000, slot = (W - 20) / n, bw = Math.min(34, slot * .3);
  const bars = months.map((m, i) => { const x = 10 + i * slot + slot / 2 - bw - 2, h1 = inc[i] / mx * H, h2 = exp[i] / mx * H; return `<rect x="${x}" y="${H + 10 - h1}" width="${bw}" height="${h1}" fill="#000"/><rect x="${x + bw + 4}" y="${H + 10 - h2}" width="${bw}" height="${h2}" fill="#fff" stroke="#000" stroke-width="2"/><text x="${x + bw + 2}" y="${H + 28}" font-size="12" text-anchor="middle" fill="#6b6b6b">${m.slice(5)}/${m.slice(2, 4)}</text>`; }).join('');
  const grp = L => { const o = {}; L.forEach(t => o[t.cat] = (o[t.cat] || 0) + t.amount); return Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 6); };
  const bar = (l, v, w) => `<div style="margin:12px 0"><div style="display:flex;justify-content:space-between;font-size:12px;gap:8px"><span>${l}</span><b>${fmt(v)}</b></div><div style="height:8px;background:var(--soft);margin-top:5px"><div style="height:8px;width:${Math.max(0, v) / w * 100}%;background:#000;transition:width .5s var(--ease)"></div></div></div>`;
  const list = (L, e) => L.length ? L.map(([k, v]) => bar(esc(k), v, L[0][1])).join('') : '<div class="empty">Không có dữ liệu.</div>';
  const tot = Math.max(c.total, c.da, 1), allCats = [...new Set([...S.cats.exp, ...S.cats.inc])];
  return `<div class="hero"><small>TÀI SẢN RÒNG</small><div class="big">${money(c.net)}</div></div>${p.has ? `<div class="sec">DỰ KIẾN ${dmy(ui.fcDate)}: <b>${money(p.net)}</b></div>` : ''}
  <div class="filters"><span class="fl">BỘ LỌC</span><div class="bar chips" style="margin:0">${RANGES.map(([v, l]) => `<button class="${f.range == v ? 'on' : ''}" onclick="ui.f.range='${v}';render()">${l}</button>`).join('')}</div>
  ${selF([['all', 'TẤT CẢ TÀI KHOẢN'], ...accOpts(), ['debt', 'NGUỒN NỢ']], f.acc, 'acc')}${selF([['all', 'TẤT CẢ DANH MỤC'], ...allCats.map(c => [c, c])], f.cat, 'cat')}
  <button class="g s" onclick="ui.f={range:'6',acc:'all',cat:'all'};render()">ĐẶT LẠI</button></div>
  <div class="grid">${kpi('THU', money(sum(I, t => t.amount)), 'in')}${kpi('CHI', money(sum(E, t => t.amount)), 'out')}${kpi('CHÊNH LỆCH', money(sum(I, t => t.amount) - sum(E, t => t.amount)))}${kpi('SỐ GIAO DỊCH', rows.length)}</div>
  <div class="cols3"><div><h2>DƯ VÀ NỢ</h2>${bar('Tổng dư', c.total, tot)}${bar('Nợ thực tế', c.da, tot)}${bar('Tiền mặt', c.cash, tot)}${bar('Ngân hàng', c.bank, tot)}</div>
  <div><h2>CHI THEO DANH MỤC</h2>${list(grp(E))}</div><div><h2>THU THEO DANH MỤC</h2>${list(grp(I))}</div></div>
  <h2>THU / CHI THEO THÁNG · ■ THU □ CHI</h2><div class="wrap"><svg viewBox="0 0 ${W} ${H + 40}" style="width:100%;min-width:520px"><line x1="0" x2="${W}" y1="${H + 10}" y2="${H + 10}" stroke="#000" stroke-width="2"/>${bars}</svg></div>`;
}
const noGroup = (t, title) => {
  const rows = calc(S).debts.filter(x => x.d.type == t).map(x => tr([esc(x.d.name) + (x.d.info ? `<br><small>${esc(x.d.info)}</small>` : '') + ` <small>#${x.d.id.slice(-4)}</small>`, '#' + (x.d.rate || 0) + '%', '#' + fmt(x.p), '#' + fmt(x.x), '#<b>' + fmt(x.a) + '</b>',
    btn('Trả nợ', `txForm('repay')`) + ' ' + btn('Nợ thực tế', `editActual('${x.d.id}')`) + ' ' + btn('Tính lãi', `calcInt('${x.d.id}')`) + ' ' + btn('Sửa', `editDebt('${x.d.id}')`) + ' ' + btn('Xóa', `delDebt('${x.d.id}')`)]));
  return `<h2>${title}</h2>` + tbl(['CHỦ NỢ', '#LÃI/NĂM', '#GỐC (CHỈ ĐỌC)', '#LÃI & ĐIỀU CHỈNH', '#THỰC TẾ', ''], rows, 'Chưa có tài khoản nợ.');
};
function pgNo() {
  const c = calc(S), rep = byDate(S.tx.filter(t => t.kind == 'repay'));
  return `<div class="grid">${kpi('TỔNG NỢ GỐC', money(c.dp))}${kpi('TỔNG LÃI', money(c.di))}${kpi('TỔNG NỢ THỰC TẾ', money(c.da))}</div>
  <div class="bar" style="margin-top:16px">${btn('+ TÀI KHOẢN NỢ', 'addDebt()', '')} ${btn('TRẢ NỢ', "txForm('repay')", '')}</div>
  ${noGroup('bank', 'NỢ TÍN DỤNG / NGÂN HÀNG')}${noGroup('cash', 'NỢ TIỀN MẶT')}
  <h2>LỊCH SỬ TRẢ NỢ</h2>${tbl(['NGÀY', 'CHỦ NỢ', '#SỐ TIỀN', 'TRẢ TỪ', ''], rep.map(t => tr([dmy(t.date), esc(dLabel(S.debts.find(d => d.id == t.debt))), '#' + fmt(t.amount), esc(accName(t.acc)), acts(t)])))}`;
}
const addDebt = () => ask('THÊM TÀI KHOẢN NỢ', debtAcctFields(), v => mutate(c => c.debts.push(newDebt(v))));
function editDebt(id) { const d = S.debts.find(d => d.id == id); ask('SỬA TÀI KHOẢN NỢ', [{ n: 'dname', l: 'TÊN' }, { n: 'info', l: 'THÔNG TIN' }, { n: 'rate', l: 'LÃI SUẤT (%/NĂM)', t: 'number' }], v => mutate(c => { const x = c.debts.find(d => d.id == id); x.name = v.dname || x.name; x.info = v.info; x.rate = v.rate || 0; }), { dname: d.name, info: d.info, rate: d.rate }); }
function delDebt(id) {
  if (S.tx.some(t => t.debt == id) || S.fc.some(f => f.debt == id)) return alert('Tài khoản nợ đã có giao dịch tham chiếu nên không thể xóa (tránh sai lệch lịch sử).');
  if (confirm('Xóa tài khoản nợ này?')) mutate(c => c.debts = c.debts.filter(d => d.id != id));
}
function editActual(id) {
  const x = calc(S).debts.find(x => x.d.id == id);
  ask('NỢ THỰC TẾ · GỐC ' + fmt(x.p), [{ n: 'a', l: 'NỢ THỰC TẾ (≥ NỢ GỐC)', t: 'number', req: 1 }], v => v.a < x.p - 0.5 ? 'Nợ thực tế không được thấp hơn nợ gốc.' : mutate(c => c.debts.find(d => d.id == id).extra = Math.round(v.a - x.p)), { a: x.a });
}
function calcInt(id) {
  const d = S.debts.find(d => d.id == id);
  ask('TÍNH LÃI · ' + d.name, [{ n: 'rate', l: 'LÃI SUẤT (%/NĂM)', t: 'number', req: 1 }, { n: 'from', l: 'TỪ NGÀY', t: 'date', req: 1 }, { n: 'to', l: 'ĐẾN NGÀY', t: 'date', req: 1 }], v => {
    if (v.to < v.from) return 'Ngày kết thúc phải sau ngày bắt đầu.';
    const i = interest(S, id, v.rate, v.from, v.to), p = calc(S).prin[id];
    const warn = d.lastTo && v.from <= d.lastTo ? `\n⚠ Kỳ này trùng với lần ghi lãi trước (đến ${dmy(d.lastTo)}).` : '';
    if (confirm(`Gốc: ${fmt(p)}\nLãi kỳ này: ${fmt(i)}\nNợ thực tế sau khi ghi: ${fmt(p + (d.extra || 0) + i)}${warn}\n\nGhi nhận lãi vào nợ thực tế?`)) return mutate(c => { const x = c.debts.find(d => d.id == id); x.rate = v.rate; x.extra = (x.extra || 0) + i; x.lastTo = v.to; });
  }, { rate: d.rate, to: today() });
}
function pgBd() {
  const chips = `<div class="bar chips">${BD.map(([k, l]) => `<button class="${ui.bd == k ? 'on' : ''}" onclick="ui.bd='${k}';render()">${ico({ ci: 'out', cp: 'out', lend: 'out', ti: 'in', tp: 'in', tv: 'in' }[k])}${l}</button>`).join('')}</div>`, k = ui.bd;
  let body;
  if (k == 'ci') {
    const L = byDate(S.tx.filter(t => t.kind == 'ci')), ds = [...new Set(L.map(t => t.date))];
    body = btn('+ THÊM CHI ĐỊNH KỲ', "txForm('ci')", '') + (ds.length ? `<div class="wrap" style="margin-top:12px"><table>${ds.map(d => `<tr class="sub"><td colspan="3">${dmy(d)}</td><td class="n" colspan="2">${fmt(sum(L.filter(t => t.date == d), t => t.amount))}</td></tr>` + L.filter(t => t.date == d).map(t => tr([esc(t.cat), esc(t.desc), txSrc(t), '#' + fmt(t.amount), acts(t)])).join('')).join('')}</table></div>` : '<div class="empty">Chưa có giao dịch.</div>');
  } else if (k == 'lend') {
    const L = byDate(S.tx.filter(t => t.kind == 'lend'));
    body = btn('+ CHO VAY', "txForm('lend')", '') + '<div style="margin-top:12px">' + tbl(['NGÀY', 'NGƯỜI VAY', '#SỐ TIỀN', '#CÒN PHẢI THU', 'HẸN TRẢ', 'TRẠNG THÁI', ''], L.map(t => { const l = lendLeft(S, t.id); return tr([dmy(t.date), esc(t.borrower) + (t.contact ? `<br><small>${esc(t.contact)}</small>` : ''), '#' + fmt(t.amount), '#' + fmt(l), dmy(t.due), l < 0.5 ? 'Đã thu đủ' : t.due && t.due < today() ? 'Quá hạn' : 'Chưa thu đủ', acts(t)]); })) + '</div>';
  } else if (k == 'tv') {
    const L = byDate(S.tx.filter(t => t.kind == 'collect' || t.kind == 'borrow'));
    body = btn('+ THU TIỀN CHO VAY', "txForm('collect')", '') + ' ' + btn('+ NHẬN TIỀN VAY', "txForm('borrow')", '') + '<div style="margin-top:12px">' + tbl(['NGÀY', 'LOẠI', 'CHI TIẾT', '#SỐ TIỀN', 'VÀO TÀI KHOẢN', ''], L.map(t => tr([dmy(t.date), t.kind == 'collect' ? 'THU CHO VAY' : 'NHẬN VAY', t.kind == 'collect' ? esc((S.tx.find(l => l.id == t.lendId) || {}).borrower) : esc(dLabel(S.debts.find(d => d.id == t.debt))) + (t.fee ? ` · phí ${fmt(t.fee)}` : ''), '#' + fmt(t.amount), esc(accName(t.acc)), acts(t)]))) + '</div>';
  } else {
    const L = byDate(S.tx.filter(t => t.kind == k)), inc = k[0] == 't';
    body = btn('+ THÊM ' + BD.find(b => b[0] == k)[1], `txForm('${k}')`, '') + '<div style="margin-top:12px">' + tbl(['NGÀY', 'DANH MỤC', 'MÔ TẢ', inc ? 'VÀO' : 'NGUỒN', '#SỐ TIỀN', ''], L.map(t => tr([dmy(t.date), esc(t.cat), esc(t.desc) + (t.note ? `<br><small>${esc(t.note)}</small>` : ''), txSrc(t), '#' + fmt(t.amount), acts(t)]))) + '</div>';
  }
  return chips + body;
}
function pgDu() {
  const c = calc(S);
  return `<div class="grid">${kpi('TỔNG DƯ', money(c.total))}${kpi('TIỀN MẶT', money(c.cash))}${kpi('NGÂN HÀNG', money(c.bank))}</div>
  <h2>TIỀN MẶT</h2><div class="bar">${btn('Số dư ban đầu: ' + fmt(S.cashOpen), 'editCash()')} ${btn('Lịch sử', "hist('cash')")}</div>
  <h2>NGÂN HÀNG</h2><div class="bar">${btn('+ TÀI KHOẢN NGÂN HÀNG', 'addBank()', '')}</div>
  ${tbl(['TÀI KHOẢN', '#DƯ BAN ĐẦU', '#SỐ DƯ HIỆN TẠI', ''], S.banks.map(b => tr([esc(b.name) + (b.note ? `<br><small>${esc(b.note)}</small>` : ''), '#' + fmt(b.open), '#<b>' + fmt(c.bal[b.id]) + '</b>', btn('Lịch sử', `hist('${b.id}')`) + ' ' + btn('Sửa', `editBank('${b.id}')`) + ' ' + btn('Xóa', `delBank('${b.id}')`)])), 'Chưa có tài khoản ngân hàng.')}`;
}
const editCash = () => ask('SỐ DƯ TIỀN MẶT BAN ĐẦU', [{ n: 'v', l: 'SỐ TIỀN (₫)', t: 'number' }], v => isNaN(v.v) ? 'Số tiền không hợp lệ.' : mutate(c => c.cashOpen = v.v), { v: S.cashOpen });
const bankFields = () => [{ n: 'bank', l: 'NGÂN HÀNG', t: 'select', o: BANKS.map(b => [b, b]) }, { n: 'other', l: 'TÊN NGÂN HÀNG KHÁC', show: v => v.bank == 'Khác', req: 1 }, { n: 'note', l: 'GHI CHÚ (SỐ TK, CHI NHÁNH...)' }, { n: 'open', l: 'SỐ DƯ BAN ĐẦU (₫)', t: 'number' }];
const addBank = () => ask('THÊM TÀI KHOẢN NGÂN HÀNG', bankFields(), v => mutate(c => c.banks.push({ id: uid(), name: v.bank == 'Khác' ? v.other : v.bank, note: v.note, open: v.open || 0 })));
function editBank(id) { const b = S.banks.find(b => b.id == id); ask('SỬA TÀI KHOẢN', [{ n: 'name', l: 'TÊN', req: 1 }, { n: 'note', l: 'GHI CHÚ' }, { n: 'open', l: 'SỐ DƯ BAN ĐẦU (₫)', t: 'number' }], v => mutate(c => Object.assign(c.banks.find(b => b.id == id), { name: v.name, note: v.note, open: v.open || 0 })), b); }
function delBank(id) { if (S.tx.some(t => t.acc == id) || S.fc.some(f => f.acc == id)) return alert('Tài khoản đã có giao dịch tham chiếu nên không thể xóa.'); if (confirm('Xóa tài khoản này?')) mutate(c => c.banks = c.banks.filter(b => b.id != id)); }
function hist(id) {
  const L = byDate(S.tx.filter(t => t.acc == id || (id == 'cash' && t.kind == 'lend'))), sign = t => (['ci', 'cp', 'lend', 'repay'].includes(t.kind) ? (t.src == 'debt' ? 0 : -1) : 1) * t.amount, nm = { ci: 'Chi định kỳ', cp: 'Chi phát sinh', ti: 'Thu định kỳ', tp: 'Thu phát sinh', lend: 'Cho vay', collect: 'Thu cho vay', borrow: 'Nhận vay', repay: 'Trả nợ' };
  show('LỊCH SỬ · ' + esc(accName(id)), tbl(['NGÀY', 'LOẠI', '#BIẾN ĐỘNG'], L.map(t => tr([dmy(t.date), nm[t.kind] + (t.cat ? ' · ' + esc(t.cat) : ''), '#' + money(sign(t))]))));
}
/* ---------- forecast ---------- */
const fcBar = () => `<div class="bar"><label style="margin:0">ĐẾN NGÀY</label><input type="date" value="${ui.fcDate}" min="${today()}" style="width:auto" onchange="ui.fcDate=this.value||ui.fcDate;render()"></div>`;
function fcTotals(p) { return `<div class="grid">${kpi('TỔNG NỢ DỰ KIẾN', money(p.da))}${kpi('TỔNG DƯ DỰ KIẾN', money(p.total))}</div>${p.has ? `<div class="sec" style="margin-top:12px">TÀI SẢN RÒNG DỰ KIẾN · ${dmy(ui.fcDate)}: <b>${money(p.net)}</b></div>` : ''}`; }
function pgFcNo() {
  const p = project(S, ui.fcDate);
  return fcBar() + fcTotals(p) + '<h2>NỢ DỰ KIẾN</h2>' + tbl(['CHỦ NỢ', '#HIỆN TẠI', '#+ CHI DỰ KIẾN', '#+ LÃI DỰ KIẾN', '#DỰ KIẾN'], p.debts.map(x => tr([esc(dLabel(x.d)), '#' + fmt(x.now), '#' + fmt(x.add), '#' + fmt(x.int), '#<b>' + fmt(x.proj) + '</b>'])), 'Chưa có tài khoản nợ.');
}
function pgFcDu() {
  const p = project(S, ui.fcDate), c = calc(S);
  return fcBar() + fcTotals(p) + '<h2>DƯ DỰ KIẾN</h2>' + tbl(['TÀI KHOẢN', '#HIỆN TẠI', '#DỰ KIẾN'], accOpts().map(([id]) => tr([esc(accName(id)), '#' + fmt(c.bal[id]), '#<b>' + money(p.bal[id]) + '</b>'])));
}
function pgFcBd() {
  const L = byDate(S.fc);
  return `<div class="bar">${btn('+ CHI DỰ KIẾN', "fcForm('chi')", '')} ${btn('+ THU DỰ KIẾN', "fcForm('thu')", '')}</div>` + tbl(['NGÀY', 'LOẠI', 'DANH MỤC', 'MÔ TẢ', 'NGUỒN', '#SỐ TIỀN', ''], L.map(f => tr([dmy(f.date), f.type == 'chi' ? 'CHI' : 'THU', esc(f.cat), esc(f.desc), f.type == 'thu' ? esc(accName(f.acc)) : f.src == 'debt' ? 'NỢ · ' + esc(dLabel(S.debts.find(d => d.id == f.debt))) : 'DƯ · ' + esc(accName(f.acc)), '#' + fmt(f.amount), btn('Sửa', `fcForm('${f.type}','${f.id}')`) + ' ' + btn('Xóa', `delFc('${f.id}')`)])), 'Chưa có dự kiến.');
}
function fcForm(type, id) {
  const old = id && S.fc.find(f => f.id == id), chi = type == 'chi';
  if (!S.cats[chi ? 'exp' : 'inc'].length) return alert('Hãy tạo danh mục trong THIẾT LẬP.');
  const f = [{ n: 'date', l: 'NGÀY', t: 'date', req: 1, v: ui.fcDate }, { n: 'amount', l: 'SỐ TIỀN (₫)', t: 'number', req: 1 }, { n: 'cat', l: 'DANH MỤC', t: 'select', o: catOpts(chi ? 'exp' : 'inc') }, { n: 'desc', l: 'MÔ TẢ' },
  ...(chi ? [{ n: 'src', l: 'NGUỒN TIỀN', t: 'select', o: [['bal', 'DƯ'], ['debt', 'NỢ']] }, { n: 'acc', l: 'TÀI KHOẢN DƯ', t: 'select', o: accOpts(), show: v => v.src == 'bal' }, { n: 'debt', l: 'TÀI KHOẢN NỢ', t: 'select', o: debtOpts(), show: v => v.src == 'debt', req: 1 }] : [{ n: 'acc', l: 'CỘNG VÀO', t: 'select', o: accOpts() }])];
  ask((old ? 'SỬA · ' : 'THÊM · ') + (chi ? 'CHI DỰ KIẾN' : 'THU DỰ KIẾN'), f, v => {
    if (v.date < today()) return 'Ngày dự kiến phải từ hôm nay trở đi.';
    const x = { ...(old || {}), ...v, type, id: old ? id : uid() }; if (chi) { if (x.src == 'debt') delete x.acc; else delete x.debt; } else delete x.src;
    return mutate(c => { c.fc = c.fc.filter(y => y.id != x.id); c.fc.push(x); });
  }, old || {});
}
const delFc = id => confirm('Xóa dự kiến này? (Không ảnh hưởng dữ liệu thực tế)') && mutate(c => c.fc = c.fc.filter(f => f.id != id));
/* ---------- settings ---------- */
function pgDm() {
  const box = (t, l) => `<div><h2>${l}</h2><div class="bar"><input id="nc-${t}" placeholder="Tên danh mục mới" style="flex:1">${btn('THÊM', `addCat('${t}')`, '')}</div>${tbl(['DANH MỤC', ''], S.cats[t].map((c, i) => tr([esc(c), btn('Xóa', `delCat('${t}',${i})`)])), 'Chưa có danh mục.')}</div>`;
  return `<div class="cols">${box('exp', 'DANH MỤC CHI')}${box('inc', 'DANH MỤC THU')}</div><p class="empty">Xóa danh mục không làm thay đổi các giao dịch cũ (tên danh mục được giữ trong lịch sử).</p>`;
}
const addCat = t => { const v = document.getElementById('nc-' + t).value.trim(); if (!v) return; if (S.cats[t].some(c => c.toLowerCase() == v.toLowerCase())) return alert('Danh mục đã tồn tại.'); S.cats[t].push(v); save(); render(); };
const delCat = (t, i) => { S.cats[t].splice(i, 1); save(); render(); };
const pgCn = () => { const pr = S.profile, cv = safeImg(pr.cover), av = safeImg(pr.avatar); return `<div class="cols"><div>
  <h2>ẢNH BÌA</h2><div class="cover" style="height:150px;${cv ? `background-image:url(${cv})` : ''}">${cv ? '' : deco}</div>
  <div class="bar" style="margin-top:14px"><label class="btn">TẢI ẢNH BÌA<input type="file" accept="image/*" hidden onchange="upImg(this,'cover',1200,420)"></label>${cv ? btn('GỠ ẢNH', "rmImg('cover')") : ''}</div>
  <h2>ẢNH ĐẠI DIỆN</h2><div class="avatar"><div>${av ? `<img src="${av}" alt="">` : esc((pr.name || 'N')[0].toUpperCase())}</div></div>
  <div class="bar" style="margin-top:14px"><label class="btn">TẢI ẢNH ĐẠI DIỆN<input type="file" accept="image/*" hidden onchange="upImg(this,'avatar',320,320)"></label>${av ? btn('GỠ ẢNH', "rmImg('avatar')") : ''}</div></div>
  <div><h2>THÔNG TIN</h2><label>TÊN HIỂN THỊ</label><input id="pn" value="${esc(pr.name)}"><label>GHI CHÚ</label><textarea id="pt" rows="4">${esc(pr.note)}</textarea><div class="row" style="justify-content:flex-start">${btn('LƯU', 'saveProfile()', '')}</div></div></div>`; };
const saveProfile = () => { S.profile.name = pn.value.trim(); S.profile.note = pt.value.trim(); save(); render(); };
function upImg(inp, key, w, h) {
  const f = inp.files[0]; inp.value = ''; if (!f) return; if (!/^image\//.test(f.type)) return alert('Vui lòng chọn file ảnh.');
  const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; const k = Math.max(w / im.width, h / im.height), dw = im.width * k, dh = im.height * k; c.getContext('2d').drawImage(im, (w - dw) / 2, (h - dh) / 2, dw, dh); S.profile[key] = c.toDataURL('image/jpeg', .82); save(); render(); }; im.onerror = () => alert('Không đọc được ảnh.'); im.src = r.result; };
  r.readAsDataURL(f);
}
const rmImg = key => { delete S.profile[key]; save(); render(); };
const pgSl = () => `<div class="bar">${btn('TẢI BẢN SAO LƯU (.json)', 'backup()', '')} <label class="btn g" style="margin:0;color:#000;background:#fff;border-color:#ccc">KHÔI PHỤC TỪ FILE<input type="file" accept=".json,application/json" hidden onchange="restore(this)"></label></div><p class="empty">Dữ liệu chỉ được lưu trong trình duyệt này. Hãy sao lưu định kỳ.</p>`;
function backup() { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' })); a.download = `nomoney-nolife-${today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1e3); }
function restore(inp) {
  const f = inp.files[0]; inp.value = ''; if (!f) return; const r = new FileReader();
  r.onload = () => { let o; try { o = JSON.parse(r.result); } catch (e) { return alert('File không phải JSON hợp lệ.'); } if (!validBackup(o)) return alert('Bản sao lưu không hợp lệ hoặc không đầy đủ. Dữ liệu hiện tại được giữ nguyên.'); if (confirm('Khôi phục sẽ THAY THẾ toàn bộ dữ liệu hiện tại. Tiếp tục?')) { S = o; save(); render(); } };
  r.readAsText(f);
}
/* ---------- router ---------- */
const PG = { 'home/tq': pgTq, 'home/db': pgDb, 'fin/no': pgNo, 'fin/bd': pgBd, 'fin/du': pgDu, 'fc/no': pgFcNo, 'fc/bd': pgFcBd, 'fc/du': pgFcDu, 'set/dm': pgDm, 'set/cn': pgCn, 'set/sl': pgSl };
function render() {
  let [m, s] = location.hash.slice(1).split('/'); if (!PG[m + '/' + s]) { m = 'home'; s = 'tq'; }
  const p = S.profile, av = safeImg(p.avatar);
  side.innerHTML = `<div class="logo">NOMONEY<i>-</i>NOLIFE</div><div class="me"><div class="av">${av ? `<img src="${av}" alt="">` : esc((p.name || 'N')[0].toUpperCase())}</div>${esc((p.name || 'NGƯỜI DÙNG').toUpperCase())}</div>` +
    Object.entries(NAV).map(([k, [l, subs]]) => `<div class="gl">${l}</div>` + subs.map(([a, b]) => `<a class="lk ${k == m && a == s ? 'on' : ''}" href="#${k}/${a}"><span>${b}</span></a>`).join('')).join('') + '<div class="slashes"></div>';
  app.innerHTML = PG[m + '/' + s](); enhance(app);
  const key = m + s + (m == 'fin' && s == 'bd' ? ui.bd : '');
  if (key != ui.key) { ui.key = key; app.classList.remove('in'); void app.offsetWidth; app.classList.add('in'); scrollTo(0, 0); }
}
addEventListener('hashchange', render); render();
