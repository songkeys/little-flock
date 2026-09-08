import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'
import App from './App'

class ErrorBoundary extends React.Component<{children:React.ReactNode},{error:boolean}> {
  state={error:false}
  static getDerivedStateFromError(){return {error:true}}
  render(){return this.state.error ? <div className="fatal-screen"><img src="/favicon.svg" width="64"/><h1>小羊迷路了一会儿</h1><p>你的牧场进度保存在服务器。重新打开，继续今天的小日子。</p><button onClick={()=>location.reload()}>重新进入牧场</button></div> : this.props.children}
}
ReactDOM.createRoot(document.getElementById('root')!).render(<ErrorBoundary><App/></ErrorBoundary>)
