type ReportRow = Record<string, unknown>

export type HealthReportData = {
  exportedAt: Date
  accountEmail: string | undefined
  profile: ReportRow | null
  measurements: ReportRow[]
  activities: ReportRow[]
  symptoms: ReportRow[]
  baselines: ReportRow[]
  events: ReportRow[]
  insights: ReportRow[]
  contacts: ReportRow[]
  analyses: ReportRow[]
}

const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const LEFT = 48
const RIGHT = 547
const CONTENT_WIDTH = RIGHT - LEFT
const BOTTOM = 795
const BLUE = '0.10 0.42 0.43'
const LABEL_BLUE = '0.76 0.86 0.84'
const INK = '0.12 0.15 0.18'
const MUTED = '0.28 0.32 0.36'
const BORDER = '0.45 0.47 0.49'

function clean(value: unknown, fallback = 'Not provided') {
  if (value === null || value === undefined || value === '') return fallback
  return String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E\n]/g, '?')
}

function pdfString(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function formatDate(value: unknown, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }) {
  if (!value) return 'Not provided'
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? clean(value) : date.toLocaleString('en-IN', options)
}

function wrap(value: unknown, maxChars: number) {
  const text = clean(value)
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/)
    let line = ''
    for (const word of words) {
      if (word.length > maxChars) {
        if (line) lines.push(line)
        for (let index = 0; index < word.length; index += maxChars) lines.push(word.slice(index, index + maxChars))
        line = ''
        continue
      }
      const next = line ? `${line} ${word}` : word
      if (next.length > maxChars && line) {
        lines.push(line)
        line = word
      } else line = next
    }
    if (line) lines.push(line)
  }
  return lines.length ? lines : ['Not provided']
}

function readingDetails(row: ReportRow) {
  const values: string[] = []
  if (row.heart_rate_bpm !== null && row.heart_rate_bpm !== undefined) values.push(`Heart rate: ${row.heart_rate_bpm} BPM`)
  if (row.resting_heart_rate_bpm !== null && row.resting_heart_rate_bpm !== undefined) values.push(`Resting heart rate: ${row.resting_heart_rate_bpm} BPM`)
  if (row.systolic_mmhg !== null && row.systolic_mmhg !== undefined) values.push(`Blood pressure: ${row.systolic_mmhg}/${clean(row.diastolic_mmhg, '?')} mmHg`)
  if (row.spo2_pct !== null && row.spo2_pct !== undefined) values.push(`Blood oxygen: ${row.spo2_pct}%`)
  if (row.temperature_c !== null && row.temperature_c !== undefined) values.push(`Temperature: ${row.temperature_c} C`)
  if (row.steps !== null && row.steps !== undefined) values.push(`Steps: ${row.steps}`)
  if (row.sleep_minutes !== null && row.sleep_minutes !== undefined) values.push(`Sleep: ${(Number(row.sleep_minutes) / 60).toFixed(1)} hours`)
  if (row.source) values.push(`Source: ${row.source}`)
  if (row.notes) values.push(`Notes: ${row.notes}`)
  return values.length ? values.join(' | ') : 'No readings recorded in this entry.'
}

export function createHealthReportPdf(report: HealthReportData) {
  const pages: string[][] = []
  let commands: string[] = []
  let y = 0
  let pageOpen = false

  function raw(command: string) { commands.push(command) }
  function text(value: unknown, x: number, top: number, size = 9, bold = false, color = INK) {
    const baseline = PAGE_HEIGHT - top - size
    raw(`BT ${color} rg /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${x} ${baseline} Tm (${pdfString(clean(value))}) Tj ET`)
  }
  function rectangle(x: number, top: number, width: number, height: number, fill: string, stroke = BORDER) {
    raw(`q ${fill} rg ${stroke} RG 0.5 w ${x} ${PAGE_HEIGHT - top - height} ${width} ${height} re B Q`)
  }
  function drawGridRow(cells: Array<{ label: string; value: unknown; widths: [number, number] }>, top: number, height: number) {
    let x = LEFT
    for (const cell of cells) {
      const [labelWidth, valueWidth] = cell.widths
      rectangle(x, top, labelWidth, height, LABEL_BLUE)
      text(cell.label, x + 6, top + 8, 7.6, true)
      x += labelWidth
      rectangle(x, top, valueWidth, height, '1 1 1')
      const lines = wrap(cell.value, Math.max(10, Math.floor((valueWidth - 12) / 4.5)))
      const visible = lines.slice(0, Math.max(1, Math.floor((height - 7) / 10)))
      visible.forEach((item, index) => text(item, x + 6, top + 7 + index * 10, 7.5, false, MUTED))
      x += valueWidth
    }
    y = top + height
  }
  function demographics() {
    text('PATIENT DEMOGRAPHICS & CLINICAL PROFILE', LEFT + 8, y, 9, true)
    y += 17
    
    // Each row spans exactly CONTENT_WIDTH (499 pts), divided into 3 equal columns of ~166 pts each
    // Column 1: Label 54, Value 112 = 166
    // Column 2: Label 54, Value 112 = 166
    // Column 3: Label 75, Value 92 = 167 (Total = 499)
    
    // Row 1: Name, Sex, Blood group
    drawGridRow([
      { label: 'Name', value: report.profile?.display_name ?? 'Aura Patient', widths: [54, 112] },
      { label: 'Sex', value: report.profile?.biological_sex, widths: [54, 112] },
      { label: 'Blood group', value: report.profile?.blood_group, widths: [75, 92] },
    ], y, 26)

    // Row 2: Height, Weight, Date of birth
    drawGridRow([
      { label: 'Height', value: report.profile?.height_cm ? `${report.profile.height_cm} cm` : null, widths: [54, 112] },
      { label: 'Weight', value: report.profile?.weight_kg ? `${report.profile.weight_kg} kg` : null, widths: [54, 112] },
      { label: 'Date of birth', value: report.profile?.date_of_birth, widths: [75, 92] },
    ], y, 26)

    // Row 3: Allergies spanning full width
    drawGridRow([
      { label: 'Allergies', value: report.profile?.allergies, widths: [54, CONTENT_WIDTH - 54] },
    ], y, 26)

    y += 14
  }
  function startPage(isFirstPage = false) {
    if (pageOpen) pages.push(commands)
    commands = []
    pageOpen = true
    raw('1 1 1 rg 0 0 595 842 re f')
    raw(`${BLUE} rg 0 742 ${PAGE_WIDTH} 100 re f`)
    text('AURA HEALTH', LEFT + 8, 23, 10, true, '1 1 1')
    text('Personal Health Report', LEFT + 8, 44, 19, true, '1 1 1')
    text("Patient's Copy", LEFT + 8, 68, 9, false, '0.92 0.95 0.98')
    raw(`q 1 1 1 RG 1.4 w 432 ${PAGE_HEIGHT - 27 - 27} 27 27 re S Q`)
    text('+', 440, 29, 19, true, '1 1 1')
    text('AURA', 466, 30, 10, true, '1 1 1')
    text('HEALTH', 466, 43, 8, false, '1 1 1')
    
    if (isFirstPage) {
      y = 106
      demographics()
    } else {
      y = 106 // Demographics are NEVER rendered on page 2 or later pages!
    }
  }
  function ensure(height: number) {
    if (y + height > BOTTOM) startPage(false)
  }
  function section(title: string) {
    ensure(85)
    raw(`${BLUE} rg ${LEFT} ${PAGE_HEIGHT - y - 25} ${CONTENT_WIDTH} 25 re f`)
    text(title, LEFT + 10, y + 7, 9, true, '1 1 1')
    y += 25
  }
  function tableRow(label: string, value: unknown) {
    const labelWidth = 132
    const lines = wrap(value, Math.floor((CONTENT_WIDTH - labelWidth - 16) / 4.3))
    const lineHeight = 12
    if (lines.length <= 48) ensure(Math.max(31, 16 + lines.length * lineHeight))
    let remaining = lines
    let continued = false
    do {
      const availableLines = Math.floor((BOTTOM - y - 16) / lineHeight)
      if (availableLines < 1) {
        startPage(false)
        continue
      }
      const chunk = remaining.slice(0, Math.min(remaining.length, availableLines, 48))
      remaining = remaining.slice(chunk.length)
      const height = Math.max(31, 16 + chunk.length * lineHeight)
      ensure(height)
      rectangle(LEFT, y, labelWidth, height, LABEL_BLUE)
      rectangle(LEFT + labelWidth, y, CONTENT_WIDTH - labelWidth, height, '1 1 1')
      const labelLines = wrap(continued ? `${label} (continued)` : label, 22)
      const labelTop = y + Math.max(8, (height - labelLines.length * 10) / 2)
      labelLines.forEach((item, index) => text(item, LEFT + 7, labelTop + index * 10, 8, true))
      chunk.forEach((item, index) => text(item, LEFT + labelWidth + 8, y + 8 + index * lineHeight, 8.4, false, MUTED))
      y += height
      continued = true
    } while (remaining.length)
  }
  function recordRow(label: unknown, date: unknown, detail: unknown) {
    const title = clean(label, 'Record')
    const timestamp = formatDate(date)
    tableRow(title, `${timestamp}\n${clean(detail)}`)
  }
  function blankRow(label: string) { tableRow(label, 'No records available.') }

  startPage(true)
  
  section('Medical history and notes')
  tableRow('Known conditions', report.profile?.conditions)
  tableRow('Important medical information', report.profile?.medical_notes)
  y += 12

  section(`Measurements (${report.measurements.length})`)
  if (!report.measurements.length) blankRow('Measurements')
  report.measurements.forEach((measurement) => recordRow('Reading', measurement.recorded_at, readingDetails(measurement)))

  section(`Symptoms (${report.symptoms.length})`)
  if (!report.symptoms.length) blankRow('Symptoms')
  report.symptoms.forEach((symptom) => recordRow(symptom.name, symptom.occurred_at, [symptom.severity ? `Severity: ${symptom.severity}/5` : '', symptom.notes].filter(Boolean).join(' | ') || 'No additional details.'))

  section(`Activity (${report.activities.length})`)
  if (!report.activities.length) blankRow('Activity')
  report.activities.forEach((activity) => recordRow(activity.activity_type, activity.occurred_at, [activity.duration_minutes ? `Duration: ${activity.duration_minutes} min` : '', activity.intensity ? `Intensity: ${activity.intensity}` : '', activity.notes].filter(Boolean).join(' | ') || 'No additional details.'))

  section(`Emergency contacts (${report.contacts.length})`)
  if (!report.contacts.length) blankRow('Emergency contacts')
  report.contacts.forEach((contact) => recordRow(contact.name, contact.updated_at ?? contact.created_at, [contact.relationship, contact.phone, contact.is_primary ? 'Primary contact' : ''].filter(Boolean).join(' | ') || 'No additional details.'))

  section(`Health events (${report.events.length})`)
  if (!report.events.length) blankRow('Health events')
  report.events.forEach((event) => recordRow(event.title ?? event.event_type ?? 'Health event', event.occurred_at, [event.event_type, event.description].filter(Boolean).join(' | ') || 'No additional details.'))

  section(`Personal baselines (${report.baselines.length})`)
  if (!report.baselines.length) blankRow('Personal baselines')
  report.baselines.forEach((baseline) => recordRow(baseline.metric ?? 'Baseline', baseline.updated_at ?? baseline.created_at, [baseline.baseline_value !== undefined ? `Typical: ${baseline.baseline_value} ${clean(baseline.unit, '')}` : '', baseline.window_start ? `From: ${formatDate(baseline.window_start)}` : '', baseline.window_end ? `Through: ${formatDate(baseline.window_end)}` : '', baseline.notes].filter(Boolean).join(' | ') || 'Saved baseline.'))

  section(`Saved insights (${report.insights.length})`)
  if (!report.insights.length) blankRow('Saved insights')
  report.insights.forEach((insight) => recordRow(insight.title ?? 'Health insight', insight.generated_at ?? insight.created_at, [insight.body, insight.status !== 'placeholder' ? insight.status : '', insight.source !== 'unconnected' ? insight.source : ''].filter(Boolean).join(' | ') || 'Saved insight.'))

  section(`Analysis history (${report.analyses.length})`)
  if (!report.analyses.length) blankRow('Analysis history')
  report.analyses.forEach((analysis) => {
    const payload = analysis.payload && typeof analysis.payload === 'object' ? analysis.payload as ReportRow : {}
    recordRow(analysis.analysis_type ?? 'Analysis', analysis.analyzed_at, payload.summary ?? payload.status ?? 'Saved analysis result.')
  })

  if (commands.length) pages.push(commands)
  const objects: string[] = []
  const pageIds = pages.map((_, index) => 5 + index * 2)
  objects.push('<< /Type /Catalog /Pages 2 0 R >>')
  objects.push(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`)
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>')
  pages.forEach((page, index) => {
    const contentId = 6 + index * 2
    const pageId = 5 + index * 2
    const footer = `BT 0.40 0.43 0.46 rg /F1 8 Tf 1 0 0 1 ${LEFT} 27 Tm (Private health information - prepared for the account holder) Tj 1 0 0 1 500 27 Tm (${index + 1} / ${pages.length}) Tj ET`
    const stream = `${page.join('\n')}\n${footer}\n`
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`)
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`)
    if (pageId !== pageIds[index]) throw new Error('Invalid PDF page structure')
  })
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n` })
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return new Blob([pdf], { type: 'application/pdf' })
}