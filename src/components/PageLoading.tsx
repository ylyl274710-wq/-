export default function PageLoading() {
  return <main className="page-loading" role="status" aria-live="polite" aria-busy="true">
    <div className="loading-paper" aria-hidden="true"><i /><i /><i /><i /></div>
    <p>正在铺开你的拼图桌…</p>
  </main>;
}
