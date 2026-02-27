import type { PackageUnits, StoreSettings } from '../types';

export const toEnglishDigits = (str: string): string => {
    const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
    const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
    return (str || "")
        .replace(/[۰-۹]/g, (w) => persianDigits.indexOf(w).toString())
        .replace(/[٠-٩]/g, (w) => arabicDigits.indexOf(w).toString());
};

export const formatStockToPackagesAndUnits = (totalStock: number, settings: StoreSettings, itemsPerPackage?: number): string => {
    const pLabel = settings.packageLabel || 'بسته';
    const uLabel = settings.unitLabel || 'عدد';

    if (!itemsPerPackage || itemsPerPackage <= 1) {
        return `${(totalStock || 0).toLocaleString('fa-IR')} ${uLabel}`;
    }
    const packages = Math.floor(totalStock / itemsPerPackage);
    const units = totalStock % itemsPerPackage;

    if (packages > 0 && units > 0) {
        return `${packages.toLocaleString('fa-IR')} ${pLabel} و ${units.toLocaleString('fa-IR')} ${uLabel}`;
    }
    if (packages > 0) {
        return `${packages.toLocaleString('fa-IR')} ${pLabel}`;
    }
    return `${units.toLocaleString('fa-IR')} ${uLabel}`;
};


export const parseToTotalUnits = (packages: number, units: number, itemsPerPackage: number): number => {
    return (packages * itemsPerPackage) + units;
};

export const parseToPackageAndUnits = (totalStock: number, itemsPerPackage: number): PackageUnits => {
    if (itemsPerPackage <= 1) {
        return { packages: 0, units: totalStock || 0 };
    }
    const packages = Math.floor(totalStock / itemsPerPackage);
    const units = totalStock % itemsPerPackage;
    return { packages, units };
};

export const formatCurrency = (amount: number, settings: StoreSettings, customCurrencyName?: string, targetCurrency?: 'AFN' | 'USD' | 'IRT', exchangeRate?: number): string => {
    const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    let displayAmount = safeAmount;
    let currencyName = customCurrencyName || settings?.currencyConfigs?.[settings.baseCurrency]?.name || settings?.currencyName || 'AFN';

    if (targetCurrency && targetCurrency !== settings.baseCurrency && exchangeRate) {
        const config = settings.currencyConfigs[targetCurrency];
        if (config) {
            displayAmount = config.method === 'multiply' ? safeAmount / exchangeRate : safeAmount * exchangeRate;
            currencyName = config.name || targetCurrency;
        }
    }

    const formatted = displayAmount.toLocaleString('fa-IR', { maximumFractionDigits: 3 });
    return `${formatted} ${currencyName}`;
};

export const numberToPersianWords = (num: number): string => {
    if (num === 0) return 'صفر';

    const units = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
    const teens = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
    const tens = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
    const hundreds = ['', 'یکصد', 'دویست', 'سیصد', 'چهارده', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
    const thousands = ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون'];

    let numStr = String(Math.round(num || 0));
    if (numStr.length > 15) return 'عدد بسیار بزرگ';

    const groups = [];
    while (numStr.length > 0) {
        groups.push(numStr.slice(-3));
        numStr = numStr.slice(0, -3);
    }

    let words = [];
    for (let i = groups.length - 1; i >= 0; i--) {
        const group = parseInt(groups[i], 10);
        if (group === 0) continue;

        const groupWords = [];
        const h = Math.floor(group / 100);
        const t = Math.floor((group % 100) / 10);
        const u = group % 10;

        if (h > 0) {
            groupWords.push(hundreds[h]);
        }

        if (t === 1) {
            groupWords.push(teens[u]);
        } else {
            if (t > 1) {
                groupWords.push(tens[t]);
            }
            if (u > 0) {
                groupWords.push(units[u]);
            }
        }
        
        words.push(groupWords.join(' و '));
        if (i > 0) {
            words.push(thousands[i]);
        }
    }

    return words.join(' و ');
};

const persianDigitsMap: { [key: string]: string } = { '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };
const wordToNumberMap: { [key: string]: number } = {
  'صفر': 0, 'یک': 1, 'دو': 2, 'سه': 3, 'چهار': 4, 'پنج': 5, 'شش': 6, 'هفت': 7, 'هشت': 8, 'نه': 9, 'ده': 10,
  'یازده': 11, 'دوازده': 12, 'سیزده': 13, 'چهارده': 14, 'پانزده': 15, 'شانزده': 16, 'هفده': 17, 'هجده': 18, 'نوزده': 19,
  'بیست': 20, 'سی': 30, 'چهل': 40, 'پنجاه': 50, 'شصت': 60, 'هفتاد': 70, 'هشتاد': 80, 'نود': 90,
  'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
  'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
};

export const parseSpokenNumber = (transcript: string): string => {
    let processedTranscript = (transcript || "").replace(/[۰-۹]/g, d => persianDigitsMap[d]);
    const words = processedTranscript.toLowerCase().split(/\s+/);
    const numbers = words.map(word => wordToNumberMap[word] ?? parseInt(word.replace(/[^0-9.]/g, ''), 10)).filter(num => !isNaN(num));
    if (numbers.length > 0) {
        return numbers.join('');
    }
    return transcript;
};