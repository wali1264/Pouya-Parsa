export interface ProductBatch {
  id: string; // Unique ID for the batch itself
  lotNumber: string;
  stock: number;
  purchasePrice: number;
  purchaseDate: string; // ISO string, crucial for FIFO
  expiryDate?: string; // Optional ISO string
}


export interface Product {
  id: string;
  name: string;
  // purchasePrice is now per batch
  salePrice: number;
  // stock is now a calculated value from batches
  batches: ProductBatch[];
  barcode?: string;
  manufacturer?: string;
  itemsPerPackage?: number;
}

export interface InvoiceItem extends Product {
  quantity: number;
  purchasePrice: number; // This is calculated at the time of sale for profit reporting.
  finalPrice?: number; // Added for individual item discounts
  batchDeductions?: { batchId: string; quantity: number }[]; // Track exactly which batches were used
}

// Service items can also be in an invoice
export interface Service {
    id: string;
    name: string;
    price: number;
}

export type CartItem = (InvoiceItem & { type: 'product' }) | (Service & { quantity: number; type: 'service' });


export interface SaleInvoice {
  id: string;
  type: 'sale' | 'return';
  originalInvoiceId?: string; // Present if type is 'return'
  items: CartItem[];
  subtotal: number; // Total before discount (in transaction currency)
  totalDiscount: number; // Total discount amount (in transaction currency)
  totalAmount: number; // Final amount (subtotal - totalDiscount) (in transaction currency)
  totalAmountAFN: number; // NEW: Equivalent in AFN for inventory and reports
  timestamp: string;
  cashier: string;
  customerId?: string; // Optional: for credit sales
  currency: 'AFN' | 'USD' | 'IRT'; // Multi-currency support
  exchangeRate: number;            // Rate to base currency (AFN)
}

export interface PurchaseInvoiceItem {
    productId: string;
    productName: string; // Denormalized for easier display
    quantity: number;
    purchasePrice: number;
    lotNumber: string;
    expiryDate?: string;
    // Phase 1: Lifecycle Tracking
    atFactoryQty: number;
    inTransitQty: number;
    receivedQty: number;
}

export interface PurchaseInvoice {
  id: string;
  type: 'purchase' | 'return';
  originalInvoiceId?: string; // Present if type is 'return'
  supplierId: string;
  invoiceNumber: string;
  items: PurchaseInvoiceItem[];
  totalAmount: number;
  timestamp: string;
  currency?: 'AFN' | 'USD' | 'IRT'; // Added IRT
  exchangeRate?: number;    
  sourceInTransitId?: string; // Phase 2: Link to parent shipment
}

export interface InTransitInvoice extends Omit<PurchaseInvoice, 'type'> {
    type: 'in_transit';
    expectedArrivalDate?: string;
    paidAmount?: number; // Phase 2: Track prepayments specifically for this order
}

export interface ActivityLog {
  id: string;
  type: 'sale' | 'purchase' | 'inventory' | 'login' | 'payroll' | 'deposit';
  description: string;
  timestamp: string;
  user: string;
  refId?: string; // ID of the related entity (invoice, product, etc.)
  refType?: 'saleInvoice' | 'purchaseInvoice' | 'product' | 'depositHolder'; // To know what to look for
}

// --- Security Deposit Module Types ---
export interface DepositHolder {
    id: string;
    name: string;
    phone?: string;
    balanceAFN: number;
    balanceUSD: number;
    balanceIRT: number;
    createdAt: string;
}

export interface DepositTransaction {
    id: string;
    holderId: string;
    type: 'deposit' | 'withdrawal';
    amount: number;
    currency: 'AFN' | 'USD' | 'IRT';
    description: string;
    date: string;
}

// --- Accounting Module Types ---

export interface Supplier {
    id:string;
    name: string;
    contactPerson?: string;
    phone?: string;
    address?: string;
    balance: number; // Total approximate balance in AFN (for reports)
    balanceAFN: number; // Precise AFN balance
    balanceUSD: number; // Precise USD balance
    balanceIRT: number; // Precise IRT balance (New)
}

export interface SupplierTransaction {
    id: string;
    supplierId: string;
    type: 'purchase' | 'payment' | 'purchase_return';
    amount: number;
    date: string;
    description: string; // e.g., Invoice # or Payment to X
    invoiceId?: string; // Link to the purchase invoice
    currency?: 'AFN' | 'USD' | 'IRT'; // Track specific currency
}


export interface Employee {
    id: string;
    name: string;
    position: string;
    monthlySalary: number;
    balance: number; // Positive means advances taken
}

export interface PayrollTransaction {
    id: string;
    employeeId: string;
    type: 'advance' | 'salary_payment';
    amount: number;
    date: string;
    description: string;
}

export interface Customer {
    id: string;
    name: string;
    phone?: string;
    creditLimit?: number;
    balance: number;    // Positive means they owe us (Total in AFN)
    balanceAFN: number; // Positive means they owe us AFN
    balanceUSD: number; // Positive means they owe us USD
    balanceIRT: number; // Positive means they owe us IRT
}

export interface CustomerTransaction {
    id: string;
    customerId: string;
    type: 'credit_sale' | 'payment' | 'sale_return';
    amount: number;
    date: string;
    description: string; // e.g., Invoice # or Payment received
    invoiceId?: string; // Link to the sale invoice
    currency?: 'AFN' | 'USD' | 'IRT'; // Added currency tracking
}

export type AnyTransaction = CustomerTransaction | SupplierTransaction | PayrollTransaction | DepositTransaction;

export interface Expense {
    id: string;
    category: 'rent' | 'utilities' | 'supplies' | 'salary' | 'other';
    description: string;
    amount: number;
    date: string;
}

export interface SalesMemoImage {
    id: number;
    imageData: string;
}

// --- Settings Module Types ---
export interface StoreSettings {
    storeName: string;
    address: string;
    phone: string;
    lowStockThreshold: number;
    expiryThresholdMonths: number;
    currencyName: string; // e.g., 'افغانی'
    currencySymbol: string; // e.g., 'AFN'
}

// --- Package/Unit Management ---
export interface PackageUnits {
    packages: number;
    units: number;
}

// --- Auth & RBAC Types ---
export type Permission = string; // e.g., 'pos:create_invoice'

export interface Role {
    id: string;
    name: string;
    permissions: Permission[];
}

export interface User {
    id: string;
    username: string;
    password?: string; // Should be hashed in a real app
    roleId: string;
}

export interface AppState {
    products: Product[];
    saleInvoices: SaleInvoice[];
    purchaseInvoices: PurchaseInvoice[];
    inTransitInvoices: InTransitInvoice[];
    customers: Customer[];
    suppliers: Supplier[];
    employees: Employee[];
    expenses: Expense[];
    services: Service[];
    depositHolders: DepositHolder[];
    depositTransactions: DepositTransaction[];
    storeSettings: StoreSettings;
    cart: CartItem[];
    customerTransactions: CustomerTransaction[];
    supplierTransactions: SupplierTransaction[];
    payrollTransactions: PayrollTransaction[];
    activities: ActivityLog[];
    saleInvoiceCounter: number;
    editingSaleInvoiceId: string | null;
    editingPurchaseInvoiceId: string | null;
    // Auth State
    isAuthenticated: boolean;
    currentUser: User | null;
    users: User[];
    roles: Role[];
}

// --- Types for Web Speech API ---
export interface SpeechRecognitionResult {
    isFinal: boolean;
    [key: number]: {
        transcript: string;
    };
    length: number;
}

export interface SpeechRecognitionEvent {
    resultIndex: number;
    results: SpeechRecognitionResult[];
}

export interface SpeechRecognitionErrorEvent {
    error: 'not-allowed' | 'no-speech' | 'audio-capture' | 'network' | 'aborted' | 'language-not-supported' | 'service-not-allowed' | 'bad-grammar';
}

export interface SpeechRecognition {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: (event: SpeechRecognitionEvent) => void;
    onerror: (event: SpeechRecognitionErrorEvent) => void;
    onend: () => void;
    start: () => void;
    stop: () => void;
}

declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognition;
        webkitSpeechRecognition: new () => SpeechRecognition;
    }
}