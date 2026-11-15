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
    throw new ApiError(
      message || `Yêu cầu không thành công (${response.status}).`, response.status, result,
    );
  }
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>);
}

export const idNumber = (value: string | number) => Number(value);
