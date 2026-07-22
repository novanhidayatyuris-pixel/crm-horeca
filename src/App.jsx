import React, { useState, useMemo, useRef } from "react";
import {
  LayoutDashboard, Users, Target, PhoneCall, Map, FileText, ShoppingCart,
  Package, UserCircle, BarChart3, Settings, Plus, Search, Pencil, Trash2,
  X, Menu, Wallet, Trophy, ChevronRight, Printer, LogOut, Loader2, Upload
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  FunnelChart, Funnel, LabelList, PieChart, Pie, Cell
} from "recharts";

/* ------------------- Supabase via plain fetch (no SDK) -------------------
   @supabase/supabase-js isn't available in this artifact sandbox, so we talk
   to Supabase's REST (PostgREST) and Auth (GoTrue) HTTP endpoints directly. */

const SB_URL = "https://hibbakzafbgdmdckkjfd.supabase.co";
const SB_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpYmJha3phZmJnZG1kY2tramZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0OTkxNDksImV4cCI6MjEwMDA3NTE0OX0.h0J5SHT9OsQAXsCibN5VNd79cCTLB4XZ48Se-yxo-64";

function authHeaders(token) {
  return { apikey: SB_ANON_KEY, Authorization: `Bearer ${token || SB_ANON_KEY}` };
}

async function sbLogin(email, password) {
  const res = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SB_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Login gagal");
  return data; // { access_token, user, ... }
}

async function sbSelect(table, token) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?select=*&order=id.desc`, { headers: authHeaders(token) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Gagal memuat data");
  return data;
}

async function sbSelectOne(table, id, token) {
  const url = `${SB_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=*`;
  const res = await fetch(url, { headers: authHeaders(token) });
  const text = await res.text();
  console.log("sbSelectOne status:", res.status, "body:", text);
  if (!res.ok) throw new Error(text || "Gagal memuat data");
  const data = text ? JSON.parse(text) : [];
  return data[0] || null;
}

async function sbInsert(table, record, token) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(record),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Gagal menyimpan data");
  return data;
}

async function sbUpdate(table, id, record, token) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...authHeaders(token), "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(record),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Gagal menyimpan data");
  return data;
}

async function sbDelete(table, id, token) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Gagal menghapus data");
  }
  return true;
}

/* ------------------------------ CSV import helper ------------------------------ */

function splitCsvLine(line) {
  const cells = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = false; }
      } else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { cells.push(cur); cur = ""; }
      else cur += c;
    }
  }
  cells.push(cur);
  return cells;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (cells[i] ?? "").trim(); });
    return obj;
  });
}

function ImportCsvButton({ table, fields, token, reload }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const inputRef = useRef();

  function downloadTemplate() {
    const headers = fields.map((f) => f.key).join(",");
    const example = fields.map((f) => f.example || "").join(",");
    const csv = headers + "\n" + example;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `template-${table}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true);
    setMsg("");
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) throw new Error("File CSV kosong atau formatnya tidak terbaca.");
      await sbInsert(table, rows, token);
      setMsg(`Berhasil impor ${rows.length} baris.`);
      reload();
    } catch (err) {
      setMsg("Gagal impor: " + err.message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={downloadTemplate} className="text-xs text-slate-500 underline whitespace-nowrap">
        Unduh Template
      </button>
      <button
        type="button" disabled={busy} onClick={() => inputRef.current.click()}
        className="flex items-center gap-1.5 border border-slate-300 text-slate-600 text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Impor CSV
      </button>
      <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
    </div>
  );
}

/* ---------------------------------- utils ---------------------------------- */

const fmtRp = (n) =>
  "Rp " + (Number(n) || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });

const todayISO = () => new Date().toISOString().slice(0, 10);
const monthKey = (iso) => (iso || "").slice(0, 7);
const thisMonthKey = todayISO().slice(0, 7);

const STATUS_COLOR = {
  Closing: "green", Lunas: "green", Selesai: "green", Disetujui: "green",
  Aktif: "green", Kirim: "green", Trial: "green",
  "Follow Up": "amber", Negosiasi: "amber", Visit: "amber",
  Menunggu: "amber", Terjadwal: "amber", "Belum Bayar": "amber", Prospek: "amber",
  Lost: "red", Ditolak: "red", Terlewat: "red", "Non-Aktif": "red",
  "Belum Dikunjungi": "red",
};
const dotClass = { green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-rose-500", gray: "bg-slate-400" };
const badgeClass = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-rose-50 text-rose-700 border-rose-200",
  gray: "bg-slate-100 text-slate-600 border-slate-200",
};
function StatusBadge({ value }) {
  const c = STATUS_COLOR[value] || "gray";
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${badgeClass[c]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass[c]}`} />
      {value}
    </span>
  );
}

/* ------------------------------ building blocks ------------------------------ */

function Card({ children, className = "" }) {
  return <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>{children}</div>;
}
function KpiCard({ label, value, sub, accent }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1.5 text-2xl font-semibold" style={{ color: accent || "#14213D" }}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </Card>
  );
}
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
function Field({ f, value, onChange }) {
  const common = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-500";
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
      {f.type === "select" ? (
        <select className={common} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
          <option value="" disabled>Pilih {f.label}</option>
          {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : f.type === "textarea" ? (
        <textarea className={common} rows={2} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input
          className={common}
          type={f.type || "text"}
          value={value ?? ""}
          onChange={(e) => onChange(f.type === "number" ? Number(e.target.value) : e.target.value)}
        />
      )}
    </div>
  );
}

/** Generic CRUD table + form page, backed live by a Supabase table (via REST) */
function CrudPage({ title, table, data, reload, token, fields, columns, searchKeys, importFields }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return data;
    const q = query.toLowerCase();
    return data.filter((row) => searchKeys.some((k) => String(row[k] || "").toLowerCase().includes(q)));
  }, [data, query, searchKeys]);

  function openNew() {
    const blank = {};
    fields.forEach((f) => (blank[f.key] = f.type === "number" ? 0 : ""));
    setEditing({ __isNew: true, ...blank });
    setErr("");
  }
  function openEdit(row) { setEditing({ __isNew: false, ...row }); setErr(""); }

  async function save() {
    setSaving(true);
    setErr("");
    try {
      const rec = { ...editing };
      const isNew = rec.__isNew;
      delete rec.__isNew;
      if (isNew) {
        await sbInsert(table, rec, token);
      } else {
        const id = rec.id;
        delete rec.id;
        await sbUpdate(table, id, rec, token);
      }
      setEditing(null);
      await reload();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function doDelete(id) {
    try {
      await sbDelete(table, id, token);
      setConfirmDel(null);
      await reload();
    } catch (e) {
      setConfirmDel(null);
      setErr(e.message);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {importFields && <ImportCsvButton table={table} fields={importFields} token={token} reload={reload} />}
          <div className="relative">
            <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              className="pl-8 pr-3 py-2 rounded-lg border border-slate-300 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="Cari..." value={query} onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button onClick={openNew} className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-3.5 py-2 rounded-lg">
            <Plus size={15} /> Tambah
          </button>
        </div>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              {columns.map((c) => <th key={c.key} className="text-left font-medium px-4 py-2.5 whitespace-nowrap">{c.label}</th>)}
              <th className="px-4 py-2.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={columns.length + 1} className="text-center text-slate-400 py-8">Belum ada data. Klik "Tambah" untuk mengisi.</td></tr>
            )}
            {filtered.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-2.5 whitespace-nowrap text-slate-700">
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(row)} className="text-slate-400 hover:text-slate-900 p-1.5"><Pencil size={15} /></button>
                  <button onClick={() => setConfirmDel(row.id)} className="text-slate-400 hover:text-rose-600 p-1.5"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {editing && (
        <Modal title={editing.__isNew ? `Tambah ${title}` : `Edit ${title}`} onClose={() => setEditing(null)}>
          {fields.map((f) => (
            <Field key={f.key} f={f} value={editing[f.key]} onChange={(v) => setEditing({ ...editing, [f.key]: v })} />
          ))}
          {err && <p className="text-xs text-rose-600 mb-2">{err}</p>}
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600">Batal</button>
            <button disabled={saving} onClick={save} className="px-4 py-2 text-sm rounded-lg bg-slate-900 text-white font-medium flex items-center gap-1.5 disabled:opacity-60">
              {saving && <Loader2 size={14} className="animate-spin" />} Simpan
            </button>
          </div>
        </Modal>
      )}

      {confirmDel && (
        <Modal title="Hapus data?" onClose={() => setConfirmDel(null)}>
          <p className="text-sm text-slate-600 mb-4">Data ini akan dihapus permanen dari database. Yakin lanjut?</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfirmDel(null)} className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600">Batal</button>
            <button onClick={() => doDelete(confirmDel)} className="px-4 py-2 text-sm rounded-lg bg-rose-600 text-white font-medium">Hapus</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* --------------------------------- pages --------------------------------- */

function DashboardPage({ customers, prospects, followups, orders, sales }) {
  const totalProspek = prospects.length;
  const prospekBaruHariIni = prospects.filter((p) => p.tanggal_masuk === todayISO()).length;
  const followUpHariIni = followups.filter((f) => f.tanggal === todayISO()).length;
  const closingBulanIni = prospects.filter((p) => p.status === "Closing" && monthKey(p.tanggal_masuk) === thisMonthKey).length;

  const ordersWithTotal = orders.map((o) => ({ ...o, total: o.qty * o.harga + Number(o.ongkir || 0) }));
  const omzetBulanIni = ordersWithTotal.filter((o) => monthKey(o.tanggal) === thisMonthKey).reduce((s, o) => s + o.total, 0);
  const targetTotal = sales.reduce((s, r) => s + Number(r.target_bulanan || 0), 0);
  const realisasiTotal = sales.reduce((s, r) => s + Number(r.realisasi_omzet || 0), 0);
  const closingRate = totalProspek ? ((prospects.filter((p) => p.status === "Closing").length / totalProspek) * 100).toFixed(1) : 0;

  const topCustomer = useMemo(() => {
    const map = {};
    ordersWithTotal.forEach((o) => { map[o.customer] = (map[o.customer] || 0) + o.total; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [orders]);
  const topSales = [...sales].sort((a, b) => b.realisasi_omzet - a.realisasi_omzet).slice(0, 10);
  const monthlyChart = useMemo(() => {
    const map = {};
    ordersWithTotal.forEach((o) => { const k = monthKey(o.tanggal); map[k] = (map[k] || 0) + o.total; });
    return Object.entries(map).sort().map(([k, v]) => ({ bulan: k.slice(5) + "/" + k.slice(2, 4), omzet: v }));
  }, [orders]);

  const funnelOrder = ["Belum Dikunjungi", "Visit", "Follow Up", "Negosiasi", "Trial", "Closing"];
  const funnelData = funnelOrder.map((s, i) => ({
    name: s, value: prospects.filter((p) => p.status === s).length,
    fill: ["#93a4c9", "#7089c2", "#4c6ebb", "#F2A104", "#e08e00", "#14213D"][i],
  }));

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-800 mb-4">Dashboard</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Total Prospek" value={totalProspek} />
        <KpiCard label="Prospek Baru Hari Ini" value={prospekBaruHariIni} accent="#F2A104" />
        <KpiCard label="Follow Up Hari Ini" value={followUpHariIni} accent="#F2A104" />
        <KpiCard label="Closing Bulan Ini" value={closingBulanIni} accent="#0f9d58" />
        <KpiCard label="Omzet Bulan Ini" value={fmtRp(omzetBulanIni)} />
        <KpiCard label="Target Bulan Ini" value={fmtRp(targetTotal)} sub={`Realisasi ${fmtRp(realisasiTotal)}`} />
        <KpiCard label="Closing Rate" value={`${closingRate}%`} />
        <KpiCard label="Realisasi vs Target" value={`${targetTotal ? ((realisasiTotal / targetTotal) * 100).toFixed(0) : 0}%`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Grafik Penjualan Bulanan</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" />
              <XAxis dataKey="bulan" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
              <Tooltip formatter={(v) => fmtRp(v)} />
              <Bar dataKey="omzet" fill="#14213D" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Sales Funnel</h3>
          <ResponsiveContainer width="100%" height={220}>
            <FunnelChart>
              <Tooltip />
              <Funnel dataKey="value" data={funnelData} isAnimationActive>
                <LabelList position="right" dataKey="name" fill="#334155" stroke="none" fontSize={11} />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Top 10 Customer (Omzet)</h3>
          <ul className="text-sm divide-y divide-slate-100">
            {topCustomer.length === 0 && <li className="text-slate-400 py-2">Belum ada order.</li>}
            {topCustomer.map(([name, val], i) => (
              <li key={name} className="flex items-center justify-between py-2">
                <span className="flex items-center gap-2 text-slate-700"><span className="w-5 text-slate-400 text-xs">{i + 1}</span>{name}</span>
                <span className="font-medium text-slate-800">{fmtRp(val)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Top 10 Sales</h3>
          <ul className="text-sm divide-y divide-slate-100">
            {topSales.length === 0 && <li className="text-slate-400 py-2">Belum ada data sales.</li>}
            {topSales.map((s, i) => (
              <li key={s.id} className="flex items-center justify-between py-2">
                <span className="flex items-center gap-2 text-slate-700"><span className="w-5 text-slate-400 text-xs">{i + 1}</span>{s.nama}</span>
                <span className="font-medium text-slate-800">{fmtRp(s.realisasi_omzet)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function KpiDashboardPage({ orders, customers, prospects }) {
  const ordersWithTotal = orders.map((o) => ({ ...o, total: o.qty * o.harga + Number(o.ongkir || 0) }));
  const topProduk = useMemo(() => {
    const map = {};
    orders.forEach((o) => { map[o.produk] = (map[o.produk] || 0) + o.qty; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [orders]);
  const kategoriCount = useMemo(() => {
    const map = {};
    customers.forEach((c) => { map[c.kategori] = (map[c.kategori] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [customers]);
  const repeatOrder = useMemo(() => {
    const map = {};
    orders.forEach((o) => { map[o.customer] = (map[o.customer] || 0) + 1; });
    return Object.values(map).filter((v) => v > 1).length;
  }, [orders]);
  const closingRate = prospects.length ? ((prospects.filter((p) => p.status === "Closing").length / prospects.length) * 100).toFixed(1) : 0;
  const COLORS = ["#14213D", "#F2A104", "#4c6ebb", "#e08e00", "#93a4c9", "#0f9d58"];

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-800 mb-4">Dashboard KPI</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Customer Baru" value={customers.length} />
        <KpiCard label="Repeat Order" value={repeatOrder} />
        <KpiCard label="Closing Rate" value={`${closingRate}%`} />
        <KpiCard label="Omzet Total" value={fmtRp(ordersWithTotal.reduce((s, o) => s + o.total, 0))} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Top Produk (Qty Terjual)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topProduk.map(([name, value]) => ({ name: (name || "").replace(" 100gr", ""), value }))} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#F2A104" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Komposisi Customer per Kategori</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={kategoriCount} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {kategoriCount.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

function TargetPage({ sales, reload, token }) {
  const ranked = [...sales].sort((a, b) => b.realisasi_omzet - a.realisasi_omzet);
  return (
    <div>
      <CrudPage
        title="Target Sales" table="sales" data={sales} reload={reload} token={token}
        searchKeys={["nama"]}
        fields={[
          { key: "nama", label: "Nama Sales", type: "text" },
          { key: "target_bulanan", label: "Target Bulanan (Rp)", type: "number" },
          { key: "realisasi_omzet", label: "Realisasi Omzet (Rp)", type: "number" },
          { key: "realisasi_closing", label: "Realisasi Closing", type: "number" },
          { key: "komisi_persen", label: "Komisi (%)", type: "number" },
        ]}
        columns={[
          { key: "nama", label: "Sales" },
          { key: "target_bulanan", label: "Target", render: (r) => fmtRp(r.target_bulanan) },
          { key: "realisasi_omzet", label: "Realisasi", render: (r) => fmtRp(r.realisasi_omzet) },
          { key: "capaian", label: "% Capaian", render: (r) => `${((r.realisasi_omzet / (r.target_bulanan || 1)) * 100).toFixed(0)}%` },
          { key: "realisasi_closing", label: "Closing" },
          { key: "komisi", label: "Komisi", render: (r) => fmtRp((r.realisasi_omzet * r.komisi_persen) / 100) },
        ]}
      />
      <Card className="p-4 mt-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><Trophy size={16} className="text-amber-600" /> Ranking Sales</h3>
        <ol className="text-sm space-y-1.5">
          {ranked.length === 0 && <li className="text-slate-400">Belum ada data.</li>}
          {ranked.map((s, i) => (
            <li key={s.id} className="flex justify-between items-center py-1.5 border-b border-slate-100 last:border-0">
              <span className="text-slate-700">#{i + 1} {s.nama}</span>
              <span className="font-medium text-slate-800">{fmtRp(s.realisasi_omzet)}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function ReportsPage({ orders, sales }) {
  const [periode, setPeriode] = useState("bulanan");
  const ordersWithTotal = orders.map((o) => ({ ...o, total: o.qty * o.harga + Number(o.ongkir || 0) }));
  const byPeriode = useMemo(() => {
    const map = {};
    ordersWithTotal.forEach((o) => {
      let key = o.tanggal;
      if (periode === "mingguan") key = (o.tanggal || "").slice(0, 8) + "xx (minggu)";
      if (periode === "bulanan") key = monthKey(o.tanggal);
      if (periode === "tahunan") key = (o.tanggal || "").slice(0, 4);
      map[key] = (map[key] || 0) + o.total;
    });
    return Object.entries(map).sort();
  }, [orders, periode]);
  const byCustomer = useMemo(() => {
    const map = {};
    ordersWithTotal.forEach((o) => { map[o.customer] = (map[o.customer] || 0) + o.total; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [orders]);
  const byProduk = useMemo(() => {
    const map = {};
    orders.forEach((o) => { map[o.produk] = (map[o.produk] || 0) + o.qty; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [orders]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Laporan</h2>
        <button onClick={() => window.print()} className="flex items-center gap-1.5 text-sm px-3.5 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50">
          <Printer size={15} /> Cetak Laporan
        </button>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {["harian", "mingguan", "bulanan", "tahunan"].map((p) => (
          <button key={p} onClick={() => setPeriode(p)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${periode === p ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}>
            {p[0].toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Omzet per Periode ({periode})</h3>
          <ul className="text-sm divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {byPeriode.map(([k, v]) => <li key={k} className="flex justify-between py-2"><span className="text-slate-600">{k}</span><span className="font-medium">{fmtRp(v)}</span></li>)}
          </ul>
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Per Customer</h3>
          <ul className="text-sm divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {byCustomer.map(([k, v]) => <li key={k} className="flex justify-between py-2"><span className="text-slate-600">{k}</span><span className="font-medium">{fmtRp(v)}</span></li>)}
          </ul>
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Per Produk (Qty)</h3>
          <ul className="text-sm divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {byProduk.map(([k, v]) => <li key={k} className="flex justify-between py-2"><span className="text-slate-600">{k}</span><span className="font-medium">{v} pcs</span></li>)}
          </ul>
        </Card>
      </div>
      <Card className="p-4 mt-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Per Sales</h3>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-400 uppercase border-b border-slate-200">
            <th className="py-2">Sales</th><th className="py-2">Target</th><th className="py-2">Realisasi</th><th className="py-2">Capaian</th>
          </tr></thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-b border-slate-100">
                <td className="py-2">{s.nama}</td>
                <td className="py-2">{fmtRp(s.target_bulanan)}</td>
                <td className="py-2">{fmtRp(s.realisasi_omzet)}</td>
                <td className="py-2">{((s.realisasi_omzet / (s.target_bulanan || 1)) * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function SettingsPage({ profile, user, onLogout }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-800 mb-4">Setting</h2>
      <Card className="p-5 max-w-lg">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Akun Kamu</h3>
        <p className="text-sm text-slate-600 mb-1">Nama: <b>{profile?.nama || "-"}</b></p>
        <p className="text-sm text-slate-600 mb-1">Email: <b>{user?.email}</b></p>
        <p className="text-sm text-slate-600 mb-4">Role: <b className="capitalize">{profile?.role}</b></p>
        <button onClick={onLogout} className="text-sm text-rose-600 flex items-center gap-1.5 mb-5"><LogOut size={14} /> Keluar</button>
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Menambah Pengguna Baru</h3>
        <p className="text-xs text-slate-400">
          Buat akun baru lewat dashboard Supabase → Authentication → Add user, lalu tambahkan baris
          di tabel <code>profiles</code> dengan <code>id</code> yang sama dan <code>role</code> = admin/sales.
        </p>
      </Card>
    </div>
  );
}

/* --------------------------------- app shell --------------------------------- */

const MENU = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "prospek", label: "Prospek", icon: Target },
  { key: "customer", label: "Customer", icon: Users },
  { key: "followup", label: "Follow Up", icon: PhoneCall },
  { key: "kunjungan", label: "Kunjungan", icon: Map },
  { key: "penawaran", label: "Penawaran", icon: FileText },
  { key: "order", label: "Order", icon: ShoppingCart },
  { key: "produk", label: "Produk", icon: Package },
  { key: "piutang", label: "Piutang", icon: Wallet },
  { key: "sales", label: "Target Sales", icon: UserCircle },
  { key: "kpi", label: "Dashboard KPI", icon: BarChart3 },
  { key: "laporan", label: "Laporan", icon: FileText },
  { key: "setting", label: "Setting", icon: Settings },
];

const TABLES = ["customers", "prospects", "followups", "visits", "products", "quotations", "orders", "receivables", "sales"];

function LoginScreen({ onLoggedIn }) {
  const [email, setEmail] = useState(() => {
    try { return localStorage.getItem("crm_horeca_remembered_email") || ""; } catch (_) { return ""; }
  });
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true); setErr("");
    try {
      const authData = await sbLogin(email, password);
      try {
        if (remember) localStorage.setItem("crm_horeca_remembered_email", email);
        else localStorage.removeItem("crm_horeca_remembered_email");
      } catch (_) {}
      onLoggedIn(authData, remember);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50" style={{ fontFamily: "'Manrope', ui-sans-serif, system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');`}</style>
      <form onSubmit={handleLogin} autoComplete="on" className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center font-bold text-slate-900">A</div>
          <div>
            <div className="font-bold text-slate-900 text-sm leading-tight">Aroma HORECA</div>
            <div className="text-[11px] text-slate-400">Sales & CRM System</div>
          </div>
        </div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
        <input
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-3" type="email" name="email"
          autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required
        />
        <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
        <input
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-3" type="password" name="password"
          autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required
        />
        <label className="flex items-center gap-2 text-xs text-slate-600 mb-4 cursor-pointer select-none">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="rounded border-slate-300" />
          Ingat saya di perangkat ini
        </label>
        {err && <p className="text-xs text-rose-600 mb-3">{err}</p>}
        <button disabled={loading} className="w-full bg-slate-900 text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-60">
          {loading && <Loader2 size={14} className="animate-spin" />} Masuk
        </button>
        <p className="text-[11px] text-slate-400 mt-4">Belum punya akun? Minta admin membuatkannya lewat dashboard Supabase.</p>
      </form>
    </div>
  );
}

const SESSION_KEY = "crm_horeca_session";
function saveSession(authData, remember) {
  try {
    if (remember) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(authData));
      sessionStorage.removeItem(SESSION_KEY);
    } else {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(authData));
      localStorage.removeItem(SESSION_KEY);
    }
  } catch (_) {}
}
function loadSession() {
  try {
    const fromLocal = localStorage.getItem(SESSION_KEY);
    if (fromLocal) return JSON.parse(fromLocal);
    const fromSession = sessionStorage.getItem(SESSION_KEY);
    if (fromSession) return JSON.parse(fromSession);
  } catch (_) {}
  return null;
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
}

export default function App() {
  const [auth, setAuth] = useState(null); // { access_token, user }
  const [profile, setProfile] = useState(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [active, setActive] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [db, setDb] = useState({ customers: [], prospects: [], followups: [], visits: [], products: [], quotations: [], orders: [], receivables: [], sales: [] });
  const [loadingData, setLoadingData] = useState(false);

  async function onLoggedIn(authData, remember = true) {
    saveSession(authData, remember);
    setAuth(authData);
    setProfileChecked(false);
    try {
      const prof = await sbSelectOne("profiles", authData.user.id, authData.access_token);
      setProfile(prof);
    } catch (e) {
      setProfile(null);
    }
    setProfileChecked(true);
  }

  React.useEffect(() => {
    const saved = loadSession();
    if (saved) {
      onLoggedIn(saved, true).finally(() => setRestoring(false));
    } else {
      setRestoring(false);
    }
  }, []);

  async function reloadAll() {
    if (!auth) return;
    setLoadingData(true);
    const results = await Promise.all(TABLES.map((t) => sbSelect(t, auth.access_token).catch(() => [])));
    const next = {};
    TABLES.forEach((t, i) => { next[t] = results[i] || []; });
    setDb(next);
    setLoadingData(false);
  }

  React.useEffect(() => { if (auth && profile) reloadAll(); }, [auth, profile]);

  function handleLogout() {
    clearSession();
    setAuth(null);
    setProfile(null);
    setProfileChecked(false);
    setDb({ customers: [], prospects: [], followups: [], visits: [], products: [], quotations: [], orders: [], receivables: [], sales: [] });
  }

  if (restoring) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400"><Loader2 className="animate-spin" size={22} /></div>;
  }

  if (!auth) return <LoginScreen onLoggedIn={onLoggedIn} />;


  if (!profileChecked) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400"><Loader2 className="animate-spin" size={22} /></div>;
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center">
        <div>
          <p className="text-slate-600 text-sm mb-3">Akun kamu belum punya profil (role) di sistem. Minta admin menambahkan baris di tabel <code>profiles</code>.</p>
          <button onClick={handleLogout} className="text-sm text-slate-900 underline">Keluar</button>
        </div>
      </div>
    );
  }

  const token = auth.access_token;
  const followUpDueToday = db.followups.filter((f) => f.reminder === todayISO() && f.status !== "Selesai").length;

  const visibleMenu = profile.role === "sales"
    ? MENU.filter((m) => ["dashboard", "prospek", "customer", "followup", "kunjungan", "penawaran", "order", "setting"].includes(m.key))
    : MENU;

  function renderPage() {
    switch (active) {
      case "dashboard":
        return <DashboardPage customers={db.customers} prospects={db.prospects} followups={db.followups} orders={db.orders} sales={db.sales} />;

      case "customer":
        return (
          <CrudPage
            title="Master Customer" table="customers" data={db.customers} reload={reloadAll} token={token}
            searchKeys={["nama_usaha", "kategori", "pic"]}
            importFields={[
              { key: "nama_usaha", example: "Contoh Resto Sedap" },
              { key: "kategori", example: "Restoran" },
              { key: "alamat", example: "Jl. Contoh No. 1, Bandung" },
              { key: "pic", example: "Budi" },
              { key: "hp", example: "0812xxxxxxx" },
              { key: "email", example: "email@contoh.com" },
              { key: "status", example: "Aktif" },
            ]}
            fields={[
              { key: "nama_usaha", label: "Nama Usaha", type: "text" },
              { key: "kategori", label: "Kategori", type: "select", options: ["Hotel", "Cafe", "Restoran", "Bakery", "Catering", "Lounge"] },
              { key: "alamat", label: "Alamat Lengkap", type: "textarea" },
              { key: "google_maps", label: "Google Maps", type: "text" },
              { key: "instagram", label: "Instagram", type: "text" },
              { key: "website", label: "Website", type: "text" },
              { key: "pic", label: "PIC", type: "text" },
              { key: "jabatan", label: "Jabatan", type: "text" },
              { key: "hp", label: "HP", type: "text" },
              { key: "email", label: "Email", type: "text" },
              { key: "jam_operasional", label: "Jam Operasional", type: "text" },
              { key: "status", label: "Status Customer", type: "select", options: ["Aktif", "Non-Aktif", "Prospek"] },
            ]}
            columns={[
              { key: "id", label: "ID" }, { key: "nama_usaha", label: "Nama Usaha" }, { key: "kategori", label: "Kategori" },
              { key: "pic", label: "PIC" }, { key: "hp", label: "HP" },
              { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
            ]}
          />
        );

      case "prospek":
        return (
          <CrudPage
            title="Database Prospek" table="prospects" data={db.prospects} reload={reloadAll} token={token}
            searchKeys={["nama", "source"]}
            fields={[
              { key: "nama", label: "Nama Usaha / Lead", type: "text" },
              { key: "source", label: "Lead Source", type: "select", options: ["Google Maps", "Instagram", "Referensi", "Pameran", "Website"] },
              { key: "prioritas", label: "Prioritas", type: "select", options: ["A", "B", "C"] },
              { key: "potensi", label: "Potensi", type: "text" },
              { key: "estimasi_omzet", label: "Estimasi Omzet (Rp)", type: "number" },
              { key: "status", label: "Status", type: "select", options: ["Belum Dikunjungi", "Visit", "Follow Up", "Negosiasi", "Trial", "Closing", "Lost"] },
              { key: "tanggal_masuk", label: "Tanggal Masuk", type: "date" },
            ]}
            columns={[
              { key: "id", label: "ID" }, { key: "nama", label: "Nama" }, { key: "source", label: "Source" }, { key: "prioritas", label: "Prio" },
              { key: "estimasi_omzet", label: "Est. Omzet", render: (r) => fmtRp(r.estimasi_omzet) },
              { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
            ]}
          />
        );

      case "followup": {
        const dueToday = db.followups.filter((f) => f.reminder === todayISO());
        return (
          <div>
            {dueToday.length > 0 && (
              <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3">
                <PhoneCall size={16} className="mt-0.5 shrink-0" />
                <span><b>{dueToday.length} follow up</b> jatuh tempo hari ini: {dueToday.map((f) => f.customer).join(", ")}</span>
              </div>
            )}
            <CrudPage
              title="Follow Up" table="followups" data={db.followups} reload={reloadAll} token={token}
              searchKeys={["customer", "pic"]}
              fields={[
                { key: "tanggal", label: "Tanggal", type: "date" },
                { key: "jam", label: "Jam", type: "time" },
                { key: "customer", label: "Customer", type: "text" },
                { key: "pic", label: "PIC", type: "text" },
                { key: "hasil", label: "Hasil Follow Up", type: "textarea" },
                { key: "reminder", label: "Reminder", type: "date" },
                { key: "next_action", label: "Next Action", type: "text" },
                { key: "status", label: "Status", type: "select", options: ["Terjadwal", "Selesai", "Terlewat"] },
              ]}
              columns={[
                { key: "tanggal", label: "Tanggal" }, { key: "jam", label: "Jam" }, { key: "customer", label: "Customer" },
                { key: "next_action", label: "Next Action" },
                { key: "reminder", label: "Reminder", render: (r) => <span className={r.reminder === todayISO() ? "text-amber-600 font-semibold" : ""}>{r.reminder}</span> },
                { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
              ]}
            />
          </div>
        );
      }

      case "kunjungan":
        return (
          <CrudPage
            title="Kunjungan Sales" table="visits" data={db.visits} reload={reloadAll} token={token}
            searchKeys={["customer", "sales"]}
            fields={[
              { key: "tanggal", label: "Tanggal", type: "date" },
              { key: "sales", label: "Sales", type: "text" },
              { key: "customer", label: "Customer", type: "text" },
              { key: "check_in", label: "Check In", type: "time" },
              { key: "check_out", label: "Check Out", type: "time" },
              { key: "hasil", label: "Hasil", type: "textarea" },
              { key: "permintaan_customer", label: "Permintaan Customer", type: "text" },
              { key: "kompetitor", label: "Kompetitor", type: "text" },
              { key: "next_visit", label: "Next Visit", type: "date" },
            ]}
            columns={[
              { key: "tanggal", label: "Tanggal" }, { key: "sales", label: "Sales" }, { key: "customer", label: "Customer" },
              { key: "check_in", label: "In" }, { key: "check_out", label: "Out" }, { key: "next_visit", label: "Next Visit" },
            ]}
          />
        );

      case "penawaran": {
        const withCalc = (r) => {
          const sub = r.qty * r.harga;
          const afterDiskon = sub - (sub * (r.diskon || 0)) / 100;
          return afterDiskon + (afterDiskon * (r.ppn || 0)) / 100;
        };
        return (
          <CrudPage
            title="Penawaran (Quotation)" table="quotations" data={db.quotations} reload={reloadAll} token={token}
            searchKeys={["customer", "produk"]}
            fields={[
              { key: "tanggal", label: "Tanggal", type: "date" },
              { key: "customer", label: "Customer", type: "text" },
              { key: "produk", label: "Produk", type: "select", options: db.products.map((p) => p.nama) },
              { key: "qty", label: "Qty", type: "number" },
              { key: "harga", label: "Harga Satuan", type: "number" },
              { key: "diskon", label: "Diskon (%)", type: "number" },
              { key: "ppn", label: "PPN (%)", type: "number" },
              { key: "status", label: "Status", type: "select", options: ["Menunggu", "Disetujui", "Ditolak"] },
            ]}
            columns={[
              { key: "id", label: "No. Quotation" }, { key: "tanggal", label: "Tanggal" }, { key: "customer", label: "Customer" },
              { key: "produk", label: "Produk" }, { key: "qty", label: "Qty" },
              { key: "grandTotal", label: "Grand Total", render: (r) => fmtRp(withCalc(r)) },
              { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
            ]}
          />
        );
      }

      case "order": {
        const withTotal = (r) => r.qty * r.harga + Number(r.ongkir || 0);
        return (
          <CrudPage
            title="Order" table="orders" data={db.orders} reload={reloadAll} token={token}
            searchKeys={["customer", "produk"]}
            fields={[
              { key: "tanggal", label: "Tanggal", type: "date" },
              { key: "customer", label: "Customer", type: "text" },
              { key: "produk", label: "Produk", type: "select", options: db.products.map((p) => p.nama) },
              { key: "qty", label: "Qty", type: "number" },
              { key: "harga", label: "Harga Satuan", type: "number" },
              { key: "ongkir", label: "Ongkir", type: "number" },
              { key: "status", label: "Status", type: "select", options: ["Belum Bayar", "Lunas", "Kirim", "Selesai"] },
            ]}
            columns={[
              { key: "id", label: "No. Order" }, { key: "tanggal", label: "Tanggal" }, { key: "customer", label: "Customer" },
              { key: "produk", label: "Produk" }, { key: "qty", label: "Qty" },
              { key: "total", label: "Total", render: (r) => fmtRp(withTotal(r)) },
              { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
            ]}
          />
        );
      }

      case "produk":
        return (
          <CrudPage
            title="Master Produk" table="products" data={db.products} reload={reloadAll} token={token}
            searchKeys={["nama", "kategori"]}
            fields={[
              { key: "nama", label: "Nama Produk", type: "text" },
              { key: "kategori", label: "Kategori", type: "select", options: ["Keju Aroma", "Pisang Aroma"] },
              { key: "moq", label: "MOQ", type: "number" },
              { key: "harga_distributor", label: "Harga Distributor", type: "number" },
              { key: "harga_reseller", label: "Harga Reseller", type: "number" },
              { key: "harga_horeca", label: "Harga HORECA", type: "number" },
            ]}
            columns={[
              { key: "nama", label: "Produk" }, { key: "kategori", label: "Kategori" }, { key: "moq", label: "MOQ" },
              { key: "harga_distributor", label: "Distributor", render: (r) => fmtRp(r.harga_distributor) },
              { key: "harga_reseller", label: "Reseller", render: (r) => fmtRp(r.harga_reseller) },
              { key: "harga_horeca", label: "HORECA", render: (r) => fmtRp(r.harga_horeca) },
              { key: "margin", label: "Margin", render: (r) => fmtRp(r.harga_horeca - r.harga_distributor) },
            ]}
          />
        );

      case "piutang":
        return (
          <CrudPage
            title="Piutang" table="receivables" data={db.receivables} reload={reloadAll} token={token}
            searchKeys={["customer"]}
            fields={[
              { key: "customer", label: "Customer", type: "text" },
              { key: "jatuh_tempo", label: "Jatuh Tempo", type: "date" },
              { key: "nominal", label: "Nominal", type: "number" },
              { key: "sudah_bayar", label: "Sudah Bayar", type: "number" },
            ]}
            columns={[
              { key: "id", label: "Invoice" }, { key: "customer", label: "Customer" },
              { key: "jatuh_tempo", label: "Jatuh Tempo", render: (r) => {
                const overdue = r.jatuh_tempo < todayISO() && r.nominal - r.sudah_bayar > 0;
                return <span className={overdue ? "text-rose-600 font-semibold" : ""}>{r.jatuh_tempo}{overdue && " ⚠"}</span>;
              }},
              { key: "nominal", label: "Nominal", render: (r) => fmtRp(r.nominal) },
              { key: "sudah_bayar", label: "Sudah Bayar", render: (r) => fmtRp(r.sudah_bayar) },
              { key: "sisa", label: "Sisa", render: (r) => {
                const sisa = r.nominal - r.sudah_bayar;
                return <span className={sisa > 0 ? "text-rose-600 font-medium" : "text-emerald-600 font-medium"}>{fmtRp(sisa)}</span>;
              }},
            ]}
          />
        );

      case "sales":
        return <TargetPage sales={db.sales} reload={reloadAll} token={token} />;

      case "kpi":
        return <KpiDashboardPage orders={db.orders} customers={db.customers} prospects={db.prospects} />;

      case "laporan":
        return <ReportsPage orders={db.orders} sales={db.sales} />;

      case "setting":
        return <SettingsPage profile={profile} user={auth.user} onLogout={handleLogout} />;

      default:
        return null;
    }
  }

  return (
    <div className="flex h-full min-h-[640px] bg-slate-50 text-slate-800" style={{ fontFamily: "'Manrope', ui-sans-serif, system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');`}</style>

      <aside className={`fixed lg:static z-40 inset-y-0 left-0 w-64 bg-slate-900 text-slate-200 flex flex-col transform transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
        <div className="flex items-center gap-2 px-5 py-5 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center font-bold text-slate-900">A</div>
          <div>
            <div className="font-bold text-white text-sm leading-tight">Aroma HORECA</div>
            <div className="text-[11px] text-slate-400">Sales & CRM System</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {visibleMenu.map((m) => {
            const Icon = m.icon;
            const isActive = active === m.key;
            return (
              <button key={m.key} onClick={() => { setActive(m.key); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm mb-0.5 transition-colors ${isActive ? "bg-white/10 text-white font-semibold" : "text-slate-300 hover:bg-white/5"}`}>
                <Icon size={16} />{m.label}
                {isActive && <ChevronRight size={14} className="ml-auto opacity-60" />}
              </button>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-white/10 text-[11px] text-slate-400 flex items-center justify-between">
          <span>{profile?.nama} <span className="opacity-60 capitalize">({profile?.role})</span></span>
          <button onClick={handleLogout} className="text-slate-300 hover:text-white"><LogOut size={14} /></button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-slate-500" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
            <span className="text-sm font-medium text-slate-500">{MENU.find((m) => m.key === active)?.label}</span>
          </div>
          <div className="flex items-center gap-3">
            {loadingData && <Loader2 size={16} className="animate-spin text-slate-300" />}
            {followUpDueToday > 0 && (
              <button onClick={() => setActive("followup")} className="relative text-slate-500 hover:text-slate-900">
                <PhoneCall size={18} />
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">{followUpDueToday}</span>
              </button>
            )}
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-semibold">{(profile?.nama || "?")[0]}</div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{renderPage()}</main>
      </div>
    </div>
  );
}
