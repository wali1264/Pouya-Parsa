// Gregorian to Jalali Conversion
function toJalali(gy: number, gm: number, gd: number) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = (gy <= 1600) ? 0 : 979;
  gy -= (gy <= 1600) ? 621 : 1600;
  const gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = (365 * gy) + (Math.floor((gy2 + 3) / 4)) - (Math.floor((gy2 + 99) / 100)) + (Math.floor((gy2 + 399) / 400)) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * (Math.floor(days / 12053));
  days %= 12053;
  jy += 4 * (Math.floor(days / 1461));
  days %= 1461;
  jy += Math.floor((days - 1) / 365);
  if (days > 365) days = (days - 1) % 365;
  const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return { jy, jm, jd };
}

// Jalali to Gregorian Conversion
function toGregorian(jy: number, jm: number, jd: number) {
  let gy = (jy <= 979) ? 621 : 1600;
  jy -= (jy <= 979) ? 0 : 979;
  let days = (365 * jy) + (Math.floor(jy / 33) * 8) + (Math.floor(((jy % 33) + 3) / 4)) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
  gy += 400 * (Math.floor(days / 146097));
  days %= 146097;
  if (days > 36524) {
    gy += 100 * (Math.floor(--days / 36524));
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * (Math.floor(days / 1461));
  days %= 1461;
  gy += Math.floor((days - 1) / 365);
  if (days > 365) days = (days - 1) % 365;
  let gd = days + 1;
  const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  while (gm < 13 && gd > sal_a[gm]) {
    gd -= sal_a[gm];
    gm++;
  }
  return { gy, gm, gd };
}


export const getJalaliDate = (date: Date) => {
    return toJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
};

export const jalaliToDate = (jy: number, jm: number, jd: number) => {
    const { gy, gm, gd } = toGregorian(jy, jm, jd);
    return new Date(gy, gm - 1, gd);
};

export const JALALI_MONTHS = [
    { value: 1, name: 'فروردین' }, { value: 2, name: 'اردیبهشت' }, { value: 3, name: 'خرداد' },
    { value: 4, name: 'تیر' }, { value: 5, name: 'مرداد' }, { value: 6, name: 'شهریور' },
    { value: 7, name: 'مهر' }, { value: 8, name: 'آبان' }, { value: 9, name: 'آذر' },
    { value: 10, name: 'دی' }, { value: 11, name: 'بهمن' }, { value: 12, name: 'اسفند' }
];
