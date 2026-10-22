export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = 'ApiError'; }
}

interface RequestOptions { signal?: AbortSignal; timeoutMs?: number }

export async function requestJson<T>(path: string, value?: unknown, { signal, timeoutMs = 20000 }: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort(); else signal?.addEventListener('abort', abort, { once: true });
  // 超时覆盖响应体读取，不只是等待响应头；写操作不自动重试，避免重复创建房间或分享。
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const response = await fetch(path, { signal: controller.signal, cache: 'no-store',
      ...(value === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) }) });
    const result: unknown = await response.json().catch(error => {
      if (controller.signal.aborted) throw error;
      return null;
    });
    if (!response.ok) throw new ApiError(result && typeof result === 'object' && 'error' in result ? String(result.error) : '拼图服务暂时未连接，请稍后重试', response.status);
    if (!result || typeof result !== 'object') throw new ApiError('拼图服务返回的数据不完整，请稍后重试', 502);
    return result as T;
  } catch (error) {
    if (signal?.aborted) throw new DOMException('已取消请求', 'AbortError');
    if (timedOut) throw new ApiError('连接超时，请检查网络后重试；若刚创建过房间或分享，请先确认创建结果', 408);
    if (error instanceof ApiError) throw error;
    throw new ApiError(typeof navigator !== 'undefined' && navigator.onLine === false ? '网络已断开，本地拼图仍可继续；联网后再试' : '暂时连接不上拼图服务，请确认服务已启动后重试', 0);
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort);
  }
}
