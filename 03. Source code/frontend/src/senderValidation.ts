export function senderValidation(form: { name: string; code?: string; email: string; smtpHost: string; smtpPort: string; smtpUser: string; quotaDaily: string }) {
  const errors: Record<string, string> = {};
  if (!form.name.trim() || form.name.length > 50) errors.name = "Nhập tên tài khoản, tối đa 50 ký tự.";
  if (form.code !== undefined && !/^[\p{L}\p{N}_-]{1,50}$/u.test(form.code)) errors.code = "Nhập mã tài khoản, tối đa 50 ký tự chữ, số, gạch ngang hoặc gạch dưới.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) || form.email.length > 320) errors.email = "Nhập địa chỉ email hợp lệ.";
  if (!form.smtpHost.trim()) errors.smtpHost = "Vui lòng nhập máy chủ SMTP.";
  if (!Number.isInteger(Number(form.smtpPort)) || Number(form.smtpPort) < 1 || Number(form.smtpPort) > 65535) errors.smtpPort = "Cổng SMTP phải là số nguyên từ 1 đến 65535.";
  if (!form.smtpUser.trim()) errors.smtpUser = "Vui lòng nhập tên đăng nhập SMTP.";
  if (!Number.isInteger(Number(form.quotaDaily)) || Number(form.quotaDaily) < 1 || Number(form.quotaDaily) > 100) errors.quotaDaily = "Hạn mức phải là số nguyên từ 1 đến 100 email / ngày.";
  return errors;
}
