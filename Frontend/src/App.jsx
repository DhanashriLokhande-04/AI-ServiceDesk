import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { getTickets } from './api'

const API_URL = 'http://localhost:8080/api/tickets'

function normalizeCategory(text) {
  const value = String(text || '').toLowerCase()
  if (value.includes('network') || value.includes('wi-fi') || value.includes('wifi') || value.includes('internet')) return 'Network'
  if (value.includes('hardware') || value.includes('laptop') || value.includes('keyboard') || value.includes('printer')) return 'Hardware'
  if (value.includes('database') || value.includes('mysql') || value.includes('sql')) return 'Database'
  if (value.includes('software') || value.includes('application') || value.includes('app') || value.includes('install')) return 'Software'
  return 'Other'
}

function normalizePriority(text) {
  const value = String(text || '').toLowerCase()
  if (/\b(high|urgent|critical)\b/.test(value)) return 'HIGH'
  if (/\b(low|minor)\b/.test(value)) return 'LOW'
  return 'MEDIUM'
}

function extractAiField(text, fieldName) {
  const match = String(text || '').match(new RegExp(`${fieldName}\\s*[:\\-]\\s*([^\\n\\r]+)`, 'i'))
  return match ? match[1].trim() : ''
}

function App() {
  const [tickets, setTickets] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [priorityFilter, setPriorityFilter] = useState('ALL')

  const [editingTicketId, setEditingTicketId] = useState(null)
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    category: 'Software',
    priority: 'MEDIUM',
    status: 'OPEN',
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingTicket, setSavingTicket] = useState(false)
  const [formError, setFormError] = useState('')

  // AI Assistant state
  const [aiDescription, setAiDescription] = useState('')
  const [aiSuggestion, setAiSuggestion] = useState('')
  const [aiCategory, setAiCategory] = useState('Other')
  const [aiPriority, setAiPriority] = useState('MEDIUM')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiSuccess, setAiSuccess] = useState('')

  const loadTickets = async () => {
    try {
      setError('')
      const data = await getTickets()
      setTickets(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error fetching tickets:', err)
      setError('Failed to load tickets. Please check whether the Java Spring Boot backend is running.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTickets()
  }, [])

  const openTickets = tickets.filter((ticket) => ticket.status === 'OPEN').length
  const progressTickets = tickets.filter((ticket) => ticket.status === 'IN_PROGRESS').length
  const resolvedTickets = tickets.filter((ticket) => ticket.status === 'RESOLVED').length

  const filteredTickets = useMemo(() => {
    const search = searchTerm.toLowerCase().trim()
    return tickets.filter((ticket) => {
      const matchesSearch =
        String(ticket.id ?? '').includes(search) ||
        (ticket.title || '').toLowerCase().includes(search) ||
        (ticket.description || '').toLowerCase().includes(search)
      const matchesStatus = statusFilter === 'ALL' || ticket.status === statusFilter
      const matchesPriority = priorityFilter === 'ALL' || ticket.priority === priorityFilter
      return matchesSearch && matchesStatus && matchesPriority
    })
  }, [tickets, searchTerm, statusFilter, priorityFilter])

  const handleAiSuggestion = async () => {
    if (!aiDescription.trim()) {
      setAiError('Please enter a description of your IT problem first.')
      setAiSuccess('')
      return
    }

    setAiLoading(true)
    setAiError('')
    setAiSuccess('')
    setAiSuggestion('')

    try {
      // React sends the request to Spring Boot; Spring Boot calls local Ollama.
      const response = await fetch(`${API_URL}/ai-suggestion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: aiDescription.trim() }),
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || `AI request failed (HTTP ${response.status}).`)
      }

      const data = await response.json()
      const suggestion = data.suggestion || ''
      if (!suggestion) throw new Error('The AI returned an empty response.')

      setAiSuggestion(suggestion)

      const categoryText = extractAiField(suggestion, 'category')
      const priorityText = extractAiField(suggestion, 'priority')
      setAiCategory(categoryText ? normalizeCategory(categoryText) : normalizeCategory(`${aiDescription} ${suggestion}`))
      setAiPriority(priorityText ? normalizePriority(priorityText) : normalizePriority(suggestion))
    } catch (err) {
      console.error('AI suggestion error:', err)
      setAiError(err.message || 'AI request failed. Check the Java backend and Ollama.')
    } finally {
      setAiLoading(false)
    }
  }

  const applyAiSuggestionToForm = () => {
    const titleField = document.getElementById('title')
    const descriptionField = document.getElementById('description')
    const categoryField = document.getElementById('category')
    const priorityField = document.getElementById('priority')

    if (titleField && !titleField.value.trim()) {
      titleField.value = aiDescription.trim().length > 60
        ? `${aiDescription.trim().slice(0, 57)}...`
        : aiDescription.trim()
    }

    if (descriptionField) {
      descriptionField.value = aiDescription
      descriptionField.dispatchEvent(new Event('input', { bubbles: true }))
      descriptionField.dispatchEvent(new Event('change', { bubbles: true }))
    }

    if (categoryField) {
      categoryField.value = aiCategory
      categoryField.dispatchEvent(new Event('change', { bubbles: true }))
    }

    if (priorityField) {
      priorityField.value = aiPriority
      priorityField.dispatchEvent(new Event('change', { bubbles: true }))
    }

    setAiSuccess('AI description, category and priority copied to the ticket form. Review them before submitting.')
    document.getElementById('new-ticket')?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleUpdateTicket = async () => {
    if (editingTicketId === null) return

    try {
      const response = await fetch(`${API_URL}/${editingTicketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })

      if (!response.ok) throw new Error(`Failed to update ticket (HTTP ${response.status}).`)

      const updatedTicket = await response.json()
      setTickets((previous) =>
        previous.map((ticket) => ticket.id === editingTicketId ? updatedTicket : ticket),
      )
      setEditingTicketId(null)
      window.alert('Ticket updated successfully!')
    } catch (err) {
      console.error('Error updating ticket:', err)
      window.alert(err.message || 'Could not update ticket. Please try again.')
    }
  }

  const handleDeleteTicket = async (ticket) => {
    if (!window.confirm(`Are you sure you want to delete ticket #${ticket.id}?`)) return

    try {
      const response = await fetch(`${API_URL}/${ticket.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(`Failed to delete ticket (HTTP ${response.status}).`)

      setTickets((previous) => previous.filter((item) => item.id !== ticket.id))
      window.alert('Ticket deleted successfully!')
    } catch (err) {
      console.error('Error deleting ticket:', err)
      window.alert(err.message || 'Could not delete ticket. Please try again.')
    }
  }

  const handleCreateTicket = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)

    const newTicket = {
      title: String(formData.get('title') || '').trim(),
      description: String(formData.get('description') || '').trim(),
      category: String(formData.get('category') || 'Software'),
      priority: String(formData.get('priority') || 'MEDIUM'),
    }

    if (!newTicket.title || !newTicket.description) {
      setFormError('Please enter both a ticket title and description.')
      return
    }

    setSavingTicket(true)
    setFormError('')

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTicket),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || `Failed to create ticket (HTTP ${response.status}).`)
      }

      const savedTicket = await response.json()
      setTickets((previous) => [...previous, savedTicket])
      form.reset()
      setFormError('')
      window.alert('Ticket created successfully!')
    } catch (err) {
      console.error('Error creating ticket:', err)
      setFormError(err.message || 'Failed to create ticket. Please check the backend.')
    } finally {
      setSavingTicket(false)
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">AI</div>
          <div>
            <h2>ServiceDesk</h2>
            <span>INTELLIGENT SUPPORT</span>
          </div>
        </div>

        <p className="menu-label">WORKSPACE</p>
        <nav>
          <a className="nav-item active" href="#dashboard">▦ Dashboard</a>
          <a className="nav-item" href="#tickets">▤ All Tickets</a>
          <a className="nav-item" href="#ai-assistant">✦ AI Assistant</a>
          <a className="nav-item" href="#analytics">▥ Analytics</a>
        </nav>

        <div className="sidebar-bottom">
          <div className="online-dot" />
          <div>
            <strong>AI Engine</strong>
            <span>Java Backend · Local Ollama</span>
          </div>
        </div>
      </aside>

      <main className="main-content" id="dashboard">
        <header className="topbar">
          <div>
            <p className="breadcrumb">Workspace / Dashboard</p>
            <h1>IT Service Desk</h1>
          </div>
          <div className="profile">
            <div className="notification">♧</div>
            <div className="avatar">U</div>
            <div>
              <strong>Support Admin</strong>
              <span>Administrator</span>
            </div>
          </div>
        </header>

        <section className="welcome">
          <div className="welcome-text">
            <span className="eyebrow">INTELLIGENT IT SUPPORT PLATFORM</span>
            <h1>AI ServiceDesk</h1>
            <h2>Intelligent Support Workspace</h2>
            <p>
              Manage IT support tickets, get AI-powered recommendations,
              and track your team's progress in one place.
            </p>
          </div>
          <button
            className="primary-button"
            type="button"
            onClick={() => document.getElementById('new-ticket')?.scrollIntoView({ behavior: 'smooth' })}
          >
            + Create Ticket
          </button>
        </section>

        <section className="stats-grid" id="analytics">
          <div className="stat-card">
            <div className="stat-top"><span>Total Tickets</span><span className="stat-icon purple">▤</span></div>
            <h2>{tickets.length}</h2>
            <p>All support requests</p>
          </div>
          <div className="stat-card">
            <div className="stat-top"><span>Open Tickets</span><span className="stat-icon orange">◷</span></div>
            <h2>{openTickets}</h2>
            <p>Waiting for support</p>
          </div>
          <div className="stat-card">
            <div className="stat-top"><span>In Progress</span><span className="stat-icon blue">↻</span></div>
            <h2>{progressTickets}</h2>
            <p>Currently being handled</p>
          </div>
          <div className="stat-card">
            <div className="stat-top"><span>Resolved</span><span className="stat-icon green">✓</span></div>
            <h2>{resolvedTickets}</h2>
            <p>Successfully completed</p>
          </div>
        </section>

        <section className="content-grid">
          <div className="panel tickets-panel" id="tickets">
            <div className="panel-heading">
              <div>
                <h2>Recent Tickets</h2>
                <p>Overview of recent support requests</p>
                <div className="ticket-filters">
                  <input
                    type="text"
                    placeholder="Search tickets..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="ALL">All Statuses</option>
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="RESOLVED">Resolved</option>
                  </select>
                  <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
                    <option value="ALL">All Priorities</option>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
              </div>
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  setSearchTerm('')
                  setStatusFilter('ALL')
                  setPriorityFilter('ALL')
                }}
              >
                Clear filters
              </button>
            </div>

            {error && <p className="ai-error" role="alert">{error}</p>}

            {editingTicketId !== null && (
              <div className="edit-ticket-panel">
                <h3>Edit Ticket #{editingTicketId}</h3>
                <label>
                  Title
                  <input
                    value={editForm.title}
                    onChange={(event) => setEditForm({ ...editForm, title: event.target.value })}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    value={editForm.description}
                    onChange={(event) => setEditForm({ ...editForm, description: event.target.value })}
                  />
                </label>
                <label>
                  Category
                  <select
                    value={editForm.category}
                    onChange={(event) => setEditForm({ ...editForm, category: event.target.value })}
                  >
                    <option value="Network">Network</option>
                    <option value="Software">Software</option>
                    <option value="Hardware">Hardware</option>
                    <option value="Database">Database</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
                <label>
                  Priority
                  <select
                    value={editForm.priority}
                    onChange={(event) => setEditForm({ ...editForm, priority: event.target.value })}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </label>
                <label>
                  Status
                  <select
                    value={editForm.status}
                    onChange={(event) => setEditForm({ ...editForm, status: event.target.value })}
                  >
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="RESOLVED">Resolved</option>
                  </select>
                </label>
                <button type="button" onClick={handleUpdateTicket}>Save Changes</button>
                <button type="button" onClick={() => setEditingTicketId(null)}>Cancel</button>
              </div>
            )}

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>TICKET</th>
                    <th>CATEGORY</th>
                    <th>PRIORITY</th>
                    <th>STATUS</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="5">Loading tickets...</td></tr>
                  ) : filteredTickets.length === 0 ? (
                    <tr><td colSpan="5">No tickets found.</td></tr>
                  ) : filteredTickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td>
                        <strong>#{ticket.id}</strong>
                        <span className="ticket-title">{ticket.title}</span>
                      </td>
                      <td>{ticket.category}</td>
                      <td>
                        <span className={`priority ${(ticket.priority || 'MEDIUM').toLowerCase()}`}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td>
                        <span className={`status ${(ticket.status || 'OPEN').toLowerCase()}`}>
                          {(ticket.status || 'OPEN').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="ticket-actions">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTicketId(ticket.id)
                            setEditForm({
                              title: ticket.title || '',
                              description: ticket.description || '',
                              category: ticket.category || 'Software',
                              priority: ticket.priority || 'MEDIUM',
                              status: ticket.status || 'OPEN',
                            })
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="ticket-delete-btn"
                          onClick={() => handleDeleteTicket(ticket)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel ai-panel" id="ai-assistant">
            <div className="ai-heading">
              <div className="ai-symbol">✦</div>
              <div>
                <h2>AI Assistant</h2>
                <p>Your intelligent support companion</p>
              </div>
            </div>

            <div className="ai-message">
              <span className="ai-message-icon">✦</span>
              <div>
                <strong>AI-Powered Ticket Assistant</strong>
                <p>
                  Describe your IT problem. The Java backend will request a recommendation
                  from your local Ollama model.
                </p>
              </div>
            </div>

            <div className="ai-form">
              <label htmlFor="ai-description">Describe Your IT Problem</label>
              <textarea
                id="ai-description"
                rows="4"
                placeholder="Example: My laptop is not connecting to Wi-Fi..."
                value={aiDescription}
                onChange={(event) => {
                  setAiDescription(event.target.value)
                  setAiError('')
                  setAiSuccess('')
                }}
              />
              <button
                className="secondary-button"
                type="button"
                onClick={handleAiSuggestion}
                disabled={aiLoading}
              >
                {aiLoading ? 'AI is thinking...' : '✦ Get AI Suggestion'}
              </button>

              {aiError && <p className="ai-error" role="alert">{aiError}</p>}

              {aiSuggestion && (
                <div className="ai-result">
                  <h3>AI Recommendation</h3>
                  <p><strong>Suggested category:</strong> {aiCategory}</p>
                  <p><strong>Suggested priority:</strong> {aiPriority}</p>
                  <pre>{aiSuggestion}</pre>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={applyAiSuggestionToForm}
                  >
                    Use AI suggestion in ticket form
                  </button>
                </div>
              )}

              {aiSuccess && <p className="ai-success">{aiSuccess}</p>}
            </div>

            <div className="ai-features">
              <div><span>✓</span> Ticket classification</div>
              <div><span>✓</span> Priority recommendations</div>
              <div><span>✓</span> Suggested solutions</div>
            </div>
          </div>
        </section>

        <section className="panel create-panel" id="new-ticket">
          <div>
            <h2>Create a New Ticket</h2>
            <p>Submit an IT support request. Review AI suggestions before submitting.</p>
          </div>

          <form onSubmit={handleCreateTicket}>
            <label htmlFor="title">Ticket Title</label>
            <input id="title" name="title" type="text" placeholder="Enter ticket title" required />

            <label htmlFor="description">Description</label>
            <textarea id="description" name="description" placeholder="Describe the issue" rows="4" required />

            <label htmlFor="category">Category</label>
            <select id="category" name="category" defaultValue="Software" required>
              <option value="Network">Network</option>
              <option value="Software">Software</option>
              <option value="Hardware">Hardware</option>
              <option value="Database">Database</option>
              <option value="Other">Other</option>
            </select>

            <label htmlFor="priority">Priority</label>
            <select id="priority" name="priority" defaultValue="MEDIUM" required>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>

            {formError && <p className="ai-error" role="alert">{formError}</p>}

            <button className="primary-button" type="submit" disabled={savingTicket}>
              {savingTicket ? 'Submitting...' : 'Submit Ticket'}
            </button>
          </form>
        </section>

        <footer>AI Service Desk <span>•</span> Intelligent IT Support Platform</footer>
      </main>
    </div>
  )
}

export default App
