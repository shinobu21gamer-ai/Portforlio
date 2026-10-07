const { Op } = require('sequelize');
const { Attendance, Employee, ShiftAssignment, User, sequelize } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { getPagination, getPaginationMeta, escapeLike, sanitizeObject } = require('../../utils/helpers');
const { logActivity } = require('../../utils/audit');

const getLocalDate = () => {
  const now = new Date();
  return new Date(now.getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
};

// Great-circle distance in metres. Haversine, so no new dependency.
// Returns null when either point is missing rather than guessing a location.
function distanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2;
  return Math.round(2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(a))));
}

function computeNightShiftHours(clockIn, clockOut) {
  const inTime = new Date(clockIn);
  const outTime = new Date(clockOut);
  let nightHours = 0;
  const current = new Date(inTime);
  while (current < outTime) {
    const hour = current.getHours();
    if (hour >= 22 || hour < 6) {
      const nextHour = new Date(current);
      nextHour.setHours(nextHour.getHours() + 1);
      const end = nextHour > outTime ? outTime : nextHour;
      nightHours += (end - current) / (1000 * 60 * 60);
    }
    current.setHours(current.getHours() + 1);
  }
  return parseFloat(nightHours.toFixed(2));
}

function computeHolidayPay(holidayType, totalHours, hourlyRate) {
  if (holidayType === 'regular') return totalHours * hourlyRate * 2.00;
  if (holidayType === 'special') return totalHours * hourlyRate * 1.30;
  return 0;
}

function computeRestDayPay(totalHours, hourlyRate) {
  return totalHours * hourlyRate * 0.30;
}

function getHolidayType(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const dow = d.getDay();
  const regularHolidays = [
    { m: 1, d: 1 }, { m: 4, d: 9 }, { m: 5, d: 1 }, { m: 6, d: 12 },
    { m: 8, d: 27 }, { m: 11, d: 30 }, { m: 12, d: 25 }, { m: 12, d: 30 }, { m: 12, d: 31 },
  ];
  const specialHolidays = [
    { m: 1, d: 2 }, { m: 2, d: 25 }, { m: 4, d: 1 }, { m: 4, d: 2 },
    { m: 8, d: 21 }, { m: 11, d: 1 }, { m: 11, d: 2 }, { m: 12, d: 8 }, { m: 12, d: 24 },
  ];
  for (const h of regularHolidays) { if (h.m === month && h.d === day) return 'regular'; }
  for (const h of specialHolidays) { if (h.m === month && h.d === day) return 'special'; }
  if (dow === 0) return 'special';
  return 'none';
}

class AttendanceService {
  async getAll(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const where = {};
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.status) where.status = query.status;
    if (query.date) where.date = query.date;
    if (query.startDate && query.endDate) {
      where.date = { [Op.between]: [query.startDate, query.endDate] };
    } else if (query.startDate) {
      where.date = { [Op.gte]: query.startDate };
    } else if (query.endDate) {
      where.date = { [Op.lte]: query.endDate };
    }

    const include = [{
      association: 'employee',
      attributes: ['id', 'employeeNo', 'firstName', 'lastName'],
      include: [
        { association: 'department', attributes: ['id', 'name'] },
        { association: 'schedule', attributes: ['id', 'name', 'startTime', 'endTime'] },
      ],
    }];

    if (query.search) {
      const safeSearch = escapeLike(query.search);
      include[0].where = {
        [Op.or]: [
          { firstName: { [Op.like]: `%${safeSearch}%` } },
          { lastName: { [Op.like]: `%${safeSearch}%` } },
          { employeeNo: { [Op.like]: `%${safeSearch}%` } },
        ],
      };
    }

    const { rows, count } = await Attendance.findAndCountAll({
      where, include, offset, limit, order: [['date', 'DESC'], ['clockIn', 'DESC']],
      distinct: true,
    });

    return { attendance: rows, pagination: getPaginationMeta(count, page, limit) };
  }

  async getScheduleForEmployee(employeeId, date) {
    const assignment = await ShiftAssignment.findOne({
      where: { employeeId, date },
      include: [{ association: 'schedule', attributes: ['id', 'name', 'startTime', 'endTime'] }],
    });
    if (assignment?.schedule) return assignment.schedule;

    const emp = await Employee.findByPk(employeeId, {
      include: [{ association: 'schedule', attributes: ['id', 'name', 'startTime', 'endTime'] }],
    });
    return emp?.schedule || null;
  }

  async clockIn(data, { skipGeofence = false } = {}) {
    const t = await sequelize.transaction({ isolationLevel: 'REPEATABLE READ' });
    try {
      const emp = await Employee.findByPk(data.employeeId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!emp) throw ApiError.notFound('Employee not found');
      if (emp.status !== 'active') throw ApiError.badRequest('Employee is not active');

      const today = getLocalDate();
      const existing = await Attendance.findOne({ where: { employeeId: data.employeeId, date: today }, transaction: t, lock: t.LOCK.UPDATE });
      if (existing) throw ApiError.badRequest('Already clocked in today');

      const schedule = await this.getScheduleForEmployee(data.employeeId, today);
      const now = new Date();
      let isLate = false;
      let lateMinutes = 0;

      if (schedule && schedule.startTime) {
        const [startH, startM] = schedule.startTime.split(':').map(Number);
        const clockHour = now.getHours();
        const clockMin = now.getMinutes();
        const scheduleMinutes = startH * 60 + startM + 5;
        const clockMinutes = clockHour * 60 + clockMin;
        if (clockMinutes > scheduleMinutes) {
          isLate = true;
          lateMinutes = clockMinutes - scheduleMinutes;
        }
      } else {
        if (now.getHours() >= 9) { isLate = true; lateMinutes = (now.getHours() - 9) * 60 + now.getMinutes(); }
      }

      const holidayType = getHolidayType(today);
      const isRestDay = new Date(today + 'T00:00:00').getDay() === 0;

      // Geofencing is opt-in per branch. The employee's branch comes via
      // User.branchId (Employee has no branchId of its own). Location is
      // recorded whenever the client supplies it, even if the branch does not
      // enforce a fence, so an odd clock-in is still reviewable afterwards.
      let geo = { lat: null, lng: null, distance: null, verified: null };
      const lat = Number(data.latitude);
      const lng = Number(data.longitude);
      const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

      // The branch lookup is unconditional: if enforcement only ran when the client
      // happened to send coordinates, an enforcing branch would be trivially
      // bypassed by omitting them.
      {
        const user = await User.findOne({
          where: { email: emp.email },
          include: [{ association: 'branch' }],
          transaction: t,
        });
        const branch = user && user.branch;
        const radius = branch ? parseInt(branch.geofenceRadiusMeters, 10) : null;
        const enforcing = Boolean(branch && branch.enforceGeofence && radius > 0 && branch.latitude != null && branch.longitude != null);

        if (enforcing && skipGeofence) {
          // HR entered the clock-in on the employee's behalf: the fence cannot be
          // checked because the person at the keyboard is not necessarily at the
          // branch, so the record is stamped as explicitly *not* verified instead
          // of rejecting the whole batch (which used to make bulk clock-in
          // impossible for every geofenced branch).
          geo = { lat: null, lng: null, distance: null, verified: false };
        } else if (enforcing) {
          if (!hasCoords) {
            throw ApiError.badRequest(
              `Clock-in requires location for ${branch.name}. Enable location on this device and try again.`
            );
          }
          const distance = distanceMeters(lat, lng, parseFloat(branch.latitude), parseFloat(branch.longitude));
          if (distance > radius) {
            const km = (distance / 1000).toFixed(2);
            throw ApiError.forbidden(
              `You are ${km} km from ${branch.name}, outside the ${radius} m clock-in area.`
            );
          }
          geo = { lat, lng, distance, verified: true };
        } else if (hasCoords && branch && branch.latitude != null && branch.longitude != null) {
          // Not enforced, but record where they actually were.
          geo = {
            lat,
            lng,
            distance: distanceMeters(lat, lng, parseFloat(branch.latitude), parseFloat(branch.longitude)),
            verified: null,
          };
        }
      }

      const record = await Attendance.create({
        employeeId: data.employeeId,
        date: today,
        clockIn: now,
        status: isLate ? 'late' : 'present',
        lateMinutes,
        holidayType,
        isRestDay,
        clockInLat: geo.lat,
        clockInLng: geo.lng,
        geofenceDistanceMeters: geo.distance,
        isGeofenceVerified: geo.verified,
        notes: data.notes || null,
      }, { transaction: t });

      await t.commit();
      return record;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  // HR clocking in other employees. Each employee gets its own transaction so
  // one rejection (already clocked in, inactive, missing) does not roll back
  // the rest of the batch. Geofencing is deliberately skipped: the person
  // clocking in is not physically at the branch.
  async bulkClockIn(employeeIds, actorId = null) {
    const succeeded = [];
    const failed = [];

    for (const employeeId of employeeIds) {
      try {
        await this.clockIn({ employeeId, notes: 'Clocked in by HR — geofence not verified' }, { skipGeofence: true });
        succeeded.push(employeeId);
      } catch (error) {
        const emp = await Employee.findByPk(employeeId, { attributes: ['firstName', 'lastName', 'employeeNo'] });
        failed.push({
          employeeId,
          name: emp ? `${emp.firstName} ${emp.lastName}` : `Employee #${employeeId}`,
          reason: error.message,
        });
      }
    }

    // HR acting on other people's attendance is exactly the kind of action an
    // audit trail exists for, so record who did it and who it affected.
    if (succeeded.length > 0) {
      await logActivity(actorId, 'attendance-bulk-clock-in', 'HRMS', {
        referenceType: 'Attendance',
        referenceId: succeeded[0],
        description: `Clocked in ${succeeded.length} employee(s): ${succeeded.join(', ')}`,
        newData: { succeeded, failed: failed.map(f => f.employeeId) },
      });
    }

    return { succeeded, failed, total: employeeIds.length };
  }

  // HR clocking out other employees. Mirrors bulkClockIn: one transaction per
  // employee so a single rejection does not roll back the batch.
  async bulkClockOut(employeeIds, actorId = null) {
    const succeeded = [];
    const failed = [];

    for (const employeeId of employeeIds) {
      try {
        await this.clockOut({ employeeId });
        succeeded.push(employeeId);
      } catch (error) {
        const emp = await Employee.findByPk(employeeId, { attributes: ['firstName', 'lastName', 'employeeNo'] });
        failed.push({
          employeeId,
          name: emp ? `${emp.firstName} ${emp.lastName}` : `Employee #${employeeId}`,
          reason: error.message,
        });
      }
    }

    if (succeeded.length > 0) {
      await logActivity(actorId, 'attendance-bulk-clock-out', 'HRMS', {
        referenceType: 'Attendance',
        referenceId: succeeded[0],
        description: `Clocked out ${succeeded.length} employee(s): ${succeeded.join(', ')}`,
        newData: { succeeded, failed: failed.map(f => f.employeeId) },
      });
    }

    return { succeeded, failed, total: employeeIds.length };
  }

  async clockOut(data) {
    const t = await sequelize.transaction({ isolationLevel: 'REPEATABLE READ' });
    try {
      const emp = await Employee.findByPk(data.employeeId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!emp) throw ApiError.notFound('Employee not found');

      const today = getLocalDate();
      const record = await Attendance.findOne({ where: { employeeId: data.employeeId, date: today }, transaction: t, lock: t.LOCK.UPDATE });
      if (!record) throw ApiError.badRequest('No clock-in record for today');
      if (record.clockOut) throw ApiError.badRequest('Already clocked out today');

      const now = new Date();
      const clockInTime = new Date(record.clockIn);

      // Handle overnight shifts: if clockOut is next day, adjust
      let totalHoursRaw = (now - clockInTime) / (1000 * 60 * 60);
      if (totalHoursRaw < 0) totalHoursRaw += 24;

      // Deduct meal break (60 min for shifts >= 6 hours)
      const mealBreakMinutes = totalHoursRaw >= 6 ? (record.mealBreakMinutes || 60) : 0;
      const totalHours = parseFloat(Math.max(0, totalHoursRaw - mealBreakMinutes / 60).toFixed(2));

      let status = record.status;
      if (totalHours < 4) status = 'half-day';
      if (totalHours < 4 && record.status !== 'late') status = 'half-day';

      // Overtime calculation
      const schedule = await this.getScheduleForEmployee(data.employeeId, today);
      let overtime = 0;
      if (schedule && schedule.startTime && schedule.endTime) {
        const [startH, startM] = schedule.startTime.split(':').map(Number);
        const [endH, endM] = schedule.endTime.split(':').map(Number);
        const shiftDecimal = (endH + endM / 60) - (startH + startM / 60);
        const shiftHours = shiftDecimal > 0 ? shiftDecimal : 24 + shiftDecimal;
        if (totalHours > shiftHours) overtime = parseFloat((totalHours - shiftHours).toFixed(2));
      } else if (totalHours > 8) {
        overtime = parseFloat((totalHours - 8).toFixed(2));
      }

      // Night shift hours
      const nightShiftHours = computeNightShiftHours(record.clockIn, now);

      // Holiday and rest day pay
      const hourlyRate = (parseFloat(emp.salary) / (emp.paymentFrequency === 'semi-monthly' ? 11 : 22)) / 8;
      const holidayPay = computeHolidayPay(record.holidayType, totalHours, hourlyRate);
      const restDayPay = record.isRestDay ? computeRestDayPay(totalHours, hourlyRate) : 0;

      await record.update({
        clockOut: now,
        totalHours,
        overtime,
        nightShiftHours,
        holidayPay: parseFloat(holidayPay.toFixed(2)),
        restDayPay: parseFloat(restDayPay.toFixed(2)),
        mealBreakMinutes,
        status,
      }, { transaction: t });

      await t.commit();
      return record.reload();
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async create(data) {
    const sanitized = sanitizeObject(data);
    const emp = await Employee.findByPk(sanitized.employeeId);
    if (!emp) throw ApiError.notFound('Employee not found');
    if (emp.status !== 'active') throw ApiError.badRequest('Employee is not active');

    const existing = await Attendance.findOne({
      where: { employeeId: sanitized.employeeId, date: sanitized.date },
    });
    if (existing) throw ApiError.badRequest('Attendance record already exists for this date');

    let totalHours = 0;
    let nightShiftHours = 0;
    let overtime = 0;
    let mealBreakMinutes = 60;

    if (sanitized.clockIn && sanitized.clockOut) {
      let raw = (new Date(sanitized.clockOut) - new Date(sanitized.clockIn)) / (1000 * 60 * 60);
      if (raw < 0) raw += 24;
      mealBreakMinutes = raw >= 6 ? 60 : 0;
      totalHours = parseFloat(Math.max(0, raw - mealBreakMinutes / 60).toFixed(2));
      nightShiftHours = computeNightShiftHours(sanitized.clockIn, sanitized.clockOut);
      if (totalHours > 8) overtime = parseFloat((totalHours - 8).toFixed(2));
    }

    const holidayType = sanitized.holidayType || getHolidayType(sanitized.date);
    const isRestDay = sanitized.isRestDay !== undefined ? sanitized.isRestDay : (new Date(sanitized.date + 'T00:00:00').getDay() === 0);

    const t = await sequelize.transaction({ isolationLevel: 'REPEATABLE READ' });
    try {
      const record = await Attendance.create({
        ...sanitized,
        totalHours,
        nightShiftHours,
        overtime,
        mealBreakMinutes,
        holidayType,
        isRestDay,
      }, { transaction: t });

      await t.commit();
      return record.reload();
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async update(id, data) {
    const t = await sequelize.transaction({ isolationLevel: 'REPEATABLE READ' });
    try {
      const record = await Attendance.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!record) throw ApiError.notFound('Attendance record not found');

      const updates = {};
      if (data.clockIn !== undefined) updates.clockIn = data.clockIn;
      if (data.clockOut !== undefined) updates.clockOut = data.clockOut;
      if (data.status !== undefined) updates.status = data.status;
      if (data.notes !== undefined) updates.notes = data.notes;
      if (data.holidayType !== undefined) updates.holidayType = data.holidayType;
      if (data.isRestDay !== undefined) updates.isRestDay = data.isRestDay;
      if (data.isOvertimeApproved !== undefined) updates.isOvertimeApproved = data.isOvertimeApproved;

      if (updates.clockIn && updates.clockOut) {
        let raw = (new Date(updates.clockOut) - new Date(updates.clockIn)) / (1000 * 60 * 60);
        if (raw < 0) raw += 24;
        updates.mealBreakMinutes = raw >= 6 ? 60 : 0;
        updates.totalHours = parseFloat(Math.max(0, raw - updates.mealBreakMinutes / 60).toFixed(2));
        updates.nightShiftHours = computeNightShiftHours(updates.clockIn, updates.clockOut);
        updates.overtime = updates.totalHours > 8 ? parseFloat((updates.totalHours - 8).toFixed(2)) : 0;
      } else if (updates.clockIn || updates.clockOut) {
        const ci = updates.clockIn || record.clockIn;
        const co = updates.clockOut || record.clockOut;
        if (ci && co) {
          let raw = (new Date(co) - new Date(ci)) / (1000 * 60 * 60);
          if (raw < 0) raw += 24;
          updates.mealBreakMinutes = raw >= 6 ? 60 : 0;
          updates.totalHours = parseFloat(Math.max(0, raw - updates.mealBreakMinutes / 60).toFixed(2));
          updates.nightShiftHours = computeNightShiftHours(ci, co);
          updates.overtime = updates.totalHours > 8 ? parseFloat((updates.totalHours - 8).toFixed(2)) : 0;
        }
      }

      await record.update(updates, { transaction: t });
      await t.commit();
      return record.reload();
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async getTodaySummary() {
    const today = getLocalDate();
    const total = await Employee.count({ where: { status: 'active' } });
    const present = await Attendance.count({ where: { date: today, status: { [Op.or]: ['present', 'late'] } } });
    const late = await Attendance.count({ where: { date: today, status: 'late' } });
    const absent = Math.max(0, total - present);

    return { total, present, late, absent, date: today };
  }

  async exportCSV(query) {
    const where = {};
    if (query.startDate && query.endDate) {
      where.date = { [Op.between]: [query.startDate, query.endDate] };
    } else if (query.date) {
      where.date = query.date;
    }
    const records = await Attendance.findAll({
      where,
      include: [{
        association: 'employee',
        attributes: ['employeeNo', 'firstName', 'lastName'],
        include: [{ association: 'department', attributes: ['name'] }],
      }],
      order: [['date', 'DESC']],
    });
    const header = 'Date,Employee No,Name,Department,Clock In,Clock Out,Status,Hours,OT,ND Hours,Holiday,Rest Day\n';
    const rows = records.map(r => {
      const e = r.employee || {};
      const sanitize = (v) => {
        const s = String(v || '');
        if (/^[=+\-@\t\r|]/.test(s)) return `"'"${s.replace(/"/g, '""')}"`;
        return `"${s.replace(/"/g, '""')}"`;
      };
      return `${sanitize(r.date)},${sanitize(e.employeeNo || '')},${sanitize(e.firstName)} ${sanitize(e.lastName)},${sanitize(e.department?.name)},${sanitize(r.clockIn || '')},${sanitize(r.clockOut || '')},${sanitize(r.status)},${sanitize(r.totalHours || 0)},${sanitize(r.overtime || 0)},${sanitize(r.nightShiftHours || 0)},${sanitize(r.holidayType || 'none')},${sanitize(r.isRestDay ? 'Yes' : 'No')}`;
    }).join('\n');
    return header + rows;
  }
}

const attendanceService = new AttendanceService();
// Pure math helpers exposed for unit tests (Phase 6). Behaviour is unchanged.
attendanceService._math = {
  distanceMeters,
  computeNightShiftHours,
  computeHolidayPay,
  computeRestDayPay,
  getHolidayType,
};
module.exports = attendanceService;
