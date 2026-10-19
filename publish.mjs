#!/usr/bin/env node
// 用 GitHub REST API 发布 dsh-skill-panel：建仓库 → 上传文件 → 建 release（可选 zip 附件）。
// 不需要本机装 git / gh。
//
//   node publish.mjs --owner 你的账号 --repo dsh-skill-panel --zip ../dsh-skill-panel-v1.0.0.zip
//   node publish.mjs --owner 你的账号 --dry-run
//
// token 取 --token 或环境变量 GITHUB_TOKEN / GH_TOKEN（需要 repo 权限）。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = { repo: 'dsh-skill-panel', dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    if (key === 'dry-run') { out.dryRun = true; continue; }
    if (key === 'private') { out.private = true; continue; }
    out[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = argv[++i];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
// tag 默认取 package.json 的 version，避免忘了 --tag 时把新包挂到旧 release 上
if (!args.tag) {
  try { args.tag = 'v' + JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version }
  catch (err) { args.tag = 'v1.0.0' }
}
const token = args.token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const SKIP = /(^|\/)(node_modules|\.git|\.tmp[^/]*)(\/|$)|\.(zip|bak|log)$|^\.DS_Store$/;

function listFiles(dir = ROOT, rel = '', acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const relPath = rel ? rel + '/' + e.name : e.name;
    if (SKIP.test(relPath)) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) listFiles(abs, relPath, acc);
    else acc.push(relPath);
  }
  return acc;
}

async function api(method, url, body, raw) {
  const headers = {
    Authorization: 'Bearer ' + token,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'dsh-skill-panel-publish',
  };
  if (raw) headers['Content-Type'] = raw.type;
  else if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, {
    method,
    headers,
    body: raw ? raw.content : body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

function transform(rel, text, owner, repo) {
  if (rel === 'README.md') return text.split('OWNER').join(owner);
  if (rel === 'package.json') {
    const j = JSON.parse(text);
    j.repository = { type: 'git', url: 'git+https://github.com/' + owner + '/' + repo + '.git' };
    j.homepage = 'https://github.com/' + owner + '/' + repo + '#readme';
    j.bugs = { url: 'https://github.com/' + owner + '/' + repo + '/issues' };
    delete j.private;
    return JSON.stringify(j, null, 2) + '\n';
  }
  return text;
}

const TEXT = /\.(md|json|yml|yaml|js|mjs|ps1|svg|txt|gitignore)$/;

const INSTALL_YAML = ['- insert:', '    - id: skill-panel', '      name: dsh-skill-panel'].join('\n');

async function main() {
  const files = listFiles();
  console.log('文件: ' + files.length + ' 个');
  for (const f of files) console.log('  · ' + f);
  if (args.zip) console.log('release 附件: ' + args.zip + ' @ ' + args.tag);
  if (args.dryRun) { console.log('\n[dry-run] 不发任何请求。'); return; }
  if (!args.owner) throw new Error('缺少 --owner（你的 GitHub 用户名）');
  if (!token) throw new Error('缺少 token：用 --token 或设置 GITHUB_TOKEN');

  const me = await api('GET', 'https://api.github.com/user');
  if (!me.ok) throw new Error('token 校验失败 ' + me.status + '：' + JSON.stringify(me.data));
  const owner = args.owner;
  const repo = args.repo;
  console.log('登录: ' + me.data.login + '（发布到 ' + owner + '/' + repo + '）');

  const repoUrl = 'https://api.github.com/repos/' + owner + '/' + repo;
  const existing = await api('GET', repoUrl);
  if (existing.status === 404) {
    const created = await api('POST', 'https://api.github.com/user/repos', {
      name: repo,
      description: 'DSH 技能面板：左侧导航加一行「技能」，悬浮气泡按功能分类列出全部技能，多选一键写入输入框。',
      private: Boolean(args.private),
      has_issues: true,
      has_wiki: false,
      auto_init: false,
    });
    if (!created.ok) throw new Error('建仓库失败 ' + created.status + '：' + JSON.stringify(created.data));
    console.log('已创建仓库：' + created.data.html_url);
  } else if (existing.ok) {
    console.log('仓库已存在：' + existing.data.html_url);
  } else {
    throw new Error('读取仓库失败 ' + existing.status + '：' + JSON.stringify(existing.data));
  }

  let n = 0;
  for (const rel of files) {
    const abs = path.join(ROOT, rel);
    let buf = fs.readFileSync(abs);
    if (TEXT.test(rel)) {
      const before = buf.toString('utf8');
      const after = transform(rel, before, owner, repo);
      if (after !== before) buf = Buffer.from(after, 'utf8');
    }
    const apiPath = 'https://api.github.com/repos/' + owner + '/' + repo + '/contents/' +
      rel.split('/').map(encodeURIComponent).join('/');
    const head = await api('GET', apiPath);
    const body = { message: 'sync ' + rel, content: buf.toString('base64') };
    if (head.ok && head.data && head.data.sha) body.sha = head.data.sha;
    const put = await api('PUT', apiPath, body);
    if (!put.ok) throw new Error('上传 ' + rel + ' 失败 ' + put.status + '：' + JSON.stringify(put.data));
    n++;
    console.log('  ✓ ' + rel + (body.sha ? ' (更新)' : ' (新增)'));
  }
  console.log('上传完成：' + n + ' 个文件');

  if (args.zip) {
    const tag = args.tag;
    let rel = await api('GET', repoUrl + '/releases/tags/' + encodeURIComponent(tag));
    if (rel.status === 404) {
      rel = await api('POST', repoUrl + '/releases', {
        tag_name: tag,
        name: 'dsh-skill-panel ' + tag,
        body: [
          '给 DSH 左侧导航加一行「技能」。',
          '',
          '## 安装',
          '',
          '```powershell',
          'powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1',
          '```',
          '',
          '或作为依赖加进 profile：`github:' + owner + '/' + repo + '#' + tag + '`，并在 `cordis.patch.yml` 里加：',
          '',
          '```yaml',
          INSTALL_YAML,
          '```',
          '',
          '装完重启一次 DSH。',
        ].join('\n'),
      });
      if (!rel.ok) throw new Error('建 release 失败 ' + rel.status + '：' + JSON.stringify(rel.data));
      console.log('已建 release：' + rel.data.html_url);
    } else if (rel.ok) {
      console.log('release 已存在：' + rel.data.html_url);
    }

    if (rel.ok && fs.existsSync(args.zip)) {
      const zipBuf = fs.readFileSync(args.zip);
      const uploadUrl = 'https://uploads.github.com/repos/' + owner + '/' + repo +
        '/releases/' + rel.data.id + '/assets?name=' + encodeURIComponent(path.basename(args.zip));
      const up = await api('POST', uploadUrl, null, { type: 'application/zip', content: zipBuf });
      console.log(up.ok ? '已上传附件：' + up.data.browser_download_url : '附件上传失败 ' + up.status + '：' + JSON.stringify(up.data));
    }
  }

  console.log('\n完成：https://github.com/' + owner + '/' + repo);
}

main().catch((err) => {
  console.error('失败：' + err.message);
  process.exit(1);
});
