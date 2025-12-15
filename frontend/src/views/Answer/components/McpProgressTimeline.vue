<template>
  <div class="mcp-progress">
    <div class="header">
      <span class="title">{{ $t('MCP 工具进度') }}</span>
      <span class="count" v-if="events.length">{{ $t('事件数:') }} {{ events.length }}</span>
      <div class="view-switch">
        <button :class="['vs-btn', view==='list' && 'active']" @click="view='list'">{{ $t('列表') }}</button>
        <button :class="['vs-btn', view==='tree' && 'active']" @click="view='tree'">{{ $t('树') }}</button>
        <button :class="['vs-btn', view==='time' && 'active']" @click="view='time'">{{ $t('时间轴') }}</button>
        <button :class="['vs-btn', showFilter && 'active']" @click="showFilter=!showFilter">{{ $t('过滤器') }}</button>
        <button :class="['vs-btn']" @click="exportJSON">{{ $t('导出JSON') }}</button>
        <button :class="['vs-btn']" @click="exportImage">{{ $t('导出图像') }}</button>
      </div>
      <div v-if="showFilter" class="filter-panel">
        <div class="filter-group">
          <span class="filter-title">{{ $t('服务器') }}</span>
          <div class="filter-items">
            <label v-for="s in serversList" :key="s" class="filter-item">
              <input type="checkbox" :value="s" v-model="fServers"> <span>{{ s }}</span>
            </label>
          </div>
        </div>
        <div class="filter-group">
          <span class="filter-title">{{ $t('工具') }}</span>
          <div class="filter-items">
            <label v-for="t in toolsList" :key="t" class="filter-item">
              <input type="checkbox" :value="t" v-model="fTools"> <span>{{ t }}</span>
            </label>
          </div>
        </div>
        <div class="filter-group">
          <span class="filter-title">{{ $t('事件') }}</span>
          <div class="filter-items">
            <label v-for="k in typesList" :key="k" class="filter-item">
              <input type="checkbox" :value="k" v-model="fTypes"> <span>{{ k }}</span>
            </label>
          </div>
        </div>
      </div>
    </div>
    <div v-if="filteredEvents.length && view==='list'" class="timeline">
      <div v-for="(evt, idx) in filteredEvents" :key="idx" class="item" :class="selectedEventIndex===idx && 'selected'" @click="selectedEventIndex=idx">
        <div class="dot" />
        <div class="content">
          <div class="row">
            <span class="event">{{ evt.event }}</span>
            <span class="ts">{{ formatTs(evt.ts) }}</span>
          </div>
          <div class="row sub" v-if="evt.payload">
            <span v-if="getServer(evt.payload)">server: {{ getServer(evt.payload) }}</span>
            <span v-if="getTool(evt.payload)">tool: {{ getTool(evt.payload) }}</span>
            <span v-if="getStep(evt.payload)">step: {{ getStep(evt.payload) }}</span>
          </div>
          <pre v-if="getDetail(evt.payload)" class="detail">{{ toStr(getDetail(evt.payload)) }}</pre>
        </div>
      </div>
    </div>

    <div v-if="visibleTraceNodes.length && view==='tree'" class="trace-tree">
      <div v-for="n in visibleTraceNodes" :key="n.id" class="tree-node" :class="selectedNodeId===n.id && 'selected'" :style="{ paddingLeft: (n.depth*16)+'px' }" @click="selectedNodeId=n.id">
        <div class="tree-row">
          <div class="tree-left">
            <button v-if="isCollapsible(n)" class="collapse-btn" @click.stop="toggleCollapse(n)">{{ collapsed.has(n.id) ? '▸' : '▾' }}</button>
            <span class="tree-title">{{ n.title }}</span>
          </div>
          <span class="tree-time">{{ formatTs(n.startTime) }}{{ n.endTime ? (' - ' + formatTs(n.endTime)) : '' }}</span>
          <span class="tree-status" :class="n.status || ''">{{ n.status || '' }}</span>
        </div>
      </div>
    </div>

    <div v-if="traceNodes.length && view==='time'" class="trace-time">
      <div class="time-scale">
        <span>{{ formatTs(viewStart) }}</span>
        <span>{{ formatTs(viewEnd) }}</span>
      </div>
      <div class="bars" ref="barsEl" @wheel.prevent="onWheel" @mousedown="onMouseDown">
        <div class="tick" v-for="tk in ticks" :key="tk.left" :style="{ left: tk.left+'%' }"></div>
        <div class="tick-label" v-for="tk in ticks" :key="'lbl-'+tk.left" :style="{ left: tk.left+'%' }">{{ formatTs(tk.time) }}</div>
        <div v-for="b in timeBars" :key="b.id" class="bar" :class="selectedNodeId===b.id && 'selected'" :style="{ left: b.left+'%', width: b.width+'%' }" @click.stop="selectedNodeId=b.id">
          <span class="bar-label">{{ b.label }}</span>
        </div>
      </div>
    </div>
    <div v-else class="empty">{{ $t('暂无进度事件') }}</div>

    <div v-if="selectedInfo" class="detail-panel">
      <div class="detail-row">
        <span class="dp-key">server</span>
        <span class="dp-val">{{ selectedInfo.server }}</span>
      </div>
      <div class="detail-row">
        <span class="dp-key">tool</span>
        <span class="dp-val">{{ selectedInfo.tool }}</span>
      </div>
      <div class="detail-row" v-if="selectedInfo.step">
        <span class="dp-key">step</span>
        <span class="dp-val">{{ selectedInfo.step }}</span>
      </div>
      <div class="detail-row" v-if="selectedInfo.status">
        <span class="dp-key">status</span>
        <span class="dp-val">{{ selectedInfo.status }}</span>
      </div>
      <div class="detail-row" v-if="selectedInfo.call_id">
        <span class="dp-key">call_id</span>
        <span class="dp-val">{{ selectedInfo.call_id }}</span>
      </div>
      <div class="detail-row" v-if="selectedInfo.name">
        <span class="dp-key">event</span>
        <span class="dp-val">{{ selectedInfo.name }}</span>
      </div>
      <pre v-if="selectedInfo.detail" class="dp-pre">{{ toStr(selectedInfo.detail) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getSiderStoreData } from '@/views/Sider/store';
import { getChatToolsStoreData } from '@/views/ChatTools/store';
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n()
const { currentContextId } = getSiderStoreData()
const { mcpProgress } = getChatToolsStoreData()

type Evt = { ts: number; event: string; payload?: any }
const events = computed<Evt[]>(() => {
  const list = mcpProgress.value.get(currentContextId.value) || []
  return list
})

const view = ref<'list'|'tree'|'time'>('list')
const showFilter = ref(false)
const fServers = ref<string[]>([])
const fTools = ref<string[]>([])
const fTypes = ref<string[]>([])
const selectedNodeId = ref<string|null>(null)
const selectedEventIndex = ref<number|null>(null)

function formatTs(ts: number) {
  try {
    const d = new Date(ts)
    const hh = String(d.getHours()).padStart(2,'0')
    const mm = String(d.getMinutes()).padStart(2,'0')
    const ss = String(d.getSeconds()).padStart(2,'0')
    return `${hh}:${mm}:${ss}`
  } catch {
    return String(ts)
  }
}

function toStr(v: any) {
  if (v == null) return ''
  if (typeof v === 'string') return v
  try { return JSON.stringify(v, null, 2) } catch { return String(v) }
}

function getServer(p: any): string {
  try { return (p?.tool_server || p?.server || p?.payload?.tool_server || p?.payload?.server || '') as string } catch { return '' }
}

function getTool(p: any): string {
  try { return (p?.tool_name || p?.tool || p?.payload?.tool_name || p?.payload?.tool || '') as string } catch { return '' }
}

function getStep(p: any): string {
  try { return (p?.step || p?.event || p?.payload?.step || p?.payload?.event || '') as string } catch { return '' }
}

function getDetail(p: any): any {
  try { return (p?.detail ?? p?.message ?? p?.payload?.detail ?? p?.payload?.message ?? null) } catch { return null }
}

function getCallId(p: any): string {
  try { return (p?.call_id || p?.callId || p?.id || p?.payload?.call_id || p?.payload?.callId || '') as string } catch { return '' }
}

type TraceNode = { id: string; title: string; startTime: number; endTime?: number; depth: number; status?: string; server?: string; tool?: string; step?: string; detail?: any; callId?: string; parentId?: string }

function normalizeEvt(e: Evt) {
  const name = (e?.event || '').toString()
  const payload = e?.payload || {}
  const server = getServer(payload)
  const tool = getTool(payload)
  const step = getStep(payload)
  const status = (payload?.status || payload?.payload?.status || '') as string
  const detail = getDetail(payload)
  const callId = getCallId(payload)
  return { name, server, tool, step, ts: e.ts, status, detail, callId }
}

const serversList = computed<string[]>(() => {
  const set = new Set<string>()
  for (const e of events.value) {
    const s = getServer(e.payload)
    if (s) set.add(s)
  }
  return Array.from(set)
})

const toolsList = computed<string[]>(() => {
  const set = new Set<string>()
  for (const e of events.value) {
    const t = getTool(e.payload)
    if (t) set.add(t)
  }
  return Array.from(set)
})

const typesList = computed<string[]>(() => {
  const set = new Set<string>()
  for (const e of events.value) {
    const n = (e.event || '').toString()
    if (n) set.add(n)
  }
  return Array.from(set)
})

const filteredEvents = computed<Evt[]>(() => {
  const s = fServers.value
  const t = fTools.value
  const k = fTypes.value
  const hasS = s.length > 0
  const hasT = t.length > 0
  const hasK = k.length > 0
  return events.value.filter((e) => {
    const sv = getServer(e.payload)
    const tv = getTool(e.payload)
    const kv = (e.event || '').toString()
    if (hasS && (!sv || !s.includes(sv))) return false
    if (hasT && (!tv || !t.includes(tv))) return false
    if (hasK && (!kv || !k.includes(kv))) return false
    return true
  })
})

const traceNodes = computed<TraceNode[]>(() => {
  const nodes: TraceNode[] = []
  const stack: { key: string; node: TraceNode }[] = []
  const openMap = new Map<string, TraceNode>()
  for (const e of filteredEvents.value) {
    const n = normalizeEvt(e)
    if (/^tool_call_/.test(n.name)) {
      const key = `tool:${(n as any).callId || ''}:${n.server}:${n.tool}`
      if (/started$/.test(n.name)) {
        const node: TraceNode = { id: key+':'+n.ts, title: `[${n.server}] ${n.tool}`, startTime: n.ts, depth: 0, server: n.server, tool: n.tool, step: n.step, detail: n.detail, callId: (n as any).callId }
        nodes.push(node)
        openMap.set(key, node)
      } else if (/finished$/.test(n.name)) {
        const node = openMap.get(key)
        if (node) {
          node.endTime = n.ts
          node.status = n.status || 'success'
          node.detail = node.detail || n.detail
          node.callId = node.callId || (n as any).callId
          openMap.delete(key)
        } else {
          const node2: TraceNode = { id: key+':'+n.ts, title: `[${n.server}] ${n.tool}`, startTime: n.ts, endTime: n.ts, depth: 0, status: n.status || '', server: n.server, tool: n.tool, step: n.step, detail: n.detail, callId: (n as any).callId }
          nodes.push(node2)
        }
      }
      continue
    }
    if (/^docx_bridge_/.test(n.name)) {
      if (n.name === 'docx_bridge_started') {
        const key = `bridge:${n.ts}`
        const node: TraceNode = { id: key, title: 'DocxBridge', startTime: n.ts, depth: 0 }
        nodes.push(node)
        stack.push({ key, node })
      } else if (n.name === 'docx_bridge_finished') {
        const top = stack.pop()
        if (top) top.node.endTime = n.ts
      } else if (/^docx_bridge_step_/.test(n.name)) {
        const top = stack[stack.length-1]
        const title = (n.step ? n.step : '') + (n.server || n.tool ? ` [${n.server}] ${n.tool}` : '')
        if (n.name === 'docx_bridge_step_started') {
          const child: TraceNode = { id: `bridge-step:${n.ts}`, title, startTime: n.ts, depth: 1, server: n.server, tool: n.tool, step: n.step, detail: n.detail, parentId: top?.node.id }
          nodes.push(child)
          stack.push({ key: child.id, node: child })
        } else if (n.name === 'docx_bridge_step_finished') {
          const cur = stack.pop()
          if (cur) {
            cur.node.endTime = n.ts
            cur.node.status = n.status || 'success'
            cur.node.detail = cur.node.detail || n.detail
          }
        }
      }
      continue
    }
    if (/^tool_decision_/.test(n.name)) {
      if (n.name === 'tool_decision_started') {
        const node: TraceNode = { id: 'decision:'+n.ts, title: 'ToolDecision', startTime: n.ts, depth: 0, detail: n.detail }
        nodes.push(node)
      } else if (n.name === 'tool_decision_failed') {
        const node: TraceNode = { id: 'decision:'+n.ts, title: 'ToolDecision', startTime: n.ts, endTime: n.ts, depth: 0, status: 'error', detail: n.detail }
        nodes.push(node)
      }
      continue
    }
    if (n.name === 'tool_calls_ready') {
      const node: TraceNode = { id: 'ready:'+n.ts, title: 'ToolsReady', startTime: n.ts, endTime: n.ts, depth: 0, detail: n.detail }
      nodes.push(node)
      continue
    }
    if (/^direct_docx_write_/.test(n.name)) {
      const label = n.tool ? `[${n.server}] ${n.tool}` : 'DocxWrite'
      const node: TraceNode = { id: 'direct:'+n.ts, title: label, startTime: n.ts, depth: 0, server: n.server, tool: n.tool, detail: n.detail }
      if (/started$/.test(n.name)) {
        nodes.push(node)
        openMap.set(node.id, node)
      } else if (/finished$/.test(n.name)) {
        const old = openMap.get(node.id)
        if (old) { old.endTime = n.ts; openMap.delete(node.id) } else { node.endTime = n.ts; nodes.push(node) }
      }
      continue
    }
  }
  const lastTs = filteredEvents.value.length ? filteredEvents.value[filteredEvents.value.length-1].ts : Date.now()
  for (const n of nodes) if (!n.endTime) n.endTime = lastTs
  return nodes
})

const collapsed = ref<Set<string>>(new Set())
function isCollapsible(n: TraceNode): boolean {
  return n.title === 'DocxBridge'
}
function toggleCollapse(n: TraceNode) {
  if (!isCollapsible(n)) return
  const set = new Set(collapsed.value)
  if (set.has(n.id)) {
    set.delete(n.id)
  } else {
    set.add(n.id)
  }
  collapsed.value = set
}
const visibleTraceNodes = computed<TraceNode[]>(() => {
  const hiddenParents = collapsed.value
  return traceNodes.value.filter((n) => {
    const pid = (n as any).parentId
    if (!pid) return true
    return !hiddenParents.has(pid)
  })
})

const traceStart = computed<number>(() => {
  const arr = traceNodes.value
  if (!arr.length) return Date.now()
  return arr.reduce((min, n) => Math.min(min, n.startTime), arr[0].startTime)
})

const traceEnd = computed<number>(() => {
  const arr = traceNodes.value
  if (!arr.length) return Date.now()
  return arr.reduce((max, n) => Math.max(max, n.endTime || n.startTime), arr[0].endTime || arr[0].startTime)
})

const zoom = ref(1)
const panRatio = ref(0)
const barsEl = ref<HTMLElement|null>(null)
const dragging = ref(false)
let dragStartX = 0
let dragStartPan = 0

const viewStart = computed<number>(() => {
  const start = traceStart.value
  const end = traceEnd.value
  const full = Math.max(1, end - start)
  const vRatio = 1 / Math.max(0.25, Math.min(10, zoom.value))
  const vDur = Math.max(1, full * vRatio)
  const maxPan = Math.max(0, 1 - vRatio)
  const p = Math.max(0, Math.min(maxPan, panRatio.value))
  const base = start + p * (full - vDur)
  return base
})

const viewEnd = computed<number>(() => {
  const start = traceStart.value
  const end = traceEnd.value
  const full = Math.max(1, end - start)
  const vRatio = 1 / Math.max(0.25, Math.min(10, zoom.value))
  const vDur = Math.max(1, full * vRatio)
  return viewStart.value + vDur
})

function onWheel(e: WheelEvent) {
  const el = barsEl.value
  const rect = el ? el.getBoundingClientRect() : { left: 0, width: 600 }
  const width = rect.width || 600
  const x = (e.clientX - rect.left)
  const a = Math.max(0, Math.min(1, x / Math.max(1, width)))
  const z0 = Math.max(0.25, Math.min(10, zoom.value))
  const z1 = Math.max(0.25, Math.min(10, z0 * (1 + (e.deltaY > 0 ? -0.15 : 0.15))))
  const v0 = 1 / z0
  const v1 = 1 / z1
  const p0 = Math.max(0, Math.min(1 - v0, panRatio.value))
  let p1 = p0 + a * (v0 - v1)
  p1 = Math.max(0, Math.min(1 - v1, p1))
  zoom.value = z1
  panRatio.value = p1
}

function onMouseDown(e: MouseEvent) {
  dragging.value = true
  dragStartX = e.clientX
  dragStartPan = panRatio.value
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(e: MouseEvent) {
  if (!dragging.value) return
  const el = barsEl.value
  const width = el ? el.clientWidth : 600
  const z = Math.max(0.25, Math.min(10, zoom.value))
  const v = 1 / z
  const dx = e.clientX - dragStartX
  const delta = (dx / Math.max(1, width)) * v
  let p = dragStartPan - delta
  p = Math.max(0, Math.min(1 - v, p))
  panRatio.value = p
}

function onMouseUp() {
  dragging.value = false
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
}

const timeBars = computed(() => {
  const start = viewStart.value
  const end = viewEnd.value
  const dur = Math.max(1, end - start)
  return traceNodes.value.map((n) => {
    const s = Math.max(start, n.startTime)
    const e = Math.min(end, n.endTime || n.startTime)
    const left = ((s - start) / dur) * 100
    const width = (Math.max(0, e - s) / dur) * 100
    const label = n.title
    return { id: n.id, left: Number(left.toFixed(3)), width: Math.max(0.8, Number(width.toFixed(3))), label }
  })
})

const ticks = computed(() => {
  const start = viewStart.value
  const end = viewEnd.value
  const dur = Math.max(1, end - start)
  const count = 6
  const arr: { time: number; left: number }[] = []
  for (let i = 0; i < count; i++) {
    const t = start + (dur * i / (count - 1))
    const left = (i / (count - 1)) * 100
    arr.push({ time: t, left: Number(left.toFixed(3)) })
  }
  return arr
})

function exportJSON() {
  const data = traceNodes.value.map((n) => ({ id: n.id, title: n.title, startTime: n.startTime, endTime: n.endTime, status: n.status, server: n.server, tool: n.tool, step: n.step, call_id: (n as any).callId, detail: n.detail }))
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `trace_${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function exportImage() {
  const el = barsEl.value
  const w = Math.max(600, el ? el.clientWidth : 600)
  const h = Math.max(140, 80 + timeBars.value.length * 36)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(60,186,146,0.06)'
  ctx.fillRect(10, 60, w - 20, h - 80)
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'
  ctx.lineWidth = 1
  for (const tk of ticks.value) {
    const x = 10 + ((tk.left / 100) * (w - 20))
    ctx.beginPath()
    ctx.moveTo(x, 60)
    ctx.lineTo(x, h - 20)
    ctx.stroke()
    ctx.fillStyle = 'rgba(0,0,0,0.65)'
    ctx.font = '12px sans-serif'
    const label = formatTs(tk.time)
    ctx.fillText(label, Math.max(12, x - 24), 50)
  }
  for (const b of timeBars.value) {
    const x = 10 + ((b.left / 100) * (w - 20))
    const bw = Math.max(6, (b.width / 100) * (w - 20))
    ctx.fillStyle = '#3cba92'
    ctx.fillRect(x, 80, bw, 28)
    ctx.fillStyle = '#ffffff'
    ctx.font = '12px sans-serif'
    ctx.fillText(b.label, x + 6, 98, Math.max(20, bw - 12))
  }
  const url = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = `trace_${Date.now()}.png`
  a.click()
}

const selectedInfo = computed(() => {
  if (selectedNodeId.value) {
    const n = traceNodes.value.find(x => x.id === selectedNodeId.value)
    if (n) return { server: n.server || '', tool: n.tool || '', step: n.step || '', status: n.status || '', detail: n.detail, name: n.title, call_id: (n as any).callId || '' }
  }
  if (selectedEventIndex.value != null) {
    const e = filteredEvents.value[selectedEventIndex.value]
    if (e) {
      const n = normalizeEvt(e)
      return { server: n.server || '', tool: n.tool || '', step: n.step || '', status: n.status || '', detail: n.detail, name: n.name, call_id: (n as any).callId || '' }
    }
  }
  return null
})
</script>

<style scoped>
.mcp-progress { 
  border-left: 3px solid #3cba92; 
  padding-left: 8px; 
  margin: 8px 0 12px 0; 
}
.header { display:flex; justify-content: space-between; align-items:center; margin-bottom: 6px; }
.title { font-weight: 600; }
.count { font-size: 12px; opacity: 0.7; }
.view-switch { display:flex; gap:6px; }
.vs-btn { font-size: 12px; padding: 4px 8px; border: 1px solid rgba(0,0,0,0.1); background: #fff; border-radius: 4px; cursor: pointer; }
.vs-btn.active { background: #e6fff4; border-color: #3cba92; }
.filter-panel { display:flex; gap: 16px; margin-top: 6px; }
.filter-group { display:flex; flex-direction: column; gap: 4px; }
.filter-title { font-size: 12px; opacity: 0.8; }
.filter-items { display:flex; flex-wrap: wrap; gap: 8px; max-width: 480px; }
.filter-item { display:flex; gap: 6px; align-items:center; }
.timeline { display:flex; flex-direction: column; gap: 10px; }
.item { display:flex; gap: 8px; cursor: pointer; }
.dot { width:10px; height:10px; border-radius:50%; background:#0ba360; margin-top:6px; }
.content { flex:1; }
.row { display:flex; justify-content: space-between; }
.row.sub { gap: 10px; font-size: 12px; opacity: 0.85; }
.detail { background: rgba(0,0,0,0.03); padding: 8px; margin-top: 6px; border-radius: 4px; }
.empty { font-size: 12px; opacity: 0.8; }
.trace-tree { display:flex; flex-direction: column; gap: 6px; }
.tree-node { border-left: 2px dashed rgba(0,0,0,0.1); padding-left: 8px; cursor: pointer; }
.tree-row { display:flex; gap: 8px; align-items:center; justify-content: space-between; }
.tree-title { font-weight: 500; }
.tree-time { font-size: 12px; opacity: 0.7; }
.tree-status.error { color: #e03a3a; }
.trace-time { display:flex; flex-direction: column; gap: 6px; }
.time-scale { display:flex; justify-content: space-between; font-size: 12px; opacity: 0.75; }
.bars { position: relative; height: 52px; border: 1px dashed rgba(0,0,0,0.1); border-radius: 6px; background: rgba(60,186,146,0.06); }
.tick { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(0,0,0,0.12); }
.tick-label { position: absolute; top: -18px; transform: translateX(-50%); font-size: 12px; opacity: 0.7; }
.bar { position: absolute; top: 12px; height: 28px; background: #3cba92; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; cursor: pointer; }
.bar-label { color: #fff; font-size: 12px; padding: 0 6px; line-height: 28px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
.selected { outline: 2px solid #3cba92; background: rgba(60,186,146,0.12); }
.detail-panel { margin-top: 10px; border: 1px dashed rgba(0,0,0,0.1); border-radius: 6px; padding: 8px; }
.detail-row { display:flex; gap: 10px; font-size: 12px; }
.dp-key { opacity: 0.7; min-width: 60px; }
.dp-val { font-weight: 500; }
.dp-pre { background: rgba(0,0,0,0.03); padding: 8px; border-radius: 4px; margin-top: 6px; }
.tree-left { display:flex; gap: 6px; align-items:center; }
.collapse-btn { font-size: 12px; border: 1px solid rgba(0,0,0,0.1); background: #fff; border-radius: 4px; width: 24px; height: 20px; line-height: 18px; }
</style>
