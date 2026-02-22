export const ALL_PERMISSIONS = [
    // Pages
    { id: 'page:dashboard', name: 'مشاهده داشبورد', group: 'صفحات' },
    { id: 'page:inventory', name: 'مشاهده انبارداری', group: 'صفحات' },
    { id: 'page:pos', name: 'مشاهده فروش', group: 'صفحات' },
    { id: 'page:purchases', name: 'مشاهده خرید', group: 'صفحات' },
    { id: 'page:in_transit', name: 'مشاهده اجناس در راه', group: 'صفحات' },
    { id: 'page:accounting', name: 'مشاهده حسابداری', group: 'صفحات' },
    { id: 'page:deposits', name: 'مشاهده امانات', group: 'صفحات' },
    { id: 'page:reports', name: 'مشاهده گزارشات', group: 'صفحات' },
    { id: 'page:settings', name: 'مشاهده تنظیمات', group: 'صفحات' },

    // Inventory
    { id: 'inventory:add_product', name: 'افزودن محصول', group: 'انبارداری' },
    { id: 'inventory:edit_product', name: 'ویرایش محصول', group: 'انبارداری' },
    { id: 'inventory:delete_product', name: 'حذف محصول', group: 'انبارداری' },

    // Point of Sale (POS)
    { id: 'pos:create_invoice', name: 'ثبت فاکتور فروش', group: 'فروش' },
    { id: 'pos:edit_invoice', name: 'ویرایش فاکتور فروش', group: 'فروش' },
    { id: 'pos:apply_discount', name: 'اعمال تخفیف', group: 'فروش' },
    { id: 'pos:create_credit_sale', name: 'فروش نسیه', group: 'فروش' },
    
    // Purchases
    { id: 'purchase:create_invoice', name: 'ثبت فاکتور خرید', group: 'خرید' },
    { id: 'purchase:edit_invoice', name: 'ویرایش فاکتور خرید', group: 'خرید' },

    // In Transit
    { id: 'in_transit:confirm_receipt', name: 'تأیید وصول کالا', group: 'اجناس در راه' },

    // Accounting
    { id: 'accounting:manage_suppliers', name: 'مدیریت تأمین‌کنندگان', group: 'حسابداری' },
    { id: 'accounting:manage_customers', name: 'مدیریت مشتریان', group: 'حسابداری' },
    { id: 'accounting:manage_payroll', name: 'مدیریت حقوق و دستمزد', group: 'حسابداری' },
    { id: 'accounting:manage_expenses', name: 'مدیریت مصارف', group: 'حسابداری' },
    { id: 'accounting:manage_deposits', name: 'مدیریت امانات', group: 'حسابداری' },

    // Settings (Super Admin / Owner level)
    { id: 'settings:manage_store', name: 'تغییر مشخصات فروشگاه', group: 'تنظیمات' },
    { id: 'settings:manage_users', name: 'مدیریت کاربران و نقش‌ها', group: 'تنظیمات' },
    { id: 'settings:manage_backup', name: 'پشتیبان‌گیری و بازیابی', group: 'تنظیمات' },
    { id: 'settings:manage_services', name: 'مدیریت خدمات', group: 'تنظیمات' },
    { id: 'settings:manage_alerts', name: 'مدیریت هشدارها', group: 'تنظیمات' },
];

export const groupPermissions = (permissions: typeof ALL_PERMISSIONS) => {
    return permissions.reduce((acc, permission) => {
        (acc[permission.group] = acc[permission.group] || []).push(permission);
        return acc;
    }, {} as Record<string, typeof ALL_PERMISSIONS>);
};