/**
 * dsh-skill-panel —— 浏览器半区
 *
 * 两处注册（与 @deepseek-ai/dsh-client-ui-plugin-manager 的用法一致）：
 *   1. sidebar.panellist  —— 左侧导航里「插件」下面多一行「技能」
 *   2. main(key)          —— 该行的页面内容
 *
 * 页面里每个技能一行：名字 + 一句中文简介 + 来源；「添加」把
 * 「请使用技能 <name> 来完成接下来的任务。」插进输入框（失败则复制到剪贴板），
 * 由用户自己按发送，所以不会误发一轮对话。
 *
 * 不用构建：__ModuleLoader__ 的 factory 里直接用种子模块 react。
 */
window.__ModuleLoader__.load({
  id: 'dsh-skill-panel',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const PANEL_ID = 'session-skills'
    const BASE = '/dsh-skill-panel'
    const STYLE_ID = 'dsh-skill-panel-style'

    /** 输入框候选：新版 Lexical 编辑器、旧版可编辑层、原生 textarea。 */
    const COMPOSER_SELECTORS = [
      '[data-composer-input]',
      '[data-composer-card] [contenteditable="true"]',
      '[contenteditable="true"][role="textbox"]',
      'textarea[data-composer-input]',
      'textarea',
    ]

    const CSS = [
      '.dssk-root{display:flex;flex-direction:column;height:100%;min-height:0;',
      ' font-family:var(--dsw-font-family,system-ui,-apple-system,"Segoe UI",sans-serif);',
      ' color:var(--dsw-alias-label-primary,#f2f3f5);background:var(--dsw-alias-bg-base,#111214)}',
      '.dssk-shell{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;width:100%;',
      ' max-width:720px;margin:0 auto;padding:14px 16px 0;box-sizing:border-box}',
      '.dssk-head{display:flex;align-items:baseline;gap:10px;padding:0 0 8px}',
      '.dssk-title{font-size:14.5px;font-weight:600;margin:0}',
      '.dssk-sub{font-size:11.5px;color:var(--dsw-alias-label-tertiary,#8b8d95);margin:0 0 0 auto;',
      ' white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.dssk-search{width:100%;box-sizing:border-box;padding:8px 12px;font-size:13.5px;border-radius:8px;outline:none;',
      ' border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.25));',
      ' background:var(--dsw-alias-bg-layer-1,#17181c);color:inherit}',
      '.dssk-search:focus{border-color:#4d6bfe}',
      '.dssk-body{flex:1 1 auto;min-height:0;overflow:auto;margin-top:8px}',
      '.dssk-group{padding:3px 0}',
      '.dssk-grouphead{display:flex;align-items:center;gap:7px;width:100%;padding:7px 2px;background:none;',
      ' border:0;cursor:pointer;color:var(--dsw-alias-label-secondary,#a9aab2);font-size:12px;font-weight:600;',
      ' text-align:left;letter-spacing:.03em}',
      '.dssk-grouphead:hover{color:var(--dsw-alias-label-primary,#f2f3f5)}',
      '.dssk-count{font-weight:400;color:var(--dsw-alias-label-caption,#6b6c74)}',
      '.dssk-row{display:flex;align-items:center;gap:9px;padding:5px 9px;border-radius:8px;cursor:pointer;',
      ' line-height:1.45;user-select:none}',
      '.dssk-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}',
      '.dssk-row[data-on="true"]{background:rgba(77,107,254,.16)}',
      '.dssk-box{flex:0 0 auto;width:15px;height:15px;border-radius:4px;box-sizing:border-box;',
      ' border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.45));display:flex;align-items:center;',
      ' justify-content:center;font-size:10px;line-height:1;color:transparent}',
      '.dssk-row[data-on="true"] .dssk-box{background:#4d6bfe;border-color:#4d6bfe;color:#fff}',
      '.dssk-name{flex:0 0 auto;font-family:var(--dsw-font-family-code,ui-monospace,Consolas,monospace);',
      ' font-size:12.5px;font-weight:600;color:var(--dsw-alias-link,#6f8bff);max-width:252px;overflow:hidden;',
      ' text-overflow:ellipsis;white-space:nowrap}',
      '.dssk-blurb{flex:1 1 auto;min-width:0;font-size:12px;color:var(--dsw-alias-label-secondary,#b9bac1);',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dssk-src{flex:0 0 auto;font-size:11px;color:var(--dsw-alias-label-caption,#6b6c74);max-width:152px;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dssk-foot{flex:0 0 auto;display:flex;align-items:center;gap:9px;padding:10px 0 12px;',
      ' border-top:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.2))}',
      '.dssk-sel{font-size:12px;color:var(--dsw-alias-label-tertiary,#8b8d95);margin-right:auto;',
      ' flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.dssk-btn{height:30px;padding:0 14px;font-size:12.5px;border-radius:8px;cursor:pointer;flex:0 0 auto;white-space:nowrap;',
      ' border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));',
      ' background:var(--dsw-alias-bg-layer-2,#1d1e23);color:var(--dsw-alias-label-primary,#f2f3f5)}',
      '.dssk-btn:hover{border-color:#4d6bfe;color:#6f8bff}',
      '.dssk-btn[data-kind="primary"]{background:#4d6bfe;border-color:#4d6bfe;color:#fff}',
      '.dssk-btn[data-kind="primary"]:hover{background:#5c79ff;border-color:#5c79ff;color:#fff}',
      '.dssk-btn:disabled,.dssk-btn[data-kind="primary"]:disabled{background:#24262b;',
      ' border-color:rgba(127,127,127,.25);color:#6b6c74;cursor:default;filter:none}',
      '.dssk-empty{padding:26px 10px;text-align:center;color:var(--dsw-alias-label-tertiary,#8b8d95);font-size:12.5px}',
      '.dssk-toast{position:sticky;bottom:0;padding:8px 11px;font-size:12px;border-radius:6px 6px 0 0;',
      ' background:var(--dsw-alias-toast-bg,#242529);color:var(--dsw-alias-toast-label,#e6e7ea)}',
      '.dssk-pop{position:fixed;z-index:2147482000;display:flex;flex-direction:column;overflow:hidden;',
      ' border-radius:16px;border:1px solid rgba(127,127,127,.3);background:var(--dsw-alias-bg-base,#141519);',
      ' box-shadow:0 22px 56px rgba(0,0,0,.55);color:var(--dsw-alias-label-primary,#f2f3f5);',
      ' font-family:var(--dsw-font-family,system-ui,-apple-system,"Segoe UI",sans-serif);animation:dssk-pop .13s ease-out}',
      '@keyframes dssk-pop{from{opacity:0;transform:translateY(6px) scale(.985)}to{opacity:1;transform:none}}',
      '.dssk-pop .dssk-shell{max-width:none;padding:14px 16px 0}',
      '.dssk-x{flex:0 0 auto;width:24px;height:24px;border-radius:6px;border:0;background:none;cursor:pointer;',
      ' color:var(--dsw-alias-label-tertiary,#8b8d95);font-size:16px;line-height:1;padding:0;margin-left:6px}',
      '.dssk-x:hover{background:rgba(127,127,127,.16);color:var(--dsw-alias-label-primary,#f2f3f5)}',
      '.dssk-grip{position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;',
      ' background:linear-gradient(135deg,transparent 45%,rgba(127,127,127,.5) 46%,rgba(127,127,127,.5) 54%,transparent 55%,',
      ' transparent 64%,rgba(127,127,127,.5) 65%,rgba(127,127,127,.5) 73%,transparent 74%)}',
      '.dssk-settings{display:flex;flex-direction:column;gap:7px;padding:9px 2px 9px;margin-bottom:2px;',
      ' border-bottom:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.2))}',
      '.dssk-srow{display:flex;align-items:center;gap:8px;font-size:12px;',
      ' color:var(--dsw-alias-label-secondary,#a9aab2)}',
      '.dssk-sval{margin-left:auto;min-width:56px;text-align:right;font-size:12px;',
      ' font-family:var(--dsw-font-family-code,ui-monospace,Consolas,monospace);',
      ' color:var(--dsw-alias-label-primary,#f2f3f5)}',
      '.dssk-sbtn{width:24px;height:24px;padding:0;line-height:1;font-size:14px;border-radius:6px;cursor:pointer;',
      ' border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));',
      ' background:var(--dsw-alias-bg-layer-2,#1d1e23);color:inherit}',
      '.dssk-sbtn:hover{border-color:#4d6bfe;color:#6f8bff}',
    ]

    /** 用户偏好：窗口宽度、窗口高度（0 = 自适应）、整体字号比例。存 localStorage。 */
    const PREFS_KEY = 'dsh-skill-panel:prefs'
    const PREF_DEFAULTS = { width: 600, height: 0, scale: 1 }
    const prefs = Object.assign({}, PREF_DEFAULTS, (() => {
      try { return JSON.parse(window.localStorage.getItem(PREFS_KEY) || '{}') || {} } catch (err) { return {} }
    })())

    const uiListeners = new Set()

    function clampPrefs() {
      prefs.width = Math.max(360, Math.min(1000, Math.round(Number(prefs.width) || 600)))
      prefs.height = prefs.height ? Math.max(320, Math.round(Number(prefs.height))) : 0
      prefs.scale = Math.max(0.85, Math.min(1.6, Math.round((Number(prefs.scale) || 1) * 20) / 20))
    }

    /** 改偏好：夹紧范围、落盘、重刷样式、通知气泡重画。 */
    function setPrefs(patch) {
      Object.assign(prefs, patch || {})
      clampPrefs()
      try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch (err) { /* noop */ }
      injectStyle()
      for (const fn of Array.from(uiListeners)) { try { fn() } catch (err) { /* noop */ } }
    }
    clampPrefs()

    /** 所有 px 尺寸乘上字号比例——字变大时内外边距、圆角、行高一起等比放大。 */
    function cssText() {
      const scale = prefs.scale
      if (!scale || scale === 1) return CSS.join('')
      const round = (v) => Math.round(v * 100) / 100
      return CSS.map((chunk) => chunk.replace(/(\d+(?:\.\d+)?)px/g, (m, n) => round(Number(n) * scale) + 'px')).join('')
    }

    /** 幂等注入样式；HMR 更新代码、或用户改字号时，把老标签内容换掉。 */
    function injectStyle() {
      const text = cssText()
      let tag = document.getElementById(STYLE_ID)
      if (!tag) {
        tag = document.createElement('style')
        tag.id = STYLE_ID
        document.head.appendChild(tag)
      }
      if (tag.textContent !== text) tag.textContent = text
    }

    /** 该技能要写进输入框的指令：DSH 里 /技能名 就是加载该技能的字面写法。 */
    function directiveFor(skill) {
      return '/' + skill.name + ' '
    }

    function findComposer() {
      for (const sel of COMPOSER_SELECTORS) {
        const el = document.querySelector(sel)
        if (el) return el
      }
      return null
    }

    /** 输入框里是否只有「/技能名」串（说明是我们写进去的那一段，可以整段替换）。 */
    function isPureTokenBlock(text) {
      const s = String(text || '').trim()
      if (!s) return false
      return s.split(/\s+/).every((part) => /^\/[^\s/]+$/.test(part))
    }

    function composerTextOf(el) {
      try { return String(el.innerText || el.textContent || '') } catch (err) { return '' }
    }

    /** 把文本塞进输入框；成功返回 true。只用一个策略，避免重复插入。 */
    /** 插入调试：只在失败时把现场 POST 给宿主，方便没有 DevTools 时定位。 */
    function reportDebug(payload) {
      try {
        fetch(BASE + '/report.json', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(Object.assign({ at: new Date().toISOString(), kind: 'insert' }, payload)),
        }).catch(() => {})
      } catch (err) { /* noop */ }
    }

    function tokenOfName(name) {
      return '/' + name + ' '
    }

    /** 读出输入框里已经写进去的 /技能名（别的文字忽略）。 */
    function composerTokens(el) {
      const raw = String(composerTextOf(el) || '').trim()
      if (!raw) return []
      return raw.split(/\s+/)
        .filter((part) => /^\/[^\s/]+$/.test(part))
        .map((part) => part.slice(1))
    }

    function caretToEnd(el) {
      try {
        const sel = window.getSelection()
        if (!sel) return
        const range = document.createRange()
        range.selectNodeContents(el)
        range.collapse(false)
        sel.removeAllRanges()
        sel.addRange(range)
      } catch (err) { /* noop */ }
    }

    /**
     * 把文本插到输入框末尾；成功返回 true。
     * 只用「光标落到末尾 + execCommand('insertText')」这一条路：Lexical 不认 DOM 选区，
     * 也不认 paste/beforeinput，叠加多种策略只会插进多份。
     */
    function insertIntoComposer(text) {
      const el = findComposer()
      if (!el) return false
      try { el.focus() } catch (err) { /* noop */ }
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        const value = String(el.value || '')
        const start = typeof el.selectionStart === 'number' ? el.selectionStart : value.length
        const end = typeof el.selectionEnd === 'number' ? el.selectionEnd : value.length
        el.setRangeText(text, start, end, 'end')
        el.dispatchEvent(new Event('input', { bubbles: true }))
        return String(el.value || '').length > value.length
      }
      const norm = (v) => String(v || '').replace(/\s+/g, ' ').trim()
      const before = norm(composerTextOf(el))
      const want = norm(text)
      caretToEnd(el)
      let executed = false
      try { executed = document.execCommand('insertText', false, text) } catch (err) { executed = false }
      // Lexical 的 DOM 更新是异步的，读回校验不可靠（明明插进去了，innerText 还是空的），
      // 所以只认 execCommand 的返回值；返回 true 就认定成功，绝不再叠加别的策略。
      if (executed) return true
      const after = norm(composerTextOf(el))
      if (after !== before && after.endsWith(want)) return true
      const act = document.activeElement
      const sel = window.getSelection()
      const anchor = sel && sel.rangeCount ? sel.anchorNode : null
      reportDebug({
        ok: false, executed,
        el: el.tagName + '|ce=' + el.isContentEditable + '|' + String(el.className || '').slice(0, 60),
        act: act ? (act.tagName + '|ce=' + act.isContentEditable + '|' + String(act.className || '').slice(0, 50)) : 'none',
        selIn: anchor ? (el.contains(anchor) ? 'in' : 'out:' + anchor.nodeName) : 'no-sel',
        before: before.slice(0, 160), want: want.slice(0, 160), after: after.slice(0, 200),
      })
      return false
    }

    /**
     * 把一批技能名写进输入框：只补「输入框里还没有的」，所以重复点也不会叠加。
     * 返回 'inserted' | 'exists' | 'failed'。
     */
    function deliverTokens(names) {
      return new Promise((resolve) => {
        let settled = false
        const finish = (value) => { if (!settled) { settled = true; resolve(value) } }
        const attempt = () => {
          const el = findComposer()
          if (!el) return false
          const have = new Set(composerTokens(el))
          const missing = names.filter((name) => !have.has(name))
          if (!missing.length) { finish('exists'); return true }
          const text = missing.map(tokenOfName).join('')
          finish(insertIntoComposer(text) ? 'inserted' : 'failed')
          return true
        }
        if (attempt()) return
        backToConversation()
        let tries = 0
        const timer = setInterval(() => {
          tries += 1
          if (attempt()) { clearInterval(timer); return }
          if (tries > 16) { clearInterval(timer); finish('failed') }
        }, 150)
      })
    }

    async function copyText(text) {
      try { await navigator.clipboard.writeText(text); return true } catch (err) { return false }
    }

    /* ------------------------------------------------------------ 图标 */

    function PanelIcon() {
      return h('svg', {
        width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': 'true',
      },
        h('path', { d: 'M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z' }),
        h('path', { d: 'M18.5 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1z' }),
      )
    }

    /* ------------------------------------------------------------ 悬浮气泡 */

    let kernelCtx = null

    /** 诊断信息：只在气泡底部显示一行，方便没有 DevTools 时定位问题。 */
    let bubbleDiag = ''

    /** 找一个能切面板的 layout 服务：不同版本挂在 ctx.layout 或 ctx.get('layout') 上。 */
    function resolveLayout() {
      const notes = []
      try {
        if (kernelCtx && typeof kernelCtx.get === 'function') {
          const l = kernelCtx.get('layout')
          if (l) return { layout: l, notes }
          notes.push('get(layout)=null')
        } else notes.push('no ctx.get')
      } catch (err) { notes.push('ctx.get:' + String((err && err.message) || err)) }
      try {
        if (kernelCtx && kernelCtx.layout) return { layout: kernelCtx.layout, notes }
      } catch (err) { notes.push('ctx.layout:' + String((err && err.message) || err)) }
      return { layout: null, notes }
    }

    /** 回会话：气泡是浮层，主区域不该停在别的面板上。 */
    function backToConversation() {
      const res = resolveLayout()
      const notes = res.notes.slice()
      if (!res.layout) { bubbleDiag = 'no layout (' + notes.join(' ') + ')'; return }
      try {
        res.layout.selectPanel(null)
        bubbleDiag = ''
      } catch (err) { bubbleDiag = 'selectPanel: ' + String((err && err.message) || err) }
    }

    /** 选中的技能放在模块作用域：气泡关掉再打开还留着，方便回头取消。 */
    const selectedSkills = new Set()

    /** 技能列表缓存：打开气泡先用旧数据秒开，再静默重拉一遍（新装的技能就会自动出现）。 */
    const listCache = { data: null, error: '', loading: false }

    /** 重新读一遍技能列表。宿主那边每次请求都重新扫盘，所以这里拿到的一定是最新的。 */
    async function loadList() {
      if (listCache.loading) return listCache
      listCache.loading = true
      try {
        const res = await fetch(BASE + '/list.json?t=' + Date.now(), { cache: 'no-store' })
        const payload = await res.json()
        if (!payload || !payload.ok) throw new Error((payload && payload.error) || '读取失败')
        listCache.data = { groups: payload.groups || [], total: payload.total || 0 }
        listCache.error = ''
      } catch (err) {
        listCache.error = String((err && err.message) || err)
      } finally {
        listCache.loading = false
      }
      return listCache
    }

    /**
     * 功能分类。宿主只区分「装的我 / 内置的」，这里再按名字、简介里的关键词分桶，
     * 所以以后新装的技能不用改代码也会自动落进合适的组（认不出来就进「其他」）。
     * 顺序即显示顺序；名字比简介可信，先看名字，再看简介。
     */
    const CATEGORY_DEFS = [
      {
        id: 'design', label: '设计与前端', order: 10,
        name: /(^|[-_])(ui|ux|design|redesign|restyle|visual|layout|frontend|front-end|web|css|html|theme|landing|page|style)([-_]|$)|brand|logo/i,
        text: /设计|前端|界面|视觉|品牌|版式|配色|落地页|作品集|样式|主题|\bdesign|frontend|front-end|brand kit/i,
      },
      {
        id: 'motion', label: '动效 / GSAP', order: 20,
        name: /gsap|motion|anim|scroll|tween|timeline|transition/i,
        text: /动效|动画|滚动|缓动|\banimat|\bmotion\b|gsap/i,
      },
      {
        id: 'office', label: '办公文档', order: 30,
        name: /office|docx|xlsx|excel|word|sheet|pdf|spreadsheet/i,
        text: /文档|表格|工作簿|电子表格|excel|word|pdf/i,
      },
      {
        id: 'slides', label: '演示文稿', order: 40,
        name: /ppt|pptx|slide|deck|presentation|keynote/i,
        text: /演示|幻灯片|课件|路演|ppt|slide deck|presentation/i,
      },
      {
        id: 'image', label: '图像与视觉', order: 50,
        name: /image|img|photo|picture|vision|ocr|sketch|render|screenshot/i,
        text: /图片|图像|截图|照片|ocr|图像生成|插画|视觉质量|image generat|screenshot|\bphoto/i,
      },
      {
        id: 'search', label: '联网与检索', order: 60,
        name: /search|browse|crawl|fetch|modsearch/i,
        text: /搜索|检索|联网|网页|抓取|\bweb search|\bcrawl/i,
      },
      {
        id: 'workflow', label: '规范与工具', order: 70,
        name: /enforce|sandbox|acl|debug|diagnose|fix|lint|review|loop|template|helper/i,
        text: /规范|约束|输出|沙箱|调试|诊断|校验|工具|\bsandbox|\bdebug|\blint/i,
      },
    ]

    const OTHER_CATEGORY = { id: 'other', label: '其他', order: 99 }

    function categoryOf(skill) {
      const name = String(skill.name || '')
      const text = String(skill.blurb || '') + ' ' + String(skill.detail || '')
      for (const def of CATEGORY_DEFS) if (def.name.test(name)) return def
      for (const def of CATEGORY_DEFS) if (def.text.test(text)) return def
      return OTHER_CATEGORY
    }

    /** 把宿主的两组摊平后按功能重新分组；同一个 data 只算一次。 */
    const groupedCache = { data: null, groups: [] }
    function categorizedGroups(data) {
      if (!data) return []
      if (groupedCache.data === data) return groupedCache.groups
      const buckets = new Map()
      for (const group of data.groups || []) {
        for (const skill of group.items || []) {
          const category = categoryOf(skill)
          if (!buckets.has(category.id)) buckets.set(category.id, { id: category.id, label: category.label, order: category.order, items: [] })
          buckets.get(category.id).items.push(skill)
        }
      }
      const groups = Array.from(buckets.values()).sort((a, b) => a.order - b.order)
      for (const group of groups) group.items.sort((a, b) => String(a.name).localeCompare(String(b.name)))
      groupedCache.data = data
      groupedCache.groups = groups
      return groups
    }

    const bubble = { open: false, listeners: new Set() }

    function setBubbleOpen(open) {
      bubble.open = !!open
      for (const fn of Array.from(bubble.listeners)) { try { fn(bubble.open) } catch (err) { /* noop */ } }
    }

    /** 侧栏里「技能」那一行；气泡贴着它弹出。 */
    function sidebarRow() {
      try {
        const buttons = Array.from(document.querySelectorAll('button[aria-label]'))
        return buttons.find((b) => b.getAttribute('aria-label') === '技能') || null
      } catch (err) { return null }
    }

    /** 气泡的位置与大小：贴住侧栏那一行的右侧，宽度/高度用用户偏好，越界时往回收。 */
    function cardStyle() {
      const row = sidebarRow()
      const rect = row ? row.getBoundingClientRect() : null
      const anchor = rect ? rect.right + 10 : 96
      const top = rect ? Math.max(12, Math.min(rect.top - 8, window.innerHeight - 260)) : 72
      const width = Math.min(Math.max(340, prefs.width), Math.max(340, window.innerWidth - anchor - 12))
      const left = Math.max(8, Math.min(anchor, window.innerWidth - width - 12))
      const room = Math.max(260, window.innerHeight - top - 18)
      const height = Math.min(prefs.height ? Math.max(320, prefs.height) : 700, room)
      const style = { left: left + 'px', top: top + 'px', width: width + 'px', maxHeight: height + 'px' }
      if (prefs.height) style.height = height + 'px'
      return style
    }

    function SkillRow(props) {
      const skill = props.skill
      return h('div', {
        className: 'dssk-row',
        'data-on': props.on ? 'true' : 'false',
        title: (skill.detail || skill.blurb || '') + '（点击切换选中）',
        onClick: () => props.onToggle(skill.name),
      },
        h('span', { className: 'dssk-box' }, props.on ? '✓' : ''),
        h('span', { className: 'dssk-name' }, skill.name),
        h('span', { className: 'dssk-blurb' }, skill.blurb || ''),
        skill.source ? h('span', { className: 'dssk-src' }, skill.source) : null,
      )
    }

    /** 气泡里的内容：搜索 + 分组列表 + 多选 + 写入输入框。 */
    function SkillsBody(props) {
      const [query, setQuery] = React.useState('')
      const [collapsed, setCollapsed] = React.useState({ other: true })
      const [data, setData] = React.useState(listCache.data)
      const [error, setError] = React.useState(listCache.error)
      const [loading, setLoading] = React.useState(false)
      const [selected, setSelected] = React.useState(() => new Set(selectedSkills))
      const [busy, setBusy] = React.useState(false)
      const [toast, setToast] = React.useState('')
      const [showSettings, setShowSettings] = React.useState(false)
      const [, bumpPrefs] = React.useReducer((n) => n + 1, 0)

      /** 字号 / 窗口大小变了要重画（偏好存在模块作用域，靠这个订阅触发）。 */
      React.useEffect(() => {
        uiListeners.add(bumpPrefs)
        return () => { uiListeners.delete(bumpPrefs) }
      }, [])

      /** 每次打开气泡都重拉一次：先用缓存秒开，拿到新列表后替换，新装的技能就自动进来了。 */
      const refresh = React.useCallback(async () => {
        setLoading(true)
        const cache = await loadList()
        if (cache.data) setData({ ...cache.data })
        setError(cache.error)
        setLoading(false)
      }, [])

      React.useEffect(() => { refresh() }, [refresh])

      const toggle = React.useCallback((name) => {
        setSelected((prev) => {
          const next = new Set(prev)
          if (next.has(name)) next.delete(name)
          else next.add(name)
          selectedSkills.clear()
          next.forEach((n) => selectedSkills.add(n))
          return next
        })
        setToast('')
      }, [])

      const clearAll = React.useCallback(() => {
        selectedSkills.clear()
        setSelected(new Set())
        setToast('已清空选择。')
      }, [])

      const writeAll = React.useCallback(async () => {
        if (busy) return
        const order = []
        const groupsAll = (data && data.groups) || []
        for (const g of groupsAll) for (const it of (g.items || [])) order.push(it.name)
        const names = order.filter((n) => selectedSkills.has(n))
        const rest = Array.from(selectedSkills).filter((n) => order.indexOf(n) < 0)
        const all = names.concat(rest)
        if (!all.length) { setToast('先点选技能（可以多选）。'); return }
        const text = all.map(tokenOfName).join('')
        setBusy(true)
        const res = await deliverTokens(all)
        setBusy(false)
        if (res === 'inserted') {
          setToast('已写进输入框：' + all.length + ' 个技能')
          window.setTimeout(() => { try { props.onClose() } catch (err) { /* noop */ } }, 280)
          return
        }
        if (res === 'exists') { setToast('这些技能已经在输入框里了，没有重复写入。'); return }
        const copied = await copyText(text)
        setToast(copied
          ? '没能直接写入输入框，指令已复制到剪贴板，粘贴即可。'
          : '没能写入输入框，也没能访问剪贴板。请手动输入 /技能名。')
      }, [busy, data])

      const q = query.trim().toLowerCase()
      const groups = categorizedGroups(data)
        .map((g) => ({
          ...g,
          items: g.items.filter((it) => !q
            || String(it.name || '').toLowerCase().includes(q)
            || String(it.blurb || '').toLowerCase().includes(q)
            || String(it.source || '').toLowerCase().includes(q)),
        }))
        .filter((g) => g.items.length > 0)

      const count = selected.size

      return h('div', { className: 'dssk-shell' },
        h('div', { className: 'dssk-head' },
          h('h2', { className: 'dssk-title' }, '技能'),
          h('p', { className: 'dssk-sub' }, data ? data.total + ' 个可用' : ''),
          h('button', {
            type: 'button', className: 'dssk-x', title: '窗口大小 / 字体大小',
            'aria-label': '显示设置', 'data-on': showSettings ? 'true' : 'false',
            onClick: () => setShowSettings((v) => !v),
          }, '⚙'),
          h('button', {
            type: 'button', className: 'dssk-x', title: '重新读取技能列表（新装的技能会出现在这里）',
            'aria-label': '刷新', 'data-spin': loading ? 'true' : 'false',
            onClick: refresh,
          }, loading ? '…' : '↻'),
          h('button', {
            type: 'button', className: 'dssk-x', title: '关闭（Esc）', 'aria-label': '关闭',
            onClick: () => props.onClose(),
          }, '×'),
        ),
        showSettings ? h('div', { className: 'dssk-settings' },
          h('div', { className: 'dssk-srow' },
            h('span', null, '窗口宽度'),
            h('button', { type: 'button', className: 'dssk-sbtn', title: '窄一点', onClick: () => setPrefs({ width: prefs.width - 40 }) }, '−'),
            h('button', { type: 'button', className: 'dssk-sbtn', title: '宽一点', onClick: () => setPrefs({ width: prefs.width + 40 }) }, '+'),
            h('span', { className: 'dssk-sval' }, prefs.width + ' px'),
          ),
          h('div', { className: 'dssk-srow' },
            h('span', null, '字体大小'),
            h('button', { type: 'button', className: 'dssk-sbtn', title: '小一点', onClick: () => setPrefs({ scale: prefs.scale - 0.05 }) }, '−'),
            h('button', { type: 'button', className: 'dssk-sbtn', title: '大一点', onClick: () => setPrefs({ scale: prefs.scale + 0.05 }) }, '+'),
            h('span', { className: 'dssk-sval' }, Math.round(prefs.scale * 100) + '%'),
          ),
          h('div', { className: 'dssk-srow' },
            h('span', { style: { opacity: .75 } }, '也能拖右下角改大小'),
            h('button', {
              type: 'button', className: 'dssk-btn', style: { marginLeft: 'auto' },
              onClick: () => setPrefs({ width: 600, height: 0, scale: 1 }),
            }, '恢复默认'),
          ),
        ) : null,
        h('input', {
          className: 'dssk-search',
          type: 'search',
          placeholder: '搜索技能名 / 简介 / 来源…',
          value: query,
          onChange: (e) => setQuery(e.target.value),
        }),
        h('div', { className: 'dssk-body' },
          !data && !error ? h('div', { className: 'dssk-empty' }, '正在读取技能列表…') : null,
          error ? h('div', { className: 'dssk-empty' }, '读取失败：' + error) : null,
          data && groups.length === 0
            ? h('div', { className: 'dssk-empty' }, q ? '没有匹配「' + query + '」的技能' : '没有可用技能')
            : null,
          groups.map((group) => h('div', { className: 'dssk-group', key: group.id },
            h('button', {
              type: 'button',
              className: 'dssk-grouphead',
              onClick: () => setCollapsed((prev) => ({ ...prev, [group.id]: !prev[group.id] })),
            },
              h('span', null, (collapsed[group.id] ? '▸ ' : '▾ ') + group.label),
              h('span', { className: 'dssk-count' }, '(' + group.items.length + ')'),
            ),
            collapsed[group.id] ? null : group.items.map((skill) => h(SkillRow, {
              key: skill.name,
              skill,
              on: selected.has(skill.name),
              onToggle: toggle,
            })),
          )),
        ),
        h('div', { className: 'dssk-foot' },
          h('span', { className: 'dssk-sel' }, count ? '已选 ' + count + ' 个' : '点一行选中，可多选'),
          bubbleDiag ? h('span', { className: 'dssk-sel', style: { color: '#e08a8a' } }, '⚠ ' + bubbleDiag) : null,
          h('button', { type: 'button', className: 'dssk-btn', disabled: count === 0, onClick: clearAll }, '清空'),
          h('button', {
            type: 'button', className: 'dssk-btn', 'data-kind': 'primary',
            disabled: count === 0 || busy,
            onClick: writeAll,
          }, busy ? '写入中…' : '写入输入框'),
        ),
        toast ? h('div', { className: 'dssk-toast', onClick: () => setToast('') }, toast) : null,
      )
    }

    /** 浮层本体：挂在 shell.overlay 上，所以永远盖在界面上，不占主区域。 */
    function SkillsBubble() {
      const [open, setOpen] = React.useState(bubble.open)
      const [style, setStyle] = React.useState(null)
      const cardRef = React.useRef(null)
      const dragRef = React.useRef(null)

      React.useEffect(() => {
        const fn = (v) => setOpen(v)
        bubble.listeners.add(fn)
        return () => { bubble.listeners.delete(fn) }
      }, [])

      React.useEffect(() => {
        if (!open) return undefined
        setStyle(cardStyle())
        /** 改字号 / 改宽度 / 窗口 resize 都要重算位置和大小。 */
        const sync = () => setStyle(cardStyle())
        uiListeners.add(sync)
        const onKey = (e) => { if (e.key === 'Escape') setBubbleOpen(false) }
        const onDown = (e) => {
          const target = e.target
          if (!(target instanceof Node)) return
          if (cardRef.current && cardRef.current.contains(target)) return
          const row = sidebarRow()
          if (row && row.contains(target)) return
          setBubbleOpen(false)
        }
        window.addEventListener('resize', sync)
        document.addEventListener('keydown', onKey, true)
        document.addEventListener('mousedown', onDown, true)
        return () => {
          uiListeners.delete(sync)
          window.removeEventListener('resize', sync)
          document.removeEventListener('keydown', onKey, true)
          document.removeEventListener('mousedown', onDown, true)
        }
      }, [open])

      /** 右下角拖拽改大小：拖多少就把 prefs.width / prefs.height 改成多少。 */
      React.useEffect(() => {
        const onMove = (e) => {
          const drag = dragRef.current
          if (!drag) return
          const width = Math.round(drag.width + (e.clientX - drag.x))
          const height = Math.round(drag.height + (e.clientY - drag.y))
          setPrefs({ width, height: Math.min(height, window.innerHeight - 40) })
        }
        const stop = () => {
          if (!dragRef.current) return
          dragRef.current = null
          document.body.style.cursor = ''
          document.body.style.userSelect = ''
        }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', stop)
        window.addEventListener('pointercancel', stop)
        return () => {
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', stop)
          window.removeEventListener('pointercancel', stop)
        }
      }, [])

      const onGripDown = (e) => {
        const box = cardRef.current ? cardRef.current.getBoundingClientRect() : null
        if (!box) return
        e.preventDefault()
        dragRef.current = { x: e.clientX, y: e.clientY, width: box.width, height: box.height }
        document.body.style.cursor = 'nwse-resize'
        document.body.style.userSelect = 'none'
      }

      if (!open) return null
      return h('div', { className: 'dssk-pop', style: style || undefined, ref: cardRef },
        h(SkillsBody, { onClose: () => setBubbleOpen(false) }),
        h('div', {
          className: 'dssk-grip', title: '拖动改变窗口大小（双击恢复默认）',
          onPointerDown: onGripDown,
          onDoubleClick: () => setPrefs({ width: 600, height: 0 }),
        }))
    }

    /** 侧栏那一行点下去会切 main 面板；这个占位组件立刻切回会话并弹出气泡，所以看不到「页面」。 */
    function SkillsLauncher() {
      React.useLayoutEffect(() => {
        setBubbleOpen(true)
        backToConversation()
      }, [])
      return null
    }

    return {
      inject: ['slots', 'layout'],
      apply(ctx) {
        kernelCtx = ctx
        const disposers = []
        try { injectStyle() } catch (err) { console.warn('[dsh-skill-panel] 样式注入失败：', err) }
        // 清掉历史版本遗留的诊断浮层（旧版把报告画成 fixed 层）
        try {
          for (const el of Array.from(document.body ? document.body.children : [])) {
            const txt = (el.textContent || '').slice(0, 40)
            if (/^\s*DSSK/.test(txt) || /^\s*\{/.test(txt) && /injected|panellistEntries/.test(el.textContent || '')) el.remove()
          }
        } catch (err) { /* noop */ }

        const registerInto = (slot, spec, component) => {
          try {
            const out = ctx.slots.inject(slot, () => ctx.slots.register(spec, component))
            disposers.push(out)
          } catch (err) {
            console.error('[dsh-skill-panel] 注册 ' + slot + ' 失败：', err)
          }
        }
        registerInto('sidebar.panellist', { name: 'sidebar.panellist', id: PANEL_ID, order: 1, label: () => '技能' }, PanelIcon)
        registerInto('main', { name: 'main', key: PANEL_ID }, SkillsLauncher)
        registerInto('shell.overlay', { name: 'shell.overlay', id: 'session-skills-bubble' }, SkillsBubble)

        ctx.effect(() => () => {
          for (const d of disposers) { try { if (typeof d === 'function') d() } catch (err) { /* noop */ } }
          setBubbleOpen(false)
        })
      },
    }
  },
})
