// 旧 Runtime Data V2 路径永久退役。
export function onRequest() {
  return new Response('Gone: FF14 runtime data V2 has been retired.\n', {
    status: 410,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
