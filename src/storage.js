import { db } from "./firebase.js";
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";

const NS = "workflow-pro:";

function fullKey(key, shared) {
  return `${NS}${shared ? "shared" : "local"}:${key}`;
}

// Memory cache to avoid excessive DB reads when possible
const memoryCache = new Map();

export const storage = {
  async get(key, shared = false) {
    const k = fullKey(key, shared);
    try {
      if (db) {
        const d = await getDoc(doc(db, "storage", k));
        if (d.exists()) {
          const raw = d.data().value;
          memoryCache.set(k, raw);
          return { key, value: raw, shared };
        }
      }
      // Fallback to localStorage if no DB or not found in DB
      const raw = window.localStorage.getItem(k);
      if (raw === null) return null;
      return { key, value: raw, shared };
    } catch (e) {
      const raw = window.localStorage.getItem(k);
      if (raw === null) return null;
      return { key, value: raw, shared };
    }
  },

  async set(key, value, shared = false) {
    const k = fullKey(key, shared);
    try {
      // Always write to local storage as a backup
      window.localStorage.setItem(k, value);
      memoryCache.set(k, value);

      if (db) {
        await setDoc(doc(db, "storage", k), { value });
      }
      return { key, value, shared };
    } catch (e) {
      console.error("storage.set failed", e);
      return null;
    }
  },

  async delete(key, shared = false) {
    const k = fullKey(key, shared);
    try {
      window.localStorage.removeItem(k);
      memoryCache.delete(k);
      
      if (db) {
        await deleteDoc(doc(db, "storage", k));
      }
      return { key, deleted: true, shared };
    } catch (e) {
      return null;
    }
  },

  async list(prefix = "", shared = false) {
    try {
      const base = `${NS}${shared ? "shared" : "local"}:`;
      const searchPrefix = base + prefix;
      const keys = [];
      
      if (db) {
        // Warning: this gets all docs in collection. 
        // For a large app, you'd want to query specifically, 
        // but for this simple key-value store wrapper, it works.
        const snapshot = await getDocs(collection(db, "storage"));
        snapshot.forEach(doc => {
          if (doc.id.startsWith(searchPrefix)) {
            keys.push(doc.id.slice(base.length));
          }
        });
      } else {
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && k.startsWith(searchPrefix)) {
            keys.push(k.slice(base.length));
          }
        }
      }
      return { keys, prefix, shared };
    } catch (e) {
      return { keys: [], prefix, shared };
    }
  },
};
