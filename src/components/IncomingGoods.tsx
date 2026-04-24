import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, addDoc, orderBy, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Distributor, UserProfile, ItemReceipt } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { 
  PackagePlus, Calendar, Store, Hash, FileText, 
  Search, Trash2, Box, Archive, ChevronDown, 
  FileSpreadsheet, FileDown, X, Plus, Filter
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, setMonth, setYear } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

export default function IncomingGoods({ profile }: { profile: UserProfile }) {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [receipts, setReceipts] = useState<ItemReceipt[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Filter state
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Form state
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    distributorId: '',
    itemName: '',
    cashAmount: '',
    tempoAmount: '',
    shippingCost: '',
    notes: ''
  });

  useEffect(() => {
    const qDist = query(collection(db, 'distributors'), where('ownerId', '==', profile.ownerId));
    const unsubDist = onSnapshot(qDist, (snap) => setDistributors(snap.docs.map(d => ({ id: d.id, ...d.data() } as Distributor))));

    const start = startOfMonth(new Date(selectedYear, selectedMonth));
    const end = endOfMonth(new Date(selectedYear, selectedMonth));

    const qReceipts = query(
      collection(db, 'item_receipts'), 
      where('ownerId', '==', profile.ownerId),
      where('date', '>=', start.toISOString()),
      where('date', '<=', end.toISOString()),
      orderBy('date', 'desc')
    );

    const unsubReceipts = onSnapshot(qReceipts, (snap) => {
      setReceipts(snap.docs.map(d => ({ id: d.id, ...d.data() } as ItemReceipt)));
      setLoading(false);
    });

    return () => { unsubDist(); unsubReceipts(); };
  }, [profile.ownerId, selectedMonth, selectedYear]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cash = Number(formData.cashAmount) || 0;
    const tempo = Number(formData.tempoAmount) || 0;
    const shipping = Number(formData.shippingCost) || 0;
    const total = cash + tempo + shipping;

    await addDoc(collection(db, 'item_receipts'), {
      distributorId: formData.distributorId,
      itemName: formData.itemName,
      cashAmount: cash,
      tempoAmount: tempo,
      shippingCost: shipping,
      amount: total,
      notes: formData.notes || '-',
      date: new Date(formData.date).toISOString(),
      ownerId: profile.ownerId,
      createdAt: new Date().toISOString()
    });

    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      distributorId: '',
      itemName: '',
      cashAmount: '',
      tempoAmount: '',
      shippingCost: '',
      notes: ''
    });
    setIsModalOpen(false);
  };

  const filteredReceipts = receipts.filter(r => 
    r.itemName.toLowerCase().includes(search.toLowerCase()) ||
    distributors.find(d => d.id === r.distributorId)?.name.toLowerCase().includes(search.toLowerCase())
  );

  const totals = useMemo(() => {
    return filteredReceipts.reduce((acc, curr) => ({
      cash: acc.cash + (curr.cashAmount || 0),
      tempo: acc.tempo + (curr.tempoAmount || 0),
      shipping: acc.shipping + (curr.shippingCost || 0),
      grand: acc.grand + (curr.amount || 0)
    }), { cash: 0, tempo: 0, shipping: 0, grand: 0 });
  }, [filteredReceipts]);

  const months = [
    'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
    'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="space-y-6 font-sans pb-10 text-zinc-300">
      {/* Top Filter Bar */}
      <div className="bg-[#141417] border border-zinc-800 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-4">
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
            className="flex-1 md:flex-none px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Plus size={16} /> Tambah
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
      <div className="bg-[#141417] border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-950/30 text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] border-b border-zinc-800">
                <th className="p-6 text-center w-16">No.</th>
                <th className="p-6">Tanggal</th>
                <th className="p-6">Distributor</th>
                <th className="p-6">Barang</th>
                <th className="p-6 text-center">Cash</th>
                <th className="p-6 text-center">Tempo</th>
                <th className="p-6 text-center">Ongkir</th>
                <th className="p-6 text-center">Ket</th>
                <th className="p-6 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-[11px] font-bold text-zinc-400">
              {filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-32 text-center text-zinc-700 italic text-sm font-medium">
                    Data tidak ditemukan.
                  </td>
                </tr>
              ) : (
                filteredReceipts.map((r, i) => (
                  <tr key={r.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/40 transition-colors">
                    <td className="p-6 text-center text-zinc-600">{i + 1}</td>
                    <td className="p-6">{format(new Date(r.date), 'dd/MM/yyyy')}</td>
                    <td className="p-6 text-white uppercase tracking-tight">{distributors.find(d => d.id === r.distributorId)?.name || '-'}</td>
                    <td className="p-6 text-zinc-500 italic">{r.itemName}</td>
                    <td className="p-6 text-center text-emerald-500/80">{formatCurrency(r.cashAmount || 0)}</td>
                    <td className="p-6 text-center text-amber-500/80">{formatCurrency(r.tempoAmount || 0)}</td>
                    <td className="p-6 text-center text-blue-500/80">{formatCurrency(r.shippingCost || 0)}</td>
                    <td className="p-6 text-center text-zinc-600">{r.notes}</td>
                    <td className="p-6 text-center">
                      <button 
                        onClick={() => deleteDoc(doc(db, 'item_receipts', r.id!))}
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
             <Archive size={120} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-4 relative z-10">Total Keseluruhan</p>
          <div className="flex items-baseline gap-2 relative z-10">
             <span className="text-3xl font-light text-white italic">Rp</span>
             <span className="text-5xl font-light text-white tracking-tighter">{totals.grand.toLocaleString('id-ID')}</span>
          </div>
          <div className="mt-4 w-full h-1 bg-zinc-900 rounded-full overflow-hidden relative z-10">
             <div className="h-full bg-amber-500/50 w-2/3"></div>
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
              className="relative w-full max-w-xl bg-[#141417] border border-zinc-800 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="px-10 py-8 border-b border-zinc-800/50 flex justify-between items-center bg-zinc-900/30">
                <h3 className="text-2xl font-serif italic text-white">Input Data Keuangan</h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="text-zinc-600 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-10 space-y-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Tanggal</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                    <input 
                      required
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-4 pl-12 pr-6 text-sm text-white focus:outline-none focus:border-amber-500 appearance-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Distributor</label>
                    <select
                      required
                      value={formData.distributorId}
                      onChange={(e) => setFormData({ ...formData, distributorId: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-4 px-6 text-sm text-zinc-400 focus:outline-none focus:border-amber-500 appearance-none"
                    >
                      <option value="">Pilih Partner</option>
                      {distributors.map(d => <option key={d.id} value={d.id} className="bg-zinc-950">{d.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Barang</label>
                    <input 
                      required
                      placeholder="Barang"
                      value={formData.itemName}
                      onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-4 px-6 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="bg-zinc-950/50 border border-zinc-900 rounded-3xl p-6 grid grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-emerald-500/80">Cash</label>
                    <input 
                      type="number"
                      placeholder="0"
                      value={formData.cashAmount}
                      onChange={(e) => setFormData({ ...formData, cashAmount: e.target.value })}
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-3 px-4 text-sm text-center font-bold text-emerald-400 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-amber-500/80">Tempo</label>
                    <input 
                      type="number"
                      placeholder="0"
                      value={formData.tempoAmount}
                      onChange={(e) => setFormData({ ...formData, tempoAmount: e.target.value })}
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-3 px-4 text-sm text-center font-bold text-amber-400 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-blue-500/80">Ongkir</label>
                    <input 
                      type="number"
                      placeholder="0"
                      value={formData.shippingCost}
                      onChange={(e) => setFormData({ ...formData, shippingCost: e.target.value })}
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-3 px-4 text-sm text-center font-bold text-blue-400 focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Keterangan</label>
                  <textarea 
                    rows={3}
                    placeholder="-"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-sm text-zinc-400 focus:outline-none focus:border-amber-500 resize-none italic"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 text-[11px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-4 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all shadow-xl shadow-blue-600/10"
                  >
                    Simpan
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
