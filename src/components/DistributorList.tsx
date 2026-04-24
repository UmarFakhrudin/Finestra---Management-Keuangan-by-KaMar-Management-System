import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Distributor, UserProfile } from '../types';
import { Plus, Pencil, Trash2, X, Save, Truck, Phone, MapPin, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function DistributorList({ profile, onSave, setSyncStatus }: { 
  profile: UserProfile,
  onSave?: () => void,
  setSyncStatus?: (status: 'idle' | 'saving' | 'saved' | 'error') => void
}) {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingDist, setEditingDist] = useState<Distributor | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Form state
  const [formData, setFormData] = useState({ name: '', contact: '', address: '' });

  useEffect(() => {
    const q = query(collection(db, 'distributors'), where('ownerId', '==', profile.ownerId));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Distributor));
      setDistributors(data);
      setLoading(false);
    });
  }, [profile.ownerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSyncStatus?.('saving');
    try {
      if (editingDist) {
        await updateDoc(doc(db, 'distributors', editingDist.id!), { ...formData });
      } else {
        await addDoc(collection(db, 'distributors'), { ...formData, ownerId: profile.ownerId });
      }
      onSave?.();
      setModalOpen(false);
      setEditingDist(null);
      setFormData({ name: '', contact: '', address: '' });
    } catch (err) {
      console.error("Error saving distributor:", err);
      setSyncStatus?.('error');
      setTimeout(() => setSyncStatus?.('idle'), 3000);
    }
  };

  const editDist = (dist: Distributor) => {
    setEditingDist(dist);
    setFormData({ name: dist.name, contact: dist.contact, address: dist.address });
    setModalOpen(true);
  };

  const deleteDist = async (id: string) => {
    if (confirm('Verifikasi: Apakah Anda yakin ingin menghentikan rekam jejak kemitraan ini?')) {
      setSyncStatus?.('saving');
      try {
        await deleteDoc(doc(db, 'distributors', id));
        onSave?.();
      } catch (err) {
        console.error("Error deleting distributor:", err);
        setSyncStatus?.('error');
        setTimeout(() => setSyncStatus?.('idle'), 3000);
      }
    }
  };

  const filteredDistributors = distributors.filter(d => 
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.contact.toLowerCase().includes(search.toLowerCase())
  );

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
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 300 } }
  };

  return (
    <div className="space-y-10 font-sans pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-amber-500 transition-colors" size={18} />
          <input 
            type="text"
            placeholder="Cari Partner..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#141417] border border-zinc-800 rounded-full py-4 pl-14 pr-6 text-zinc-200 focus:outline-none focus:border-zinc-700 transition-all font-medium text-sm shadow-inner"
          />
        </div>
        <button
          onClick={() => { setEditingDist(null); setFormData({ name: '', contact: '', address: '' }); setModalOpen(true); }}
          className="px-8 py-4 bg-white text-black text-[10px] font-black uppercase tracking-[0.3em] rounded-full hover:bg-zinc-200 transition-all shadow-xl shadow-white/5 flex items-center gap-3"
        >
          <Plus size={16} />
          Tambah Partner Baru
        </button>
      </div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
      >
        {filteredDistributors.length === 0 && !loading ? (
          <motion.div variants={itemVariants} className="col-span-full py-32 text-center flex flex-col items-center gap-6">
             <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800">
                <Truck className="text-zinc-700" size={32} />
             </div>
             <div>
                <p className="text-zinc-600 font-serif italic text-xl tracking-tight uppercase opacity-50">Tidak ada entitas aktif ditemukan</p>
                <p className="text-[10px] text-zinc-800 font-black tracking-widest mt-2">MENUNGGU INPUT SISTEM</p>
             </div>
          </motion.div>
        ) : (
          filteredDistributors.map((dist) => (
            <motion.div 
              layout
              variants={itemVariants}
              key={dist.id}
              className="bg-[#141417] border border-zinc-800 rounded-[2.5rem] p-8 group hover:border-zinc-700 transition-all relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8 opacity-[0.02] -translate-y-4 translate-x-4">
                 <Truck size={120} />
              </div>
              
              <div className="relative z-10 space-y-6">
                <div className="flex justify-between items-start">
                   <div className="space-y-1">
                      <h3 className="text-xl font-serif italic text-white tracking-tight leading-none group-hover:text-amber-500 transition-colors uppercase">{dist.name}</h3>
                      <p className="text-[9px] font-black tracking-widest text-zinc-600 uppercase">Entitas Terdaftar</p>
                   </div>
                   <div className="flex gap-2">
                      <button onClick={() => editDist(dist)} className="p-3 bg-zinc-900 text-zinc-600 hover:text-white rounded-xl border border-transparent hover:border-zinc-700 transition-all">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => deleteDist(dist.id!)} className="p-3 bg-zinc-900 text-zinc-600 hover:text-red-400 rounded-xl border border-transparent hover:border-red-400/20 transition-all">
                        <Trash2 size={14} />
                      </button>
                   </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-zinc-800/50">
                   <div className="flex items-center gap-4 text-zinc-400">
                      <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center">
                         <Phone size={12} className="text-zinc-600" />
                      </div>
                      <span className="text-xs font-mono tracking-tight">{dist.contact || 'Tidak Ada Kontak'}</span>
                   </div>
                   <div className="flex items-start gap-4 text-zinc-400">
                      <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center flex-shrink-0">
                         <MapPin size={12} className="text-zinc-600" />
                      </div>
                      <p className="text-xs italic leading-relaxed opacity-70 line-clamp-2">{dist.address || 'Data lokasi terbatas'}</p>
                   </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </motion.div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md" 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#09090b] rounded-[3rem] shadow-2xl w-full max-w-lg p-12 border border-zinc-800 relative z-[101]"
            >
              <div className="flex justify-between items-center mb-10">
                <div>
                   <h3 className="text-3xl font-serif italic text-white tracking-tight">
                    {editingDist ? 'Ubah Entitas' : 'Partner Baru'}
                   </h3>
                   <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest mt-2 italic">Protokol Registri Aman</p>
                </div>
                <button onClick={() => setModalOpen(false)} className="text-zinc-600 hover:text-white p-2">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 px-1">Nama Entitas</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 text-white focus:outline-none focus:border-white transition-all text-sm font-medium italic"
                    placeholder="misal. PT. AESTHETICS CORP"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 px-1">Link Komunikasi</label>
                  <input
                    type="text"
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 text-white focus:outline-none focus:border-white transition-all text-sm font-mono"
                    placeholder="+62 800-000-000"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 px-1">Metadata Geografis/Alamat</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 text-white focus:outline-none focus:border-white transition-all text-sm italic min-h-[120px] leading-relaxed"
                    placeholder="Masukkan alamat logistik lengkap..."
                  />
                </div>
                <div className="pt-6">
                  <button
                    type="submit"
                    className="w-full py-5 bg-white text-black rounded-2xl text-[11px] font-black uppercase tracking-[0.4em] hover:bg-zinc-200 transition-all shadow-xl shadow-white/5 active:scale-[0.98]"
                  >
                    Simpan ke Buku Besar
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
