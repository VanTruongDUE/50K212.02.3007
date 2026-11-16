// Quotas reset at midnight in Vietnam, independently of the database timezone.
export const dailyQuotaStartSql =
  "(date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh')";
