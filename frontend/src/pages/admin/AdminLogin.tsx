import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setAdminToken } from '../../services/adminApi'
import { adminApi } from '../../services/adminApi'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const token = await adminApi.login(email, password)
      setAdminToken(token)
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="page">
      <div className="login-box">
        <h1>Вход администратора</h1>
        {error && <div className="alert error">{error}</div>}
        <form className="form-grid" onSubmit={submit}>
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label>Пароль<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          <button type="submit" className="btn">Войти</button>
        </form>
      </div>
    </div>
  )
}
