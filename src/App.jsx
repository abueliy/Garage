import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Upload, Trash2, BarChart3, FilePlus, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Pie, PieChart, Legend } from "recharts";

// ================= Helpers =================
const todayStr = () => new Date().toISOString().slice(0, 10);
const toNumber = (v) => (v === "" || v == null ? 0 : Number(v));
const formatCurrency = (n) => new Intl.NumberFormat("ar-JO", { style: "currency", currency: "JOD" }).format(n || 0);
const monthsAr = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

function monthKey(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function groupByMonth(items, amountFn) {
  const map = new Map();
  items.forEach((it) => {
    const k = monthKey(it.date);
    const curr = map.get(k) || 0;
    map.set(k, curr + amountFn(it));
  });
  const arr = Array.from(map.entries())
    .sort((a,b)=>a[0].localeCompare(b[0]))
    .map(([k,v])=>{
      const [y,m] = k.split("-");
      return { key:k, label: `${monthsAr[Number(m)-1]} ${y}`, value: v };
    });
  return arr;
}

// ================= KV store helpers =================
async function loadAllFromKV() {
  const res = await fetch("/api/store", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load from KV");
  return res.json(); // { invoices, expenses }
}
async function saveAllToKV(next) {
  const res = await fetch("/api/store", {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify(next),
  });
  if (!res.ok) throw new Error("Failed to save to KV");
}

// ================= Data hook (uses KV instead of localStorage) =================
function useGarageData() {
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    try {
      const data = await loadAllFromKV();
      setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
      setExpenses(Array.isArray(data.expenses) ? data.expenses : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const saveAll = async (next) => {
    try {
      await saveAllToKV(next);
    } catch (e) {
      console.error(e);
      alert("تعذّر الحفظ إلى المخزن المركزي");
    }
  };

  useEffect(() => {
    // تحميل أولي
    loadAll();
    // تحديث تلقائي كل 5 ثوانٍ للمزامنة بين الأجهزة
    const id = setInterval(loadAll, 5000);
    return () => clearInterval(id);
  }, []);

  const resetAll = async () => {
    if (!confirm("سيتم مسح جميع البيانات المركزية. هل أنت متأكد؟")) return;
    const empty = { invoices: [], expenses: [] };
    setInvoices([]);
    setExpenses([]);
    await saveAll(empty);
  };

  return { invoices, setInvoices, expenses, setExpenses, resetAll, saveAll, loading, reload: loadAll };
}

// ================= App =================
export default function GarageBookApp() {
  const { invoices, setInvoices, expenses, setExpenses, resetAll, saveAll, loading } = useGarageData();

  // ===== Derived stats =====
  const totals = useMemo(() => {
    const revenue = invoices.reduce((s, i) => s + (toNumber(i.serviceCost) + toNumber(i.partsCost)), 0);
    const paid = invoices.reduce((s, i) => s + toNumber(i.paid), 0);
    const ar = revenue - paid; // المتبقي على العملاء
    const out = expenses.reduce((s, e) => s + toNumber(e.amount), 0);
    const profit = revenue - out;
    return { revenue, paid, ar, out, profit };
  }, [invoices, expenses]);

  // Charts data
  const revenueByMonth = useMemo(() => groupByMonth(invoices, i => toNumber(i.serviceCost)+toNumber(i.partsCost)), [invoices]);
  const expensesByMonth = useMemo(() => groupByMonth(expenses, e => toNumber(e.amount)), [expenses]);
  const monthsUnion = Array.from(new Set([...revenueByMonth.map(d=>d.key), ...expensesByMonth.map(d=>d.key)])).sort();
  const chartMonthly = monthsUnion.map(k=>{
    const rev = revenueByMonth.find(x=>x.key===k)?.value || 0;
    const exp = expensesByMonth.find(x=>x.key===k)?.value || 0;
    const [y,m] = k.split("-");
    return { name: `${monthsAr[Number(m)-1]} ${y}`, الإيرادات: rev, المصاريف: exp };
  });

  // ===== Handlers (now save to KV) =====
  const addInvoice = (inv) => {
    const next = { invoices: [{ id: crypto.randomUUID(), ...inv }, ...invoices], expenses };
    setInvoices(next.invoices);
    saveAll(next);
  };
  const deleteInvoice = (id) => {
    const next = { invoices: invoices.filter(i => i.id !== id), expenses };
    setInvoices(next.invoices);
    saveAll(next);
  };
  const addExpense = (exp) => {
    const next = { invoices, expenses: [{ id: crypto.randomUUID(), ...exp }, ...expenses] };
    setExpenses(next.expenses);
    saveAll(next);
  };
  const deleteExpense = (id) => {
    const next = { invoices, expenses: expenses.filter(e => e.id !== id) };
    setExpenses(next.expenses);
    saveAll(next);
  };

  const onExport = () => {
    const blob = new Blob([JSON.stringify({ invoices, expenses }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `garage-data-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  };
  const fileRef = useRef(null);
  const onImport = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result);
        const next = {
          invoices: Array.isArray(data.invoices) ? data.invoices : invoices,
          expenses: Array.isArray(data.expenses) ? data.expenses : expenses
        };
        // تحديث الحالة + الحفظ في KV
        if (Array.isArray(data.invoices)) setInvoices(data.invoices);
        if (Array.isArray(data.expenses)) setExpenses(data.expenses);
        await saveAll(next);
        alert("تم استيراد البيانات وحفظها في المخزن المركزي ✅");
      } catch (err) {
        alert("ملف غير صالح");
      }
    };
    reader.readAsText(f);
  };

  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">
          برنامج حسابات الورشة (سحابي عبر Vercel KV)
        </h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onExport}><Download className="w-4 h-4 ml-1"/>تصدير</Button>
          <Button variant="secondary" onClick={()=>fileRef.current?.click()}><Upload className="w-4 h-4 ml-1"/>استيراد</Button>
          <input type="file" ref={fileRef} className="hidden" accept="application/json" onChange={onImport}/>
          <Button variant="destructive" onClick={resetAll}><Trash2 className="w-4 h-4 ml-1"/>مسح الكل</Button>
        </div>
      </header>

      {loading && (
        <div className="text-sm bg-blue-50 border border-blue-100 rounded-md px-3 py-2">
          جارٍ مزامنة البيانات من المخزن المركزي…
        </div>
      )}

      <StatsRow totals={totals} />

      <Tabs defaultValue="invoices" className="w-full">
        <TabsList className="grid w-full md:w-auto grid-cols-3 md:inline-flex">
          <TabsTrigger value="invoices">فواتير</TabsTrigger>
          <TabsTrigger value="expenses">مصاريف</TabsTrigger>
          <TabsTrigger value="dashboard">لوحة تحكم</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center"><FilePlus className="w-4 h-4 ml-2"/>إضافة فاتورة</CardTitle></CardHeader>
            <CardContent>
              <InvoiceForm onSubmit={addInvoice} />
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-lg">سجل الفواتير</CardTitle></CardHeader>
            <CardContent>
              <InvoiceTable items={invoices} onDelete={deleteInvoice} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center"><FilePlus className="w-4 h-4 ml-2"/>إضافة مصروف</CardTitle></CardHeader>
            <CardContent>
              <ExpenseForm onSubmit={addExpense} />
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-lg">سجل المصاريف</CardTitle></CardHeader>
            <CardContent>
              <ExpenseTable items={expenses} onDelete={deleteExpense} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center"><BarChart3 className="w-4 h-4 ml-2"/>ملخص شهري</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartMonthly}>
                    <XAxis dataKey="name" interval={0} angle={-10} textAnchor="end" height={50} />
                    <YAxis />
                    <Tooltip formatter={(v)=>formatCurrency(v)} />
                    <Legend />
                    <Bar dataKey="الإيرادات" />
                    <Bar dataKey="المصاريف" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-lg">توزيع الإيرادات مقابل المصاريف</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie dataKey="value" nameKey="name" data={[{name:"الإيرادات", value: totals.revenue},{name:"المصاريف", value: totals.out}]} cx="50%" cy="50%" outerRadius={90} label />
                    <Tooltip formatter={(v)=>formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <footer className="text-sm text-muted-foreground text-center pt-2">
        البيانات محفوظة مركزيًا عبر Vercel KV — استعمل “تصدير” للاحتفاظ بنسخة احتياطية.
      </footer>
    </div>
  );
}

// ================= UI Pieces =================
function StatsRow({ totals }){
  const items = [
    { label: "إجمالي الإيرادات", value: totals.revenue },
    { label: "إجمالي المصاريف", value: totals.out },
    { label: "صافي الربح", value: totals.profit },
    { label: "المدفوع من العملاء", value: totals.paid },
    { label: "المتبقي على العملاء", value: totals.ar },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {items.map((it, idx) => (
        <Card key={idx} className="shadow-sm">
          <CardHeader className="p-3 pb-0"><CardTitle className="text-sm text-muted-foreground">{it.label}</CardTitle></CardHeader>
          <CardContent className="p-3 pt-1"><div className="text-xl font-bold">{formatCurrency(it.value)}</div></CardContent>
        </Card>
      ))}
    </div>
  );
}

function InvoiceForm({ onSubmit }){
  const [form, setForm] = useState({
    date: todayStr(), customer: "", phone:"", desc:"",
    serviceCategory: "غيار زيت",
    serviceCost: "", partsCost: "", paid: "", method: "كاش"
  });

  const total = toNumber(form.serviceCost) + toNumber(form.partsCost);
  const balance = total - toNumber(form.paid);

  const handle = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const submit = (e) => {
    e.preventDefault();
    if (!form.customer && !form.desc) return alert("أدخل على الأقل اسم العميل أو وصف الخدمة");
    onSubmit(form);
    setForm({ date: todayStr(), customer: "", phone:"", desc:"", serviceCategory:"غيار زيت", serviceCost: "", partsCost: "", paid: "", method: form.method });
  };

  return (
    <form onSubmit={submit} className="grid md:grid-cols-6 gap-3">
      <div className="col-span-2">
        <Label>اسم العميل</Label>
        <Input value={form.customer} onChange={e=>handle("customer", e.target.value)} placeholder="مثال: أحمد" />
      </div>
      <div className="col-span-2">
        <Label>الهاتف</Label>
        <Input value={form.phone} onChange={e=>handle("phone", e.target.value)} placeholder="07XXXXXXXX" />
      </div>
      <div className="col-span-2">
        <Label>التاريخ</Label>
        <Input type="date" value={form.date} onChange={e=>handle("date", e.target.value)} />
      </div>
      <div className="md:col-span-6">
        <Label>وصف الخدمة</Label>
        <Input value={form.desc} onChange={e=>handle("desc", e.target.value)} placeholder="تغيير زيت / ميكانيك / كهرباء ..." />
      </div>
      <div>
        <Label>تصنيف الخدمة</Label>
        <Select value={form.serviceCategory} onValueChange={(v)=>handle("serviceCategory", v)}>
          <SelectTrigger><SelectValue placeholder="اختر التصنيف" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="غيار زيت">غيار زيت</SelectItem>
            <SelectItem value="تغيير خلايا بطارية">تغيير خلايا بطارية</SelectItem>
            <SelectItem value="نظام الفرامل">نظام الفرامل</SelectItem>
            <SelectItem value="ميكانيك">ميكانيك</SelectItem>
            <SelectItem value="اخرى">اخرى</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>تكلفة الخدمة</Label>
        <Input type="number" inputMode="decimal" value={form.serviceCost} onChange={e=>handle("serviceCost", e.target.value)} />
      </div>
      <div>
        <Label>قيمة القطع</Label>
        <Input type="number" inputMode="decimal" value={form.partsCost} onChange={e=>handle("partsCost", e.target.value)} />
      </div>
      <div>
        <Label>إجمالي الفاتورة</Label>
        <Input value={total} readOnly />
      </div>
      <div>
        <Label>المدفوع</Label>
        <Input type="number" inputMode="decimal" value={form.paid} onChange={e=>handle("paid", e.target.value)} />
      </div>
      <div>
        <Label>المتبقي</Label>
        <Input value={balance} readOnly />
      </div>
      <div>
        <Label>طريقة الدفع</Label>
        <Select value={form.method} onValueChange={(v)=>handle("method", v)}>
          <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="كاش">كاش</SelectItem>
            <SelectItem value="شبكة">شبكة</SelectItem>
            <SelectItem value="تحويل">تحويل</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="md:col-span-6 flex justify-end gap-2">
        <Button type="submit">حفظ الفاتورة</Button>
      </div>
    </form>
  );
}

function InvoiceTable({ items, onDelete }){
  const [filter, setFilter] = useState({ q: "", from: "", to: "", cat: "" });

  const filtered = useMemo(()=>{
    return items.filter(i=>{
      const okQ = filter.q ? (i.customer?.includes(filter.q) || i.desc?.includes(filter.q) || i.phone?.includes(filter.q)) : true;
      const okFrom = filter.from ? (new Date(i.date) >= new Date(filter.from)) : true;
      const okTo = filter.to ? (new Date(i.date) <= new Date(filter.to)) : true;
      const okCat = filter.cat ? (i.serviceCategory === filter.cat) : true;
      return okQ && okFrom && okTo && okCat;
    });
  }, [items, filter]);

  const total = filtered.reduce((s,i)=>s + toNumber(i.serviceCost)+toNumber(i.partsCost),0);
  const paid = filtered.reduce((s,i)=>s + toNumber(i.paid),0);

  return (
    <div className="space-y-3">
      <div className="grid md:grid-cols-5 gap-2">
        <Input placeholder="بحث: عميل/وصف/هاتف" value={filter.q} onChange={(e)=>setFilter(f=>({...f,q:e.target.value}))} />
        <div className="flex items-center gap-2">
          <Label className="whitespace-nowrap">من</Label>
          <Input type="date" value={filter.from} onChange={(e)=>setFilter(f=>({...f,from:e.target.value}))} />
        </div>
        <div className="flex items-center gap-2">
          <Label className="whitespace-nowrap">إلى</Label>
          <Input type="date" value={filter.to} onChange={(e)=>setFilter(f=>({...f,to:e.target.value}))} />
        </div>
        <Select value={filter.cat} onValueChange={(v)=>setFilter(f=>({...f,cat:v}))}>
          <SelectTrigger><SelectValue placeholder="فلتر: التصنيف" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">الكل</SelectItem>
            <SelectItem value="غيار زيت">غيار زيت</SelectItem>
            <SelectItem value="تغيير خلايا بطارية">تغيير خلايا بطارية</SelectItem>
            <SelectItem value="نظام الفرامل">نظام الفرامل</SelectItem>
            <SelectItem value="ميكانيك">ميكانيك</SelectItem>
            <SelectItem value="اخرى">اخرى</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={()=>setFilter({q:"",from:"",to:"",cat:""})}><RefreshCw className="w-4 h-4 ml-1"/>تصفير</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-right">التاريخ</TableHead>
            <TableHead className="text-right">العميل</TableHead>
            <TableHead className="text-right">الهاتف</TableHead>
            <TableHead className="text-right">الوصف</TableHead>
            <TableHead className="text-right">التصنيف</TableHead>
            <TableHead className="text-right">الخدمة</TableHead>
            <TableHead className="text-right">القطع</TableHead>
            <TableHead className="text-right">الإجمالي</TableHead>
            <TableHead className="text-right">المدفوع</TableHead>
            <TableHead className="text-right">المتبقي</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((i)=>{
            const total = toNumber(i.serviceCost)+toNumber(i.partsCost);
            const balance = total - toNumber(i.paid);
            return (
              <TableRow key={i.id}>
                <TableCell>{i.date}</TableCell>
                <TableCell className="font-medium">{i.customer}</TableCell>
                <TableCell>{i.phone}</TableCell>
                <TableCell>{i.desc}</TableCell>
                <TableCell>{i.serviceCategory || "—"}</TableCell>
                <TableCell>{formatCurrency(i.serviceCost)}</TableCell>
                <TableCell>{formatCurrency(i.partsCost)}</TableCell>
                <TableCell>{formatCurrency(total)}</TableCell>
                <TableCell>{formatCurrency(i.paid)}</TableCell>
                <TableCell className={balance>0?"text-red-600":""}>{formatCurrency(balance)}</TableCell>
                <TableCell className="text-left"><Button variant="ghost" onClick={()=>onDelete(i.id)}><Trash2 className="w-4 h-4"/></Button></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="flex justify-end gap-6 text-sm">
        <div>الإجمالي: <span className="font-bold">{formatCurrency(total)}</span></div>
        <div>المدفوع: <span className="font-bold">{formatCurrency(paid)}</span></div>
        <div>المتبقي: <span className="font-bold">{formatCurrency(total-paid)}</span></div>
      </div>
    </div>
  );
}

function ExpenseForm({ onSubmit }){
  const [form, setForm] = useState({ date: todayStr(), category: "", amount: "", notes:"" });
  const handle = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const submit = (e) => {
    e.preventDefault();
    if (!form.category || !form.amount) return alert("أدخل بند ومبلغ المصروف");
    onSubmit(form);
    setForm({ date: todayStr(), category: "", amount: "", notes:"" });
  };
  return (
    <form onSubmit={submit} className="grid md:grid-cols-6 gap-3">
      <div className="col-span-2">
        <Label>التاريخ</Label>
        <Input type="date" value={form.date} onChange={(e)=>handle("date", e.target.value)} />
      </div>
      <div className="col-span-2">
        <Label>البند</Label>
        <Input value={form.category} onChange={(e)=>handle("category", e.target.value)} placeholder="إيجار، كهرباء، رواتب..." />
      </div>
      <div className="col-span-2">
        <Label>المبلغ</Label>
        <Input type="number" inputMode="decimal" value={form.amount} onChange={(e)=>handle("amount", e.target.value)} />
      </div>
      <div className="md:col-span-6">
        <Label>ملاحظات</Label>
        <Input value={form.notes} onChange={(e)=>handle("notes", e.target.value)} placeholder="اختياري" />
      </div>
      <div className="md:col-span-6 flex justify-end">
        <Button type="submit">حفظ المصروف</Button>
      </div>
    </form>
  );
}

function ExpenseTable({ items, onDelete }){
  const [filter, setFilter] = useState({ from:"", to:"", q:"" });
  const filtered = useMemo(()=>{
    return items.filter(e=>{
      const okQ = filter.q ? (e.category?.includes(filter.q) || e.notes?.includes(filter.q)) : true;
      const okFrom = filter.from ? (new Date(e.date) >= new Date(filter.from)) : true;
      const okTo = filter.to ? (new Date(e.date) <= new Date(filter.to)) : true;
      return okQ && okFrom && okTo;
    });
  }, [items, filter]);

  const total = filtered.reduce((s,e)=>s + toNumber(e.amount),0);

  return (
    <div className="space-y-3">
      <div className="grid md:grid-cols-4 gap-2">
        <Input placeholder="بحث: بند/ملاحظة" value={filter.q} onChange={(e)=>setFilter(f=>({...f,q:e.target.value}))} />
        <div className="flex items-center gap-2">
          <Label className="whitespace-nowrap">من</Label>
          <Input type="date" value={filter.from} onChange={(e)=>setFilter(f=>({...f,from:e.target.value}))} />
        </div>
        <div className="flex items-center gap-2">
          <Label className="whitespace-nowrap">إلى</Label>
          <Input type="date" value={filter.to} onChange={(e)=>setFilter(f=>({...f,to:e.target.value}))} />
        </div>
        <Button variant="outline" onClick={()=>setFilter({q:"",from:"",to:""})}><RefreshCw className="w-4 h-4 ml-1"/>تصفير</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-right">التاريخ</TableHead>
            <TableHead className="text-right">البند</TableHead>
            <TableHead className="text-right">المبلغ</TableHead>
            <TableHead className="text-right">ملاحظات</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map(e=> (
            <TableRow key={e.id}>
              <TableCell>{e.date}</TableCell>
              <TableCell className="font-medium">{e.category}</TableCell>
              <TableCell>{formatCurrency(e.amount)}</TableCell>
              <TableCell>{e.notes}</TableCell>
              <TableCell className="text-left"><Button variant="ghost" onClick={()=>onDelete(e.id)}><Trash2 className="w-4 h-4"/></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex justify-end text-sm">إجمالي المصاريف: <span className="font-bold ml-1">{formatCurrency(total)}</span></div>
    </div>
  );
}
