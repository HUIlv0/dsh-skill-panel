/**
 * dsh-skill-panel —— 宿主半区
 *
 * 左侧导航「技能」页的数据来源。两件事：
 *   1. 把「本机可用的技能」整理成前端能直接渲染的两组（我装的 / DSH 内置），
 *      每条给一句中文简介（内置的只有英文长描述，这里做一次性翻译/收敛）。
 *   2. 通过 /dsh-skill-panel/list.json 提供给浏览器半区。
 *
 * 技能清单优先问 ctx.skills（与 agent 看到的目录同源，含 app.asar 里的内置技能）；
 * 服务不可用时退回扫描磁盘，保证这个页面永远有东西可看。
 *
 * 只依赖 Node 内置模块：profile 的 node_modules 解析不到 @deepseek-ai/*。
 *
 * @module dsh-skill-panel
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const HOME = os.homedir()
const DSH_HOME = process.env.DSH_HOME || path.join(HOME, '.dsh')

const BASE = '/dsh-skill-panel'
const LOG_PREFIX = '[session-skills]'

/** 技能执行目录：优先当前 DSH 工作区，其次用户主目录。 */
const WORKSPACE_DIR = (() => {
  const candidates = [
    process.env.DSH_WORKSPACE,
    process.env.DSH_CWD,
    'D:\\Documents\\deepseek-harness\\default-workspace',
    path.join(HOME, 'Documents', 'deepseek-harness', 'default-workspace'),
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) {
      try { if (fs.existsSync(c)) return c } catch (err) { /* noop */ }
    }
  }
  return HOME
})()

/**
 * 一句话中文简介。键是技能名（kebab-case，必须与 SKILL.md 的 name 完全一致）。
 * 未收录的技能会从原始 description 里截一句，所以新增技能不会显示空白。
 */
const BLURB = {
  'brandkit': '品牌视觉套件：logo、配色、版式、品牌指南板',
  'design-taste-frontend': '前端设计品味：落地页/作品集，去掉模板感',
  'design-taste-frontend-v1': '上一版前端设计品味（兼容旧行为用）',
  'diagnose-windows-sandbox-acl': '诊断并修复 Windows 沙箱的 ACL 拒绝',
  'full-output-enforcement': '强制完整输出：禁止占位、截断和省略',
  'gpt-image-2-style-library': 'GPT-Image2 风格库与工业级提示词模板',
  'gpt-taste': '高级 UX + GSAP 动效，版式真随机化',
  'gsap-core': 'GSAP 核心 API：补间、缓动、时间线',
  'gsap-frameworks': 'GSAP 用在 Vue / Svelte / Nuxt 里',
  'gsap-performance': 'GSAP 性能：只动 transform、避免布局抖动',
  'gsap-plugins': 'GSAP 插件：ScrollTrigger / Flip / Draggable 等',
  'gsap-react': 'GSAP 用在 React 里：useGSAP 与清理',
  'gsap-scrolltrigger': '滚动驱动的动画与 pin / scrub',
  'gsap-timeline': '时间线编排与位置参数',
  'gsap-utils': 'gsap.utils：clamp / mapRange / random / snap',
  'high-end-visual-design': '高端视觉规范：字体、留白、阴影、卡片',
  'image-to-code': '先出设计图，再照图实现页面',
  'imagegen-frontend-mobile': '移动端 App 界面概念图（多屏、原生感）',
  'imagegen-frontend-web': '网页设计参考图，一段一图',
  'industrial-brutalist-ui': '工业粗野主义界面：重网格、强对比',
  'media-tools': '图片生成：SenseNova 优先，SiliconFlow 兜底',
  'minimalist-ui': '极简编辑风界面：暖灰、留白、无重阴影',
  'office': 'Office 总入口：按任务选文档工作流',
  'office-docx': 'Word：读写、编辑、校验 .docx',
  'office-export-pdf': '用 LibreOffice 把文档导成 PDF',
  'office-pptx': 'PowerPoint：读写、编辑、校验 .pptx',
  'office-recalculate': '刷新表格公式缓存并校验结果',
  'office-render': '把文档渲染成图片，检查版式',
  'office-xlsx': 'Excel：读写、公式、数据分析',
  'photo-to-travel-sketch': '照片转旅行速写：松散的黑线加马克笔',
  'ppt-master': '演示文稿全流程：生成/美化可编辑 PPTX',
  'react-bits': '216 个动效 React 组件（四种变体，离线源码）',
  'redesign-existing-projects': '旧站改造：审计后升级到高级质感',
  'stitch-design-taste': '生成反模板的 DESIGN.md 设计规范',
  'vision-review': '图像理解、OCR、截图视觉 QA',
  'modsearch': '联网搜索 / 读网页 / 搜 X',
  'clearai-loop': 'ClearAI 本体论研究循环',
}

/** 取一句话简介：优先手工表，其次把原始描述收敛到一行。 */
function blurbOf(name, raw) {
  const curated = BLURB[name]
  if (curated) return curated
  const text = String(raw || '').replace(/\s+/g, ' ').trim()
  if (!text) return '（无描述）'
  const cut = text.split(/(?:[.。!！?？]\s)|(?: · )/u)[0] || text
  return cut.length > 46 ? cut.slice(0, 45) + '…' : cut
}

/** 解析 SKILL.md 的 frontmatter（只取 name / description）。 */
function parseFrontmatter(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(raw)
  if (m === null) return {}
  const block = m[1]
  const name = /^name:[ \t]*(.*)$/mu.exec(block)
  const desc = /^description:[ \t]*(.*)$/mu.exec(block)
  let description = desc === null ? '' : desc[1].trim()
  if (description === '>' || description === '|' || description === '>-' || description === '|-') {
    const folded = description.startsWith('|') ? '\n' : ' '
    const start = desc.index + desc[0].length
    const collected = []
    for (const line of block.slice(start).split(/\r?\n/)) {
      if (line.trim() === '') { if (collected.length > 0) break; else continue }
      if (!/^\s/.test(line)) break
      collected.push(line.trim())
    }
    description = collected.join(folded)
  }
  return {
    name: name === null ? '' : name[1].trim().replace(/^["']|["']$/gu, ''),
    description: description.replace(/^["']|["']$/gu, '').trim(),
  }
}

/** 扫描一个目录下的 SKILL.md 所在目录，maxDepth 层。 */
function scanSkillDirs(root, maxDepth) {
  const found = []
  function walk(d, level) {
    let entries
    try { entries = fs.readdirSync(d, { withFileTypes: true }) } catch (err) { return }
    if (entries.some((e) => e.isFile() && e.name === 'SKILL.md')) found.push(d)
    if (level <= 0) return
    for (const e of entries) {
      if (!e.isDirectory() || e.name === 'node_modules' || e.name.startsWith('.')) continue
      walk(path.join(d, e.name), level - 1)
    }
  }
  walk(root, maxDepth)
  return found
}

/** 用户目录里所有可能放技能的根：全局技能、插件技能、profile 内 node_modules 的插件技能。 */
function diskRoots() {
  const roots = [
    [path.join(DSH_HOME, 'skills'), 1],
    [path.join(DSH_HOME, 'plugins'), 3],
  ]
  let profiles = []
  try { profiles = fs.readdirSync(path.join(DSH_HOME, 'profiles'), { withFileTypes: true }) } catch (err) { profiles = [] }
  for (const profile of profiles) {
    if (!profile.isDirectory()) continue
    const modules = path.join(DSH_HOME, 'profiles', profile.name, 'node_modules')
    let entries = []
    try { entries = fs.readdirSync(modules, { withFileTypes: true }) } catch (err) { continue }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      const skillsDir = path.join(modules, entry.name, 'skills')
      try { if (fs.statSync(skillsDir).isDirectory()) roots.push([skillsDir, 2]) } catch (err) { /* noop */ }
    }
  }
  return roots
}

/** 磁盘兜底：只覆盖用户目录里的技能（内置技能在 app.asar 内，扫不到）。 */
function listFromDisk() {
  const rows = []
  for (const [root, depth] of diskRoots()) {
    for (const dir of scanSkillDirs(root, depth)) {
      const file = path.join(dir, 'SKILL.md')
      let meta = {}
      try { meta = parseFrontmatter(fs.readFileSync(file, 'utf8')) } catch (err) { continue }
      const name = meta.name || path.basename(dir)
      rows.push({ name, description: meta.description || '', path: file, provider: '' })
    }
  }
  return rows
}

/** 优先用 ctx.skills 的合并目录；失败则退回磁盘扫描。 */
async function listSkills(ctx, cwd) {
  const service = ctx.get('skills') || ctx.skills
  if (service && typeof service.list === 'function') {
    try {
      const found = await service.list({ cwd: cwd || WORKSPACE_DIR })
      if (Array.isArray(found) && found.length > 0) {
        return {
          source: 'skills-service',
          rows: found.map((s) => ({
            name: String(s.name || ''),
            description: String(s.description || ''),
            path: typeof s.path === 'string' ? s.path : '',
            provider: String(s.provider || ''),
          })).filter((s) => s.name !== ''),
        }
      }
    } catch (err) {
      warn('ctx.skills.list 失败，退回磁盘扫描：', String(err && err.message || err))
    }
  }
  return { source: 'disk', rows: listFromDisk() }
}

/**
 * 判断来源。
 *   1. 路径在 app.asar 里 → 内置；
 *   2. 路径在 ~/.dsh 下 → 我装的（来源取插件目录名）；
 *   3. 没有路径：磁盘上有同名技能 → 我装的（用磁盘那条的来源），否则 → 内置。
 * 第 3 条很关键：插件用 ctx.skills.register 注册的技能摘要可能不带 path。
 */
function classify(row, onDisk) {
  const p = String(row.path || '').replace(/\\/g, '/')
  if (p.includes('.asar')) return { group: 'builtin', source: 'DSH 内置' }
  if (p !== '') {
    const pluginsAt = (DSH_HOME + '/plugins').replace(/\\/g, '/')
    const skillsAt = (DSH_HOME + '/skills').replace(/\\/g, '/')
    const homeAt = DSH_HOME.replace(/\\/g, '/')
    if (p.startsWith(pluginsAt + '/')) {
      const rest = p.slice(pluginsAt.length + 1)
      return { group: 'installed', source: rest.split('/')[0] }
    }
    if (p.startsWith(skillsAt + '/')) return { group: 'installed', source: 'skills' }
    if (p.startsWith(homeAt + '/')) {
      const parts = p.slice(homeAt.length + 1).split('/')
      const at = parts.indexOf('node_modules')
      return { group: 'installed', source: at >= 0 ? (parts[at + 1] || 'local') : 'local' }
    }
    return { group: 'installed', source: path.basename(path.dirname(path.dirname(p))) || 'local' }
  }
  const hit = onDisk.get(row.name)
  if (hit) return { group: 'installed', source: hit }
  return { group: 'builtin', source: 'DSH 内置' }
}

function log(...args) { try { console.log(LOG_PREFIX, ...args) } catch (err) { /* noop */ } }
function warn(...args) { try { console.warn(LOG_PREFIX, ...args) } catch (err) { /* noop */ } }

function isLoopbackHostname(hostname) {
  const h = String(hostname || '').toLowerCase()
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]'
}

function makeGuard(ctx) {
  const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
  const APP_SCHEMES = ['dsh-app:', 'file:', 'chrome-extension:', 'electron:']
  return function rejected(req, res) {
    try {
      const headers = (req && req.headers) || {}
      let url = null
      try { url = new URL('http://' + String(headers.host || '')) } catch (err) { res.statusCode = 403; res.end(); return true }
      if (String(headers['sec-fetch-site'] || '') === 'cross-site') { res.statusCode = 403; res.end(); return true }
      const method = String((req && req.method) || 'GET').toUpperCase()
      if (WRITE.has(method) && !isLoopbackHostname(url.hostname)) { res.statusCode = 403; res.end(); return true }
      const origin = String(headers.origin || '')
      if (origin && origin !== 'null') {
        let o = null
        try { o = new URL(origin) } catch (err) { res.statusCode = 403; res.end(); return true }
        if (!APP_SCHEMES.includes(o.protocol) && o.host.toLowerCase() !== url.host.toLowerCase()) {
          res.statusCode = 403; res.end(); return true
        }
      }
      const conn = ctx.get('connection') || ctx.connection
      if (conn && typeof conn.requestRejection === 'function') {
        const code = conn.requestRejection(req)
        if (code !== undefined && code !== null && code !== false) {
          res.statusCode = typeof code === 'number' ? code : 403
          res.end()
          return true
        }
      }
      return false
    } catch (err) {
      res.statusCode = 403
      res.end()
      return true
    }
  }
}

function json(res, code, value) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(JSON.stringify(value))
}

export default {
  name: 'session-skills',

  apply(root) {
    root.inject(['webServer'], (ctx) => {
      const disposers = []
      const guard = makeGuard(ctx)

      function register(route) {
        const inner = route.handler
        return ctx.webServer.register({
          ...route,
          handler: async (req, res) => {
            if (guard(req, res)) return
            try { return await inner(req, res) } catch (err) {
              warn('路由 ' + route.path + ' 抛错：', String((err && err.stack) || err))
              try { json(res, 500, { ok: false, error: String((err && err.message) || err) }) } catch (e2) { /* noop */ }
            }
          },
        })
      }

      async function buildList(cwd) {
        const serviceResult = await listSkills(ctx, cwd)
        // 磁盘结果永远参与合并：即使服务挂了或只返回部分来源，用户自己装的技能也不会消失
        const diskRows = listFromDisk()
        const merged = new Map()
        for (const row of diskRows) merged.set(row.name, row)
        for (const row of serviceResult.rows) {
          const prev = merged.get(row.name)
          merged.set(row.name, {
            name: row.name,
            description: row.description || (prev ? prev.description : ''),
            path: row.path || (prev ? prev.path : ''),
            provider: row.provider || (prev ? prev.provider : ''),
          })
        }
        const rows = [...merged.values()]
        const source = serviceResult.source === 'disk' ? 'disk' : (diskRows.length > 0 ? 'service+disk' : 'service')
        // 磁盘索引：名字 → 来源（插件目录名），用来给不带 path 的技能摘要定性
        const onDisk = new Map()
        for (const diskRow of diskRows) {
          if (onDisk.has(diskRow.name)) continue
          const guess = classify(diskRow, new Map())
          onDisk.set(diskRow.name, guess.source)
        }
        const seen = new Set()
        const installed = []
        for (const row of rows) {
          const { group, source: src } = classify(row, onDisk)
          // DSH 内置技能保持默认开启，但不在面板里展示：只列「我装的」
          if (group === 'builtin') continue
          if (seen.has(row.name)) continue
          seen.add(row.name)
          installed.push({
            name: row.name,
            blurb: blurbOf(row.name, row.description),
            detail: String(row.description || '').replace(/\s+/g, ' ').trim(),
            source: src,
            path: row.path || '',
          })
        }
        installed.sort((a, b) => a.name.localeCompare(b.name))
        return {
          ok: true,
          source,
          cwd: cwd || WORKSPACE_DIR,
          groups: [
            { id: 'installed', label: '我装的技能', items: installed },
          ],
          total: installed.length,
        }
      }

      disposers.push(register({
        kind: 'exact',
        path: BASE + '/list.json',
        handler: async (req, res) => {
          const url = new URL('http://x' + String(req.url || '/'))
          const cwd = url.searchParams.get('cwd') || ''
          json(res, 200, await buildList(cwd))
        },
      }))

      disposers.push(register({
        kind: 'exact',
        path: BASE + '/report.json',
        handler: (req, res) => {
          if (String(req.method || 'GET').toUpperCase() !== 'POST') return json(res, 405, { ok: false })
          let body = ''
          req.on('data', (chunk) => { body += chunk; if (body.length > 1e6) req.destroy() })
          req.on('end', () => {
            try { fs.writeFileSync(path.join(DSH_HOME, 'session-skills-report.json'), body, 'utf8') } catch (err) { /* noop */ }
            json(res, 200, { ok: true })
          })
          req.on('error', () => { try { res.statusCode = 400; res.end() } catch (err) { /* noop */ } })
        },
      }))

      disposers.push(register({
        kind: 'exact',
        path: BASE + '/health.json',
        handler: (req, res) => json(res, 200, { ok: true, workspace: WORKSPACE_DIR, dshHome: DSH_HOME }),
      }))

      ctx.effect(() => () => { for (const d of disposers) { try { d() } catch (err) { /* noop */ } } })
      log('已就绪：' + BASE + '/list.json，工作区 ' + WORKSPACE_DIR)
    })
  },
}
