// استبدل الدالة الحالية بهذا التعريف
function useGarageData() {
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    try {
      const res = await fetch('/api/store', { cache: 'no-store' });
      const data = await res.json();
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
      await fetch('/api/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
    } catch (e) {
      console.error(e);
      alert('تعذّر الحفظ إلى المخزن المركزي');
    }
  };

  useEffect(() => {
    loadAll();
    // تحديث خفيف بين الأجهزة كل 5 ثواني
    const id = setInterval(loadAll, 5000);
    return () => clearInterval(id);
  }, []);

  const resetAll = async () => {
    if (!confirm('سيتم مسح جميع البيانات المركزية. هل أنت متأكد؟')) return;
    const empty = { invoices: [], expenses: [] };
    setInvoices([]); setExpenses([]);
    await saveAll(empty);
  };

  return { invoices, setInvoices, expenses, setExpenses, resetAll, saveAll, loading, reload: loadAll };
}
