import React, { useState, useRef, useEffect } from 'react'
import './App.css'
import Settings from './Settings'
import type { Company, Project } from './types'

export default function App() {
  const [view, setView] = useState<'main' | 'settings'>('main')
  const [companies, setCompanies] = useState<Company[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [dataLoaded, setDataLoaded] = useState(false)

  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [bulletPoints, setBulletPoints] = useState('')
  const [generatedEmail, setGeneratedEmail] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const emailRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch('/api/data')
      .then(r => r.json())
      .then(data => {
        setCompanies(data.companies ?? [])
        setProjects(data.projects ?? [])
        setDataLoaded(true)
      })
      .catch(() => setDataLoaded(true))
  }, [])

  const handleDataUpdate = (newCompanies: Company[], newProjects: Project[]) => {
    setCompanies(newCompanies)
    setProjects(newProjects)
    if (selectedProject && !newProjects.find(p => p.id === selectedProject.id)) {
      setSelectedProject(null)
      setGeneratedEmail('')
      setError('')
    }
  }

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project)
    setGeneratedEmail('')
    setError('')
  }

  const getCompanyName = (companyId: string) =>
    companies.find(c => c.id === companyId)?.name ?? ''

  const handleGenerate = async () => {
    if (!selectedProject) return
    if (!bulletPoints.trim()) {
      setError("Please enter some notes about this week's work before generating.")
      return
    }

    setError('')
    setIsGenerating(true)
    setGeneratedEmail('')

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobName: selectedProject.name,
          clientName: selectedProject.clientName,
          companyName: getCompanyName(selectedProject.companyId),
          bulletPoints: bulletPoints.trim(),
        }),
      })

      if (!response.ok || !response.body) {
        throw new Error('Server error — please try again.')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          let parsed: { text?: string; error?: string }
          try {
            parsed = JSON.parse(data)
          } catch {
            continue
          }
          if (parsed.error) throw new Error(parsed.error)
          if (parsed.text) {
            setGeneratedEmail(prev => prev + parsed.text)
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setError(msg)
    } finally {
      setIsGenerating(false)
      setTimeout(() => emailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
  }

  const handleCopy = async () => {
    if (!generatedEmail) return
    try {
      await navigator.clipboard.writeText(generatedEmail)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      emailRef.current?.select()
    }
  }

  const handleReset = () => {
    setGeneratedEmail('')
    setBulletPoints('')
    setError('')
    setSelectedProject(null)
  }

  if (view === 'settings') {
    return (
      <Settings
        companies={companies}
        projects={projects}
        onUpdate={handleDataUpdate}
        onBack={() => setView('main')}
      />
    )
  }

  return (
    <div className="app">
      <header className="header">
        <span className="header-icon" aria-hidden="true">🏗️</span>
        <div className="header-text">
          <h1>Weekly Client Update Generator</h1>
          <p>Turn your rough job notes into a polished client email — in seconds</p>
        </div>
        <div className="header-actions">
          {(selectedProject || generatedEmail) && (
            <button className="reset-btn" onClick={handleReset} title="Start over">
              ↩ Start Over
            </button>
          )}
          <button className="settings-nav-btn" onClick={() => setView('settings')}>
            ⚙️ Settings
          </button>
        </div>
      </header>

      <main className="main">
        {!dataLoaded ? (
          <div className="card loading-state">Loading your projects…</div>
        ) : projects.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-state-icon">🏗️</div>
            <h2>Welcome! Let's get set up.</h2>
            <p>You don't have any projects yet. Head to Settings to add your company and first project — it only takes a minute.</p>
            <button className="settings-launch-btn" onClick={() => setView('settings')}>
              ⚙️ Open Settings
            </button>
          </div>
        ) : (
          <>
            {/* ── Step 1: Select a Project ── */}
            <section className="card">
              <h2 className="step-title">
                <span className="step-badge">1</span>
                Select a Project
              </h2>
              <div className="job-grid">
                {projects.map(project => (
                  <button
                    key={project.id}
                    className={`job-card ${selectedProject?.id === project.id ? 'selected' : ''}`}
                    onClick={() => handleSelectProject(project)}
                  >
                    <div className="job-name">{project.name}</div>
                    <div className="job-client">{project.clientName}</div>
                    <div className="job-company">{getCompanyName(project.companyId)}</div>
                  </button>
                ))}
              </div>
            </section>

            {/* ── Step 2: Enter Notes ── */}
            <section className={`card ${!selectedProject ? 'card--disabled' : ''}`}>
              <h2 className="step-title">
                <span className="step-badge">2</span>
                Enter This Week's Notes
              </h2>
              <p className="hint">
                Keep it simple — bullet points, short sentences, even rough shorthand. Claude will do the rest.
              </p>

              <div className="placeholder-tip">
                <strong>💡 Example notes:</strong>
                <ul>
                  <li>Framing on second floor done</li>
                  <li>Electrician started rough-in</li>
                  <li>Client needs to pick tile for master bath by Friday</li>
                  <li>Plumbing passed inspection</li>
                  <li>Next week: drywall starts Monday</li>
                </ul>
              </div>

              <textarea
                className="notes-input"
                value={bulletPoints}
                onChange={e => setBulletPoints(e.target.value)}
                placeholder="Type your notes here..."
                rows={7}
                disabled={!selectedProject}
              />

              {error && (
                <p className="error" role="alert">⚠️ {error}</p>
              )}

              <button
                className="generate-btn"
                onClick={handleGenerate}
                disabled={!selectedProject || isGenerating}
              >
                {isGenerating ? (
                  <><span className="spinner" aria-hidden="true" /> Generating Email…</>
                ) : (
                  '✉️  Generate Client Email'
                )}
              </button>
            </section>

            {/* ── Step 3: Generated Email ── */}
            {(generatedEmail || isGenerating) && (
              <section className="card" ref={emailRef as React.RefObject<HTMLElement>}>
                <div className="email-section-header">
                  <h2 className="step-title" style={{ margin: 0 }}>
                    <span className="step-badge">3</span>
                    Your Client Email
                  </h2>
                  <div className="email-actions">
                    {generatedEmail && !isGenerating && (
                      <button className="copy-btn" onClick={handleCopy}>
                        {copied ? '✅  Copied!' : '📋  Copy Email'}
                      </button>
                    )}
                  </div>
                </div>

                <p className="hint" style={{ marginTop: 8, marginBottom: 16 }}>
                  Review and edit below if needed, then copy and paste into your email client.
                </p>

                {isGenerating && !generatedEmail && (
                  <div className="loading-bar">
                    <div className="loading-bar-inner" />
                    <p>Writing your email…</p>
                  </div>
                )}

                <textarea
                  ref={emailRef}
                  className="email-output"
                  value={generatedEmail}
                  onChange={e => setGeneratedEmail(e.target.value)}
                  placeholder="Your email will appear here…"
                  rows={22}
                />

                {generatedEmail && !isGenerating && (
                  <button className="copy-btn copy-btn--bottom" onClick={handleCopy}>
                    {copied ? '✅  Copied!' : '📋  Copy Email'}
                  </button>
                )}
              </section>
            )}
          </>
        )}
      </main>

      <footer className="footer">
        Powered by Claude AI &nbsp;·&nbsp; Built for your construction team
      </footer>
    </div>
  )
}
