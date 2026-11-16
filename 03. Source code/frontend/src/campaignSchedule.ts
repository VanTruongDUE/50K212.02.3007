export function scheduleError(value: string, now = Date.now()) {
  const start = Date.parse(value);
  return !Number.isFinite(start) || start < now + 15 * 60000 || start > now + 90 * 86400000
    ? 'Chọn thời điểm bắt đầu từ 15 phút đến 90 ngày sau hiện tại.' : '';
}

export function expectedFinish(start: string, count: number, rate = 50, from = '08:00', to = '17:00', immediate = false, dailyLimit = Infinity, usedToday = 0, now = Date.now()): string | undefined {
  let time = Date.parse(start);
  if (!Number.isFinite(time) || !Number.isInteger(count) || count < 1 || scheduleOptionsError(rate, from, to)) return;
  if (dailyLimit <= 0 || usedToday < 0) return;
  const day = (value: number) => Math.floor((value + 7 * 3600000) / 86400000);
  let quotaDay = day(time), used = quotaDay === day(now) ? usedToday : 0;
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  const open = minutes(from), close = minutes(to);
  if (!Number.isFinite(open) || !Number.isFinite(close) || open < 0 || close > 1440) return;
  const inWindow = (value: number) => {
    const local = new Date(value + 7 * 3600000);
    const dayStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - 7 * 3600000;
    if (value < dayStart + open * 60000) return dayStart + open * 60000;
    if (value >= dayStart + close * 60000) return dayStart + 86400000 + open * 60000;
    return value;
  };
  if (!immediate) time = inWindow(time);
  for (let index = 0; index < count; index++) {
    if (day(time) !== quotaDay) { quotaDay = day(time); used = 0; }
    if (used >= dailyLimit) {
      time = (quotaDay + 1) * 86400000 - 7 * 3600000 + (immediate ? 0 : open * 60000);
      quotaDay = day(time); used = 0;
    }
    used++;
    if (index < count - 1) {
      time += 3600000 / rate;
      if (!immediate) time = inWindow(time);
    }
  }
  return new Date(time).toISOString();
}

export function scheduleOptionsError(rate: number, from: string, to: string) {
  return !Number.isInteger(rate) || rate < 1 || rate > 100 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(from) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(to) || from >= to
    ? 'Tốc độ gửi phải là số nguyên từ 1 đến 100 email/giờ; giờ bắt đầu phải trước giờ kết thúc.' : '';
}

export function scheduleStartError(value: string, from: string, to: string, now = Date.now()) {
  const error = scheduleError(value, now);
  if (error) return error;
  const start = new Date(value);
  const time = `${String((start.getUTCHours() + 7) % 24).padStart(2, '0')}:${String(start.getUTCMinutes()).padStart(2, '0')}`;
  return time < from || time >= to ? 'Giờ bắt đầu phải nằm trong khung giờ gửi.' : '';
}
