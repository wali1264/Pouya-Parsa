import type { SalesMemoImage, Product, SaleInvoice, PurchaseInvoice, InTransitInvoice, Customer, Supplier, Employee, Expense, Service, StoreSettings, CustomerTransaction, SupplierTransaction, PayrollTransaction, ActivityLog, User, Role } from '../types';

const DB_NAME = 'KetabestanLocalDB';
const DB_VERSION = 4; // Increment version for in_transit_invoices store

const STORES = {
  SALES_MEMOS: 'salesMemos',
  PRODUCTS: 'products',
  SALE_INVOICES: 'sale_invoices',
  PURCHASE_INVOICES: 'purchase_invoices',
  IN_TRANSIT_INVOICES: 'in_transit_invoices',
  CUSTOMERS: 'customers',
  SUPPLIERS: 'suppliers',
  EMPLOYEES: 'employees',
  EXPENSES: 'expenses',
  SERVICES: 'services',
  CUSTOMER_TX: 'customer_transactions',
  SUPPLIER_TX: 'supplier_transactions',
  PAYROLL_TX: 'payroll_transactions',
  ACTIVITY: 'activity_logs',
  SETTINGS: 'store_settings',
  USERS: 'users', // استور جدید برای کاربران محلی
  ROLES: 'roles'  // استور جدید برای نقش‌های محلی
};

let db: IDBDatabase;

export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject('Error opening local database');

    request.onsuccess = (event) => {
      db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      Object.values(STORES).forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: storeName === STORES.SALES_MEMOS });
        }
      });
      
      // ایجاد نقش ادمین پیش‌فرض در صورت عدم وجود
      // این بخش در سرویس انجام خواهد شد
    };
  });
};

// Generic CRUD helpers
export const getAll = async <T>(storeName: string): Promise<T[]> => {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(`Error getting all from ${storeName}`);
  });
};

export const getById = async <T>(storeName: string, id: string | number): Promise<T | undefined> => {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(`Error getting ${id} from ${storeName}`);
  });
};

export const putItem = async <T>(storeName: string, item: T): Promise<void> => {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(`Error putting item into ${storeName}`);
  });
};

export const deleteItem = async (storeName: string, id: string | number): Promise<void> => {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(`Error deleting ${id} from ${storeName}`);
  });
};

export const clearStore = async (storeName: string): Promise<void> => {
    const database = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(`Error clearing ${storeName}`);
    });
};

// Sales Memo specific (because of auto-increment)
export const addMemoImage = async (imageData: string): Promise<void> => {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.SALES_MEMOS, 'readwrite');
    const store = transaction.objectStore(STORES.SALES_MEMOS);
    const request = store.add({ imageData });
    request.onsuccess = () => resolve();
    request.onerror = () => reject('Could not add image.');
  });
};

export const getAllMemoImages = async (): Promise<SalesMemoImage[]> => {
  const images = await getAll<SalesMemoImage>(STORES.SALES_MEMOS);
  return images.reverse();
};

export const deleteMemoImage = async (id: number): Promise<void> => {
  return deleteItem(STORES.SALES_MEMOS, id);
};

export { STORES };