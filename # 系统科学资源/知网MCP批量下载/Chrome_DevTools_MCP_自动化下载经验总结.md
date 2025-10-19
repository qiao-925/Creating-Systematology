# Chrome DevTools MCP 自动化下载经验总结

**文档目的**: 记录使用Chrome DevTools MCP进行知网文献自动下载的完整经验，供未来类似任务复用。

---

## 🎯 任务概述

**目标**: 使用Chrome DevTools MCP自动化工具批量下载CNKI（中国知网）学术文献

**工具链**:
- Chrome DevTools MCP (chrome-devtools-mcp)
- Python脚本（文件管理）
- Windows PowerShell（终端操作）

---

## 📚 核心工作流程

### 1. 页面导航与内容提取

```javascript
// 1.1 打开搜索结果页面
mcp_chrome-devtools_new_page({
  url: "知网搜索结果URL",
  timeout: 30000
})

// 1.2 获取页面快照
mcp_chrome-devtools_take_snapshot()

// 1.3 提取文献链接
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

### 2. 批量打开详情页

**策略**: 批量并行打开详情页 + 逐个下载PDF

```javascript
// 批量打开20个详情页
evaluate_script: (links) => {
  links.forEach(link => {
    window.open(link.href, '_blank');
  });
  return `已打开 ${links.length} 个页面`;
}
```

**优势**:
- ✅ 并行加载，节省时间
- ✅ 可以一次性打开多个页面
- ✅ 适合批量处理

**注意事项**:
- ⚠️ 一次不要打开太多页面（建议10-20个）
- ⚠️ 打开后需要等待页面加载

### 3. 逐个下载PDF

```javascript
// 3.1 列出所有页面
mcp_chrome-devtools_list_pages()

// 3.2 切换到指定页面
mcp_chrome-devtools_select_page({ pageIdx: 2 })

// 3.3 获取页面快照并查找下载按钮
mcp_chrome-devtools_take_snapshot()

// 3.4 点击PDF下载按钮
mcp_chrome-devtools_click({ uid: "PDF下载按钮的UID" })
```

**循环处理模式**:
```python
for pageIdx in range(起始页, 结束页):
    select_page(pageIdx)
    take_snapshot()
    click(PDF下载按钮UID)
```

---

## 🚧 遇到的主要障碍与解决方案

### 障碍1: 知网页面无法直接跳转到指定页码

**问题**: 通过URL参数`curpage=N`无法直接跳转到第N页

**解决方案**:
```javascript
// 方法1: 使用JavaScript连续点击"下一页"
async () => {
  for (let i = 0; i < 9; i++) {  // 跳转9次到达第10页
    const nextButtons = Array.from(document.querySelectorAll('a'))
      .filter(a => a.textContent.includes('下一页'));
    if (nextButtons.length > 0) {
      nextButtons[nextButtons.length - 1].click();
      await new Promise(resolve => setTimeout(resolve, 2000));  // 等待2秒
    }
  }
  return { message: '已到达目标页' };
}

// 方法2: 手动翻页（最可靠）
// 提示用户手动点击页码，然后告知AI继续
```

**经验教训**:
- ✅ 手动翻页最可靠
- ✅ JavaScript循环点击可行但较慢
- ❌ 直接URL跳转不可行（知网限制）

### 障碍2: 下载频率限制与验证码

**问题**: 批量下载时知网触发反爬虫机制，出现验证页面

**现象**:
- 连续下载5-10个文件后出现验证页面
- URL跳转到`bar/verify/index.html`
- 需要人工验证

**解决方案**:
```python
# 策略1: 分批次下载 + 延时
batch_size = 5
delay_seconds = 60

for i in range(0, total, batch_size):
    download_batch(i, i + batch_size)
    sleep(delay_seconds)  # 每批次后暂停

# 策略2: 使用较低的并发数
# 不要一次打开20个页面，改为10个或5个

# 策略3: 监测验证页面
def check_verification_page():
    snapshot = take_snapshot()
    if 'verify' in snapshot or '验证' in snapshot:
        return True
    return False
```

**最佳实践**:
- ✅ 每批次5-10个文件
- ✅ 批次间隔1-2分钟
- ✅ 非高峰时段下载
- ⚠️ 准备处理验证码的方案

### 障碍3: Windows中文路径编码问题

**问题**: PowerShell处理包含中文的文件路径时出现乱码

**失败的尝试**:
```powershell
# ❌ 失败: PowerShell Move-Item
Move-Item "*.pdf" "目标文件夹（中文括号）"

# ❌ 失败: CMD move命令
cmd /c move "*.pdf" "目标文件夹"

# ❌ 失败: robocopy
robocopy "源文件夹" "目标文件夹"
```

**成功的解决方案**:
```python
# ✅ 使用Python处理文件操作
import os, shutil, time
from pathlib import Path

downloads = Path(os.environ['USERPROFILE']) / 'Downloads'
target = Path(r'目标路径（使用中文括号）')
target.mkdir(parents=True, exist_ok=True)

# 移动最近下载的文件
cutoff_time = time.time() - 1800  # 最近30分钟
for pdf_file in downloads.glob('*.pdf'):
    if pdf_file.stat().st_mtime > cutoff_time:
        dest = target / pdf_file.name
        shutil.move(str(pdf_file), str(dest))
        print(f'OK: {pdf_file.name}')
```

**关键要点**:
- ✅ 使用Python的`pathlib`和`shutil`
- ✅ 使用原始字符串`r'...'`处理路径
- ✅ 注意中文括号`（）`vs 英文括号`()`
- ✅ 避免在终端输出中文（改用英文或ASCII）

### 障碍4: Snapshot过期问题

**问题**: 点击操作时提示快照过期（Stale snapshot）

**解决方案**:
```python
# 在每次点击前重新获取快照
def safe_click(element_uid):
    take_snapshot()  # 刷新快照
    click(element_uid)

# 或者在连续操作中减少依赖快照
# 直接使用evaluate_script执行操作
```

---

## ✅ 成功的策略与最佳实践

### 1. 页面管理策略

**推荐工作流**:
```
1. 打开搜索结果页（Page 1）
2. 批量打开10-20个详情页（Pages 2-21）
3. 逐个切换页面并下载（Page 2 → Page 21）
4. 关闭已下载的详情页（可选）
5. 继续下一批次
```

**页面索引管理**:
```python
# 详情页通常从索引2开始（索引0是about:blank，索引1是搜索页）
detail_page_start = 2
detail_page_end = detail_page_start + num_articles

for pageIdx in range(detail_page_start, detail_page_end):
    select_page(pageIdx)
    # ... 下载操作
```

### 2. 文件管理策略

**目录结构**:
```
项目根目录/
├── # 系统科学资源/
│   └── 文献PDF/
│       └── 钱学森-作者-相关资料（总库299）/
│           ├── 1-20/
│           ├── 21-40/
│           ├── ...
│           └── 181-200/
├── move_pdfs.py          # 文件移动脚本
├── check_progress.py      # 进度检查脚本
└── download_progress.json # 进度数据
```

**文件命名规则**:
- 知网自动命名：`文章标题_作者名.pdf`
- 保持原始文件名，便于识别

### 3. 进度跟踪策略

**进度检查脚本**:
```python
# 1. 统计各文件夹PDF数量
# 2. 与预期数量比对
# 3. 生成缺失报告
# 4. 保存JSON格式数据
```

**报告格式**:
- Markdown格式（用户友好）
- JSON格式（程序处理）
- 包含优先级排序

### 4. 错误处理策略

```python
# 捕获常见错误
try:
    click(button_uid)
except StaleSnapshotError:
    take_snapshot()
    click(button_uid)
except VerificationRequired:
    log("需要验证码")
    pause_and_wait()
except DownloadFailed:
    retry_later()
```

---

## 🛠️ 关键技术点

### 1. Chrome DevTools MCP核心函数

| 函数 | 用途 | 频率 |
|------|------|------|
| `new_page(url)` | 打开新页面 | 初始化 |
| `list_pages()` | 列出所有页面 | 频繁 |
| `select_page(idx)` | 切换页面 | 频繁 |
| `take_snapshot()` | 获取页面快照 | 频繁 |
| `click(uid)` | 点击元素 | 频繁 |
| `evaluate_script(js)` | 执行JavaScript | 中等 |
| `navigate_page(url)` | 页面导航 | 中等 |

### 2. JavaScript辅助脚本

```javascript
// 提取链接
() => {
  const elements = document.querySelectorAll('selector');
  return Array.from(elements).map(el => ({
    text: el.textContent.trim(),
    href: el.href
  }));
}

// 批量打开链接
(links) => {
  links.forEach(link => window.open(link.href, '_blank'));
  return `opened ${links.length} pages`;
}

// 页面滚动（如需加载动态内容）
async () => {
  window.scrollTo(0, document.body.scrollHeight);
  await new Promise(r => setTimeout(r, 2000));
  return 'scrolled';
}
```

### 3. Python文件操作

```python
from pathlib import Path
import shutil, time

# 使用pathlib处理路径
base = Path(r'基础路径')
target = base / '子文件夹'
target.mkdir(parents=True, exist_ok=True)

# 按时间筛选文件
cutoff = time.time() - 1800  # 30分钟内
recent_files = [f for f in Path('Downloads').glob('*.pdf') 
                if f.stat().st_mtime > cutoff]

# 移动文件
for file in recent_files:
    shutil.move(str(file), str(target / file.name))
```

---

## 📊 性能与效率

### 时间消耗分析

| 操作 | 单次耗时 | 批量(20个) | 优化建议 |
|------|---------|-----------|----------|
| 打开详情页 | 2-3秒 | 并行打开 | 批量执行 |
| 获取快照 | 1-2秒 | 20-40秒 | 必需步骤 |
| 点击下载 | 1秒 | 20秒 | 连续执行 |
| 文件下载 | 3-5秒 | 60-100秒 | 后台进行 |
| 移动文件 | <1秒 | <5秒 | 批量处理 |

**总计**: 下载20篇文献约需5-10分钟（不含验证码延迟）

### 效率优化建议

1. **并行化**: 批量打开详情页
2. **流水线**: 下载时同时打开下一批页面
3. **缓存**: 保存已下载文件列表，避免重复
4. **断点续传**: 记录进度，支持中断后继续

---

## ⚠️ 注意事项与风险

### 1. 法律与伦理
- ✅ 仅用于学术研究
- ✅ 遵守知网服务条款
- ❌ 不用于商业目的
- ❌ 不过度频繁请求

### 2. 技术风险
- ⚠️ IP可能被临时封禁
- ⚠️ 账号可能被限制
- ⚠️ 验证码增加延迟
- ⚠️ 页面结构可能变化

### 3. 数据风险
- 💾 定期备份已下载文件
- 💾 保存进度数据（JSON）
- 💾 记录失败的文献ID

---

## 📝 检查清单

### 开始前
- [ ] 确认Chrome DevTools MCP已连接
- [ ] 确认知网账号可用
- [ ] 确认有足够的磁盘空间
- [ ] 准备好目标文件夹路径

### 执行中
- [ ] 监控下载进度
- [ ] 检查验证码页面
- [ ] 观察文件下载到Downloads文件夹
- [ ] 定期移动文件到目标文件夹

### 完成后
- [ ] 检查文件数量是否正确
- [ ] 生成进度报告
- [ ] 保存进度数据（JSON）
- [ ] 关闭浏览器标签页

---

## 🔄 可复用的代码模板

### 模板1: 批量下载主流程

```python
def batch_download_cnki(start_article, end_article, target_folder):
    """
    批量下载CNKI文献
    
    Args:
        start_article: 起始文章序号
        end_article: 结束文章序号
        target_folder: 目标文件夹
    """
    # 1. 导航到搜索结果页面
    navigate_to_search_page()
    
    # 2. 翻页到目标页面
    page_number = (start_article - 1) // 20 + 1
    navigate_to_page(page_number)
    
    # 3. 提取文献链接
    links = extract_article_links(start_article, end_article)
    
    # 4. 批量打开详情页
    open_detail_pages(links)
    
    # 5. 逐个下载PDF
    for i, link in enumerate(links):
        page_idx = 2 + i  # 详情页从索引2开始
        download_pdf(page_idx)
        
        # 每5个暂停一下
        if (i + 1) % 5 == 0:
            time.sleep(60)
    
    # 6. 移动文件到目标文件夹
    move_downloaded_files(target_folder)
    
    # 7. 检查下载结果
    check_download_results(target_folder, end_article - start_article + 1)
```

### 模板2: 进度检查脚本

```python
def check_download_progress(base_path, groups):
    """
    检查下载进度
    
    Args:
        base_path: 基础路径
        groups: [(start, end, folder_name), ...]
    
    Returns:
        dict: 进度统计数据
    """
    results = []
    total_downloaded = 0
    total_expected = 0
    
    for start, end, folder_name in groups:
        folder_path = base_path / folder_name
        expected = end - start + 1
        total_expected += expected
        
        if folder_path.exists():
            downloaded = len(list(folder_path.glob('*.pdf')))
            total_downloaded += downloaded
            results.append({
                'range': folder_name,
                'downloaded': downloaded,
                'expected': expected,
                'missing': expected - downloaded
            })
    
    return {
        'total_downloaded': total_downloaded,
        'total_expected': total_expected,
        'completion_rate': total_downloaded / total_expected * 100,
        'groups': results
    }
```

### 模板3: 文件移动脚本

```python
def move_recent_pdfs(source_dir, target_dir, minutes=30):
    """
    移动最近下载的PDF文件
    
    Args:
        source_dir: 源目录（通常是Downloads）
        target_dir: 目标目录
        minutes: 时间窗口（分钟）
    """
    from pathlib import Path
    import shutil, time
    
    source = Path(source_dir)
    target = Path(target_dir)
    target.mkdir(parents=True, exist_ok=True)
    
    cutoff_time = time.time() - (minutes * 60)
    moved_count = 0
    
    for pdf_file in source.glob('*.pdf'):
        if pdf_file.stat().st_mtime > cutoff_time:
            dest = target / pdf_file.name
            shutil.move(str(pdf_file), str(dest))
            moved_count += 1
    
    return moved_count
```

---

## 📚 相关资源

### 文档
- Chrome DevTools Protocol 文档
- CNKI API参考（如有）
- Python pathlib 文档

### 工具
- Chrome DevTools MCP
- Python 3.x
- CAJViewer (用于验证PDF可读性)

### 脚本文件
- `move_pdfs.py` - 文件移动
- `check_progress.py` - 进度检查
- `download_progress.json` - 进度数据

---

## 🎓 经验总结

### 成功要素
1. ✅ **分批次处理**: 避免一次性处理过多文件
2. ✅ **充分延时**: 给系统足够的响应时间
3. ✅ **错误处理**: 准备好应对各种异常情况
4. ✅ **进度跟踪**: 实时了解完成情况
5. ✅ **文件管理**: 有序组织下载的文件

### 失败教训
1. ❌ 过快的下载速度导致封禁
2. ❌ 没有处理验证码页面
3. ❌ Windows编码问题未提前考虑
4. ❌ 快照过期未及时刷新

### 改进方向
1. 🔄 实现自动验证码识别
2. 🔄 使用代理池分散请求
3. 🔄 增加下载失败的自动重试
4. 🔄 实现更智能的频率控制算法

---

## 💡 未来优化建议

### 技术优化
- 实现断点续传功能
- 添加GUI界面
- 支持配置文件
- 增加日志记录

### 功能扩展
- 支持其他文献数据库（万方、维普等）
- 批量下载引文
- 自动提取文献元数据
- 生成文献管理清单

---

**文档版本**: v1.0  
**最后更新**: 2025-10-19  
**适用场景**: CNKI文献批量下载，可扩展至其他学术数据库

**建议**: 根据实际使用情况持续更新此文档。

