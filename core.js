/* NOMONEY-NOLIFE core: pure financial logic (no DOM). */
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
const days = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 864e5));
const defState = () => ({
  v: 1, profile: { name: '', note: '' },
  cats: { exp: ['Ăn uống', 'Đi lại', 'Nhu yếu phẩm', 'Xăng xe', 'Mua sắm', 'Giặt ủi', 'Sửa xe'], inc: ['Lương', 'Thưởng', 'Quà tặng'] },
  cashOpen: 0, banks: [], debts: [], tx: [], fc: []
});
/* tx kinds: ci chi định kỳ, cp chi phát sinh, ti thu định kỳ, tp thu phát sinh, lend chi vay,
   collect thu tiền cho vay, borrow nhận tiền vay, repay trả nợ. Everything is derived from these. */
function calc(S) {
  const bal = { cash: +S.cashOpen || 0 }; S.banks.forEach(b => bal[b.id] = +b.open || 0);
  const prin = {}; S.debts.forEach(d => prin[d.id] = 0);
  for (const t of S.tx) {
    const k = t.kind;
    if (k == 'ci' || k == 'cp') { if (t.src == 'debt') prin[t.debt] += t.amount; else bal[t.acc] -= t.amount; }
    else if (k == 'ti' || k == 'tp' || k == 'collect') bal[t.acc] += t.amount;
    else if (k == 'lend') bal.cash -= t.amount;
    else if (k == 'borrow') { bal[t.acc] += t.amount; prin[t.debt] += t.amount + (t.fee || 0); }
    else if (k == 'repay') { bal[t.acc] -= t.amount; prin[t.debt] -= t.pp; }
  }
  const debts = S.debts.map(d => ({ d, p: prin[d.id], x: d.extra || 0, a: prin[d.id] + (d.extra || 0) }));
  const cash = bal.cash, bank = sum(S.banks, b => bal[b.id]);
  const dp = sum(debts, x => x.p), da = sum(debts, x => x.a);
  return { bal, prin, debts, cash, bank, total: cash + bank, dp, di: da - dp, da, net: cash + bank - da };
}
const lendLeft = (S, id) => { const l = S.tx.find(t => t.id == id && t.kind == 'lend'); return l ? l.amount - sum(S.tx.filter(t => t.kind == 'collect' && t.lendId == id), t => t.amount) : 0; };
function validate(S) {
  const c = calc(S);
  for (const k in c.bal) if (!(c.bal[k] >= -0.5)) return 'Số dư không được âm.';
  for (const x of c.debts) { if (!(x.p >= -0.5)) return 'Nợ gốc không hợp lệ.'; if (!(x.x >= -0.5)) return 'Nợ thực tế không thể thấp hơn nợ gốc.'; }
  for (const t of S.tx) {
    if (!(t.amount > 0) || !/^\d{4}-\d\d-\d\d$/.test(t.date || '')) return 'Dữ liệu giao dịch không hợp lệ.';
    if (t.acc && !(t.acc in c.bal)) return 'Tài khoản không tồn tại.';
    if (t.debt && !(t.debt in c.prin)) return 'Tài khoản nợ không tồn tại.';
    if (t.kind == 'collect' && (!S.tx.some(y => y.id == t.lendId && y.kind == 'lend') || lendLeft(S, t.lendId) < -0.5)) return 'Khoản thu vượt quá dư nợ cho vay.';
  }
  for (const f of S.fc) if (!(f.amount > 0) || (f.acc && !(f.acc in c.bal)) || (f.debt && !(f.debt in c.prin))) return 'Dữ liệu dự kiến không hợp lệ.';
  return null;
}
function addTx(c, t) {
  t.id = t.id || uid();
  if (t.kind == 'repay') {
    const d = c.debts.find(d => d.id == t.debt); if (!d) throw 'Chưa chọn tài khoản nợ.';
    const p = calc(c).prin[t.debt], pp = Math.min(t.amount, p), ep = t.amount - pp;
    if (ep > (d.extra || 0) + 0.5) throw 'Số tiền trả vượt quá nợ thực tế.';
    d.extra = (d.extra || 0) - ep; t.pp = pp; t.ep = ep;
  }
  c.tx.push(t);
}
function delTx(c, id) {
  const i = c.tx.findIndex(t => t.id == id); if (i < 0) return;
  const t = c.tx[i]; if (t.kind == 'repay') { const d = c.debts.find(d => d.id == t.debt); if (d) d.extra = (d.extra || 0) + t.ep; }
  c.tx.splice(i, 1);
}
function interest(S, id, rate, from, to) {
  const ev = S.tx.filter(t => t.debt == id && (t.src == 'debt' || t.kind == 'borrow' || t.kind == 'repay'))
    .map(t => ({ d: t.date, v: t.kind == 'repay' ? -t.pp : t.amount + (t.fee || 0) }));
  let tot = 0, n = 0;
  for (const d = new Date(from); d <= new Date(to) && n < 3700; d.setDate(d.getDate() + 1), n++) {
    const ds = d.toISOString().slice(0, 10);
    tot += sum(ev.filter(e => e.d <= ds), e => e.v) * rate / 100 / 365;
  }
  return Math.round(tot);
}
function project(S, date) {
  const c = calc(S), t0 = today(), bal = { ...c.bal }, add = {};
  const items = S.fc.filter(f => f.date <= date);
  for (const f of items) { if (f.type == 'thu') bal[f.acc] += f.amount; else if (f.src == 'debt') add[f.debt] = (add[f.debt] || 0) + f.amount; else bal[f.acc] -= f.amount; }
  const debts = c.debts.map(x => {
    const r = (x.d.rate || 0) / 100, a = add[x.d.id] || 0;
    let i = x.p * r * days(t0, date) / 365;
    for (const f of items) if (f.type == 'chi' && f.src == 'debt' && f.debt == x.d.id) i += f.amount * r * days(f.date, date) / 365;
    i = Math.round(i); return { d: x.d, now: x.a, add: a, int: i, proj: x.a + a + i };
  });
  const cash = bal.cash, bank = sum(S.banks, b => bal[b.id]), da = sum(debts, x => x.proj);
  return { bal, debts, cash, bank, total: cash + bank, da, net: cash + bank - da, has: S.fc.length > 0 };
}
function validBackup(o) {
  if (!o || typeof o != 'object' || o.v !== 1) return false;
  if (!['banks', 'debts', 'tx', 'fc'].every(k => Array.isArray(o[k]))) return false;
  if (!o.cats || !Array.isArray(o.cats.exp) || !Array.isArray(o.cats.inc) || !o.profile || typeof o.profile != 'object' || isNaN(+o.cashOpen)) return false;
  return !validate(o);
}
if (typeof module !== 'undefined') module.exports = { calc, validate, addTx, delTx, interest, project, defState, validBackup, lendLeft, uid, today };
