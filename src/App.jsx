
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Upload, Trash2, BarChart3, FilePlus, RefreshCw } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie } from 'recharts'

const LS_KEY = 'garageBook_v1'
const todayStr = () => new Date().toISOString().slice(0,10)
const toNumber = v => (v === '' || v == null ? 0 : Number(v))
const fmt = n => new Intl.NumberFormat('ar-JO', { style:'currency', currency:'JOD' }).format(n||0)
const monthsAr = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

function monthKey(dateStr){
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}
function groupByMonth(items, amountFn){
  const map = new Map()
  items.forEach(it=>{
    const k = monthKey(it.date)
    map.set(k, (map.get(k)||0) + amountFn(it))
  })
  return Array.from(map.entries()).sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>{
    const [y,m] = k.split('-')
    return { key:k, name:`${monthsAr[Number(m)-1]} ${y}`, value:v }
  })
}

export default function App(){
  const [invoices, setInvoices] = useState([])
  const [expenses, setExpenses] = useState([])

  useEffect(()=>{
    const raw = localStorage.getItem(LS_KEY)
    if (raw){
      try{
        const parsed = JSON.parse(raw)
        setInvoices(parsed.invoices||[])
        setExpenses(parsed.expenses||[])
      }catch{}
    }
  },[])

  useEffect(()=>{
    localStorage.setItem(LS_KEY, JSON.stringify({ invoices, expenses }))
  }, [invoices, expenses])

  const addInvoice = inv => setInvoices(p=>[{ id:crypto.randomUUID(), ...inv }, ...p])
  const deleteInvoice = id => setInvoices(p=>p.filter(i=>i.id!==id))
  const addExpense = ex => setExpenses(p=>[{ id:crypto.randomUUID(), ...ex }, ...p])
  const deleteExpense = id => setExpenses(p=>p.filter(e=>e.id!==id))

  const totals = useMemo(()=>{
    const revenue = invoices.reduce((s,i)=> s + toNumber(i.serviceCost)+toNumber(i.partsCost), 0)
    const paid = invoices.reduce((s,i)=> s + toNumber(i.paid), 0)
    const ar = revenue - paid
    const out = expenses.reduce((s,e)=> s + toNumber(e.amount), 0)
    const profit = revenue - out
    return { revenue, paid, ar, out, profit }
  }, [invoices, expenses])

  const revenueByMonth = useMemo(()=> groupByMonth(invoices, i=> toNumber(i.serviceCost)+toNumber(i.partsCost)), [invoices])
  const expensesByMonth = useMemo(()=> groupByMonth(expenses, e=> toNumber(e.amount)), [expenses])
  const union = Array.from(new Set([...revenueByMonth.map(d=>d.key), ...expensesByMonth.map(d=>d.key)])).sort()
  const chartMonthly = union.map(k=>{
    const rev = revenueByMonth.find(x=>x.key===k)?.value || 0
    const exp = expensesByMonth.find(x=>x.key===k)?.value || 0
    const [y,m] = k.split('-')
    return { name: `${monthsAr[Number(m)-1]} ${y}`, الإيرادات: rev, المصاريف: exp }
  })

  const [tab, setTab] = useState('invoices')
  const onExport = () => {
    const blob = new Blob([JSON.stringify({ invoices, expenses }, null, 2)], { type:'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `garage-data-${todayStr()}.json`
    a.click(); URL.revokeObjectURL(url)
  }
  const fileRef = useRef(null)
  const onImport = e => {
    const f = e.target.files?.[0]; if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      try{
        const data = JSON.parse(reader.result)
        setInvoices(Array.isArray(data.invoices)? data.invoices : [])
        setExpenses(Array.isArray(data.expenses)? data.expenses : [])
        alert('تم استيراد البيانات ✅')
      }catch{ alert('ملف غير صالح') }
    }
    reader.readAsText(f)
  }

  return (
    <div className="container" dir="rtl">
      <div className="header">
        <div className="title">برنامج حسابات الورشة (بسيط وسريع)</div>
        <div className="flex">
          <button className="btn secondary" onClick={onExport}><Download size={16}/>تصدير</button>
          <button className="btn secondary" onClick={()=>fileRef.current?.click()}><Upload size={16}/>استيراد</button>
          <input ref={fileRef} type="file" className="hidden" accept="application/json" onChange={onImport}/>
          <button className="btn danger" onClick={()=>{ if(confirm('مسح كل البيانات؟')){ setInvoices([]); setExpenses([]); localStorage.removeItem(LS_KEY)} }}><Trash2 size={16}/>مسح الكل</button>
        </div>
      </div>

      {/* Stats */}
      <div className="row row-5" style={{margin:'12px 0'}}>
        {[
          ['إجمالي الإيرادات', totals.revenue],
          ['إجمالي المصاريف', totals.out],
          ['صافي الربح', totals.profit],
          ['المدفوع من العملاء', totals.paid],
          ['المتبقي على العملاء', totals.ar],
        ].map(([label,val])=> (
          <div key={label} className="card stat">
            <div className="label">{label}</div>
            <div className="v">{fmt(val)}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs">
        {['invoices','expenses','dashboard'].map(t=> (
          <button key={t} className={`tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>
            {t==='invoices'?'فواتير': t==='expenses'?'مصاريف':'لوحة تحكم'}
          </button>
        ))}
      </div>

      {tab==='invoices' && <Invoices invoices={invoices} onAdd={addInvoice} onDelete={deleteInvoice} />}
      {tab==='expenses' && <Expenses expenses={expenses} onAdd={addExpense} onDelete={deleteExpense} />}
      {tab==='dashboard' && <Dashboard chartMonthly={chartMonthly} totals={totals} />}

      <div className="footer">يعمل محليًا داخل المتصفح ويُخزّن في LocalStorage. للتعدد الحقيقي للمستخدمين، اربطه بـ Supabase لاحقًا.</div>
    </div>
  )
}

function Invoices({ invoices, onAdd, onDelete }){
  const [form, setForm] = useState({
    date: todayStr(), customer:'', phone:'', desc:'',
    serviceCategory:'غيار زيت',
    serviceCost:'', partsCost:'', paid:'', method:'كاش'
  })
  const total = toNumber(form.serviceCost)+toNumber(form.partsCost)
  const balance = total - toNumber(form.paid)
  const handle = (k,v)=> setForm(p=>({...p,[k]:v}))
  const submit = e => {
    e.preventDefault()
    if (!form.customer && !form.desc) return alert('أدخل على الأقل اسم العميل أو وصف الخدمة')
    onAdd(form)
    setForm({ date: todayStr(), customer:'', phone:'', desc:'', serviceCategory:'غيار زيت', serviceCost:'', partsCost:'', paid:'', method: form.method })
  }

  const [filter, setFilter] = useState({ q:'', from:'', to:'' })
  const filtered = useMemo(()=>{
    return invoices.filter(i=>{
      const okQ = filter.q ? (i.customer?.includes(filter.q) || i.desc?.includes(filter.q)) : true
      const okFrom = filter.from ? (new Date(i.date) >= new Date(filter.from)) : true
      const okTo = filter.to ? (new Date(i.date) <= new Date(filter.to)) : true
      return okQ && okFrom && okTo
    })
  }, [invoices, filter])

  const totalFiltered = filtered.reduce((s,i)=> s + toNumber(i.serviceCost)+toNumber(i.partsCost), 0)
  const paidFiltered = filtered.reduce((s,i)=> s + toNumber(i.paid), 0)

  return (
    <div className="row" style={{marginTop:12}}>
      <div className="card">
        <div className="card-h"><div className="card-t"><FilePlus size={16}/>إضافة فاتورة</div></div>
        <div className="card-c">
          <form onSubmit={submit} className="row row-6">
            <div><label className="label">اسم العميل</label><input className="input" value={form.customer} onChange={e=>handle('customer', e.target.value)} placeholder="مثال: أحمد" /></div>
            <div><label className="label">الهاتف</label><input className="input" value={form.phone} onChange={e=>handle('phone', e.target.value)} placeholder="07XXXXXXXX" /></div>
            <div><label className="label">التاريخ</label><input className="input" type="date" value={form.date} onChange={e=>handle('date', e.target.value)} /></div>
            <div className="row" style={{gridColumn:'1 / -1'}}><label className="label">وصف الخدمة</label><input className="input" value={form.desc} onChange={e=>handle('desc', e.target.value)} placeholder="تغيير زيت / ميكانيك / كهرباء ..." /></div>
            <div><label className="label">تصنيف الخدمة</label>
              <select className="select" value={form.serviceCategory} onChange={e=>handle('serviceCategory', e.target.value)}>
                <option>غيار زيت</option>
                <option>تغيير خلايا بطارية</option>
                <option>نظام الفرامل</option>
                <option>ميكانيك</option>
                <option>اخرى</option>
              </select>
            </div>
            <div><label className="label">تكلفة الخدمة</label><input className="input" type="number" value={form.serviceCost} onChange={e=>handle('serviceCost', e.target.value)} /></div>
            <div><label className="label">قيمة القطع</label><input className="input" type="number" value={form.partsCost} onChange={e=>handle('partsCost', e.target.value)} /></div>
            <div><label className="label">إجمالي الفاتورة</label><input className="input" value={total} readOnly /></div>
            <div><label className="label">المدفوع</label><input className="input" type="number" value={form.paid} onChange={e=>handle('paid', e.target.value)} /></div>
            <div><label className="label">المتبقي</label><input className="input" value={balance} readOnly /></div>
            <div><label className="label">طريقة الدفع</label>
              <select className="select" value={form.method} onChange={e=>handle('method', e.target.value)}>
                <option>كاش</option><option>شبكة</option><option>تحويل</option>
              </select>
            </div>
            <div style={{gridColumn:'1 / -1', display:'flex', justifyContent:'flex-end'}}>
              <button className="btn" type="submit">حفظ الفاتورة</button>
            </div>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><div className="card-t">سجل الفواتير</div></div>
        <div className="card-c">
          <div className="search-row">
            <input className="input" placeholder="بحث: عميل/وصف" value={filter.q} onChange={e=>setFilter(f=>({...f,q:e.target.value}))} />
            <div className="flex"><span className="label">من</span><input className="input" type="date" value={filter.from} onChange={e=>setFilter(f=>({...f,from:e.target.value}))} /></div>
            <div className="flex"><span className="label">إلى</span><input className="input" type="date" value={filter.to} onChange={e=>setFilter(f=>({...f,to:e.target.value}))} /></div>
            <button className="btn" onClick={()=>setFilter({q:'',from:'',to:''})}><RefreshCw size={16}/>تصفير</button>
          </div>

          <div style={{overflowX:'auto'}}>
            <table className="table">
              <thead><tr>
                <th>التاريخ</th><th>العميل</th><th>الهاتف</th><th>الوصف</th><th>التصنيف</th><th>الخدمة</th><th>القطع</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th></th>
              </tr></thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id}>
                    <td>{e.date}</td>
                    <td>{e.category}</td>
                    <td>{fmt(e.amount)}</td>
                    <td>{e.notes}</td>
                    <td>
                      <button className="btn" onClick={() => onDelete(e.id)}>
                        <Trash2 size={16}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{display:'flex',gap:16,justifyContent:'flex-end',marginTop:8,fontSize:12}}>
            <div>الإجمالي: <b>{fmt(total)}</b></div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Expenses({ expenses, onAdd, onDelete }){
  const [form, setForm] = useState({ date: todayStr(), category:'', amount:'', notes:'' })
  const submit = e => { e.preventDefault(); if(!form.category || !form.amount) return alert('أدخل بند ومبلغ'); onAdd(form); setForm({ date: todayStr(), category:'', amount:'', notes:'' }) }
  const handle = (k,v)=> setForm(p=>({...p,[k]:v}))

  const [filter, setFilter] = useState({ q:'', from:'', to:'' })
  const filtered = useMemo(()=>{
    return expenses.filter(e=>{
      const okQ = filter.q ? (e.category?.includes(filter.q) || e.notes?.includes(filter.q)) : true
      const okFrom = filter.from ? (new Date(e.date) >= new Date(filter.from)) : true
      const okTo = filter.to ? (new Date(e.date) <= new Date(filter.to)) : true
      return okQ && okFrom && okTo
    })
  }, [expenses, filter])
  const total = filtered.reduce((s,e)=> s + toNumber(e.amount), 0)

  return (
    <div className="row" style={{marginTop:12}}>
      <div className="card">
        <div className="card-h"><div className="card-t"><FilePlus size={16}/>إضافة مصروف</div></div>
        <div className="card-c">
          <form onSubmit={submit} className="row row-6">
            <div><label className="label">التاريخ</label><input className="input" type="date" value={form.date} onChange={e=>handle('date', e.target.value)} /></div>
            <div><label className="label">البند</label><input className="input" value={form.category} onChange={e=>handle('category', e.target.value)} placeholder="إيجار/كهرباء/رواتب..." /></div>
            <div><label className="label">المبلغ</label><input className="input" type="number" value={form.amount} onChange={e=>handle('amount', e.target.value)} /></div>
            <div style={{gridColumn:'1 / -1'}}><label className="label">ملاحظات</label><input className="input" value={form.notes} onChange={e=>handle('notes', e.target.value)} placeholder="اختياري" /></div>
            <div style={{gridColumn:'1 / -1', display:'flex', justifyContent:'flex-end'}}><button className="btn" type="submit">حفظ المصروف</button></div>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><div className="card-t">سجل المصاريف</div></div>
        <div className="card-c">
          <div className="search-row">
            <input className="input" placeholder="بحث: بند/ملاحظة" value={filter.q} onChange={e=>setFilter(f=>({...f,q:e.target.value}))} />
            <div className="flex"><span className="label">من</span><input className="input" type="date" value={filter.from} onChange={e=>setFilter(f=>({...f,from:e.target.value}))} /></div>
            <div className="flex"><span className="label">إلى</span><input className="input" type="date" value={filter.to} onChange={e=>setFilter(f=>({...f,to:e.target.value}))} /></div>
            <button className="btn" onClick={()=>setFilter({q:'',from:'',to:''})}><RefreshCw size={16}/>تصفير</button>
          </div>

          <div style={{overflowX:'auto'}}>
            <table className="table">
              <thead><tr><th>التاريخ</th><th>البند</th><th>المبلغ</th><th>ملاحظات</th><th></th></tr></thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id}>
                    <td>{e.date}</td>
                    <td>{e.category}</td>
                    <td>{fmt(e.amount)}</td>
                    <td>{e.notes}</td>
                    <td><button className="btn" onClick={() => onDelete(e.id)}><Trash2 size={16}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{display:'flex',gap:16,justifyContent:'flex-end',marginTop:8,fontSize:12}}>
            <div>إجمالي المصاريف: <b>{fmt(total)}</b></div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Dashboard({ chartMonthly, totals }){
  return (
    <div className="row" style={{marginTop:12}}>
      <div className="card">
        <div className="card-h"><div className="card-t"><BarChart3 size={16}/> ملخص شهري</div></div>
        <div className="card-c">
          <div style={{height:260}}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartMonthly}>
                <XAxis dataKey="name" interval={0} angle={-10} textAnchor="end" height={50} />
                <YAxis />
                <Tooltip formatter={(v)=>fmt(v)} />
                <Legend />
                <Bar dataKey="الإيرادات" />
                <Bar dataKey="المصاريف" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><div className="card-t">توزيع الإيرادات مقابل المصاريف</div></div>
        <div className="card-c">
          <div style={{height:260}}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie dataKey="value" nameKey="name" data={[{name:'الإيرادات', value: totals.revenue},{name:'المصاريف', value: totals.out}]} cx="50%" cy="50%" outerRadius={90} label />
                <Tooltip formatter={(v)=>fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
