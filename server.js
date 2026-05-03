import 'dotenv/config'
import express from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { randomUUID } from 'crypto'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_FILE = join(__dirname, 'data.json')

const app = express()
app.use(express.json())

const client = new Anthropic()

function readData() {
  if (!existsSync(DATA_FILE)) return { companies: [], projects: [] }
  try {
    return JSON.parse(readFileSync(DATA_FILE, 'utf-8'))
  } catch {
    return { companies: [], projects: [] }
  }
}

function writeData(data) {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
}

// ── Data endpoints ──

app.get('/api/data', (req, res) => {
  res.json(readData())
})

app.post('/api/companies', (req, res) => {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Company name is required' })
  const data = readData()
  const company = { id: randomUUID(), name: name.trim() }
  data.companies.push(company)
  writeData(data)
  res.json(company)
})

app.put('/api/companies/:id', (req, res) => {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Company name is required' })
  const data = readData()
  const company = data.companies.find(c => c.id === req.params.id)
  if (!company) return res.status(404).json({ error: 'Company not found' })
  company.name = name.trim()
  writeData(data)
  res.json(company)
})

app.delete('/api/companies/:id', (req, res) => {
  const data = readData()
  data.companies = data.companies.filter(c => c.id !== req.params.id)
  data.projects = data.projects.filter(p => p.companyId !== req.params.id)
  writeData(data)
  res.json({ ok: true })
})

app.post('/api/projects', (req, res) => {
  const { name, clientName, companyId } = req.body
  if (!name?.trim() || !clientName?.trim() || !companyId) {
    return res.status(400).json({ error: 'All fields are required' })
  }
  const data = readData()
  const project = { id: randomUUID(), name: name.trim(), clientName: clientName.trim(), companyId }
  data.projects.push(project)
  writeData(data)
  res.json(project)
})

app.put('/api/projects/:id', (req, res) => {
  const { name, clientName, companyId } = req.body
  const data = readData()
  const project = data.projects.find(p => p.id === req.params.id)
  if (!project) return res.status(404).json({ error: 'Project not found' })
  if (name?.trim()) project.name = name.trim()
  if (clientName?.trim()) project.clientName = clientName.trim()
  if (companyId) project.companyId = companyId
  writeData(data)
  res.json(project)
})

app.delete('/api/projects/:id', (req, res) => {
  const data = readData()
  data.projects = data.projects.filter(p => p.id !== req.params.id)
  writeData(data)
  res.json({ ok: true })
})

// ── Generate endpoint ──

const SYSTEM_PROMPT = `You are a professional construction project manager writing weekly client update emails on behalf of a construction company.

Your emails must be:
- Professional, warm, and easy to read
- Written in plain English — no construction jargon
- Organized into clear sections so the client can quickly find what they need
- Positive and solution-focused in tone

Always structure the email with these sections (using bold headers):
1. A friendly opening paragraph referencing the project and the week
2. **Progress This Week** — what was accomplished
3. **Action Needed From You** — clear, specific items the client must decide or provide (skip this section entirely if there are none)
4. **Coming Up Next Week** — what work is planned
5. A warm closing paragraph`

app.post('/api/generate', async (req, res) => {
  const { jobName, clientName, companyName, bulletPoints } = req.body

  if (!jobName || !bulletPoints) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const signOff = companyName
    ? `Warm regards,\n${companyName}`
    : `Warm regards,\nThe Project Team`

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-5',
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Write a weekly client update email for this construction project.

Project: ${jobName}
Client Name: ${clientName}
Week Ending: ${today}

Notes from this week:
${bulletPoints}

Start the email with "Dear ${clientName}," and write a complete, polished email following the structure in your instructions. Make any required client actions very clear and easy to spot. Sign off the email as:
${signOff}`,
        },
      ],
    })

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`)
      }
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Anthropic API error:', message)
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`)
    res.end()
  }
})

// ── Serve React frontend in production ──
const DIST = join(__dirname, 'dist')
app.use(express.static(DIST))
app.get('*', (req, res) => {
  res.sendFile(join(DIST, 'index.html'))
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`)
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️  Warning: ANTHROPIC_API_KEY is not set.')
  }
})
