import { collection, getDocs, writeBatch, doc, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';

export async function exportAppData(ownerId: string) {
  const collections = ['distributors', 'bills', 'app_settings', 'team_members'];
  const data: Record<string, any[]> = {};

  for (const colName of collections) {
    const q = query(collection(db, colName), where('ownerId', '==', ownerId));
    const snap = await getDocs(q);
    data[colName] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `finestra-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importAppData(ownerId: string, jsonData: any) {
  const batch = writeBatch(db);
  const collections = ['distributors', 'bills', 'app_settings', 'team_members'];

  for (const colName of collections) {
    if (jsonData[colName] && Array.isArray(jsonData[colName])) {
      for (const item of jsonData[colName]) {
        const { id, ...data } = item;
        const ref = doc(db, colName, id || Math.random().toString(36).substr(2, 9));
        batch.set(ref, { ...data, ownerId });
      }
    }
  }

  await batch.commit();
}
