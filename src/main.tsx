import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { App, Splash } from './app/App'
import { capability } from './core/runtime'
import { createStore } from './core/store/createStore'

const root = createRoot(document.getElementById('root')!)
root.render(<Splash />)

async function boot() {
  const store = await createStore()
  let readOnly = false
  if (store.mode === 'db') {
    // A viewer below Contributor can read shared data but not write it: start in read-only.
    const user = await capability('user')
    readOnly = (user ? await user.can('data.write') : null) === false
  }
  root.render(
    <StrictMode>
      <App store={store} initialReadOnly={readOnly} />
    </StrictMode>,
  )
}

void boot()
