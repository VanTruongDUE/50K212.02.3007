export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;
  constructor(message: string, status: number, data: Record<string, unknown> = {}) { super(message); this.status = status; this.data = data; }
}

export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/${path}`, {
      method,
      credentials: "same-origin",
      ...(body === undefined
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    });
  } catch {
    throw new Error("Không thể kết nối máy chủ. Kiểm tra kết nối rồi thử lại.");
  }
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => ({}));
    const result = (payload && typeof payload === "object" ? payload : {}) as {
      message?: string | { message?: string };
    };
    const message =
      typeof result.message === "string"
        ? result.message
        : result.message?.message;
    const technical = !message || /^(Not Found|Bad Request|Unauthorized|Forbidden|Conflict|Internal Server Error|Service Unavailable)$/i.test(message);
    const fallback = response.status === 404 ? 'Không tìm thấy dữ liệu hoặc bạn không có quyền truy cập. Vui lòng chọn lại từ danh sách.'
      : response.status === 401 ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
      : response.status === 403 ? 'Bạn không có quyền thực hiện thao tác này.'
      : response.status >= 500 ? 'Máy chủ tạm thời không xử lý được yêu cầu. Vui lòng thử lại.'
      : 'Yêu cầu chưa hợp lệ. Kiểm tra thông tin và trạng thái hiện tại.';
    throw new ApiError(technical ? fallback : message, response.status, result);
  }
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>);
}

export const idNumber = (value: string | number) => Number(value);
