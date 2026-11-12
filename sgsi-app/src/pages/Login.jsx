import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { session, signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [modo, setModo] = useState('login')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState(null)
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)

  if (session) return <Navigate to="/" replace />

  const submit = async (e) => {
    e.preventDefault()
    setErro(null); setMsg(null); setLoading(true)
    try {
      if (modo === 'login') {
        const { error } = await signIn(email, senha)
        if (error) throw error
        navigate('/')
      } else {
        const { data, error } = await signUp(email, senha, nome)
        if (error) throw error
        if (data.session) navigate('/')
        else setMsg('Conta criada. Se a confirmacao por e-mail estiver ativa, verifique sua caixa de entrada.')
      }
    } catch (err) {
      setErro(traduzErro(err.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-900 p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.12),transparent_40%)]" />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 rounded-2xl bg-emerald-500/15 p-3">
            <ShieldCheck className="h-10 w-10 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">SGSI</h1>
          <p className="text-sm text-navy-300">Sistema de Gestao de Seguranca da Informacao · ISO 27001</p>
        </div>

        <div className="card p-6">
          <div className="mb-5 flex rounded-lg bg-slate-100 p-1 text-sm font-semibold">
            <button
              className={`flex-1 rounded-md py-1.5 transition ${modo === 'login' ? 'bg-white text-navy-800 shadow-sm' : 'text-slate-500'}`}
              onClick={() => setModo('login')}
            >Entrar</button>
            <button
              className={`flex-1 rounded-md py-1.5 transition ${modo === 'signup' ? 'bg-white text-navy-800 shadow-sm' : 'text-slate-500'}`}
              onClick={() => setModo('signup')}
            >Criar conta</button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {modo === 'signup' && (
              <div>
                <label className="label">Nome</label>
                <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" required />
              </div>
            )}
            <div>
              <label className="label">E-mail</label>
              <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com.br" required />
            </div>
            <div>
              <label className="label">Senha</label>
              <input type="password" className="input" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="********" minLength={6} required />
            </div>

            {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
            {msg && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div>}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {modo === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-navy-400">
          Acesso restrito a colaboradores autorizados.
        </p>
      </div>
    </div>
  )
}

function traduzErro(m = '') {
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.'
  if (/User already registered/i.test(m)) return 'Este e-mail ja possui cadastro.'
  if (/Password should be/i.test(m)) return 'A senha deve ter ao menos 6 caracteres.'
  if (/Email not confirmed/i.test(m)) return 'E-mail ainda nao confirmado.'
  return m || 'Nao foi possivel completar a operacao.'
}
