import { useState } from 'react'
import './App.css'
import type { Company, Project } from './types'

interface Props {
  companies: Company[]
  projects: Project[]
  onUpdate: (companies: Company[], projects: Project[]) => void
  onBack: () => void
}

export default function Settings({ companies, projects, onUpdate, onBack }: Props) {
  const [addingCompany, setAddingCompany] = useState(false)
  const [newCompanyName, setNewCompanyName] = useState('')
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null)
  const [editCompanyName, setEditCompanyName] = useState('')

  const [addingProject, setAddingProject] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', clientName: '', companyId: '' })
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editProject, setEditProject] = useState({ name: '', clientName: '', companyId: '' })

  const [error, setError] = useState('')

  // ── Company operations ──

  const handleAddCompany = async () => {
    if (!newCompanyName.trim()) { setError('Please enter a company name.'); return }
    setError('')
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCompanyName.trim() }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const company = await res.json()
      onUpdate([...companies, company], projects)
      setNewCompanyName('')
      setAddingCompany(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add company')
    }
  }

  const handleSaveCompany = async (id: string) => {
    if (!editCompanyName.trim()) { setError('Company name cannot be empty.'); return }
    setError('')
    try {
      const res = await fetch(`/api/companies/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editCompanyName.trim() }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const updated = await res.json()
      onUpdate(companies.map(c => c.id === id ? updated : c), projects)
      setEditingCompanyId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save company')
    }
  }

  const handleDeleteCompany = async (id: string, name: string) => {
    const projectCount = projects.filter(p => p.companyId === id).length
    const msg = projectCount > 0
      ? `Delete "${name}" and its ${projectCount} project${projectCount !== 1 ? 's' : ''}? This cannot be undone.`
      : `Delete "${name}"? This cannot be undone.`
    if (!window.confirm(msg)) return
    setError('')
    try {
      const res = await fetch(`/api/companies/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      onUpdate(
        companies.filter(c => c.id !== id),
        projects.filter(p => p.companyId !== id)
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete company')
    }
  }

  // ── Project operations ──

  const handleAddProject = async () => {
    if (!newProject.name.trim() || !newProject.clientName.trim() || !newProject.companyId) {
      setError('Please fill in all three project fields.')
      return
    }
    setError('')
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const project = await res.json()
      onUpdate(companies, [...projects, project])
      setNewProject({ name: '', clientName: '', companyId: '' })
      setAddingProject(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add project')
    }
  }

  const handleSaveProject = async (id: string) => {
    if (!editProject.name.trim() || !editProject.clientName.trim() || !editProject.companyId) {
      setError('Please fill in all three project fields.')
      return
    }
    setError('')
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editProject),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const updated = await res.json()
      onUpdate(companies, projects.map(p => p.id === id ? updated : p))
      setEditingProjectId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project')
    }
  }

  const handleDeleteProject = async (id: string, name: string) => {
    if (!window.confirm(`Delete project "${name}"? This cannot be undone.`)) return
    setError('')
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      onUpdate(companies, projects.filter(p => p.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project')
    }
  }

  const startEditCompany = (company: Company) => {
    setEditingCompanyId(company.id)
    setEditCompanyName(company.name)
    setAddingCompany(false)
    setError('')
  }

  const startEditProject = (project: Project) => {
    setEditingProjectId(project.id)
    setEditProject({ name: project.name, clientName: project.clientName, companyId: project.companyId })
    setAddingProject(false)
    setError('')
  }

  return (
    <div className="app">
      <header className="header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="header-text">
          <h1>Settings</h1>
          <p>Manage your companies and projects</p>
        </div>
      </header>

      <main className="main">
        {error && <p className="error" role="alert" style={{ marginBottom: 0 }}>⚠️ {error}</p>}

        {/* ── Companies ── */}
        <section className="card">
          <div className="settings-section-header">
            <h2 className="step-title" style={{ margin: 0 }}>
              <span className="step-badge">1</span>
              Companies
            </h2>
            {!addingCompany && (
              <button
                className="add-btn"
                onClick={() => { setAddingCompany(true); setEditingCompanyId(null); setError('') }}
              >
                + Add Company
              </button>
            )}
          </div>

          {addingCompany && (
            <div className="settings-form">
              <input
                className="settings-input"
                value={newCompanyName}
                onChange={e => setNewCompanyName(e.target.value)}
                placeholder="Company name (e.g. Johnson Construction)"
                onKeyDown={e => e.key === 'Enter' && handleAddCompany()}
                autoFocus
              />
              <div className="settings-form-actions">
                <button className="save-btn" onClick={handleAddCompany}>Save</button>
                <button className="cancel-btn" onClick={() => { setAddingCompany(false); setNewCompanyName('') }}>Cancel</button>
              </div>
            </div>
          )}

          {companies.length === 0 && !addingCompany ? (
            <p className="settings-empty">No companies yet. Click "Add Company" to get started.</p>
          ) : (
            <ul className="settings-list">
              {companies.map(company => (
                <li key={company.id} className="settings-item">
                  {editingCompanyId === company.id ? (
                    <div className="settings-form">
                      <input
                        className="settings-input"
                        value={editCompanyName}
                        onChange={e => setEditCompanyName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSaveCompany(company.id)}
                        autoFocus
                      />
                      <div className="settings-form-actions">
                        <button className="save-btn" onClick={() => handleSaveCompany(company.id)}>Save</button>
                        <button className="cancel-btn" onClick={() => setEditingCompanyId(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="settings-item-name">{company.name}</span>
                      <div className="settings-item-actions">
                        <button className="edit-btn" onClick={() => startEditCompany(company)}>Edit</button>
                        <button className="delete-btn" onClick={() => handleDeleteCompany(company.id, company.name)}>Delete</button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Projects ── */}
        <section className="card">
          <div className="settings-section-header">
            <h2 className="step-title" style={{ margin: 0 }}>
              <span className="step-badge">2</span>
              Projects
            </h2>
            {!addingProject && companies.length > 0 && (
              <button
                className="add-btn"
                onClick={() => { setAddingProject(true); setEditingProjectId(null); setError('') }}
              >
                + Add Project
              </button>
            )}
          </div>

          {companies.length === 0 && (
            <p className="settings-empty">Add a company above before adding projects.</p>
          )}

          {addingProject && (
            <div className="settings-form settings-form--project">
              <input
                className="settings-input"
                value={newProject.name}
                onChange={e => setNewProject(p => ({ ...p, name: e.target.value }))}
                placeholder="Project name (e.g. Maple Street Renovation)"
                autoFocus
              />
              <input
                className="settings-input"
                value={newProject.clientName}
                onChange={e => setNewProject(p => ({ ...p, clientName: e.target.value }))}
                placeholder="Client name (e.g. The Johnson Family)"
              />
              <select
                className="settings-select"
                value={newProject.companyId}
                onChange={e => setNewProject(p => ({ ...p, companyId: e.target.value }))}
              >
                <option value="">Select a company…</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <div className="settings-form-actions">
                <button className="save-btn" onClick={handleAddProject}>Save</button>
                <button className="cancel-btn" onClick={() => { setAddingProject(false); setNewProject({ name: '', clientName: '', companyId: '' }) }}>Cancel</button>
              </div>
            </div>
          )}

          {projects.length === 0 && !addingProject && companies.length > 0 && (
            <p className="settings-empty">No projects yet. Click "Add Project" to get started.</p>
          )}

          {projects.length > 0 && (
            <ul className="settings-list">
              {projects.map(project => {
                const companyName = companies.find(c => c.id === project.companyId)?.name ?? 'Unknown company'
                return (
                  <li key={project.id} className="settings-item settings-item--project">
                    {editingProjectId === project.id ? (
                      <div className="settings-form settings-form--project">
                        <input
                          className="settings-input"
                          value={editProject.name}
                          onChange={e => setEditProject(p => ({ ...p, name: e.target.value }))}
                          placeholder="Project name"
                          autoFocus
                        />
                        <input
                          className="settings-input"
                          value={editProject.clientName}
                          onChange={e => setEditProject(p => ({ ...p, clientName: e.target.value }))}
                          placeholder="Client name"
                        />
                        <select
                          className="settings-select"
                          value={editProject.companyId}
                          onChange={e => setEditProject(p => ({ ...p, companyId: e.target.value }))}
                        >
                          <option value="">Select a company…</option>
                          {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <div className="settings-form-actions">
                          <button className="save-btn" onClick={() => handleSaveProject(project.id)}>Save</button>
                          <button className="cancel-btn" onClick={() => setEditingProjectId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="settings-item-info">
                          <span className="settings-item-name">{project.name}</span>
                          <span className="settings-item-meta">Client: {project.clientName} · {companyName}</span>
                        </div>
                        <div className="settings-item-actions">
                          <button className="edit-btn" onClick={() => startEditProject(project)}>Edit</button>
                          <button className="delete-btn" onClick={() => handleDeleteProject(project.id, project.name)}>Delete</button>
                        </div>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </main>

      <footer className="footer">
        Powered by Claude AI &nbsp;·&nbsp; Built for your construction team
      </footer>
    </div>
  )
}
