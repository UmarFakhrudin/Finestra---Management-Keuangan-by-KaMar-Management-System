import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Bill, Distributor, AppSettings } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { 
  ReceiptText, Trash2, CheckCircle2, History, CreditCard, 
  Search, Calendar, Tag, Truck, Clock, AlertCircle, 
  Box, Filter, ChevronDown, Plus, FileSpreadsheet, FileDown, X, Sparkles
} from 'lucide-react';
import { format, isBefore, startOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

export default function Bills({ profile, appSettings, onSave, setSyncStatus }: { 
  profile: UserProfile, 
  appSettings: AppSettings | null, 
  onSave?: () => void,
  setSyncStatus?: (status: 'idle' | 'saving' | 'saved' | 'error') => void
}) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  const themeColor = appSettings?.themeColor || '#3b82f6';

  // Filter state
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const today = startOfDay(new Date());
  
  // Form State
  const [formData, setFormData] = useState({
    category: 'sales' as 'sales' | 'non-sales',
    paymentType: 'tempo' as 'tunai' | 'tempo',
    date: format(new Date(), 'yyyy-MM-dd'),
    distributorId: '',
    itemName: '',
    amount: '',
    dueDate: '',
  });

  useEffect(() => {
    const qDist = query(collection(db, 'distributors'), where('ownerId', '==', profile.ownerId));
    const unsubDist = onSnapshot(qDist, (snap) => setDistributors(snap.docs.map(d => ({ id: d.id, ...d.data() } as Distributor))));

    const start = startOfMonth(new Date(selectedYear, selectedMonth));
    const end = endOfMonth(new Date(selectedYear, selectedMonth));

    const qBills = query(
      collection(db, 'bills'), 
      where('ownerId', '==', profile.ownerId),
      where('date', '>=', start.toISOString()),
      where('date', '<=', end.toISOString()),
      orderBy('date', 'desc')
    );

    const unsubBills = onSnapshot(qBills, (snap) => {
      setBills(snap.docs.map(d => ({ id: d.id, ...d.data() } as Bill)));
      setLoading(false);
    });

    return () => { unsubDist(); unsubBills(); };
  }, [profile.ownerId, selectedMonth, selectedYear]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.distributorId) return;

    const total = Number(formData.amount) || 0;
    const isTunai = formData.paymentType === 'tunai';

    setSyncStatus?.('saving');
    try {
      await addDoc(collection(db, 'bills'), {
        category: formData.category,
        distributorId: formData.distributorId,
        itemName: formData.itemName,
        cashAmount: isTunai ? total : 0,
        tempoAmount: isTunai ? 0 : total,
        shippingCost: 0,
        amount: total,
        dueDate: isTunai ? null : formData.dueDate,
        date: new Date(formData.date).toISOString(),
        createdAt: new Date().toISOString(),
        status: isTunai ? 'lunas' : 'pending',
        ownerId: profile.ownerId
      });

      onSave?.();
      setIsModalOpen(false);
      setFormData({
        category: 'sales',
        paymentType: 'tempo',
        date: format(new Date(), 'yyyy-MM-dd'),
        distributorId: '',
        itemName: '',
        amount: '',
        dueDate: '',
      });
    } catch (err) {
      console.error("Error saving bill:", err);
      setSyncStatus?.('error');
      setTimeout(() => setSyncStatus?.('idle'), 3000);
    }
  };

  const toggleStatus = async (bill: Bill) => {
    setSyncStatus?.('saving');
    try {
      const newStatus = bill.status === 'pending' ? 'lunas' : 'pending';
      await updateDoc(doc(db, 'bills', bill.id), { status: newStatus });
      onSave?.();
    } catch (err) {
      console.error("Error toggling status:", err);
      setSyncStatus?.('error');
      setTimeout(() => setSyncStatus?.('idle'), 3000);
    }
  };

  const deleteBill = async (id: string) => {
    setSyncStatus?.('saving');
    try {
      await deleteDoc(doc(db, 'bills', id));
      onSave?.();
    } catch (err) {
      console.error("Error deleting bill:", err);
      setSyncStatus?.('error');
      setTimeout(() => setSyncStatus?.('idle'), 3000);
    }
  };

  const filteredBills = bills.filter(b => 
    b.itemName.toLowerCase().includes(search.toLowerCase()) ||
    distributors.find(d => d.id === b.distributorId)?.name.toLowerCase().includes(search.toLowerCase())
  );

  const totals = useMemo(() => {
    return filteredBills.reduce((acc, curr) => ({
      cash: acc.cash + (curr.cashAmount || 0),
      tempo: acc.tempo + (curr.tempoAmount || 0),
      shipping: acc.shipping + (curr.shippingCost || 0),
      grand: acc.grand + (curr.amount || 0)
    }), { cash: 0, tempo: 0, shipping: 0, grand: 0 });
  }, [filteredBills]);

  const months = [
    'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
    'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    show: { opacity: 1, x: 0, transition: { type: 'spring', damping: 25, stiffness: 300 } }
  };

  return (
    <div className="space-y-6 font-sans pb-10 text-zinc-300">
      {/* Top Filter Bar */}
      <div className="bg-zinc-100 dark:bg-[#141417] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative group min-w-[140px]">
             <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
                <Filter size={14} />
             </div>
             <select 
               value={selectedMonth}
               onChange={(e) => setSelectedMonth(Number(e.target.value))}
               className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-xs font-black tracking-widest focus:outline-none focus:border-amber-500 appearance-none uppercase"
             >
               {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
             </select>
             <ChevronDown size={12} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
          </div>

          <div className="relative group min-w-[120px]">
             <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
                <Calendar size={14} />
             </div>
             <select 
               value={selectedYear}
               onChange={(e) => setSelectedYear(Number(e.target.value))}
               className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-xs font-black tracking-widest focus:outline-none focus:border-amber-500 appearance-none"
             >
               {years.map(y => <option key={y} value={y}>{y}</option>)}
             </select>
             <ChevronDown size={12} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
          </div>
        </div>

        <div className="relative flex-1 w-full md:w-auto">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
          <input 
            type="text"
            placeholder="Cari..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-14 pr-6 text-sm focus:outline-none focus:border-zinc-700 transition-all font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button 
            onClick={() => setIsModalOpen(true)}
            style={{ backgroundColor: themeColor }}
            className="flex-1 md:flex-none px-6 py-3 text-white text-[11px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap shadow-lg shadow-blue-600/20 active:scale-95"
          >
            <Plus size={16} /> Tambah Tagihan
          </button>
          <button className="p-3 bg-emerald-600/10 border border-emerald-600/20 text-emerald-500 hover:bg-emerald-600/20 rounded-xl transition-all">
            <FileSpreadsheet size={18} />
          </button>
          <button className="p-3 bg-red-600/10 border border-red-600/20 text-red-500 hover:bg-red-600/20 rounded-xl transition-all">
            <FileDown size={18} />
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-zinc-100 dark:bg-[#141417] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-200 dark:bg-zinc-950/30 text-zinc-500 dark:text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] border-b border-zinc-200 dark:border-zinc-800">
                <th className="p-6 text-center w-16">No.</th>
                <th className="p-6">Tanggal</th>
                <th className="p-6">Distributor</th>
                <th className="p-6">Barang</th>
                <th className="p-6 text-center">Cash</th>
                <th className="p-6 text-center">Tempo</th>
                <th className="p-6 text-center">Ongkir</th>
                <th className="p-6 text-center">Status</th>
                <th className="p-6 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-[11px] font-bold text-zinc-400">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-32 text-center text-zinc-700 italic text-sm font-medium">
                    Data tidak ditemukan.
                  </td>
                </tr>
              ) : (
                filteredBills.map((b, i) => (
                  <tr key={b.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/40 transition-colors">
                    <td className="p-6 text-center text-zinc-600">{i + 1}</td>
                    <td className="p-6">{format(new Date(b.date), 'dd/MM/yyyy')}</td>
                    <td className="p-6 text-zinc-900 dark:text-white uppercase tracking-tight">{distributors.find(d => d.id === b.distributorId)?.name || '-'}</td>
                    <td className="p-6 text-zinc-500 dark:text-zinc-500 italic">{b.itemName}</td>
                    <td className="p-6 text-center text-emerald-500/80">{formatCurrency(b.cashAmount || 0)}</td>
                    <td className="p-6 text-center text-amber-500/80">{formatCurrency(b.tempoAmount || 0)}</td>
                    <td className="p-6 text-center text-blue-500/80">{formatCurrency(b.shippingCost || 0)}</td>
                    <td className="p-6 text-center">
                      <button 
                        onClick={() => toggleStatus(b)}
                        className={cn(
                          "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all",
                          b.status === 'lunas' 
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                            : "bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-[0_0_15px_-5px_rgba(245,158,11,0.3)]"
                        )}
                      >
                        {b.status}
                      </button>
                    </td>
                    <td className="p-6 text-center">
                      <button 
                        onClick={() => deleteBill(b.id)}
                        className="text-zinc-700 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* Total Row */}
            <tfoot className="bg-zinc-950/50 border-t border-zinc-800">
              <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
                <td colSpan={4} className="p-8 text-right">Total</td>
                <td className="p-8 text-center text-emerald-500">{formatCurrency(totals.cash)}</td>
                <td className="p-8 text-center text-amber-500">{formatCurrency(totals.tempo)}</td>
                <td className="p-8 text-center text-blue-500">{formatCurrency(totals.shipping)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Bottom Grand Total Card */}
      <div className="flex justify-end">
        <div className="w-full md:w-[400px] bg-[#141417]/80 backdrop-blur-xl border border-zinc-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 text-zinc-500 group-hover:scale-110 transition-transform">
             <ReceiptText size={120} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-4 relative z-10">Total Keseluruhan</p>
          <div className="flex items-baseline gap-2 relative z-10">
             <span className="text-3xl font-light text-white italic">Rp</span>
             <span className="text-5xl font-light text-white tracking-tighter">{totals.grand.toLocaleString('id-ID')}</span>
          </div>
        </div>
      </div>

      {/* Input Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-20">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-[#09090b]/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-xl bg-[#1d212b] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-zinc-800/50 flex items-center gap-4 bg-[#1d212b]">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                   <ChevronDown size={24} className="rotate-90" />
                </button>
                <h3 className="text-xl font-bold text-white">Input Tagihan Barang Masuk</h3>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-8 max-h-[85vh] overflow-y-auto custom-scrollbar">
                {/* Kategori Tagihan */}
                <div className="space-y-4">
                  <label className="text-xs font-bold text-zinc-400">Kategori Tagihan</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, category: 'sales' })}
                      className={cn(
                        "py-4 rounded-xl text-sm font-black transition-all border border-transparent",
                        formData.category === 'sales' 
                          ? "text-white shadow-lg shadow-blue-600/20" 
                          : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800"
                      )}
                      style={formData.category === 'sales' ? { backgroundColor: themeColor } : {}}
                    >Tagihan Sales</button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, category: 'non-sales' })}
                      className={cn(
                        "py-4 rounded-xl text-sm font-black transition-all border border-transparent",
                        formData.category === 'non-sales' 
                          ? "bg-orange-600 text-white shadow-lg shadow-orange-600/20" 
                          : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800"
                      )}
                    >Non Sales</button>
                  </div>
                </div>

                {/* Jenis Pembayaran */}
                <div className="space-y-4">
                  <label className="text-xs font-bold text-zinc-400">Jenis Pembayaran</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, paymentType: 'tunai' })}
                      className={cn(
                        "py-4 rounded-xl transition-all border border-transparent flex flex-col items-center justify-center gap-1",
                        formData.paymentType === 'tunai' 
                          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" 
                          : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800"
                      )}
                    >
                      <span className="text-sm font-black">TUNAI (Cash)</span>
                      <span className="text-[10px] opacity-70">Otomatis Lunas</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, paymentType: 'tempo' })}
                      className={cn(
                        "py-4 rounded-xl transition-all border border-transparent flex flex-col items-center justify-center gap-1",
                        formData.paymentType === 'tempo' 
                          ? "bg-[#ce8e00] text-white shadow-lg shadow-amber-600/20" 
                          : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800"
                      )}
                    >
                      <span className="text-sm font-black">TEMPO (Kredit)</span>
                      <span className="text-[10px] opacity-70">Perlu Jatuh Tempo</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400">Nama Distributor</label>
                    <div className="relative">
                      <select
                        required
                        value={formData.distributorId}
                        onChange={(e) => setFormData({ ...formData, distributorId: e.target.value })}
                        className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-4 px-6 text-sm text-white focus:outline-none focus:border-blue-500 appearance-none font-medium"
                      >
                        <option value="">-- Pilih Supplier --</option>
                        {distributors.map(d => <option key={d.id} value={d.id} className="bg-zinc-900">{d.name}</option>)}
                      </select>
                      <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400">Tanggal Barang Datang</label>
                    <div className="relative">
                       <input 
                        required
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-4 px-6 text-sm text-white focus:outline-none focus:border-blue-500 appearance-none"
                      />
                      <Calendar size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400">Nama Produk</label>
                  <input 
                    required
                    placeholder="Deskripsi barang..."
                    value={formData.itemName}
                    onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                    className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-4 px-6 text-sm text-white focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400">Total Tagihan (Rp)</label>
                    <input 
                      required
                      type="number"
                      placeholder="0"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-4 px-6 text-sm text-white focus:outline-none focus:border-blue-500 font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400">Jatuh Tempo</label>
                    <div className="relative">
                      <input 
                        required={formData.paymentType === 'tempo'}
                        disabled={formData.paymentType === 'tunai'}
                        type={formData.paymentType === 'tunai' ? 'text' : 'date'}
                        value={formData.paymentType === 'tunai' ? '- (Tunai)' : formData.dueDate}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                        className={cn(
                          "w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-4 px-6 text-sm focus:outline-none focus:border-blue-500 appearance-none font-medium",
                          formData.paymentType === 'tunai' ? "text-zinc-500 italic" : "text-white"
                        )}
                        placeholder="mm/dd/yyyy"
                      />
                      {formData.paymentType === 'tempo' && <Calendar size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />}
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-zinc-800/50 flex flex-col md:flex-row justify-between items-center gap-6">
                  <p className="text-[10px] text-zinc-500 italic">* Data otomatis tersimpan sebagai draft</p>
                  <button 
                    type="submit"
                    style={{ backgroundColor: themeColor }}
                    className="w-full md:w-auto px-10 py-4 text-white text-[13px] font-black uppercase tracking-wider rounded-xl transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 active:scale-95"
                  >
                    <FileDown size={18} /> Simpan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
