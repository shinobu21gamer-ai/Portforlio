const { Op } = require('sequelize');
const { Payroll, Payslip, Employee, Attendance, sequelize, Notification } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta, escapeLike } = require('../../utils/helpers');
const { logActivity } = require('../../utils/audit');

// ─── Philippine Holidays (fixed + movable) ────────────────
const PH_HOLIDAYS = {
  regular: [
    { month: 1, day: 1, name: "New Year's Day" },
    { month: 4, day: 9, name: "Araw ng Kagitingan" },
    { month: 5, day: 1, name: "Labor Day" },
    { month: 6, day: 12, name: "Independence Day" },
    { month: 8, day: 27, name: "National Heroes Day" },
    { month: 11, day: 30, name: "Bonifacio Day" },
    { month: 12, day: 25, name: "Christmas Day" },
    { month: 12, day: 30, name: "Rizal Day" },
    { month: 12, day: 31, name: "Last Day of Year" },
  ],
  special: [
    { month: 1, day: 2, name: "Additional Special Day" },
    { month: 2, day: 25, name: "EDSA Revolution" },
    { month: 4, day: 1, name: "Maundy Thursday" },
    { month: 4, day: 2, name: "Good Friday" },
    { month: 8, day: 21, name: "Ninoy Aquino Day" },
    { month: 11, day: 1, name: "All Saints Day" },
    { month: 11, day: 2, name: "All Souls Day" },
    { month: 12, day: 8, name: "Feast of the Immaculate Conception" },
    { month: 12, day: 24, name: "Christmas Eve" },
  ],
};

function getHolidayType(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const dow = d.getDay();
  for (const h of PH_HOLIDAYS.regular) {
    if (h.month === month && h.day === day) return 'regular';
  }
  for (const h of PH_HOLIDAYS.special) {
    if (h.month === month && h.day === day) return 'special';
  }
  if (dow === 0) return 'special';
  return 'none';
}

// ─── SSS Contribution Table (2024 + 2025) ────────────────
// 2024: 14% total rate (SS circular 2024)
// 2025: 14.5% total rate (SS circular 2025, effective Jan 2025)
const SSS_TABLES = {
  2024: [
    { min: 0, max: 3250, employee: 135, employer: 225 },
    { min: 3250, max: 3750, employee: 157.50, employer: 262.50 },
    { min: 3750, max: 4250, employee: 180, employer: 300 },
    { min: 4250, max: 4750, employee: 202.50, employer: 337.50 },
    { min: 4750, max: 5250, employee: 225, employer: 375 },
    { min: 5250, max: 5750, employee: 247.50, employer: 412.50 },
    { min: 5750, max: 6250, employee: 270, employer: 450 },
    { min: 6250, max: 6750, employee: 292.50, employer: 487.50 },
    { min: 6750, max: 7250, employee: 315, employer: 525 },
    { min: 7250, max: 7750, employee: 337.50, employer: 562.50 },
    { min: 7750, max: 8250, employee: 360, employer: 600 },
    { min: 8250, max: 8750, employee: 382.50, employer: 637.50 },
    { min: 8750, max: 9250, employee: 405, employer: 675 },
    { min: 9250, max: 9750, employee: 427.50, employer: 712.50 },
    { min: 9750, max: 10250, employee: 450, employer: 750 },
    { min: 10250, max: 10750, employee: 472.50, employer: 787.50 },
    { min: 10750, max: 11250, employee: 495, employer: 825 },
    { min: 11250, max: 11750, employee: 517.50, employer: 862.50 },
    { min: 11750, max: 12250, employee: 540, employer: 900 },
    { min: 12250, max: 12750, employee: 562.50, employer: 937.50 },
    { min: 12750, max: 13250, employee: 585, employer: 975 },
    { min: 13250, max: 13750, employee: 607.50, employer: 1012.50 },
    { min: 13750, max: 14250, employee: 630, employer: 1050 },
    { min: 14250, max: 14750, employee: 652.50, employer: 1087.50 },
    { min: 14750, max: 15250, employee: 675, employer: 1125 },
    { min: 15250, max: 15750, employee: 697.50, employer: 1162.50 },
    { min: 15750, max: 16250, employee: 720, employer: 1200 },
    { min: 16250, max: 16750, employee: 742.50, employer: 1237.50 },
    { min: 16750, max: 17250, employee: 765, employer: 1275 },
    { min: 17250, max: 17750, employee: 787.50, employer: 1312.50 },
    { min: 17750, max: 18250, employee: 810, employer: 1350 },
    { min: 18250, max: 18750, employee: 832.50, employer: 1387.50 },
    { min: 18750, max: 19250, employee: 855, employer: 1425 },
    { min: 19250, max: 19750, employee: 877.50, employer: 1462.50 },
    { min: 19750, max: 20250, employee: 900, employer: 1500 },
    { min: 20250, max: 20750, employee: 922.50, employer: 1537.50 },
    { min: 20750, max: 21250, employee: 945, employer: 1575 },
    { min: 21250, max: 21750, employee: 967.50, employer: 1612.50 },
    { min: 21750, max: 22250, employee: 990, employer: 1650 },
    { min: 22250, max: 22750, employee: 1012.50, employer: 1687.50 },
    { min: 22750, max: 23250, employee: 1035, employer: 1725 },
    { min: 23250, max: 23750, employee: 1057.50, employer: 1762.50 },
    { min: 23750, max: 24250, employee: 1080, employer: 1800 },
    { min: 24250, max: 24750, employee: 1102.50, employer: 1837.50 },
    { min: 24750, max: Infinity, employee: 1125, employer: 1875 },
  ],
  2025: [
    { min: 0, max: 3250, employee: 139.70, employer: 235.30 },
    { min: 3250, max: 3750, employee: 163.30, employer: 274.20 },
    { min: 3750, max: 4250, employee: 187, employer: 313 },
    { min: 4250, max: 4750, employee: 210.60, employer: 351.90 },
    { min: 4750, max: 5250, employee: 234.40, employer: 390.60 },
    { min: 5250, max: 5750, employee: 258, employer: 430 },
    { min: 5750, max: 6250, employee: 281.70, employer: 468.80 },
    { min: 6250, max: 6750, employee: 305.30, employer: 508.20 },
    { min: 6750, max: 7250, employee: 329, employer: 548 },
    { min: 7250, max: 7750, employee: 352.60, employer: 587.40 },
    { min: 7750, max: 8250, employee: 376.40, employer: 626.60 },
    { min: 8250, max: 8750, employee: 400, employer: 667 },
    { min: 8750, max: 9250, employee: 423.70, employer: 706.30 },
    { min: 9250, max: 9750, employee: 447.30, employer: 745.70 },
    { min: 9750, max: 10250, employee: 471, employer: 785 },
    { min: 10250, max: 10750, employee: 494.60, employer: 824.40 },
    { min: 10750, max: 11250, employee: 518.40, employer: 863.60 },
    { min: 11250, max: 11750, employee: 542, employer: 904 },
    { min: 11750, max: 12250, employee: 565.70, employer: 943.30 },
    { min: 12250, max: 12750, employee: 589.30, employer: 982.70 },
    { min: 12750, max: 13250, employee: 613, employer: 1022 },
    { min: 13250, max: 13750, employee: 636.60, employer: 1061.40 },
    { min: 13750, max: 14250, employee: 660.40, employer: 1100.60 },
    { min: 14250, max: 14750, employee: 684, employer: 1141 },
    { min: 14750, max: 15250, employee: 707.70, employer: 1180.30 },
    { min: 15250, max: 15750, employee: 731.30, employer: 1219.70 },
    { min: 15750, max: 16250, employee: 755, employer: 1259 },
    { min: 16250, max: 16750, employee: 778.60, employer: 1298.40 },
    { min: 16750, max: 17250, employee: 802.40, employer: 1337.60 },
    { min: 17250, max: 17750, employee: 826, employer: 1378 },
    { min: 17750, max: 18250, employee: 849.70, employer: 1417.30 },
    { min: 18250, max: 18750, employee: 873.30, employer: 1456.70 },
    { min: 18750, max: 19250, employee: 897, employer: 1496 },
    { min: 19250, max: 19750, employee: 920.60, employer: 1535.40 },
    { min: 19750, max: 20250, employee: 944.40, employer: 1574.60 },
    { min: 20250, max: 20750, employee: 968, employer: 1615 },
    { min: 20750, max: 21250, employee: 991.70, employer: 1654.30 },
    { min: 21250, max: 21750, employee: 1015.30, employer: 1693.70 },
    { min: 21750, max: 22250, employee: 1039, employer: 1733 },
    { min: 22250, max: 22750, employee: 1062.60, employer: 1772.40 },
    { min: 22750, max: 23250, employee: 1086.40, employer: 1811.60 },
    { min: 23250, max: 23750, employee: 1110, employer: 1852 },
    { min: 23750, max: 24250, employee: 1133.70, employer: 1891.30 },
    { min: 24250, max: 24750, employee: 1157.30, employer: 1930.70 },
    { min: 24750, max: Infinity, employee: 1181, employer: 1970 },
  ],
  2026: [
    { min: 0, max: 3250, employee: 143.75, employer: 242.50 },
    { min: 3250, max: 3750, employee: 168.10, employer: 282.20 },
    { min: 3750, max: 4250, employee: 192.50, employer: 322 },
    { min: 4250, max: 4750, employee: 216.90, employer: 361.80 },
    { min: 4750, max: 5250, employee: 241.50, employer: 402.50 },
    { min: 5250, max: 5750, employee: 266, employer: 443 },
    { min: 5750, max: 6250, employee: 290.50, employer: 483.50 },
    { min: 6250, max: 6750, employee: 315, employer: 524 },
    { min: 6750, max: 7250, employee: 339.50, employer: 564.50 },
    { min: 7250, max: 7750, employee: 364, employer: 605 },
    { min: 7750, max: 8250, employee: 388.80, employer: 645.80 },
    { min: 8250, max: 8750, employee: 413.50, employer: 686.50 },
    { min: 8750, max: 9250, employee: 438, employer: 727 },
    { min: 9250, max: 9750, employee: 462.50, employer: 767.50 },
    { min: 9750, max: 10250, employee: 487, employer: 808 },
    { min: 10250, max: 10750, employee: 511.50, employer: 848.50 },
    { min: 10750, max: 11250, employee: 536.30, employer: 889.10 },
    { min: 11250, max: 11750, employee: 561, employer: 931 },
    { min: 11750, max: 12250, employee: 585.50, employer: 971.50 },
    { min: 12250, max: 12750, employee: 610, employer: 1012 },
    { min: 12750, max: 13250, employee: 634.50, employer: 1052.50 },
    { min: 13250, max: 13750, employee: 659, employer: 1093 },
    { min: 13750, max: 14250, employee: 683.80, employer: 1133.80 },
    { min: 14250, max: 14750, employee: 708.50, employer: 1174.50 },
    { min: 14750, max: 15250, employee: 733, employer: 1215 },
    { min: 15250, max: 15750, employee: 757.50, employer: 1255.50 },
    { min: 15750, max: 16250, employee: 782, employer: 1296 },
    { min: 16250, max: 16750, employee: 807, employer: 1337 },
    { min: 16750, max: 17250, employee: 831.50, employer: 1377.50 },
    { min: 17250, max: 17750, employee: 856, employer: 1418 },
    { min: 17750, max: 18250, employee: 880.50, employer: 1458.50 },
    { min: 18250, max: 18750, employee: 905, employer: 1499 },
    { min: 18750, max: 19250, employee: 929.50, employer: 1539.50 },
    { min: 19250, max: 19750, employee: 954, employer: 1580 },
    { min: 19750, max: 20250, employee: 978.80, employer: 1620.80 },
    { min: 20250, max: 20750, employee: 1003.50, employer: 1661.50 },
    { min: 20750, max: 21250, employee: 1028, employer: 1702 },
    { min: 21250, max: 21750, employee: 1052.50, employer: 1742.50 },
    { min: 21750, max: 22250, employee: 1077, employer: 1783 },
    { min: 22250, max: 22750, employee: 1101.50, employer: 1823.50 },
    { min: 22750, max: 23250, employee: 1126.30, employer: 1864.10 },
    { min: 23250, max: 23750, employee: 1151, employer: 1905 },
    { min: 23750, max: 24250, employee: 1175.50, employer: 1945.50 },
    { min: 24250, max: 24750, employee: 1200, employer: 1986 },
    { min: 24750, max: Infinity, employee: 1225, employer: 2027 },
  ],
};

function computeSSS(monthlySalary, year) {
  if (!SSS_TABLES[year]) throw new Error(`SSS table not defined for year ${year}; supported: ${Object.keys(SSS_TABLES).join(', ')}`);
  const table = SSS_TABLES[year];
  const bracket = table.find(b => monthlySalary >= b.min && monthlySalary < b.max);
  return bracket ? bracket.employee : table[table.length - 1].employee;
}

// ─── PhilHealth 2024+: 5% of basic, split 50/50 ─────────────
// Per PhilHealth circular: MSC floor ₱10,000, ceiling ₱100,000
// (full premium 5% of 100,000 = ₱5,000; employee share caps at ₱2,500)
const PHILHEALTH_RATE = 0.05;
const PHILHEALTH_FLOOR = 10000;
const PHILHEALTH_CEILING = 100000;
const PHILHEALTH_EE_MAX = 2500;
function computePhilHealth(monthlySalary) {
  const base = Math.min(Math.max(monthlySalary, PHILHEALTH_FLOOR), PHILHEALTH_CEILING);
  const contribution = base * PHILHEALTH_RATE;
  const half = parseFloat((contribution / 2).toFixed(2));
  return Math.max(100, Math.min(PHILHEALTH_EE_MAX, half));
}

// ─── Pag-IBIG: 2% of basic, max ₱100 ─────────────────────
// Mandatory employee contribution capped at ₱100/month (based on ₱5,000 MSC)
const PAGIBIG_RATE = 0.02;
const PAGIBIG_MAX = 100;
function computePagIBIG(monthlySalary) {
  const contribution = monthlySalary * PAGIBIG_RATE;
  return Math.min(contribution, PAGIBIG_MAX);
}

// ─── Withholding Tax (BIR Monthly Tax Table, RR 8-2023 / TRAIN) ──
function computeTaxMonthly(monthlyTaxableIncome) {
  if (monthlyTaxableIncome <= 20833) return 0;
  if (monthlyTaxableIncome <= 33333) return (monthlyTaxableIncome - 20833) * 0.15;
  if (monthlyTaxableIncome <= 66667) return 1875 + (monthlyTaxableIncome - 33333) * 0.20;
  if (monthlyTaxableIncome <= 166667) return 8541.67 + (monthlyTaxableIncome - 66667) * 0.25;
  if (monthlyTaxableIncome <= 666667) return 33541.67 + (monthlyTaxableIncome - 166667) * 0.30;
  if (monthlyTaxableIncome <= 1041667) return 183541.67 + (monthlyTaxableIncome - 666667) * 0.32;
  return 303541.67 + (monthlyTaxableIncome - 1041667) * 0.35;
}

// Semi-monthly tax table (Schedule 7, RR 2-98)
function computeTaxSemiMonthly(semiMonthlyTaxableIncome) {
  if (semiMonthlyTaxableIncome <= 10417) return 0;
  if (semiMonthlyTaxableIncome <= 16667) return (semiMonthlyTaxableIncome - 10417) * 0.15;
  if (semiMonthlyTaxableIncome <= 33333) return 937.50 + (semiMonthlyTaxableIncome - 16667) * 0.20;
  if (semiMonthlyTaxableIncome <= 50000) return 4270.83 + (semiMonthlyTaxableIncome - 33333) * 0.25;
  if (semiMonthlyTaxableIncome <= 100000) return 8437.50 + (semiMonthlyTaxableIncome - 50000) * 0.30;
  if (semiMonthlyTaxableIncome <= 250000) return 23437.50 + (semiMonthlyTaxableIncome - 100000) * 0.32;
  return 71437.50 + (semiMonthlyTaxableIncome - 250000) * 0.35;
}

function computeTax(income, isSemiMonthly) {
  if (isSemiMonthly) {
    return parseFloat(computeTaxSemiMonthly(income).toFixed(2));
  }
  return parseFloat(computeTaxMonthly(income).toFixed(2));
}

// ─── Night Differential ───────────────────────────────────
const ND_RATE = 0.10;
function computeNightDiff(nightHours, hourlyRate) {
  return nightHours * hourlyRate * ND_RATE;
}

// ─── Overtime Rate ────────────────────────────────────────
// Regular day: 1.25x | Rest day: 1.30x
// Regular holiday: 2.60x (200% + 30% OT premium) | Rest day + Regular holiday: 2.60x
// Special holiday: 1.69x (130% + 30% OT premium) | Rest day + Special holiday: 1.50x
function computeOvertimePay(otHours, hourlyRate, holidayType, isRestDay) {
  if (holidayType === 'regular') return otHours * hourlyRate * 2.60;
  if (holidayType === 'special') return otHours * hourlyRate * 1.69;
  if (isRestDay) return otHours * hourlyRate * 1.30;
  return otHours * hourlyRate * 1.25;
}

// ─── 13th Month Pay ───────────────────────────────────────
function compute13thMonth(totalBasicEarnedYTD, monthsWorked) {
  if (monthsWorked <= 0) return 0;
  return parseFloat((totalBasicEarnedYTD / 12).toFixed(2));
}

// ─── Helper: compute payslip for one employee ─────────────
function countWorkingDays(startDate, endDate) {
  let totalWorkingDays = 0;
  const d = new Date(startDate + 'T00:00:00');
  const endD = new Date(endDate + 'T00:00:00');
  while (d <= endD) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      const dateStr = d.toISOString().split('T')[0];
      if (getHolidayType(dateStr) === 'none') totalWorkingDays++;
    }
    d.setDate(d.getDate() + 1);
  }
  return totalWorkingDays;
}

function computePayslipForEmployee(emp, empAtt, periodSalary, periodWorkingDays, totalWorkingDays, isSemiMonthly, is13thMonthPeriod, totalBasicYTD, bonusAmount = 0, year = new Date().getFullYear()) {
  const basicSalary = parseFloat(emp.salary);
  const hourlyRate = periodSalary / (isSemiMonthly ? Math.ceil(periodWorkingDays) : totalWorkingDays) / 8;

  // Absent deduction
  const absentDays = Math.max(0, periodWorkingDays - empAtt.daysWorked);
  const absentDeduction = parseFloat(((absentDays / periodWorkingDays) * periodSalary).toFixed(2));

  // Overtime (use approved OT only)
  const otHours = empAtt.overtime || 0;
  const avgHolidayType = empAtt.avgHolidayType || 'none';
  const hasRestDay = empAtt.hasRestDay || false;
  const overtimePay = parseFloat(computeOvertimePay(otHours, hourlyRate, avgHolidayType, hasRestDay).toFixed(2));

  // Night differential
  const nightHours = empAtt.nightShiftHours || 0;
  const nightDiffPay = parseFloat(computeNightDiff(nightHours, hourlyRate).toFixed(2));

  // Holiday pay (for unworked holidays within the period)
  const holidayPay = parseFloat(empAtt.holidayPay || 0);

  // Rest day premium
  const restDayPay = parseFloat(empAtt.restDayPay || 0);

  // 13th month (computed monthly, accumulated annually)
  let thirteenthMonthPay = 0;
  if (is13thMonthPeriod) {
    thirteenthMonthPay = compute13thMonth(totalBasicYTD || periodSalary, 12);
  }

  // Bonus
  const bonusPay = parseFloat(bonusAmount) || 0;

  // Government deductions (use full monthly salary for SSS/PhilHealth/Pag-IBIG)
  const sss = computeSSS(basicSalary, year);
  const philhealth = computePhilHealth(basicSalary);
  const pagibig = computePagIBIG(basicSalary);

  // Taxable income: gross - statutory deductions - 13th month (tax-exempt up to ₱90,000)
  const grossPay = periodSalary + overtimePay + nightDiffPay + holidayPay + restDayPay + thirteenthMonthPay + bonusPay;
  const thirteenthMonthExempt = Math.min(thirteenthMonthPay, 90000);
  const taxableIncome = grossPay - sss - philhealth - pagibig - thirteenthMonthExempt;
  const tax = computeTax(taxableIncome, isSemiMonthly);

  const totalDed = sss + philhealth + pagibig + tax + absentDeduction;
  const netPay = parseFloat((grossPay - totalDed).toFixed(2));

  return {
    basicSalary: periodSalary,
    daysWorked: empAtt.daysWorked,
    absentDays,
    absentDeduction,
    overtimePay,
    nightDiffPay,
    holidayPay,
    restDayPay,
    thirteenthMonthPay,
    bonusPay,
    grossPay: parseFloat(grossPay.toFixed(2)),
    sssDeduction: sss,
    philhealthDeduction: philhealth,
    pagibigDeduction: pagibig,
    taxDeduction: tax,
    totalDeductions: parseFloat(totalDed.toFixed(2)),
    netPay,
  };
}

// ─── Helper: gather attendance data for a period ───────────
function gatherAttendance(attendanceRecords) {
  const byEmployee = {};

  for (const rec of attendanceRecords) {
    const empId = rec.employeeId;
    if (!byEmployee[empId]) {
      byEmployee[empId] = {
        daysWorked: 0, totalHours: 0, overtime: 0,
        nightShiftHours: 0, holidayPay: 0, restDayPay: 0,
        avgHolidayType: 'none', hasRestDay: false,
      };
    }
    // 'late', 'undertime' and 'half-day' all still count as a worked day; only a
    // genuine absence (or approved leave) must not, or the employee is paid in full.
    if (rec.status !== 'absent' && rec.status !== 'on-leave') {
      byEmployee[empId].daysWorked++;
    }
    byEmployee[empId].totalHours += parseFloat(rec.totalHours) || 0;
    byEmployee[empId].overtime += parseFloat(rec.overtime) || 0;
    byEmployee[empId].nightShiftHours += parseFloat(rec.nightShiftHours) || 0;
    byEmployee[empId].holidayPay += parseFloat(rec.holidayPay) || 0;
    byEmployee[empId].restDayPay += parseFloat(rec.restDayPay) || 0;
    if (rec.holidayType && rec.holidayType !== 'none') byEmployee[empId].avgHolidayType = rec.holidayType;
    if (rec.isRestDay) byEmployee[empId].hasRestDay = true;
  }

  return byEmployee;
}

class PayrollService {
  async getAll(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const where = {};
    if (query.status) where.status = query.status;

    const include = [];
    if (query.search) {
      include.push({
        association: 'payslips',
        attributes: ['id'],
        include: [{
          association: 'employee',
          attributes: ['id', 'firstName', 'lastName'],
          where: {
            [Op.or]: [
              { firstName: { [Op.like]: `%${escapeLike(query.search)}%` } },
              { lastName: { [Op.like]: `%${escapeLike(query.search)}%` } },
            ],
          },
        }],
      });
    }

    const { rows, count } = await Payroll.findAndCountAll({
      where, include, offset, limit, order: [['createdAt', 'DESC']],
      distinct: true,
    });

    return { payrolls: rows, pagination: getPaginationMeta(count, page, limit) };
  }

  async getById(id) {
    const payroll = await Payroll.findByPk(id, {
      include: [{
        association: 'payslips',
        include: [{ association: 'employee', attributes: ['id', 'employeeNo', 'firstName', 'lastName', 'departmentId'],
          include: [{ association: 'department', attributes: ['id', 'name'] }],
        }],
      }],
    });
    if (!payroll) throw ApiError.notFound('Payroll not found');
    return payroll;
  }

  async generate(data) {
    const months = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
    const periodType = data.periodType || 'monthly';
    const half = data.half || null;
    const year = data.year;
    const month = data.month;

    let startDate, endDate, period;
    if (periodType === 'semi-monthly') {
      if (!half) throw ApiError.badRequest('Semi-monthly payroll requires half (1 or 2)');
      if (half === 1) {
        startDate = `${year}-${String(month).padStart(2,'0')}-01`;
        endDate = `${year}-${String(month).padStart(2,'0')}-15`;
        period = `${months[month]} ${year} (1st-15th)`;
      } else {
        const lastDay = new Date(year, month, 0).getDate();
        startDate = `${year}-${String(month).padStart(2,'0')}-16`;
        endDate = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
        period = `${months[month]} ${year} (16th-${lastDay})`;
      }
    } else {
      startDate = `${year}-${String(month).padStart(2,'0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      endDate = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
      period = `${months[month]} ${year}`;
    }

    const t = await sequelize.transaction({ isolationLevel: 'REPEATABLE READ' });
    try {
      const existing = await Payroll.findOne({ where: { period }, transaction: t, lock: t.LOCK.UPDATE });
      if (existing) throw ApiError.badRequest(`Payroll for ${period} already exists`);

      const empWhere = { status: 'active' };
      if (data.departmentId) empWhere.departmentId = data.departmentId;
      const employees = await Employee.findAll({ where: empWhere, transaction: t, lock: t.LOCK.UPDATE });
      if (employees.length === 0) throw ApiError.badRequest('No active employees found');

      const attendanceRecords = await Attendance.findAll({
        where: { date: { [Op.between]: [startDate, endDate] } },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      const attendanceByEmployee = gatherAttendance(attendanceRecords);

      let totalWorkingDays = countWorkingDays(startDate, endDate);

      const isDecember = month === 12;

      const payroll = await Payroll.create({
        period, startDate, endDate, status: 'draft',
      }, { transaction: t });

      let totalGross = 0, totalDeductions = 0, totalNet = 0;

      for (const emp of employees) {
        const basicSalary = parseFloat(emp.salary);
        const isSemiMonth = emp.paymentFrequency === 'semi-monthly';
        const periodSalary = isSemiMonth ? basicSalary / 2 : basicSalary;
        const empAtt = attendanceByEmployee[emp.id] || {
          daysWorked: 0, totalHours: 0, overtime: 0,
          nightShiftHours: 0, holidayPay: 0, restDayPay: 0,
          avgHolidayType: 'none', hasRestDay: false,
        };

        const pwd = isSemiMonth ? Math.ceil(totalWorkingDays / 2) : totalWorkingDays;
        const is13thMonthPeriod = isDecember && !isSemiMonth;

        // Calculate YTD basic salary for 13th month computation
        let totalBasicYTD = basicSalary;
        if (is13thMonthPeriod) {
          const previousPayslips = await Payslip.findAll({
            where: { employeeId: emp.id },
            include: [{ model: Payroll, where: { startDate: { [Op.gte]: `${year}-01-01`, [Op.lt]: startDate } }, attributes: [] }],
            attributes: ['basicSalary'],
            transaction: t,
          });
          totalBasicYTD = previousPayslips.reduce((sum, p) => sum + (parseFloat(p.basicSalary) || 0), 0) + basicSalary;
        }

        const payslipData = computePayslipForEmployee(
          emp, empAtt, periodSalary, pwd, totalWorkingDays, isSemiMonth, is13thMonthPeriod, totalBasicYTD, data.bonuses?.[emp.id], year
        );

        await Payslip.create({
          payrollId: payroll.id,
          employeeId: emp.id,
          ...payslipData,
          status: 'draft',
        }, { transaction: t });

        totalGross += payslipData.grossPay;
        totalDeductions += payslipData.totalDeductions;
        totalNet += payslipData.netPay;
      }

      await payroll.update({
        totalEmployees: employees.length,
        totalGrossPay: totalGross,
        totalDeductions,
        totalNetPay: totalNet,
      }, { transaction: t });

      await t.commit();
      return this.getById(payroll.id);
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  async process(id, userId = null) {
    const payroll = await Payroll.findByPk(id);
    if (!payroll) throw ApiError.notFound('Payroll not found');
    if (payroll.status !== 'draft') throw ApiError.badRequest('Only draft payrolls can be processed');

    const { sequelize } = require('../../models');
    await sequelize.transaction(async (t) => {
      await Payslip.update({ status: 'processed' }, { where: { payrollId: id }, transaction: t });
      await payroll.update({ status: 'processed' }, { transaction: t });
    });

    await logActivity(userId, 'payroll-processed', 'HRMS', { referenceType: 'Payroll', referenceId: id, description: `Processed payroll for ${payroll.period}` });

    try {
      const { sendEmail } = require('../../utils/mailer');
      const { payrollProcessedEmail } = require('../../utils/emailTemplates');
      const slips = await Payslip.findAll({ where: { payrollId: id }, include: [{ association: 'employee', attributes: ['id', 'email', 'firstName'] }] });
      for (const slip of slips) {
        if (slip.employee?.email) {
          sendEmail({
            to: slip.employee.email,
            subject: `Payroll Processed - ${payroll.period}`,
            html: payrollProcessedEmail(slip.employee.firstName || slip.employee.email, payroll.period, slip.netPay),
          }).catch(() => {});
        }
      }
    } catch { /* email errors should not block payroll processing */ }

    return this.getById(id);
  }

  async pay(id, userId = null) {
    const payroll = await Payroll.findByPk(id);
    if (!payroll) throw ApiError.notFound('Payroll not found');
    if (payroll.status === 'paid') throw ApiError.badRequest('Payroll already paid');
    if (payroll.status !== 'processed') throw ApiError.badRequest('Payroll must be processed before payment');

    const { sequelize } = require('../../models');
    const today = new Date().toISOString().split('T')[0];
    await sequelize.transaction(async (t) => {
      await Payslip.update({ status: 'paid', paidDate: today }, { where: { payrollId: id }, transaction: t });
      await payroll.update({ status: 'paid', paidAt: new Date() }, { transaction: t });
    });
    await logActivity(userId, 'payroll-paid', 'HRMS', { referenceType: 'Payroll', referenceId: id, description: `Paid payroll for ${payroll.period}` });

    const slips = await Payslip.findAll({
      where: { payrollId: id },
      include: [{ association: 'employee', attributes: ['userId', 'firstName'] }],
    });
    for (const slip of slips) {
      if (slip.employee?.userId) {
        await Notification.create({
          userId: slip.employee.userId,
          type: 'hrms_payroll_paid',
          title: 'Payroll Paid',
          message: `Your payroll for ${payroll.period} has been paid. Net pay: ₱${parseFloat(slip.netPay).toFixed(2)}`,
          data: { payrollId: id, period: payroll.period, netPay: parseFloat(slip.netPay) },
        });
      }
    }

    return this.getById(id);
  }

  async getPayslips(payrollId) {
    return Payslip.findAll({
      where: { payrollId },
      include: [{
        association: 'employee',
        attributes: ['id', 'employeeNo', 'firstName', 'lastName'],
        include: [{ association: 'department', attributes: ['id', 'name'] }],
      }],
    });
  }

  async getMyPayslips(employeeId) {
    return Payslip.findAll({
      where: { employeeId },
      include: [{ association: 'payroll', attributes: ['id', 'period', 'startDate', 'endDate'] }],
      order: [['createdAt', 'DESC']],
    });
  }

  async preview(data) {
    const months = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
    const periodType = data.periodType || 'monthly';
    const half = data.half || null;
    const year = data.year;
    const month = data.month;

    let startDate, endDate, period;
    if (periodType === 'semi-monthly') {
      if (!half) throw ApiError.badRequest('Semi-monthly payroll requires half (1 or 2)');
      if (half === 1) {
        startDate = `${year}-${String(month).padStart(2,'0')}-01`;
        endDate = `${year}-${String(month).padStart(2,'0')}-15`;
        period = `${months[month]} ${year} (1st-15th)`;
      } else {
        const lastDay = new Date(year, month, 0).getDate();
        startDate = `${year}-${String(month).padStart(2,'0')}-16`;
        endDate = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
        period = `${months[month]} ${year} (16th-${lastDay})`;
      }
    } else {
      const lastDay = new Date(year, month, 0).getDate();
      startDate = `${year}-${String(month).padStart(2,'0')}-01`;
      endDate = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
      period = `${months[month]} ${year}`;
    }

    const empWherePreview = { status: 'active' };
    if (data.departmentId) empWherePreview.departmentId = data.departmentId;
    const employees = await Employee.findAll({ where: empWherePreview });
    if (employees.length === 0) throw ApiError.badRequest('No active employees found');

    const attendanceRecords = await Attendance.findAll({
      where: { date: { [Op.between]: [startDate, endDate] } },
    });
    const attendanceByEmployee = gatherAttendance(attendanceRecords);

    const totalWorkingDays = countWorkingDays(startDate, endDate);

    const isDecember = month === 12;
    const previewPayslips = [];
    let totalGross = 0, totalDeductions = 0, totalNet = 0;

    for (const emp of employees) {
      const basicSalary = parseFloat(emp.salary);
      const isSemiMonth = emp.paymentFrequency === 'semi-monthly';
      const periodSalary = isSemiMonth ? basicSalary / 2 : basicSalary;
      const empAtt = attendanceByEmployee[emp.id] || {
        daysWorked: 0, totalHours: 0, overtime: 0,
        nightShiftHours: 0, holidayPay: 0, restDayPay: 0,
        avgHolidayType: 'none', hasRestDay: false,
      };

      const pwd = isSemiMonth ? Math.ceil(totalWorkingDays / 2) : totalWorkingDays;
      const is13thMonthPeriod = isDecember && !isSemiMonth;

      const p = computePayslipForEmployee(
        emp, empAtt, periodSalary, pwd, totalWorkingDays, isSemiMonth, is13thMonthPeriod, basicSalary, 0, year
      );

      previewPayslips.push({
        employeeId: emp.id,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        ...p,
      });
      totalGross += p.grossPay;
      totalDeductions += p.totalDeductions;
      totalNet += p.netPay;
    }

    return { period, startDate, endDate, totalEmployees: employees.length, totalWorkingDays, totalGross, totalDeductions, totalNet, payslips: previewPayslips };
  }

  async exportCSV(id) {
    const payslips = await Payslip.findAll({
      where: { payrollId: id },
      include: [{
        association: 'employee',
        attributes: ['employeeNo', 'firstName', 'lastName'],
        include: [{ association: 'department', attributes: ['name'] }],
      }],
    });
    const header = 'Employee No,Name,Department,Days Worked,Absent Days,Basic Pay,OT Pay,ND Pay,Holiday Pay,Rest Day Pay,13th Month,Bonus,Absent Ded,SSS,PhilHealth,Pag-IBIG,BIR Tax,Total Ded,Net Pay\n';
    const rows = payslips.map(ps => {
      const e = ps.employee || {};
      const sanitize = (v) => {
        const s = String(v || '');
        if (/^[=+\-@\t\r|]/.test(s)) return `"'"${s.replace(/"/g, '""')}"`;
        return `"${s.replace(/"/g, '""')}"`;
      };
      return `${sanitize(e.employeeNo || '')},${sanitize(e.firstName)} ${sanitize(e.lastName)},${sanitize(e.department?.name)},${sanitize(ps.daysWorked || 0)},${sanitize(ps.absentDays || 0)},${sanitize(ps.basicSalary || 0)},${sanitize(ps.overtimePay || 0)},${sanitize(ps.nightDiffPay || 0)},${sanitize(ps.holidayPay || 0)},${sanitize(ps.restDayPay || 0)},${sanitize(ps.thirteenthMonthPay || 0)},${sanitize(ps.bonusPay || 0)},${sanitize(ps.absentDeduction || 0)},${sanitize(ps.sssDeduction || 0)},${sanitize(ps.philhealthDeduction || 0)},${sanitize(ps.pagibigDeduction || 0)},${sanitize(ps.taxDeduction || 0)},${sanitize(ps.totalDeductions || 0)},${sanitize(ps.netPay || 0)}`;
    }).join('\n');
    return header + rows;
  }
}

module.exports = new PayrollService();
