import { useState, useRef, useEffect } from 'react'

// ─── Dados fixos do plano ────────────────────────────────────────────
const FIXAS = 5896
const CARTOES = [2650, 1702, 740, 492, 372, 0]
const MESES = ['Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const LIMITE_MEI = 81000

const CHECKLIST_INICIAL = [
  { acao: 'Quitar moto (pagar R$ 11k à financeira)', impacto: 'Elimina R$ 44k de dívida' },
  { acao: 'Receber R$ 22k do comprador', impacto: 'Lucro líquido de R$ 11k' },
  { acao: 'Transferir R$ 17.000 → reserva emergência', impacto: 'Reserva de 3 meses completa' },
  { acao: 'Transferir R$ 5.000 → reserva bebê', impacto: 'Chegada da filha garantida' },
  { acao: 'Quitar MEI no gov.br/regularize', impacto: 'Zero dívida com a Receita' },
  { acao: 'Abrir conta separada para reservas', impacto: 'Nubank ou Inter — rende automaticamente' },
]

// ─── Helpers ─────────────────────────────────────────────────────────
const fmt = (v) => 'R$ ' + Math.abs(Number(v)).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const fmtK = (v) => v >= 1000 ? 'R$ ' + (v / 1000).toFixed(0) + 'k' : fmt(v)
const today = () => new Date().toISOString().split('T')[0]
const load = (key, def) => { try { return JSON.parse(localStorage.getItem(key)) ?? def } catch { return def } }
const save = (key, val) => localStorage.setItem(key, JSON.stringify(val))

// ─── Sistema de IA ───────────────────────────────────────────────────
const SYSTEM_PROMPT = `Você é a Lia, assessora financeira pessoal do Wagner, MEI brasileiro.

Quando ele descrever uma transação, responda SOMENTE com JSON puro (sem markdown):
{
  "type": "transaction" | "query" | "chat",
  "entry": {
    "kind": "income" | "expense",
    "amount": 150.00,
    "desc": "descrição curta",
    "category": "servico" | "produto" | "moradia" | "alimentacao" | "transporte" | "saude" | "telecom" | "marketing" | "outros",
    "date": "YYYY-MM-DD"
  },
  "reply": "resposta curta e direta"
}

Contexto do Wagner:
- MEI com faturamento normal de R$ 12k/mês (julho foi R$ 25k)
- Despesas fixas: R$ 5.896/mês
- Reserva emergência: R$ 17.000 (meta atingida em julho)
- Reserva bebê: R$ 5.000 (meta atingida em julho)
- Filha nascendo em dezembro/2026
- Dívidas de cartão encerram até novembro/2026
- Data de hoje: ${today()}

Regras:
- Se receita (recebeu, faturou, vendeu, ganhou): kind = "income"
- Se despesa (gastei, paguei, comprei): kind = "expense"
- Se pergunta sobre saldo/relatório: type = "query", sem "entry"
- Se conversa geral: type = "chat", sem "entry"
- Respostas curtas — está no celular
- Português brasileiro, tom direto e amigável`

// ─── Ícones SVG inline ───────────────────────────────────────────────
const Icon = ({ name, size = 20, color = 'currentColor' }) => {
  const icons = {
    chat: <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />,
    dash: <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
    list: <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />,
    plus: <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />,
    send: <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />,
    trash: <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />,
    check: <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />,
    plan: <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      {icons[name]}
    </svg>
  )
}

// ─── Bottom Nav ──────────────────────────────────────────────────────
const NAV = [
  { id: 'chat', label: 'Lia IA', icon: 'chat' },
  { id: 'dash', label: 'Painel', icon: 'dash' },
  { id: 'entries', label: 'Lançamentos', icon: 'list' },
  { id: 'plan', label: 'Plano', icon: 'plan' },
]

// ─── App Principal ───────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('chat')
  const [entries, setEntries] = useState(() => load('entries', []))
  const [messages, setMessages] = useState(() => load('messages', [{
    role: 'assistant',
    text: 'Oi Wagner! 👋 Sou a Lia, sua assessora financeira.\n\nMe conta uma receita ou despesa em linguagem natural:\n\n• "Recebi R$ 1.200 de um cliente"\n• "Paguei R$ 80 de internet"\n• "Qual meu saldo do mês?"\n\nRegistro tudo automaticamente.',
    type: 'chat'
  }]))
  const [checklist, setChecklist] = useState(() => load('checklist', CHECKLIST_INICIAL.map(c => ({ ...c, feito: false }))))
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { save('entries', entries) }, [entries])
  useEffect(() => { save('messages', messages.slice(-50)) }, [messages])
  useEffect(() => { save('checklist', checklist) }, [checklist])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  // ─── Cálculos ──────────────────────────────────────────────────────
  const now = new Date()
  const mesAtual = now.getMonth()
  const anoAtual = now.getFullYear()

  const doMes = (kind) => entries
    .filter(e => {
      const d = new Date(e.date + 'T12:00:00')
      return e.kind === kind && d.getMonth() === mesAtual && d.getFullYear() === anoAtual
    })
    .reduce((s, e) => s + e.amount, 0)

  const receitaMes = doMes('income')
  const despesaMes = doMes('expense')
  const saldoMes = receitaMes - despesaMes

  const receitaAno = entries
    .filter(e => e.kind === 'income' && new Date(e.date + 'T12:00:00').getFullYear() === anoAtual)
    .reduce((s, e) => s + e.amount, 0)

  const limitePct = Math.min(100, (receitaAno / LIMITE_MEI) * 100)

  // ─── IA ────────────────────────────────────────────────────────────
  async function sendMessage(text) {
    if (!text.trim() || loading) return
    const userMsg = { role: 'user', text: text.trim() }
    setMessages(m => [...m, userMsg])
    setInput('')
    setLoading(true)

    try {
      const ctx = `Saldo do mês: ${fmt(saldoMes)} | Receita: ${fmt(receitaMes)} | Despesas: ${fmt(despesaMes)} | Faturamento anual: ${fmt(receitaAno)}\n\nMensagem: ${text}`
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 500,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: ctx }]
        })
      })
      const data = await res.json()
      const raw = data.content?.[0]?.text || '{}'
      let parsed
      try { parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()) }
      catch { parsed = { type: 'chat', reply: raw } }

      let newEntry = null
      if (parsed.type === 'transaction' && parsed.entry) {
        newEntry = { id: Date.now() + '', ...parsed.entry, amount: Number(parsed.entry.amount) || 0, date: parsed.entry.date || today() }
        setEntries(prev => [newEntry, ...prev])
      }

      setMessages(m => [...m, { role: 'assistant', text: parsed.reply || 'Entendido!', type: parsed.type, entry: newEntry }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', text: 'Erro de conexão. Tente novamente.', type: 'chat' }])
    }
    setLoading(false)
    inputRef.current?.focus()
  }

  const toggleCheck = (i) => {
    const next = [...checklist]
    next[i].feito = !next[i].feito
    setChecklist(next)
  }

  const delEntry = (id) => setEntries(prev => prev.filter(e => e.id !== id))

  const feitos = checklist.filter(c => c.feito).length
  const checkPct = Math.round((feitos / checklist.length) * 100)

  const S = styles

  return (
    <div style={S.root}>
      {/* ── Conteúdo ── */}
      <div style={S.content}>
        {tab === 'chat' && <ChatTab messages={messages} loading={loading} input={input} setInput={setInput} sendMessage={sendMessage} inputRef={inputRef} bottomRef={bottomRef} receitaMes={receitaMes} despesaMes={despesaMes} saldoMes={saldoMes} />}
        {tab === 'dash' && <DashTab receitaMes={receitaMes} despesaMes={despesaMes} saldoMes={saldoMes} receitaAno={receitaAno} limitePct={limitePct} entries={entries} />}
        {tab === 'entries' && <EntriesTab entries={entries} delEntry={delEntry} showAdd={showAdd} setShowAdd={setShowAdd} setEntries={setEntries} />}
        {tab === 'plan' && <PlanTab checklist={checklist} toggleCheck={toggleCheck} feitos={feitos} checkPct={checkPct} />}
      </div>

      {/* ── Bottom Nav ── */}
      <nav style={S.nav}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setTab(n.id)} style={{ ...S.navBtn, ...(tab === n.id ? S.navBtnActive : {}) }}>
            <Icon name={n.icon} size={22} color={tab === n.id ? '#10B981' : '#64748B'} />
            <span style={{ fontSize: 10, marginTop: 3, color: tab === n.id ? '#10B981' : '#64748B', fontWeight: tab === n.id ? 600 : 400 }}>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

// ─── Chat Tab ─────────────────────────────────────────────────────────
function ChatTab({ messages, loading, input, setInput, sendMessage, inputRef, bottomRef, receitaMes, despesaMes, saldoMes }) {
  const S = styles
  const SUGS = ['Recebi R$ 800 hoje', 'Paguei R$ 120 de aluguel', 'Qual meu saldo?', 'Quanto faturei?']

  return (
    <div style={S.chatWrap}>
      {/* Mini cards */}
      <div style={S.miniCards}>
        {[
          { l: 'Receita', v: receitaMes, c: '#10B981' },
          { l: 'Despesas', v: despesaMes, c: '#F43F5E' },
          { l: 'Saldo', v: saldoMes, c: saldoMes >= 0 ? '#10B981' : '#F43F5E' },
        ].map(c => (
          <div key={c.l} style={S.miniCard}>
            <div style={{ fontSize: 10, color: '#64748B', marginBottom: 3 }}>{c.l}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: c.c }}>{fmtK(c.v)}</div>
          </div>
        ))}
      </div>

      {/* Messages */}
      <div style={S.msgList}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: m.role === 'user' ? 'row-reverse' : 'row', gap: 8, marginBottom: 12, alignItems: 'flex-end' }}>
            {m.role === 'assistant' && (
              <div style={S.avatar}>L</div>
            )}
            <div style={{ maxWidth: '78%' }}>
              <div style={{ ...S.bubble, ...(m.role === 'user' ? S.bubbleUser : S.bubbleBot) }}>
                {m.text}
              </div>
              {m.entry && (
                <div style={{ ...S.entryPill, background: m.entry.kind === 'income' ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)', borderColor: m.entry.kind === 'income' ? '#10B981' : '#F43F5E', marginTop: 6 }}>
                  <span style={{ fontSize: 14 }}>{m.entry.kind === 'income' ? '✅' : '🔴'}</span>
                  <span style={{ fontSize: 13, flex: 1 }}>{m.entry.desc}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: m.entry.kind === 'income' ? '#10B981' : '#F43F5E' }}>
                    {m.entry.kind === 'income' ? '+' : '-'}{fmtK(m.entry.amount)}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={S.avatar}>L</div>
            <div style={{ ...S.bubble, ...S.bubbleBot, padding: '12px 16px' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#64748B', animation: `bounce 1.2s ${i * 0.2}s infinite` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} style={{ height: 8 }} />
      </div>

      {/* Suggestions */}
      <div style={S.sugs}>
        {SUGS.map(s => (
          <button key={s} onClick={() => sendMessage(s)} style={S.sugBtn}>{s}</button>
        ))}
      </div>

      {/* Input */}
      <div style={S.inputRow}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendMessage(input) } }}
          placeholder="Recebi, paguei, qual meu saldo..."
          style={S.input}
        />
        <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()} style={{ ...S.sendBtn, opacity: loading || !input.trim() ? 0.4 : 1 }}>
          <Icon name="send" size={18} color="#fff" />
        </button>
      </div>
      <style>{`@keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }`}</style>
    </div>
  )
}

// ─── Dash Tab ─────────────────────────────────────────────────────────
function DashTab({ receitaMes, despesaMes, saldoMes, receitaAno, limitePct, entries }) {
  const S = styles
  const now = new Date()
  const mesAtual = now.getMonth()
  const anoAtual = now.getFullYear()

  const catExp = entries
    .filter(e => e.kind === 'expense' && new Date(e.date + 'T12:00:00').getMonth() === mesAtual && new Date(e.date + 'T12:00:00').getFullYear() === anoAtual)
    .reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + e.amount; return acc }, {})

  const mesIdx = now.getMonth() - 6 // julho = 0
  const cartoesMes = mesIdx >= 0 && mesIdx < 6 ? (CARTOES[mesIdx] || 0) : 0

  const das = 1518 * 0.05 + 5

  return (
    <div style={S.scroll}>
      <div style={S.pageTitle}>Painel Financeiro</div>

      {/* Cards principais */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[
          { l: 'Receita do mês', v: receitaMes, c: '#10B981', bg: 'rgba(16,185,129,0.1)' },
          { l: 'Despesas', v: despesaMes, c: '#F43F5E', bg: 'rgba(244,63,94,0.1)' },
        ].map(c => (
          <div key={c.l} style={{ ...S.card, background: c.bg }}>
            <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6 }}>{c.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: c.c }}>{fmtK(c.v)}</div>
          </div>
        ))}
      </div>
      <div style={{ ...S.card, background: saldoMes >= 0 ? 'rgba(59,130,246,0.1)' : 'rgba(244,63,94,0.1)', marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>Saldo líquido do mês</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: saldoMes >= 0 ? '#3B82F6' : '#F43F5E' }}>{fmt(saldoMes)}</div>
      </div>

      {/* Limite MEI */}
      <div style={{ ...S.card, marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: '#94A3B8' }}>Limite anual MEI</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{limitePct.toFixed(1)}%</span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
          <div style={{ height: 8, borderRadius: 4, width: limitePct + '%', background: limitePct > 90 ? '#F43F5E' : limitePct > 70 ? '#F59E0B' : '#10B981', transition: 'width 0.4s' }} />
        </div>
        <div style={{ fontSize: 11, color: '#64748B', marginTop: 6 }}>{fmt(receitaAno)} de R$ 81.000</div>
      </div>

      {/* Reservas */}
      <div style={{ ...S.card, marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Reservas — Meta julho</div>
        {[
          { icon: '🛡️', l: 'Emergência', v: 17000, meta: 17000, c: '#3B82F6' },
          { icon: '👶', l: 'Bebê (dez)', v: 5000, meta: 5000, c: '#8B5CF6' },
        ].map(r => (
          <div key={r.l} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
              <span style={{ color: '#94A3B8' }}>{r.icon} {r.l}</span>
              <span style={{ color: r.c, fontWeight: 600 }}>{fmt(r.v)} ✅</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 4, height: 6 }}>
              <div style={{ height: 6, borderRadius: 4, width: '100%', background: r.c }} />
            </div>
          </div>
        ))}
      </div>

      {/* DAS */}
      <div style={{ ...S.card, marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>DAS estimado — mês atual</div>
        {[
          { l: 'INSS (5% salário mínimo)', v: 1518 * 0.05 },
          { l: 'ISS fixo (serviços)', v: 5 },
        ].map(r => (
          <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
            <span style={{ color: '#64748B' }}>{r.l}</span>
            <span>{fmt(r.v)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, padding: '10px 0 0', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 4 }}>
          <span>Total DAS</span>
          <span style={{ color: '#3B82F6' }}>{fmt(das)}</span>
        </div>
      </div>

      {/* Categorias */}
      {Object.keys(catExp).length > 0 && (
        <div style={{ ...S.card, marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Despesas por categoria</div>
          {Object.entries(catExp).sort((a, b) => b[1] - a[1]).map(([cat, val]) => {
            const pct = despesaMes > 0 ? (val / despesaMes) * 100 : 0
            return (
              <div key={cat} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: '#94A3B8', textTransform: 'capitalize' }}>{cat}</span>
                  <span style={{ fontWeight: 600 }}>{fmt(val)}</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 3, height: 5 }}>
                  <div style={{ height: 5, borderRadius: 3, width: pct.toFixed(1) + '%', background: '#8B5CF6' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ height: 20 }} />
    </div>
  )
}

// ─── Entries Tab ──────────────────────────────────────────────────────
function EntriesTab({ entries, delEntry, showAdd, setShowAdd, setEntries }) {
  const S = styles
  const [form, setForm] = useState({ kind: 'income', desc: '', amount: '', category: 'servico', date: today() })

  const sorted = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date))

  const addEntry = () => {
    if (!form.desc || !form.amount) return
    const e = { id: Date.now() + '', ...form, amount: parseFloat(form.amount) }
    setEntries(prev => [e, ...prev])
    setShowAdd(false)
    setForm({ kind: 'income', desc: '', amount: '', category: 'servico', date: today() })
  }

  const CAT_INC = [{ v: 'servico', l: 'Serviço' }, { v: 'produto', l: 'Produto' }, { v: 'outros', l: 'Outros' }]
  const CAT_EXP = [{ v: 'moradia', l: 'Moradia' }, { v: 'alimentacao', l: 'Alimentação' }, { v: 'transporte', l: 'Transporte' }, { v: 'saude', l: 'Saúde' }, { v: 'telecom', l: 'Telecom' }, { v: 'outros', l: 'Outros' }]

  return (
    <div style={S.scroll}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 16px 12px' }}>
        <div style={S.pageTitle2}>Lançamentos</div>
        <button onClick={() => setShowAdd(!showAdd)} style={S.addBtn}>
          <Icon name="plus" size={16} color="#fff" />
        </button>
      </div>

      {/* Form rápido */}
      {showAdd && (
        <div style={{ ...S.card, marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Novo lançamento</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {[['income', '📈 Receita'], ['expense', '📉 Despesa']].map(([k, l]) => (
              <button key={k} onClick={() => setForm(f => ({ ...f, kind: k, category: k === 'income' ? 'servico' : 'moradia' }))}
                style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: form.kind === k ? (k === 'income' ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)') : 'rgba(255,255,255,0.06)', color: form.kind === k ? (k === 'income' ? '#10B981' : '#F43F5E') : '#94A3B8', fontSize: 13, fontWeight: 600 }}>
                {l}
              </button>
            ))}
          </div>
          {[
            { label: 'Descrição', field: 'desc', type: 'text', placeholder: 'Ex: Serviço de design' },
            { label: 'Valor (R$)', field: 'amount', type: 'number', placeholder: '0,00' },
          ].map(f => (
            <div key={f.field} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>{f.label}</div>
              <input type={f.type} value={form[f.field]} onChange={e => setForm(p => ({ ...p, [f.field]: e.target.value }))}
                placeholder={f.placeholder} style={S.formInput} />
            </div>
          ))}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>Categoria</div>
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={S.formInput}>
              {(form.kind === 'income' ? CAT_INC : CAT_EXP).map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>Data</div>
            <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={S.formInput} />
          </div>
          <button onClick={addEntry} style={S.saveBtn}>Salvar lançamento</button>
        </div>
      )}

      {sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748B' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
          <div style={{ fontSize: 15 }}>Nenhum lançamento ainda</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Use o chat com a Lia ou o botão + para adicionar</div>
        </div>
      ) : sorted.map(e => (
        <div key={e.id} style={S.entryRow}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: e.kind === 'income' ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
            {e.kind === 'income' ? '📈' : '📉'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.desc}</div>
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
              {e.category} · {new Date(e.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </div>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: e.kind === 'income' ? '#10B981' : '#F43F5E', whiteSpace: 'nowrap' }}>
            {e.kind === 'income' ? '+' : '-'}{fmtK(e.amount)}
          </div>
          <button onClick={() => delEntry(e.id)} style={{ background: 'none', border: 'none', color: '#334155', padding: 6, borderRadius: 6, display: 'flex' }}>
            <Icon name="trash" size={16} color="#64748B" />
          </button>
        </div>
      ))}
      <div style={{ height: 20 }} />
    </div>
  )
}

// ─── Plan Tab ─────────────────────────────────────────────────────────
function PlanTab({ checklist, toggleCheck, feitos, checkPct }) {
  const S = styles
  const mesesSaldo = [27288, 4402, 5364, 5612, 5732, 6104]

  return (
    <div style={S.scroll}>
      <div style={S.pageTitle}>Plano Jul–Dez/26</div>

      {/* Checklist julho */}
      <div style={{ ...S.card, marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>✅ Checklist de julho</div>
          <div style={{ fontSize: 13, color: '#10B981', fontWeight: 600 }}>{feitos}/{checklist.length}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 4, height: 6, marginBottom: 14, overflow: 'hidden' }}>
          <div style={{ height: 6, borderRadius: 4, width: checkPct + '%', background: checkPct === 100 ? '#10B981' : '#3B82F6', transition: 'width 0.4s' }} />
        </div>
        {checklist.map((c, i) => (
          <div key={i} onClick={() => toggleCheck(i)} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: i > 0 ? '0.5px solid rgba(255,255,255,0.06)' : 'none', cursor: 'pointer', alignItems: 'flex-start' }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', border: c.feito ? 'none' : '1.5px solid #334155', background: c.feito ? '#10B981' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
              {c.feito && <Icon name="check" size={12} color="#fff" />}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: c.feito ? '#64748B' : '#F1F5F9', textDecoration: c.feito ? 'line-through' : 'none' }}>{c.acao}</div>
              <div style={{ fontSize: 11, color: c.feito ? '#10B981' : '#64748B', marginTop: 2 }}>{c.impacto}</div>
            </div>
          </div>
        ))}
        {checkPct === 100 && (
          <div style={{ marginTop: 12, background: 'rgba(16,185,129,0.15)', borderRadius: 8, padding: '10px', textAlign: 'center', fontSize: 14, fontWeight: 600, color: '#10B981' }}>
            🎉 Julho executado!
          </div>
        )}
      </div>

      {/* Saldo por mês */}
      <div style={{ ...S.card, marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Saldo livre por mês</div>
        {MESES.map((mes, i) => {
          const max = Math.max(...mesesSaldo)
          const pct = (mesesSaldo[i] / max) * 100
          return (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: '#94A3B8', display: 'flex', gap: 6, alignItems: 'center' }}>
                  {mes}
                  {i === 5 && <span style={{ fontSize: 10, background: 'rgba(139,92,246,0.2)', color: '#8B5CF6', padding: '1px 6px', borderRadius: 20 }}>👶</span>}
                  {i === 5 && <span style={{ fontSize: 10, background: 'rgba(16,185,129,0.2)', color: '#10B981', padding: '1px 6px', borderRadius: 20 }}>zero cartão</span>}
                </span>
                <span style={{ fontWeight: 600, color: mesesSaldo[i] > 4000 ? '#10B981' : '#F59E0B' }}>{fmt(mesesSaldo[i])}</span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 4, height: 6 }}>
                <div style={{ height: 6, borderRadius: 4, width: pct.toFixed(1) + '%', background: i === 0 ? '#3B82F6' : '#10B981' }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Dívidas */}
      <div style={{ ...S.card, marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Situação das dívidas em dez/26</div>
        {[
          { l: 'Moto (R$ 44k)', status: '✅ Eliminada em julho', c: '#10B981' },
          { l: 'MEI (R$ 4k)', status: '✅ Quitado em julho', c: '#10B981' },
          { l: 'Cartão Militão', status: '⏳ Encerra out/26', c: '#F59E0B' },
          { l: 'Cartão Roger', status: '⏳ Encerra nov/26', c: '#F59E0B' },
          { l: 'Cartão Ebó', status: '⏳ Encerra out/26', c: '#F59E0B' },
        ].map((d, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '7px 0', borderTop: i > 0 ? '0.5px solid rgba(255,255,255,0.06)' : 'none' }}>
            <span style={{ color: '#94A3B8' }}>{d.l}</span>
            <span style={{ color: d.c, fontWeight: 500, fontSize: 12 }}>{d.status}</span>
          </div>
        ))}
        <div style={{ marginTop: 12, background: 'rgba(16,185,129,0.12)', borderRadius: 8, padding: '10px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#10B981' }}>
          Dezembro: zero dívidas + R$ 22k em reservas 🎉
        </div>
      </div>

      {/* Lazer */}
      <div style={{ ...S.card, background: 'rgba(245,158,11,0.08)', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: '#F59E0B' }}>🎯 Lazer com a Marcela</div>
        {[
          { m: 'Julho', v: 'R$ 0', obs: 'Mês de execução' },
          { m: 'Agosto', v: 'R$ 900', obs: 'Cartão ainda pesado' },
          { m: 'Set–Nov', v: 'R$ 1.200', obs: 'Saldo maior' },
          { m: 'Dezembro', v: 'R$ 1.500+', obs: 'Zero cartão — comemore 🎉' },
        ].map((r, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderTop: i > 0 ? '0.5px solid rgba(245,158,11,0.15)' : 'none' }}>
            <span style={{ color: '#94A3B8' }}>{r.m} <span style={{ fontSize: 11, color: '#64748B' }}>· {r.obs}</span></span>
            <span style={{ fontWeight: 600, color: '#F59E0B' }}>{r.v}</span>
          </div>
        ))}
      </div>

      <div style={{ height: 20 }} />
    </div>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────
const styles = {
  root: { display: 'flex', flexDirection: 'column', height: '100dvh', background: '#0F172A', overflow: 'hidden' },
  content: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  scroll: { flex: 1, overflowY: 'auto', padding: '0 16px' },
  nav: { display: 'flex', background: '#1E293B', borderTop: '0.5px solid rgba(255,255,255,0.08)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' },
  navBtn: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0 8px', background: 'none', border: 'none' },
  navBtnActive: {},
  card: { background: '#1E293B', borderRadius: 14, padding: '14px', marginBottom: 0, border: '0.5px solid rgba(255,255,255,0.06)' },
  pageTitle: { fontSize: 20, fontWeight: 700, padding: '20px 16px 12px', color: '#F1F5F9' },
  pageTitle2: { fontSize: 20, fontWeight: 700, color: '#F1F5F9' },
  chatWrap: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0 0 0 0' },
  miniCards: { display: 'flex', gap: 8, padding: '12px 16px 0' },
  miniCard: { flex: 1, background: '#1E293B', borderRadius: 10, padding: '10px', border: '0.5px solid rgba(255,255,255,0.06)' },
  msgList: { flex: 1, overflowY: 'auto', padding: '12px 16px' },
  avatar: { width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#3B82F6,#10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0 },
  bubble: { padding: '10px 14px', borderRadius: 16, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' },
  bubbleUser: { background: '#3B82F6', color: '#fff', borderRadius: '16px 16px 4px 16px' },
  bubbleBot: { background: '#1E293B', color: '#F1F5F9', borderRadius: '16px 16px 16px 4px', border: '0.5px solid rgba(255,255,255,0.06)' },
  entryPill: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: '0.5px solid', fontSize: 13 },
  sugs: { display: 'flex', gap: 6, padding: '8px 16px', overflowX: 'auto' },
  sugBtn: { flexShrink: 0, fontSize: 12, padding: '6px 12px', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 20, background: 'rgba(255,255,255,0.05)', color: '#94A3B8' },
  inputRow: { display: 'flex', gap: 8, padding: '8px 16px 12px' },
  input: { flex: 1, padding: '12px 14px', fontSize: 15, border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 12, background: '#1E293B', color: '#F1F5F9', outline: 'none' },
  sendBtn: { width: 44, height: 44, borderRadius: 12, background: '#3B82F6', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  addBtn: { width: 36, height: 36, borderRadius: 10, background: '#10B981', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  entryRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '0.5px solid rgba(255,255,255,0.06)' },
  formInput: { width: '100%', padding: '10px 12px', fontSize: 14, border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: '#F1F5F9', outline: 'none' },
  saveBtn: { width: '100%', padding: '12px', background: '#10B981', border: 'none', borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 600 },
}
