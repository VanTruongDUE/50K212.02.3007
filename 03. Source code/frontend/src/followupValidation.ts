export function followupValidation(input: { goal: string; due: string; reminderMinutes: string; waitDays: string; maxAttempts: string; intervalDays: string }, now = Date.now()) {
  const errors: Record<string, string> = {};
  if (!input.goal.trim() || input.goal.length > 2000) errors.goal = 'Vui lòng nhập nội dung / mục tiêu, tối đa 2000 ký tự.';
  if (input.due && (!Number.isFinite(Date.parse(input.due)) || Date.parse(input.due) < now)) errors.due = 'Ngày giờ hẹn phải ở tương lai.';
  for (const [key, min, max] of [['reminderMinutes', 0, 10080], ['waitDays', 1, 30], ['maxAttempts', 1, 3], ['intervalDays', 1, 30]] as const) {
    if (!input[key].trim() || !Number.isInteger(Number(input[key])) || Number(input[key]) < min || Number(input[key]) > max) errors[key] = `Nhập số nguyên từ ${min} đến ${max}.`;
  }
  return errors;
}
