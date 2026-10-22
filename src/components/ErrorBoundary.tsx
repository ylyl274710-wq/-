import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // 不记录照片、房间凭据或存档内容；现有本地数据保留供重新进入。
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="recovery-page" role="alert">
      <span aria-hidden="true">✳</span><h1>这一片，暂时卡住了。</h1>
      <p>页面没有顺利打开。已保存的拼图和收藏仍保留在这个浏览器里。</p>
      <div><button className="primary-button" onClick={() => location.reload()}>重新打开页面</button>
        <a className="secondary-button" href={location.pathname + location.search}>返回首页</a></div>
      <small>如果刚刚断网，连接恢复后再试一次。</small>
    </main>;
  }
}
