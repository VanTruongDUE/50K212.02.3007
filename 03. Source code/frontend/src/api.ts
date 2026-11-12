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
    const result = (await response.json().catch(() => ({}))) as {
      message?: string | { message?: string };
    };
    const message =
      typeof result.message === "string"
        ? result.message
        : result.message?.message;
    throw new Error(
      message || `Yêu cầu không thành công (${response.status}).`,
    );
  }
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>);
}

export const idNumber = (value: string | number) => Number(value);
