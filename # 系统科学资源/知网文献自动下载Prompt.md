# 知网文献自动下载 Prompt

## 使用说明

此 Prompt 用于通过 Chrome DevTools MCP 工具自动下载知网文献并保存到指定文件夹。

## 前置条件

1. 已安装并配置 Chrome DevTools MCP 工具
2. 已在浏览器中打开知网搜索结果页面
3. 已通过杭州图书馆VPN登录知网

## 标准工作流

### 步骤1：打开知网搜索页面
```
使用Chrome MCP打开知网搜索结果页：
http://sq.zjhzlib.cn/https/vpn/2/NNYHGLUDN3WXTLUPMW4A/kns8s/defaultresult/index?[搜索参数]
```

### 步骤2：自动下载文献（单个）

**操作流程：**
1. 获取列表页快照（take_snapshot）
2. 点击文献标题链接 → 在新标签页打开详情页
3. 切换到详情页（select_page）
4. 获取详情页快照，找到 "PDF下载" 按钮的 uid
5. 点击 "PDF下载" 按钮
6. PDF自动下载到 `~/Downloads/` 目录

### 步骤3：批量下载文献

**循环执行步骤2**，针对第N个文献：
- 从列表页快照中找到第N个文献的标题链接uid
- 点击打开详情页
- 切换到新标签页
- 点击PDF下载
- 返回列表页

### 步骤4：移动下载的文件

等待下载完成后，批量移动文件：
```bash
mv ~/Downloads/*.pdf "/目标路径/"
```

或使用时间过滤移动最近下载的文件：
```bash
find ~/Downloads -name "*.pdf" -mmin -10 -exec mv {} "/目标路径/" \;
```

## 优化方案

### 关键发现
- ✅ 知网自动按 `标题_作者.pdf` 格式命名文件
- ❌ 列表页的"下载"按钮会先跳转到详情页（测试发现）
- ⚠️ 每个详情页会创建新标签页，需注意标签页累积

### 改进点

#### 1. 批量并行打开页面（推荐）⭐

**核心思路：** 一次性打开多个详情页，然后依次切换页面点击下载，大幅减少等待时间。

**实施步骤：**

1. 在列表页使用JavaScript获取文献详情页链接：
```javascript
evaluate_script: () => {
  const rows = document.querySelectorAll('table.result-table-list tbody tr');
  const links = [];
  for (let i = startIdx; i < endIdx; i++) {
    const titleLink = rows[i].querySelector('a.fz14');
    if (titleLink) {
      links.push({
        index: i + 1,
        title: titleLink.textContent.trim(),
        href: titleLink.href
      });
    }
  }
  return links;
}
```

2. 使用 `window.open` 批量打开5个详情页：
```javascript
evaluate_script: (links) => {
  links.forEach(link => {
    window.open(link.href, '_blank');
  });
  return `已打开 ${links.length} 个页面`;
}
```

3. 依次切换到每个新打开的页面并下载：
```
for each new page:
  - select_page(pageIdx)
  - take_snapshot()
  - 找到 "PDF下载" 按钮的 uid
  - click(uid)
  - 等待2-3秒
```

4. 清理已用标签页（可选）：
```
使用 close_page(pageIdx) 关闭已下载的详情页
```

**优势：**
- ⚡ 并行加载页面，节省等待时间
- 🎯 适合批量下载5-10篇文献
- 🔄 减少页面切换次数

**注意事项：**
- 建议一次打开不超过10个页面，避免浏览器负载过高
- 知网可能有并发限制，注意控制频率

#### 2. 自动文件移动
在下载前启动后台监控脚本，实时移动PDF文件：

```bash
# 后台运行文件监控
inotifywait -m ~/Downloads/ -e close_write --format '%f' | 
while read file; do
  if [[ "$file" == *.pdf ]]; then
    mv ~/Downloads/"$file" "/目标路径/"
  fi
done &

# 记录进程ID以便后续停止
echo $! > /tmp/cnki_download_monitor.pid
```

停止监控：
```bash
kill $(cat /tmp/cnki_download_monitor.pid)
rm /tmp/cnki_download_monitor.pid
```

#### 3. 关闭已用标签页
下载完成后关闭详情页标签，避免累积：
```
使用 close_page(pageIdx) 关闭已使用的详情页
保留列表页(pageIdx=0)用于继续下载
```

## 使用示例

### 示例命令（给AI）

```
使用Chrome MCP工具：
1. 打开知网搜索页面：[URL]
2. 下载第1-5个文献的PDF
3. 保存到：/home/qiao/Desktop/Git Repo/Creating-Systematology/# 系统科学资源/文献PDF/钱学森-作者-相关资料（总库299）/
```

### 完整自动化流程（给AI）

**方法一：批量并行打开（推荐）**
```
1. 在列表页使用evaluate_script获取第N-M个文献的详情页链接
2. 使用evaluate_script批量打开所有详情页（window.open）
3. 等待3-5秒让页面加载
4. 使用list_pages查看所有打开的页面
5. 依次切换到每个详情页：
   - select_page(pageIdx)
   - take_snapshot()
   - 点击PDF下载按钮
   - 等待2秒
6. 批量移动下载的文件到目标路径
7. 清理已用标签页（可选）
```

**方法二：串行逐个下载（传统方式）**
```
1. 启动文件监控脚本（后台运行）
2. 获取知网列表页快照
3. 循环下载文献：
   - 点击第N个文献标题
   - 切换到新标签页
   - 点击PDF下载
   - 关闭详情页标签
   - 返回列表页
4. 等待所有下载完成
5. 停止文件监控脚本
6. 确认文件已全部移动
```

## 目标路径配置

当前默认路径：
```
/home/qiao/Desktop/Git Repo/Creating-Systematology/# 系统科学资源/文献PDF/钱学森-作者-相关资料（总库299）/
```

可根据不同搜索修改为其他子文件夹。

## 注意事项

1. 每次下载间隔建议2-3秒，避免触发知网反爬机制
2. 检查文件大小确认下载完整（知网文件通常>50KB）
3. 列表页会在新标签打开详情页，需定期清理标签
4. 下载失败时检查VPN连接和登录状态

## 技术细节

- **Chrome MCP工具**：使用 `chrome-devtools-mcp` (通过npx运行)
- **文件命名**：知网自动命名为 `文献标题_第一作者.pdf`
- **下载位置**：Chrome默认 `~/Downloads/` 目录
- **移动方式**：bash `mv` 命令批量移动或inotify实时监控

## 完整代码示例

### 批量并行下载示例（第11-15篇）

```javascript
// 步骤1：获取文献链接
const links = await evaluate_script(() => {
  const rows = document.querySelectorAll('table.result-table-list tbody tr');
  const links = [];
  for (let i = 10; i < 15; i++) {  // 第11-15篇（索引10-14）
    const titleLink = rows[i]?.querySelector('a.fz14');
    if (titleLink) {
      links.push({
        index: i + 1,
        title: titleLink.textContent.trim(),
        href: titleLink.href
      });
    }
  }
  return links;
});

// 步骤2：批量打开详情页
await evaluate_script(() => {
  const links = /* 传入上一步的links */;
  links.forEach(link => {
    window.open(link.href, '_blank');
  });
  return `已打开 ${links.length} 个详情页`;
});

// 步骤3：等待页面加载
await sleep(5000);  // 等待5秒

// 步骤4：依次切换页面并下载
const pages = await list_pages();
for (let i = 1; i < pages.length; i++) {  // 跳过索引0的列表页
  await select_page(i);
  const snapshot = await take_snapshot();
  
  // 查找PDF下载按钮（uid包含"PDF下载"）
  const downloadBtn = snapshot.find(el => el.text === 'PDF下载');
  
  if (downloadBtn) {
    await click(downloadBtn.uid);
    await sleep(2000);  // 等待2秒让下载开始
  }
}

// 步骤5：移动文件
await run_terminal_cmd(`
  find ~/Downloads -name "*.pdf" -mmin -10 -exec mv {} "/目标路径/" \\;
`);
```

### 注意事项

1. **页面索引变化**：批量打开页面后，list_pages返回的索引会变化，需要重新获取
2. **下载间隔**：建议每次点击下载后等待2-3秒，避免触发知网限制
3. **错误处理**：部分文献可能没有PDF，需要检查按钮是否存在
4. **清理标签**：下载完成后建议关闭详情页标签，避免浏览器占用过多资源

