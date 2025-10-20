// 知网批量打开详情页脚本 - 在知网列表页按F12打开控制台，粘贴此代码并回车（手动执行）

(function() {
    console.log('=== 知网批量打开详情页 ===');
    console.log('等待页面加载...');
    
    // 等待页面加载完成
    if (document.readyState === 'complete') {
        执行批量打开();
    } else {
        window.addEventListener('load', 执行批量打开);
    }
    
    function 执行批量打开() {
        console.log('开始提取文章链接...');
        
        // 获取所有文章行
        const 文章行列表 = document.querySelectorAll('tbody tr');
        const 文章链接 = [];
        
        文章行列表.forEach((行) => {
            const 序号单元格 = 行.querySelector('td.seq');
            const 标题链接 = 行.querySelector('td.name a.fz14');
            
            if (序号单元格 && 标题链接) {
                const 文章序号 = parseInt(序号单元格.textContent.trim());
                const 文章标题 = 标题链接.textContent.trim();
                const 详情页链接 = 标题链接.href;
                
                文章链接.push({
                    序号: 文章序号,
                    标题: 文章标题,
                    链接: 详情页链接
                });
            }
        });
        
        if (文章链接.length === 0) {
            alert('❌ 未找到文章！\n请确保在知网搜索结果页面运行此脚本。');
            console.error('未找到文章，页面可能未正确加载');
            return;
        }
        
        console.log(`✓ 找到 ${文章链接.length} 篇文章`);
        
        // 确认对话框
        const 确认信息 = `准备打开 ${文章链接.length} 个详情页\n\n` +
                       `范围：第 ${文章链接[0].序号} - ${文章链接[文章链接.length-1].序号} 篇\n\n` +
                       `是否继续？`;
        
        if (!confirm(确认信息)) {
            console.log('❌ 用户取消操作');
            return;
        }
        
        console.log(`\n🚀 开始批量打开 ${文章链接.length} 个详情页...`);
        
        // 批量打开（间隔150ms避免浏览器拦截）
        文章链接.forEach((文章, 索引) => {
            setTimeout(() => {
                console.log(`[${索引 + 1}/${文章链接.length}] 打开第${文章.序号}篇: ${文章.标题}`);
                window.open(文章.链接, '_blank');
            }, 索引 * 150);
        });
        
        console.log(`\n✅ 已触发打开 ${文章链接.length} 个页面`);
        console.log('💡 提示：等待所有页面加载完成后再下载PDF');
        
        // 完成提示
        setTimeout(() => {
            alert(`✅ 批量打开完成！\n\n共打开 ${文章链接.length} 个详情页\n\n下一步：\n1. 等待所有页面加载完成\n2. 逐个点击"PDF下载"按钮`);
        }, 文章链接.length * 150 + 1000);
    }
    
})();

